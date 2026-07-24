-- =========================================================
-- DRESS CODE TOKYO — 全体お知らせ（announcements）用スキーマ
-- ---------------------------------------------------------
-- これまでの notifications テーブルは「購入者本人だけ」に届く通知でした。
-- announcements は逆に「ログイン中の会員全員」に届く、DRESS CODE TOKYOからの
-- お知らせ（イベント告知など）です。ヘッダーの通知アイコンの
-- 「ドレスコードからのお知らせ」タブに表示されます。
--
-- 投稿方法（管理画面は未実装のため、今は手動）：
--   Supabase の Table Editor → announcements → Insert row で
--   title / body を入力するだけ（created_at は自動）。
-- =========================================================

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

-- ログイン中の会員なら誰でも読める（全体向けのお知らせのため）
create policy "announcements_select_authenticated" on public.announcements
  for select using (auth.role() = 'authenticated');

-- insert/update/delete のポリシーは意図的に作っていません
-- → 投稿は Supabase ダッシュボード（管理者としてログイン）からのみ行う運用。
--   将来、投稿用の管理画面を作る場合は service role 経由のAPIを別途用意すること。
