-- =========================================================
-- DRESS CODE TOKYO — 入場確認まわりの仕上げ（v13の取りこぼし修復も兼ねる）
-- ---------------------------------------------------------
-- Supabase の SQL Editor に貼って Run するだけ。
-- v13 / v14 を実行済みでも未実行でも、これ1本を通せば正しい状態になる
-- （同じものを何度実行しても結果は変わらない）。
--
-- ■ このファイルでやること
--   1. v13 の列追加をやり直す（すでにあれば何もしない）
--   2. 入場処理・取り消し処理の関数を作り直す
--      → v13 実行時に undo_checkin だけ作られていなかったケースを修復する
--   3. 同じ読み取りを2回送っても二重に数えないようにする（下記）
--   4. 権限を整える（ブラウザからは呼べず、サーバーからは呼べる状態にする）
--   5. 返金ステータスを許可する
--
-- ■ 3. の背景
--   会場のWi-Fiが遅いと、スタッフは「反応が無い」と思ってもう一度スキャンする。
--   ところが1回目のリクエストは実際には届いていて、すでに人数を1つ数えていることがある。
--   何も対策しないと、
--     ・1人分の購入 … 2回目が「入場済みです」になり、本人が疑われる
--     ・3人分の購入 … 1人目の受付だけで2枠消費され、3人目が入場できなくなる
--   という事故が起きる。しかも画面上は正常に見えるので誰も気づけない。
--   そこで1回の読み取りごとに端末がランダムなIDを送り、直前と同じIDなら
--   数えずに前回と同じ結果を返す。
-- =========================================================

-- ---------- 1. 列（v13の取りこぼし対策。すでにあれば何もしない） ----------
alter table public.purchases add column if not exists quantity int not null default 1;
alter table public.purchases add column if not exists checked_in_count int not null default 0;
alter table public.purchases add column if not exists last_checkin_request_id text;

comment on column public.purchases.quantity is 'この購入に含まれる点数（＝何人分入場できるか）。api/checkout.js が保存する。';
comment on column public.purchases.checked_in_count is '当日すでに入場した人数。quantity に達すると、それ以上は入場できない。';
comment on column public.purchases.last_checkin_request_id is '直近に処理したチェックイン要求のID。通信のやり直しで二重に数えるのを防ぐために使う。';

-- 既にチェックイン済みの行（この仕組みより前のデータ）は1人入場済みとして扱う
update public.purchases
   set checked_in_count = 1
 where checked_in_at is not null
   and checked_in_count = 0;

-- 過去のまとめ買いに正しい人数を入れ直す（items に残っているカート内容から数え直す）
update public.purchases p
   set quantity = greatest(
         (select coalesce(sum((i ->> 'quantity')::int), 1)
            from jsonb_array_elements(p.items) i),
         1)
 where p.items is not null
   and jsonb_typeof(p.items) = 'array'
   and jsonb_array_length(p.items) > 0;

-- ---------- 2 & 3. 入場処理 ----------
-- 引数が増えるので、古い1引数版があれば先に消しておく
drop function if exists public.checkin_entry(text);

create or replace function public.checkin_entry(p_code text, p_request_id text default null)
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

  -- 同じ読み取りの再送。数えずに、前回この読み取りで通した結果をそのまま返す。
  if p_request_id is not null and v_row.last_checkin_request_id = p_request_id then
    return query select
      v_row.id, v_row.user_id, v_row.ticket_name,
      v_row.quantity, v_row.checked_in_count, v_row.checked_in_at, true;
    return;
  end if;

  if v_row.checked_in_count < v_row.quantity then
    update public.purchases
       set checked_in_count = v_row.checked_in_count + 1,
           -- checked_in_at は「最初に入場した時刻」として残す
           checked_in_at = coalesce(v_row.checked_in_at, now()),
           last_checkin_request_id = p_request_id
     where purchases.id = v_row.id
     returning * into v_row;
    v_admitted := true;
  end if;

  return query select
    v_row.id, v_row.user_id, v_row.ticket_name,
    v_row.quantity, v_row.checked_in_count, v_row.checked_in_at, v_admitted;
end;
$$;

-- ---------- 取り消し：1人分だけ戻す ----------
-- 0人になったら checked_in_at も消して、一覧から消えるようにする。
-- 直前の読み取りIDも消すので、取り消した直後に同じコードを読めばまた数えられる。
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
         checked_in_at = case when v_next = 0 then null else v_row.checked_in_at end,
         last_checkin_request_id = null
   where purchases.id = v_row.id
   returning * into v_row;

  return query select v_row.id, v_row.checked_in_count, v_row.checked_in_at;
end;
$$;

-- ---------- 4. 権限 ----------
-- ブラウザ（anon / authenticated）からは呼べないようにし、
-- サーバー（service_role）からは確実に呼べるようにする。
revoke execute on function public.checkin_entry(text, text) from public, anon, authenticated;
revoke execute on function public.undo_checkin(uuid)        from public, anon, authenticated;
revoke execute on function public.next_entry_seq(text, text) from public, anon, authenticated;

grant execute on function public.checkin_entry(text, text) to service_role;
grant execute on function public.undo_checkin(uuid)        to service_role;
grant execute on function public.next_entry_seq(text, text) to service_role;

-- ---------- 5. 返金ステータスを許可 ----------
alter table public.purchases drop constraint if exists purchases_status_check;
alter table public.purchases
  add constraint purchases_status_check
  check (status in ('initiated', 'paid', 'canceled', 'refunded'));

-- =========================================================
-- 確認用：ここまでが正しく通ったかを見る。
-- 期待する結果:
--   ・checkin_entry / undo_checkin / next_entry_seq の3つが並ぶ
--   ・service_role の has_execute が true
--   ・anon / authenticated の has_execute が false
-- =========================================================
select
  p.proname                                            as function_name,
  pg_get_function_identity_arguments(p.oid)            as args,
  r.rolname                                            as role_name,
  has_function_privilege(r.rolname, p.oid, 'EXECUTE')  as has_execute
from pg_proc p
cross join (values ('service_role'), ('authenticated'), ('anon')) as r(rolname)
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('checkin_entry', 'undo_checkin', 'next_entry_seq')
order by p.proname, r.rolname;
