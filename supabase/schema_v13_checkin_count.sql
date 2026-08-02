-- =========================================================
-- DRESS CODE TOKYO — 複数枚まとめ買いに対応した入場確認
-- ---------------------------------------------------------
-- Supabase の SQL Editor に貼って Run するだけ。
--
-- 直す問題：
--   カートでは1つの商品を2枚、3枚…と増やして買える（js/cart.js）が、
--   購入記録（purchases）は1回の決済につき1行しか作られず、
--   受付コード（entry_code）も1つしか発行していなかった。
--   そのため「3人分まとめて買った人」が当日受付に来ても、
--     1人目 → 入場OK
--     2人目 → 「入場済みです」
--     3人目 → 「入場済みです」
--   となり、お金を払っているのに2人目以降が入れなかった。
--   （現場では「入場済み」が頻発するので、スタッフがその表示を
--     信用しなくなり、本当の使い回しも見逃すようになる、という副作用もある）
--
-- 対応：
--   purchases に「何人分か（quantity）」と「何人入場したか（checked_in_count）」を持たせ、
--   人数に達するまで同じコードで入場できるようにする。
--   カウントの増減は下の関数の中で行ロック付きでやるので、
--   受付が複数台に分かれていて同時にスキャンしても二重にカウントされない。
-- =========================================================

alter table public.purchases
  add column if not exists quantity int not null default 1;

alter table public.purchases
  add column if not exists checked_in_count int not null default 0;

comment on column public.purchases.quantity is 'この購入に含まれる点数（＝何人分入場できるか）。api/checkout.js が保存する。';
comment on column public.purchases.checked_in_count is '当日すでに入場した人数。quantity に達すると、それ以上は入場できない。';

-- 既にチェックイン済みの行（この変更より前のデータ）は1人入場済みとして扱う
update public.purchases
   set checked_in_count = 1
 where checked_in_at is not null
   and checked_in_count = 0;

-- =========================================================
-- 入場処理：見つかったら1人分カウントを増やして、その結果を返す
-- ---------------------------------------------------------
-- select ... for update で行をロックしてから更新するので、
-- 同じコードを2台の端末で同時に読んでも、入場できるのは残り人数分だけになる。
--
-- 戻り値の admitted:
--   true  … 今回の1人を入場させた
--   false … すでに人数分すべて入場済み（＝使い回しの可能性）
-- 行が1つも返らない場合は「そのコードの支払い済み購入が無い」。
-- =========================================================
create or replace function public.checkin_entry(p_code text)
returns table (
  id uuid,
  user_id uuid,
  ticket_name text,
  quantity int,
  checked_in_count int,
  checked_in_at timestamptz,
  admitted boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.purchases%rowtype;
  v_admitted boolean := false;
begin
  -- for update でこの行をロックする。ロックを取れるのは一度に1リクエストだけなので、
  -- 受付が複数台あって同時に同じコードを読んでも、順番に処理されて二重に数えない。
  select * into v_row
    from public.purchases p
   where p.entry_code = p_code
     and p.status = 'paid'
   for update;

  if not found then
    return; -- 0行 → 呼び出し側で「無効なコード」として扱う
  end if;

  if v_row.checked_in_count < v_row.quantity then
    update public.purchases
       set checked_in_count = v_row.checked_in_count + 1,
           -- checked_in_at は「最初に入場した時刻」として残す
           checked_in_at = coalesce(v_row.checked_in_at, now())
     where purchases.id = v_row.id
     returning * into v_row;
    v_admitted := true;
  end if;

  return query select
    v_row.id, v_row.user_id, v_row.ticket_name,
    v_row.quantity, v_row.checked_in_count, v_row.checked_in_at, v_admitted;
end;
$$;

-- =========================================================
-- 取り消し：1人分だけ戻す（スタッフの誤操作を戻すため）
-- 0人になったら checked_in_at も消して、一覧から消えるようにする。
-- =========================================================
create or replace function public.undo_checkin(p_id uuid)
returns table (
  id uuid,
  checked_in_count int,
  checked_in_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.purchases%rowtype;
  v_next int;
begin
  select * into v_row from public.purchases p where p.id = p_id for update;
  if not found then
    return;
  end if;

  v_next := greatest(v_row.checked_in_count - 1, 0);

  update public.purchases
     set checked_in_count = v_next,
         checked_in_at = case when v_next = 0 then null else v_row.checked_in_at end
   where purchases.id = v_row.id
   returning * into v_row;

  return query select v_row.id, v_row.checked_in_count, v_row.checked_in_at;
end;
$$;

-- この2つの関数は service role（api/admin-checkin.js）からだけ呼べればよい。
-- security definer なので、誰でも呼べる状態のままだとRLSを迂回して
-- 入場記録を書き換えられてしまう。明示的に取り上げておく。
revoke execute on function public.checkin_entry(text) from public, anon, authenticated;
revoke execute on function public.undo_checkin(uuid) from public, anon, authenticated;

-- 同じ理由で、受付コードの連番を発行する関数も取り上げておく
-- （こちらは security definer ではないので現状も実害は無いが、
--   将来 security definer を付けられたときに穴にならないようにするため）。
revoke execute on function public.next_entry_seq(text, text) from public, anon, authenticated;

-- =========================================================
-- 返金に対応する（api/square-webhook.js の refund.created / refund.updated 用）
-- ---------------------------------------------------------
-- Squareで返金しても payment.status は COMPLETED のままなので、
-- 「返金された」という状態を purchases 側に持てるようにする。
-- 返金が確定したら status を 'refunded' にして entry_code を消し、
-- その受付コードでは入場できないようにする。
-- =========================================================
alter table public.purchases
  drop constraint if exists purchases_status_check;

alter table public.purchases
  add constraint purchases_status_check
  check (status in ('initiated', 'paid', 'canceled', 'refunded'));
