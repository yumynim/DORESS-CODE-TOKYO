-- =========================================================
-- DRESS CODE TOKYO — 当日の入場チェックイン記録を追加
-- ---------------------------------------------------------
-- Supabase の SQL Editor に貼って Run するだけ。
--
-- 背景:
--   受付コード（entry_code）をQRコード化して当日スタッフが読み取り、
--   入場済みかどうかをその場で判定できるようにしたい。
--   同じコードを2回読み取っても「入場済み」を正しく検知できるよう、
--   チェックインした時刻を記録する。
--
-- 対応:
--   purchases.checked_in_at 列（チェックインした日時。未チェックインはnull）を追加。
--   api/admin-checkin.js がここを読み書きする（service role経由のみ、RLSでの直接書き込みは許可しない）。
-- =========================================================

alter table public.purchases add column if not exists checked_in_at timestamptz;

comment on column public.purchases.checked_in_at is '当日の入場チェックイン時刻。QRコード（entry_code）読み取り時にAPI側で記録。未チェックインはnull。';
