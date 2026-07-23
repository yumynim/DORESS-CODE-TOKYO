-- =========================================================
-- DRESS CODE TOKYO — カート決済（Square）連携用の追加スキーマ
-- ---------------------------------------------------------
-- schema.sql を実行済みの上で、これを追加で実行してください（SQL Editorに貼って Run）。
--
-- 追加する内容：
--   1. purchases に square_order_id / square_checkout_id を追加
--      → Webhookが「どの購入記録を paid にすればいいか」を突き止めるための紐付け用
--   2. purchases に items（購入した商品の内訳）を追加
--      → カートは複数商品をまとめて買えるので、1行に複数アイテムをJSONで保存する
--   3. Webhook（サーバー側の service role）だけが status を更新できるポリシーを追加
--      → クライアントから直接 status='paid' に書き換えられないようにする
-- =========================================================

alter table public.purchases
  add column if not exists square_order_id text unique,
  add column if not exists square_checkout_id text,
  add column if not exists items jsonb;

comment on column public.purchases.square_order_id is 'SquareのOrder ID。Webhookが購入記録を特定するためのキー';
comment on column public.purchases.items is '購入した商品の内訳 [{name, price, quantity, catalog_object_id}, ...]';

-- purchases.status を 'paid' / 'canceled' に更新できるのは service role（サーバー側）のみ。
-- クライアント（anon key）からの update は一切許可しない → 支払っていないのに paid にする不正を防ぐ。
drop policy if exists "purchases_update_service_only" on public.purchases;
create policy "purchases_update_service_only" on public.purchases
  for update using (auth.role() = 'service_role');
