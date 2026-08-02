-- =========================================================
-- DRESS CODE TOKYO — 受付コードをイベント識別番号ベースに変更
-- ---------------------------------------------------------
-- Supabase の SQL Editor に貼って Run するだけ。
--
-- 背景:
--   受付コードの真ん中の部分が「購入日（YYYYMMDD）」になっていたが、
--   ユーザーからの要望で「イベント識別番号」に変更したい。
--   例: 2026年9月27日開催のイベントなら "0927"、
--       出店者は連番でS1・S2…、来場者はN1・N2…という形式にする。
--   最終的なコードの見た目: DCT-0927-S1-7K4M / DCT-0927-N1-QX52 など
--   （末尾のランダム4文字は、連番だけだと次の人のコードを推測できてしまうため
--    2026-08-03に復活させた。付与は api/square-webhook.js 側で行う）。
--
-- 対応:
--   entry_code_counters テーブルを新設し、イベントID×カテゴリ（S/N等）
--   ごとに「次に割り当てる番号」を持たせる。
--   next_entry_seq() 関数で「現在の番号を返しつつ次の番号へ進める」処理を
--   アトミックに行う（同時に複数の決済が完了しても番号が重複しないように）。
--   呼び出し側（api/square-webhook.js）は
--     select next_entry_seq('0927', 'S');
--   のようにRPCとして呼ぶ。
-- =========================================================

create table if not exists public.entry_code_counters (
  event_id text not null,
  category text not null,
  next_seq int not null default 1,
  primary key (event_id, category)
);

comment on table public.entry_code_counters is 'イベントID×カテゴリ(S=出店者/N=来場者等)ごとの、次に発行する受付番号のカウンター。';

-- クライアント（anon/authenticated）からは一切触らせない。service role（Vercel Functions側）のみが
-- 使うテーブルなので、ポリシーは一つも作らずRLSを有効化するだけで全面ブロックする
-- （purchases.status等、他のテーブルと同じ考え方）。
alter table public.entry_code_counters enable row level security;

create or replace function public.next_entry_seq(p_event text, p_category text)
returns int
language plpgsql
as $$
declare
  v_seq int;
begin
  insert into public.entry_code_counters (event_id, category, next_seq)
  values (p_event, p_category, 2)
  on conflict (event_id, category)
  do update set next_seq = public.entry_code_counters.next_seq + 1
  returning next_seq - 1 into v_seq;
  return v_seq;
end;
$$;

comment on function public.next_entry_seq(text, text) is 'イベントID×カテゴリの次の連番を返し、同時にカウンターを1つ進める（アトミック）。新しいイベントIDを使えば1番から自動的に再スタートする。';
