/* =========================================================
   /api/admin-checkin
   ---------------------------------------------------------
   当日の入場確認用。

   GET  : チェックイン済みの一覧を返す（checkin.htmlの「本日のチェックイン一覧」用）
   POST : 受付コード（entry_code）を受け取り、支払い済みの購入かどうか・
          すでにチェックイン済みかどうかを判定し、未チェックインならその場で
          チェックイン済みにする。{ undo: true, id } を渡すと逆に取り消せる
          （スタッフの誤操作を戻すため）。

   checkin.html（/checkin）のQRスキャン・手入力どちらからもここを呼ぶ。
   認証は/consoleと同じ共通パスワード方式（ADMIN_CONSOLE_PASSWORD）。
   ========================================================= */
const { createClient } = require('@supabase/supabase-js');
const { verifyAdminToken } = require('../lib/adminAuth');

// 会員登録時の「お名前」（display_name）とメールアドレスの両方を返す。
// スタッフが現場でメールアドレスだけでは本人特定しづらいという要望に対応するため。
async function resolveUsers(serviceClient, userIds) {
  const map = new Map();
  const remaining = new Set(userIds);
  if (!remaining.size) return map;
  let page = 1;
  const perPage = 200;
  for (;;) {
    const { data, error } = await serviceClient.auth.admin.listUsers({ page, perPage });
    if (error) break;
    const users = (data && data.users) || [];
    for (const u of users) {
      if (remaining.has(u.id)) {
        map.set(u.id, {
          email: u.email || '（不明）',
          name: (u.user_metadata && u.user_metadata.display_name) || '',
        });
        remaining.delete(u.id);
      }
    }
    if (!remaining.size || users.length < perPage) break;
    page += 1;
  }
  return map;
}

module.exports = async function handler(req, res) {
  const serviceClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (req.method === 'GET') {
    const token = req.query.token;
    if (!verifyAdminToken(token, 'checkin')) { res.status(401).json({ error: '認証が切れました。もう一度パスワードを入力してください' }); return; }
    try {
      const { data, error } = await serviceClient
        .from('purchases')
        .select('id, user_id, ticket_name, entry_code, checked_in_at, quantity, checked_in_count')
        .eq('status', 'paid')
        .not('checked_in_at', 'is', null)
        .order('checked_in_at', { ascending: false })
        .limit(200);
      if (error) { console.error('admin-checkin list failed:', error.message); res.status(500).json({ error: '読み込みに失敗しました' }); return; }

      const userByUserId = await resolveUsers(serviceClient, (data || []).map((p) => p.user_id));
      const checkins = (data || []).map((p) => {
        const u = userByUserId.get(p.user_id);
        return {
          id: p.id,
          entryCode: p.entry_code,
          ticketName: p.ticket_name,
          buyerEmail: (u && u.email) || '（不明）',
          buyerName: (u && u.name) || '',
          checkedInAt: p.checked_in_at,
          quantity: p.quantity,
          checkedInCount: p.checked_in_count,
        };
      });
      res.status(200).json({ checkins });
    } catch (err) {
      console.error('admin-checkin GET handler error:', err);
      res.status(500).json({ error: 'サーバー内部でエラーが発生しました' });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'このメソッドは対応していません' });
    return;
  }

  const { code, token, undo, id } = req.body || {};
  if (!verifyAdminToken(token, 'checkin')) {
    res.status(401).json({ error: '認証が切れました。もう一度パスワードを入力してください' });
    return;
  }

  try {
    if (undo) {
      // スタッフの誤操作（間違ったコードを読み取ってチェックインしてしまった等）を取り消す。
      if (!id) { res.status(400).json({ error: 'idが必要です' }); return; }
      // 1人分だけ戻す（3人分の購入で2人入場済みなら1人に戻す）。
      // 0人になったら checked_in_at も消えるので、一覧からも消える。
      const { data: undone, error } = await serviceClient.rpc('undo_checkin', { p_id: id });
      if (error) { console.error('admin-checkin undo failed:', error.message); res.status(500).json({ error: '取り消しに失敗しました' }); return; }
      const undoneRow = Array.isArray(undone) ? undone[0] : undone;
      res.status(200).json({ ok: true, checkedInCount: undoneRow ? undoneRow.checked_in_count : null });
      return;
    }

    // 記号以外を取り除いてから照合する。スタッフが手入力するとき、
    // 区切りのハイフンを抜いたり空白を入れたりしがちなため（DCT 0927 N1 7K4M 等）。
    const normalize = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const entryCode = String(code || '').trim().toUpperCase();
    if (!entryCode) {
      res.status(400).json({ error: 'コードを入力してください' });
      return;
    }

    // 今回のイベントのコードか確認する。これが無いと、前回のイベントで買って
    // 使わなかったコード（または取り消されたコード）が次のイベントでもそのまま通ってしまう。
    const eventId = process.env.CURRENT_EVENT_ID;
    if (eventId && !normalize(entryCode).startsWith(normalize(`DCT-${eventId}-`))) {
      res.status(404).json({ error: '今回のイベントの受付コードではありません' });
      return;
    }

    // 入力ゆれを吸収するため、まずはそのまま、見つからなければ記号を無視して探す。
    let matchedCode = entryCode;
    const { data: exact } = await serviceClient
      .from('purchases')
      .select('entry_code')
      .eq('entry_code', entryCode)
      .eq('status', 'paid')
      .maybeSingle();

    if (!exact) {
      const target = normalize(entryCode);
      const { data: candidates } = await serviceClient
        .from('purchases')
        .select('entry_code')
        .not('entry_code', 'is', null)
        .eq('status', 'paid');
      const hit = (candidates || []).find((row) => normalize(row.entry_code) === target);
      if (!hit) {
        res.status(404).json({ error: 'そのコードの購入が見つかりませんでした（支払い未完了、または無効なコードです）' });
        return;
      }
      matchedCode = hit.entry_code;
    }

    // 入場のカウントアップはDBの関数の中で行ロック付きで行う。
    // ここで「読んでから書く」をやると、受付が複数台あるときに同じコードを
    // 同時に読んで両方入場させてしまうため（supabase/schema_v13_checkin_count.sql 参照）。
    const { data: result, error: checkinErr } = await serviceClient.rpc('checkin_entry', { p_code: matchedCode });
    if (checkinErr) { console.error('checkin_entry failed:', checkinErr.message); res.status(500).json({ error: '記録に失敗しました' }); return; }

    const row = Array.isArray(result) ? result[0] : result;
    if (!row) {
      res.status(404).json({ error: 'そのコードの購入が見つかりませんでした（支払い未完了、または無効なコードです）' });
      return;
    }

    const { data: userRes } = await serviceClient.auth.admin.getUserById(row.user_id);
    const buyerEmail = (userRes && userRes.user && userRes.user.email) || '（不明）';
    const buyerName = (userRes && userRes.user && userRes.user.user_metadata && userRes.user.user_metadata.display_name) || '';

    res.status(200).json({
      alreadyCheckedIn: !row.admitted,
      id: row.id,
      ticketName: row.ticket_name,
      buyerEmail,
      buyerName,
      checkedInAt: row.checked_in_at,
      quantity: row.quantity,
      checkedInCount: row.checked_in_count,
    });
  } catch (err) {
    console.error('admin-checkin handler error:', err);
    res.status(500).json({ error: 'サーバー内部でエラーが発生しました' });
  }
};
