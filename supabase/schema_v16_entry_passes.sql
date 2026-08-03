-- =========================================================
-- DRESS CODE TOKYO — 受付コードを「1人1コード」方式に変更する
-- ---------------------------------------------------------
-- Supabase の SQL Editor に貼って Run するだけ。schema_v15 まで実行済みであること。
-- 何度実行しても同じ結果になる。
--
-- ■ なぜ変えるか
--   これまでは「1回の購入＝1コード」で、まとめ買い（数量2）のときは同じQRを
--   人数分読み取って数える方式だった。この方式には使いにくさと危うさがある：
--     ・2人が別々に会場に来ると、1つのQRを2人で共有しないといけない
--     ・「同じQRをもう一度読む」という操作自体が、読み間違い・数え間違いの温床
--   そこで、数量2で買ったら別々のコードを2つ発行し、1コード＝1人＝1回入場にする。
--   「何人目か」を数える必要が無くなるので、受付の判断は「このコードは
--   入場済みか、まだか」の二択だけになる。
--
-- ■ このファイルでやること
--   1. entry_passes テーブル（1行＝1人分の入場権）を作る
--   2. 発行・入場・取り消しの3関数を作る（すべて行ロック付きで多重実行に安全）
--   3. 旧方式の関数（checkin_entry / undo_checkin）を削除する
--   4. 権限を整える（会員は自分のコードを見るだけ。書き込みはサーバーのみ）
--   5. 旧方式で発行済みのコードがあれば新テーブルに移す
-- =========================================================

-- ---------- 1. テーブル ----------
create table if not exists public.entry_passes (
  id                  uuid primary key default gen_random_uuid(),
  purchase_id         uuid not null references public.purchases(id) on delete cascade,
  user_id             uuid not null,
  code                text not null unique,
  status              text not null default 'valid' check (status in ('valid', 'revoked')),
  checked_in_at       timestamptz,
  checkin_request_id  text,
  created_at          timestamptz not null default now()
);

comment on table public.entry_passes is '入場権。1行＝1人分。まとめ買いすると購入1件に対して数量分の行ができる。';
comment on column public.entry_passes.code is '受付コード（DCT-イベント-カテゴリ連番-ランダム4文字）。1コード1回しか入場できない。';
comment on column public.entry_passes.status is 'revoked = 返金などで無効化済み。無効化されたコードでは入場できない。';
comment on column public.entry_passes.checkin_request_id is 'この入場を確定させた読み取りのID。通信のやり直しで二重処理しないために使う。';

create index if not exists entry_passes_purchase_id_idx on public.entry_passes (purchase_id);
create index if not exists entry_passes_user_id_idx on public.entry_passes (user_id);

-- ---------- 2a. 発行 ----------
-- Squareの決済完了Webhookから呼ぶ。購入行をロックしてから発行するので、
-- Squareが同じ通知を再送して2つの処理が同時に走っても、二重発行にならない
-- （2つ目は既に発行済みのコードをそのまま返す）。
-- 引数構成が変わっても古い版が残らないように、先に消しておく
drop function if exists public.issue_entry_passes(uuid, text, text);

-- p_categories には「1枚ごとのカテゴリ」の配列を渡せる（例: {S,N,N} = 出店1＋入場2）。
-- 渡された場合は枚数も配列の長さに従う。渡されない場合（古い購入など）は
-- purchases.quantity 枚をすべて p_category で発行する。
create or replace function public.issue_entry_passes(p_purchase_id uuid, p_event text, p_category text, p_categories text[] default null)
returns setof text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.purchases%rowtype;
  v_qty int;
  v_cat text;
  v_seq bigint;
  v_code text;
  v_alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; -- 0/O, 1/I/L を除いた31文字
  v_bytes bytea;
  v_suffix text;
  v_done boolean;
begin
  select * into v_purchase from public.purchases p where p.id = p_purchase_id for update;
  if not found or v_purchase.status <> 'paid' then
    return; -- 支払い済みでない購入には発行しない
  end if;

  -- 既に発行済みなら、それをそのまま返す（Webhook再送への対応）。
  -- 並び順は「短いコードが先」＝連番の数字順（created_at は同一トランザクション内で
  -- 全行同じ時刻になるため並び替えに使えない。文字列順だと N10 が N2 より前に来てしまう）。
  if exists (select 1 from public.entry_passes ep where ep.purchase_id = p_purchase_id) then
    return query
      select ep.code from public.entry_passes ep
       where ep.purchase_id = p_purchase_id
       order by length(ep.code), ep.code;
    return;
  end if;

  v_qty := coalesce(array_length(p_categories, 1), greatest(coalesce(v_purchase.quantity, 1), 1));

  for n in 1..v_qty loop
    v_cat := coalesce(p_categories[n], p_category);
    -- 連番は1人ごとに1つ進める（2枚買えば N1 と N2 になる）
    select public.next_entry_seq(p_event, v_cat) into v_seq;

    -- ランダム4文字。gen_random_uuid() のバイト列から作る（暗号学的に強い乱数源）。
    -- ユニーク制約と衝突したらランダム部分だけ引き直す。
    v_done := false;
    for attempt in 1..5 loop
      v_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
      v_suffix := '';
      for i in 0..3 loop
        v_suffix := v_suffix || substr(v_alphabet, (get_byte(v_bytes, i) % 31) + 1, 1);
      end loop;
      v_code := format('DCT-%s-%s%s-%s', p_event, v_cat, v_seq, v_suffix);
      begin
        insert into public.entry_passes (purchase_id, user_id, code)
        values (p_purchase_id, v_purchase.user_id, v_code);
        v_done := true;
        exit;
      exception when unique_violation then
        -- 引き直して再挑戦
      end;
    end loop;
    if not v_done then
      raise exception 'entry code collision: could not generate a unique code for purchase %', p_purchase_id;
    end if;
  end loop;

  return query
    select ep.code from public.entry_passes ep
     where ep.purchase_id = p_purchase_id
     order by length(ep.code), ep.code;
