const { Op } = require('sequelize');
const moment = require('moment-timezone');
const { UserVehicle, User, Wallet, UserOptions } = require('../models');
const billingService = require('../services/billing.service');
const { sendMail } = require('../services/emailService');

// Ops mailbox that gets copied on every expiry warning.
const OPS_EMAIL = process.env.EXPIRY_OPS_EMAIL || 'smartchallan@gmail.com';
// Warn when the ACTUAL expiry (subscription_expires_at) falls within this many days.
const WARN_DAYS = parseInt(process.env.EXPIRY_WARN_DAYS, 10) || 7;

const fmt = (d) => (d ? moment(d).tz('Asia/Kolkata').format('DD MMM YYYY') : '—');

/** Walk parent_id up to the top account (parent_id 0/null) using a preloaded map. */
const findRoot = (user, byId) => {
  let cur = user;
  const seen = new Set();
  while (cur && cur.parent_id != null && Number(cur.parent_id) !== 0 && byId[cur.parent_id] && !seen.has(cur.id)) {
    seen.add(cur.id);
    cur = byId[cur.parent_id];
  }
  return cur;
};

const buildEmailHtml = ({ clientName, rows }) => {
  const list = rows.map((v) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eef2f7;font-weight:600;">${v.vehicle_number || `#${v.id}`}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eef2f7;color:#dc2626;">${fmt(v.subscription_expires_at)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eef2f7;color:#64748b;">${fmt(v.grace_expires_at)}</td>
    </tr>`).join('');
  return `
  <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;padding:24px;background:#f9fafb;border-radius:8px;">
    <h2 style="color:#1d4ed8;margin:0 0 4px;">Vehicle subscription expiring soon</h2>
    <p style="color:#334155;">The following vehicle${rows.length > 1 ? 's' : ''} for <b>${clientName || 'this client'}</b> ${rows.length > 1 ? 'are' : 'is'} expiring within the next ${WARN_DAYS} days. Please renew to avoid interruption.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;background:#fff;border-radius:6px;overflow:hidden;">
      <thead>
        <tr style="background:#f1f5f9;color:#475569;text-align:left;">
          <th style="padding:10px 12px;">Vehicle</th>
          <th style="padding:10px 12px;">Expiry</th>
          <th style="padding:10px 12px;">Grace till</th>
        </tr>
      </thead>
      <tbody>${list}</tbody>
    </table>
    <p style="color:#94a3b8;font-size:12px;margin-top:20px;">This is an automated reminder from ${process.env.COMPANY_NAME || 'SmartChallan'}.</p>
  </div>`;
};

/**
 * Nightly vehicle-expiry job:
 *  1. Auto-deactivate vehicles whose grace period has fully lapsed.
 *  2. Auto-renew due vehicles for billable-prepaid clients who opted in and hold tokens.
 *  3. Email a 7-day expiry warning (ops + top account + client + dealer) for the rest,
 *     once per term (deduped via expiry_reminder_sent_at).
 */
module.exports = async function vehicleExpiryJob() {
  const started = Date.now();
  console.log('[vehicleExpiryJob] start', new Date().toISOString());
  const now = new Date();
  const warnCutoff = new Date(now.getTime() + WARN_DAYS * 24 * 60 * 60 * 1000);

  // ── 1. Auto-deactivate past-grace vehicles ──────────────────────────────────
  const [deactivated] = await UserVehicle.update(
    { status: 'deleted', deleted_at: now },
    { where: { status: 'active', grace_expires_at: { [Op.lt]: now } } }
  );
  console.log(`[vehicleExpiryJob] auto-deactivated ${deactivated} past-grace vehicle(s)`);

  // ── Load the expiring set (active, actual expiry within the warn window) ─────
  const expiring = await UserVehicle.findAll({
    where: { status: 'active', subscription_expires_at: { [Op.ne]: null, [Op.lte]: warnCutoff } },
  });
  if (!expiring.length) {
    console.log(`[vehicleExpiryJob] no vehicles expiring within ${WARN_DAYS} days. (${Date.now() - started}ms)`);
    return { deactivated, autoRenewed: 0, remindedClients: 0 };
  }

  // Preload users, auto-renew opt-ins, and wallet balances once.
  const users = await User.findAll({ attributes: ['id', 'name', 'email', 'parent_id', 'account_type', 'billing_type'], raw: true });
  const usersById = Object.fromEntries(users.map((u) => [u.id, u]));
  const autoRenewRows = await UserOptions.findAll({ where: { option_key: 'auto_renew' }, raw: true });
  const autoRenewSet = new Set(autoRenewRows.filter((o) => String(o.option_value) === '1' || String(o.option_value).toLowerCase() === 'true').map((o) => o.user_id));
  const wallets = await Wallet.findAll({ attributes: ['userId', 'balance'], raw: true });
  const balanceByUser = Object.fromEntries(wallets.map((w) => [w.user_id ?? w.userId, Number(w.balance) || 0]));

  // ── 2. Auto-renew eligible vehicles ─────────────────────────────────────────
  const renewedIds = new Set();
  let autoRenewed = 0;
  for (const v of expiring) {
    const owner = usersById[v.client_id];
    const eligible = owner && billingService.ownerChargesToken(owner) && autoRenewSet.has(v.client_id) && (balanceByUser[v.client_id] || 0) >= 1;
    if (!eligible) continue;
    try {
      await billingService.renewVehicle({ actor: { id: null }, vehicleId: v.id });
      balanceByUser[v.client_id] -= 1;
      renewedIds.add(v.id);
      autoRenewed += 1;
    } catch (e) {
      console.error(`[vehicleExpiryJob] auto-renew failed for vehicle ${v.id}:`, e.message);
    }
  }
  console.log(`[vehicleExpiryJob] auto-renewed ${autoRenewed} vehicle(s)`);

  // ── 3. Reminder emails (per client, once per term) ──────────────────────────
  const byClient = new Map();
  for (const v of expiring) {
    if (renewedIds.has(v.id) || v.expiry_reminder_sent_at) continue;
    if (!byClient.has(v.client_id)) byClient.set(v.client_id, []);
    byClient.get(v.client_id).push(v);
  }

  let remindedClients = 0;
  for (const [clientId, rows] of byClient.entries()) {
    const client = usersById[clientId];
    const dealer = client && client.parent_id ? usersById[client.parent_id] : null;
    const root = client ? findRoot(client, usersById) : null;
    const recipients = [...new Set([OPS_EMAIL, root?.email, client?.email, dealer?.email].filter(Boolean))];
    if (!recipients.length) continue;
    try {
      await sendMail({
        to: recipients.join(','),
        subject: `Vehicle subscription expiring — ${client?.name || 'client'} (${rows.length})`,
        html: buildEmailHtml({ clientName: client?.name, rows }),
      });
      await UserVehicle.update({ expiry_reminder_sent_at: now }, { where: { id: rows.map((r) => r.id) } });
      remindedClients += 1;
    } catch (e) {
      console.error(`[vehicleExpiryJob] reminder email failed for client ${clientId}:`, e.message);
    }
  }
  console.log(`[vehicleExpiryJob] reminded ${remindedClients} client(s). done in ${Date.now() - started}ms`);
  return { deactivated, autoRenewed, remindedClients };
};
