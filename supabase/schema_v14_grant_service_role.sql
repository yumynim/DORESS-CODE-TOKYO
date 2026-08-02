-- =========================================================
-- DRESS CODE TOKYO — サーバー（service_role）に関数の実行権限を明示的に与える
-- ---------------------------------------------------------
-- Supabase の SQL Editor に貼って Run するだけ。schema_v13 を実行した後に必ず実行すること。
--
-- なぜ必要か：
--   schema_v13 の最後で
--     revoke execute on function ... from public, anon, authenticated;
--   としている。これは「ブラウザから直接これらの関数を呼べないようにする」ためだが、
--   Postgresの権限の仕組み上、`public` からの revoke は
--   「public 経由で権限をもらっていた全ロール」に影響する。
--
--   Supabaseは通常 service_role にも個別に権限を配っている想定なので、
--   おそらく service_role は影響を受けない。ただし「おそらく」で済ませると、
--   もし外れていた場合に起きることが深刻すぎる：
--     ・next_entry_seq が呼べない → 決済は通るのに受付コードが発行されない
--     ・checkin_entry が呼べない → 当日、誰もチェックインできない
--   しかもどちらも「本番で実際に決済／入場するまで気づけない」種類の壊れ方をする。
--
--   そこで、推測に頼らず service_role に明示的に権限を与え直しておく。
--   既に権限がある場合、この grant は何も変えない（実行しても害はない）。
-- =========================================================

grant execute on function public.checkin_entry(text) to service_role;
grant execute on function public.undo_checkin(uuid) to service_role;
grant execute on function public.next_entry_seq(text, text) to service_role;

-- =========================================================
-- 確認用：下のSELECTを実行すると、いま誰がこの3つの関数を実行できるかが見られる。
-- 期待する状態:
--   ・service_role が has_execute = true
--   ・anon / authenticated が has_execute = false
-- =========================================================
select
  p.proname                                   as function_name,
  r.rolname                                   as role_name,
  has_function_privilege(r.rolname, p.oid, 'EXECUTE') as has_execute
from pg_proc p
cross join (values ('service_role'), ('authenticated'), ('anon')) as r(rolname)
where p.pronamespace = 'public'::regnamespace
  and p.proname in ('checkin_entry', 'undo_checkin', 'next_entry_seq')
order by p.proname, r.rolname;
