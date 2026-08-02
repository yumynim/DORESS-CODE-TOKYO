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
        .select('id, user_id, ticket_name, entry_code, checked_in_at')
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
      const { error } = await serviceClient.from('purchases').update({ checked_in_at: null }).eq('id', id);
      if (error) { console.error('admin-checkin undo failed:', error.message); res.status(500).json({ error: '取り消しに失敗しました' }); return; }
      res.status(200).json({ ok: true });
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

    let { data: purchase, error } = await serviceClient
      .from('purchases')
      .select('id, user_id, ticket_name, status, checked_in_at')
      .eq('entry_code', entryCode)
      .maybeSingle();

    // そのままの文字列で見つからない場合、記号を無視した比較で探し直す
    // （ハイフンを抜いて入力された、全角が混ざった、等を救済する）。
    if (!error && !purchase) {
      const target = normalize(entryCode);
      const { data: candidates } = await serviceClient
        .from('purchases')
        .select('id, user_id, ticket_name, status, checked_in_at, entry_code')
        .not('entry_code', 'is', null)
        .eq('status', 'paid');
      purchase = (candidates || []).find((row) => normalize(row.entry_code) === target) || null;
    }

    if (error) { console.error('admin-checkin lookup failed:', error.message); res.status(500).json({ error: '確認中にエラーが発生しました' }); return; }
    if (!purchase || purchase.status !== 'paid') {
      res.status(404).json({ error: 'そのコードの購入が見つかりませんでした（支払い未完了、または無効なコードです）' });
      return;
    }

    const { data: userRes } = await serviceClient.auth.admin.getUserById(purchase.user_id);
    const buyerEmail = (userRes && userRes.user && userRes.user.email) || '（不明）';
    const buyerName = (userRes && userRes.user && userRes.user.user_metadata && userRes.user.user_metadata.display_name) || '';

    if (purchase.checked_in_at) {
      res.status(200).json({
        alreadyCheckedIn: true,
        ticketName: purchase.ticket_name,
        buyerEmail,
        buyerName,
        checkedInAt: purchase.checked_in_at,
      });
      return;
    }

    // 「まだチェックインしていない行だけ」を条件に更新し、実際に更新できたかで判定する。
    // 上のselectを見てからupdateするだけだと、受付が2台に分かれていて同じコードを
    // 同時にスキャンした場合、どちらのselectも checked_in_at = null を読んでしまい、
    // 両方に「入場OK」を出す（＝1枚のチケットで2人入れる）ことになる。
    // .is('checked_in_at', null) を付けると、後から来た方は0行更新となり弾ける。
    const checkedInAt = new Date().toISOString();
    const { data: updated, error: updateErr } = await serviceClient
      .from('purchases')
      .update({ checked_in_at: checkedInAt })
      .eq('id', purchase.id)
      .is('checked_in_at', null)
      .select('id, checked_in_at');
    if (updateErr) { console.error('admin-checkin update failed:', updateErr.message); res.status(500).json({ error: '記録に失敗しました' }); return; }

    if (!updated || updated.length === 0) {
      // ほぼ同時に別の端末がチェックインを完了させていた。現在の記録を読み直して「入場済み」として返す。
      const { data: current } = await serviceClient
        .from('purchases')
        .select('checked_in_at')
        .eq('id', purchase.id)
        .maybeSingle();
      res.status(200).json({
        alreadyCheckedIn: true,
        ticketName: purchase.ticket_name,
        buyerEmail,
        buyerName,
        checkedInAt: (current && current.checked_in_at) || checkedInAt,
      });
      return;
    }

    res.status(200).json({ alreadyCheckedIn: false, id: purchase.id, ticketName: purchase.ticket_name, buyerEmail, buyerName, checkedInAt });
  } catch (err) {
    console.error('admin-checkin handler error:', err);
    res.status(500).json({ error: 'サーバー内部でエラーが発生しました' });
  }
};
