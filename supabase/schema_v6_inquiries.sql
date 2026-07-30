-- =========================================================
-- DRESS CODE TOKYO — お問い合わせ（サイト内蔵フォーム）用スキーマ
-- ---------------------------------------------------------
-- Supabase の SQL Editor に貼って Run するだけ。
--
-- 作られるもの：
--   inquiries … サイトのお問い合わせフォーム（/api/contact）から送られた内容を保存する。
--               /console の「お問い合わせ」タブから一覧・返信できる。
--
-- status について：
--   'new'     … まだ返信していない
--   'replied' … consoleから返信済み（reply_body / replied_at に記録される）
--   返信するたびに reply_body は最新の内容で上書きされる（履歴は1件分のみ保持）。
-- =========================================================

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  reason text not null,
  name text not null,
  email text not null,
  message text not null,
  status text not null default 'new' check (status in ('new', 'replied')),
  reply_body text,
  replied_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.inquiries is 'サイトのお問い合わせフォーム（/api/contact）から送られた内容。/console から一覧・返信する。';

alter table public.inquiries enable row level security;

-- クライアント（anon key）からの直接アクセスは一切許可しない。
-- 新規保存は api/contact.js が、一覧取得・返信の記録は api/admin-inquiries.js が、
-- どちらも service role 経由でのみ行う（announcements/notifications と同じ考え方）。
-- → ここでは意図的に anon 向けの select/insert/update ポリシーを作らない。
