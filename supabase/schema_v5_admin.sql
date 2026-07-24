-- =========================================================
-- DRESS CODE TOKYO — お知らせ投稿ページ（管理者）用スキーマ
-- ---------------------------------------------------------
-- schema_v4_announcements.sql を実行済みの上で、これを追加で実行してください。
--
-- 追加する内容：
--   1. profiles.is_admin … 「お知らせを投稿できる人」の目印
--   2. is_admin は本人も含め誰も自分では変更できないようにするトリガー
--      → チームメンバーを管理者にするときは、Supabaseダッシュボード
--        （Table Editor → profiles）から手動で is_admin を true にする。
--        （service role 経由の操作だけがこの値を変更できる）
-- =========================================================

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

comment on column public.profiles.is_admin is 'trueの人だけが admin-announcements.html からお知らせを投稿できる。Supabaseダッシュボードから手動で設定する。';

-- is_admin を本人が勝手に true に書き換えられないようにするガード
-- （profiles_update_own ポリシーは本人によるupdateを許可しているため、
--   is_admin列だけは service role からの変更以外は元の値に戻す）
create or replace function public.guard_profiles_is_admin()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.is_admin is distinct from old.is_admin and auth.role() <> 'service_role' then
    new.is_admin := old.is_admin;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_is_admin on public.profiles;
create trigger profiles_guard_is_admin
  before update on public.profiles
  for each row execute procedure public.guard_profiles_is_admin();
