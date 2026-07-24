-- =========================================================
-- DRESS CODE TOKYO — サイト内通知（お知らせ）用スキーマ
-- ---------------------------------------------------------
-- schema.sql / schema_v2_cart.sql を実行済みの上で、これを追加で実行してください（SQL Editorに貼って Run）。
--
-- 追加する内容：
--   1. notifications テーブル
--      → 決済完了/キャンセル時に Webhook（サーバー側の service role）が1件書き込む。
--        マイページ（members-only.html）の「お知らせ」欄に表示される。
--   2. 本人だけが自分の通知を見られる／既読にできるポリシー
--   3. 挿入は service role のみ（クライアントから直接お知らせを作れないようにする）
-- =========================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid references public.purchases(id) on delete set null,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

-- 本人だけが自分の通知を見られる
create policy "notifications_select_own" on public.notifications
  for select using (auth.uid() = user_id);

-- 本人が自分の通知を既読にできる（マイページを開いたときに使う）
create policy "notifications_update_own" on public.notifications
  for update using (auth.uid() = user_id);

-- insert のポリシーは意図的に作っていません → service role（Webhook）だけが通知を作成できます。
