-- =========================================================
-- DRESS CODE TOKYO — 入場確認用の受付コードを追加
-- ---------------------------------------------------------
-- Supabase の SQL Editor に貼って Run するだけ。
--
-- 背景:
--   当日の受付・入場確認のために、購入者ごとに一意な確認コードが欲しい。
--
-- 対応:
--   purchases.entry_code 列（文字列。「DCT-購入日-ランダム4文字」の形式、
--   例: DCT-20260802-7K4M）を追加。
--   支払いが完了(status='paid')した時点で api/square-webhook.js が生成して埋める
--   （申し込み直後のstatus='initiated'の段階ではまだ発行しない）。
--   一意性はDB側のユニークインデックスで保証する（衝突時はAPI側でリトライして別の値を割り当てる）。
-- =========================================================

alter table public.purchases add column if not exists entry_code text;

create unique index if not exists purchases_entry_code_key
  on public.purchases (entry_code)
  where entry_code is not null;

comment on column public.purchases.entry_code is '当日の入場確認用コード（「DCT-購入日-ランダム4文字」形式）。支払い完了時にAPI側で発行。';
