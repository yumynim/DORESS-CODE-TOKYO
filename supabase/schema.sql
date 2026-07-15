-- =========================================================
-- DRESS CODE TOKYO — 会員登録・チケット購入履歴 用スキーマ
-- ---------------------------------------------------------
-- 使い方：Supabase プロジェクト作成後、左メニューの SQL Editor を開き、
-- このファイルの中身を貼り付けて実行（Run）するだけ。
--
-- 作られるもの：
--   1. profiles      … 会員のプロフィール（表示名など）
--   2. purchases     … 「誰が・何のチケットを・いつ買ったか」の記録
--
-- 購入の確定（本当に決済が完了したか）は、今の時点では自動連携していません。
-- 現状は「購入ボタンを押した（＝Squareの決済画面を開いた）」時点で status='initiated'
-- として記録されます。Square からの Webhook 連携を後で追加すると、決済完了時に
-- status を 'paid' に自動更新できるようになります（別途実装）。
-- =========================================================

-- ---------- 1. profiles：会員プロフィール ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 本人だけが自分のプロフィールを見られる／編集できる
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- 新規登録時に自動で profiles の行を作る
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- 2. purchases：チケット購入履歴 ----------
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticket_name text not null,
  price integer not null,
  status text not null default 'initiated' check (status in ('initiated', 'paid', 'canceled')),
  square_url text,
  created_at timestamptz not null default now()
);

alter table public.purchases enable row level security;

-- 本人だけが自分の購入履歴を見られる
create policy "purchases_select_own" on public.purchases
  for select using (auth.uid() = user_id);

-- 本人が「購入ボタンを押した」記録を作れる（status は initiated 固定）
create policy "purchases_insert_own" on public.purchases
  for insert with check (auth.uid() = user_id and status = 'initiated');

-- status を 'paid' に更新できるのはサーバー側（service role）のみ。
-- クライアントからの update ポリシーは意図的に作っていません
-- （Square Webhook 連携を実装するときに、service role キーを使うサーバー関数から更新します）。
