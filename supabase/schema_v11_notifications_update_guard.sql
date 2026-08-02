-- =========================================================
-- DRESS CODE TOKYO — notifications の更新ポリシーを「既読フラグだけ」に絞る
-- ---------------------------------------------------------
-- schema_v3_notifications.sql を実行済みの上で、これを追加で実行してください（SQL Editorに貼って Run）。
--
-- 直す問題：
--   schema_v3_notifications.sql の notifications_update_own は
--     for update using (auth.uid() = user_id)
--   だけで with check が無く、更新できる列も制限していませんでした。
--   このため、ログイン中の会員が自分の通知の title / body / body_html を
--   書き換えたり、user_id を他人のIDに付け替えて相手の通知欄に
--   任意の文面を差し込んだりできてしまう状態でした
--   （クライアント側の js/notifications.js・members-only.html は read しか更新しませんが、
--    ブラウザから直接Supabaseを叩けば何でも書けてしまう）。
--
-- 対策：
--   1. with check を付けて、更新後も自分の行のままであることを強制する（user_idの付け替え防止）。
--   2. トリガーで、read 以外の列が変わる更新を拒否する
--      （PostgresのRLSには「この列だけ更新可」という指定が無いため、トリガーで担保する）。
-- =========================================================

-- 1) with check を追加した版に貼り替える
drop policy if exists "notifications_update_own" on public.notifications;

create policy "notifications_update_own" on public.notifications
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2) read 以外の列を書き換える更新を拒否する
--    service role は RLS もこのトリガーも通るため、明示的に素通りさせる
--    （Webhookが通知を作ったり運営が本文を直したりできなくなると困るため）。
create or replace function public.guard_notifications_readonly_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- サーバー側（service role）からの更新は制限しない
  if auth.role() = 'service_role' then
    return new;
  end if;

  if new.user_id     is distinct from old.user_id
     or new.purchase_id is distinct from old.purchase_id
     or new.title     is distinct from old.title
     or new.body      is distinct from old.body
     or new.body_html is distinct from old.body_html
     or new.created_at is distinct from old.created_at then
    raise exception '通知は既読状態（read）以外を変更できません';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_notifications_readonly_fields on public.notifications;

create trigger guard_notifications_readonly_fields
  before update on public.notifications
  for each row execute function public.guard_notifications_readonly_fields();