end;
$$;

-- ---------- 2b. 入場 ----------
-- 1コード1回。2回目以降は admitted = false（入場済み）を返す。
-- 同じ読み取りのやり直し（p_request_id が一致）だけは、前回の結果をそのまま返す。
create or replace function public.checkin_pass(p_code text, p_request_id text default null)
returns table (
  pass_id uuid,
  purchase_id uuid,
  user_id uuid,
  ticket_name text,
  code text,
  checked_in_at timestamptz,
  admitted boolean,
  group_total int,
  group_used int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pass public.entry_passes%rowtype;
  v_ticket text;
  v_admitted boolean := false;
  v_total int;
  v_used int;
begin
  -- 行ロック。受付が複数台で同時に同じコードを読んでも、順番に処理される。
  select ep.* into v_pass
    from public.entry_passes ep
    join public.purchases p on p.id = ep.purchase_id
   where ep.code = p_code
     and ep.status = 'valid'
     and p.status = 'paid'
   for update of ep;

  if not found then
    return; -- 0行 → 呼び出し側で「無効なコード」として扱う
  end if;

  select p.ticket_name into v_ticket from public.purchases p where p.id = v_pass.purchase_id;

  if v_pass.checked_in_at is null then
    update public.entry_passes ep
       set checked_in_at = now(),
           checkin_request_id = p_request_id
     where ep.id = v_pass.id
     returning * into v_pass;
    v_admitted := true;
  elsif p_request_id is not null and v_pass.checkin_request_id = p_request_id then
    v_admitted := true; -- 同じ読み取りのやり直し。二重入場ではない
  end if;

  -- 同じ購入の残り枚数（受付で「同行者の分があと◯枚」を出すため）
  select count(*)::int, count(ep.checked_in_at)::int
    into v_total, v_used
    from public.entry_passes ep
   where ep.purchase_id = v_pass.purchase_id
     and ep.status = 'valid';

  return query select
    v_pass.id, v_pass.purchase_id, v_pass.user_id, v_ticket,
    v_pass.code, v_pass.checked_in_at, v_admitted, v_total, v_used;
end;
$$;

-- ---------- 2c. 取り消し ----------
create or replace function public.undo_pass(p_pass_id uuid)
returns table (pass_id uuid, code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pass public.entry_passes%rowtype;
begin
  select * into v_pass from public.entry_passes ep where ep.id = p_pass_id for update;
  if not found then
    return;
  end if;

  update public.entry_passes ep
     set checked_in_at = null,
         checkin_request_id = null
   where ep.id = v_pass.id
   returning * into v_pass;

  return query select v_pass.id, v_pass.code;
end;
$$;

-- ---------- 3. 旧方式の関数を削除 ----------
-- api/admin-checkin.js は新しい関数（checkin_pass / undo_pass）だけを呼ぶ。
-- 古い関数を残すと、どちらが本物か分からなくなるので消す。
drop function if exists public.checkin_entry(text, text);
drop function if exists public.checkin_entry(text);
drop function if exists public.undo_checkin(uuid);

-- ---------- 4. 権限 ----------
-- 会員は自分のコードを見るだけ（マイページに表示するため）。書き込みはサーバーのみ。
alter table public.entry_passes enable row level security;

drop policy if exists entry_passes_select_own on public.entry_passes;
create policy entry_passes_select_own on public.entry_passes
  for select using (auth.uid() = user_id);

-- Supabaseは新しいテーブルに全権限を配ってしまうので、書き込み系は明示的に取り上げる
revoke insert, update, delete on public.entry_passes from anon, authenticated;
revoke all on public.entry_passes from public;
grant select on public.entry_passes to authenticated;
grant all on public.entry_passes to service_role;

revoke execute on function public.issue_entry_passes(uuid, text, text, text[]) from public, anon, authenticated;
revoke execute on function public.checkin_pass(text, text)                     from public, anon, authenticated;
revoke execute on function public.undo_pass(uuid)                              from public, anon, authenticated;

grant execute on function public.issue_entry_passes(uuid, text, text, text[]) to service_role;
grant execute on function public.checkin_pass(text, text)                     to service_role;
grant execute on function public.undo_pass(uuid)                              to service_role;

-- ---------- 5. 旧方式で発行済みのコードを新テーブルへ移す ----------
-- 過去に purchases.entry_code に発行された分（テスト購入など）を1件ずつ移す。
-- 旧方式のまとめ買い（1コードで2人分）は移行後「1コード1回」になるが、
-- 該当する本番販売はまだ無い前提（あれば手動で追加発行する）。
insert into public.entry_passes (purchase_id, user_id, code, checked_in_at)
select p.id, p.user_id, p.entry_code, p.checked_in_at
  from public.purchases p
 where p.status = 'paid'
   and p.entry_code is not null
   and not exists (select 1 from public.entry_passes ep where ep.code = p.entry_code);

-- =========================================================
-- 確認用。期待する結果：
--   ・3関数とも service_role の has_execute が true、anon / authenticated が false
-- =========================================================
select
  p.proname                                            as function_name,
  pg_get_function_identity_arguments(p.oid)            as args,
  r.rolname                                            as role_name,
  has_function_privilege(r.rolname, p.oid, 'EXECUTE')  as has_execute
from pg_proc p
cross join (values ('service_role'), ('authenticated'), ('anon')) as r(rolname)
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('issue_entry_passes', 'checkin_pass', 'undo_pass')
order by p.proname, r.rolname;
