-- =========================================================
-- DRESS CODE TOKYO — お知らせにHTML本文（画像等）を保存できるようにする
-- ---------------------------------------------------------
-- Supabase の SQL Editor に貼って Run するだけ。
--
-- 背景:
--   /console の配信エディタでは画像・見出し・ボタンなどをブロックで組み立てられるが、
--   これまで notifications / announcements テーブルには「プレーンテキスト版」（body列）
--   しか保存していなかった。そのためメールには画像がちゃんと届くのに、
--   サイトの通知ドロワーや個人宛て送信履歴では画像が表示されない
--   （[画像: ...] という文字列にしかならない）という食い違いが起きていた。
--
-- 対応:
--   body_html 列を追加し、メールと同じ renderBlocks() のHTML出力をここにも保存する。
--   フロント側は body_html があればそれを、無ければ従来通り body（プレーンテキスト）を表示する
--   （body_html が null になるのは、このマイグレーション以前に送られた過去のお知らせ、
--    および購入完了/キャンセル通知のようにブロックを使わない単純なテキスト通知）。
-- =========================================================

alter table public.notifications add column if not exists body_html text;
alter table public.announcements add column if not exists body_html text;

comment on column public.notifications.body_html is 'ブロックエディタで作成した本文のHTML版（画像・見出し・ボタン等を含む）。nullなら body（プレーンテキスト）を表示する。';
comment on column public.announcements.body_html is 'ブロックエディタで作成した本文のHTML版（画像・見出し・ボタン等を含む）。nullなら body（プレーンテキスト）を表示する。';
