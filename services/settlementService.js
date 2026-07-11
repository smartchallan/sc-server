/**
 * Challan-settlement workflow service.
 *
 * Lifecycle of a request (di_cart):
 *   payment_pending  → client raised it, PayU payment not yet confirmed
 *   payment_failed   → PayU failed/cancelled (client can retry)
 *   pending_approval → paid; walking up the dealer chain, strictly bottom-to-top
 *   settled          → top account placed it for settlement (final)
 *   rejected         → an approver rejected it
 *
 * The approval chain (di_cart_approvals) is one row per ancestor of the client:
 * level 1 = immediate dealer … last level = top account (is_top). Only the
 * account named by di_cart.current_approver_id may act, which enforces order.
 */
const { Op } = require('sequelize');
const {
  Cart, CartLineItem, CartApproval, Payment, User, UserMeta, ClientNotification,
} = require('../models');
const { getAllDescendants } = require('../middleware/resolveBillingActor');
const { sendMail } = require('./emailService');

const isTop = (parentId) => parentId == null || Number(parentId) === 0;

const err = (message, status = 400, code) => {
  const e = new Error(message);
  e.statusCode = status;
  if (code) e.code = code;
  return e;
};

// ── Pricing (client override > immediate dealer default) ─────────────────────
// Mirrors routes/userMeta.js GET /pricing so server and client agree on fees.
async function resolvePricing(client) {
  const clientMeta = await UserMeta.findOne({ where: { user_id: client.id }, raw: true });
  let dealerMeta = null;
  if (client.parent_id) {
    dealerMeta = await UserMeta.findOne({ where: { user_id: client.parent_id }, raw: true });
  }
  const toNum = (v) => (v == null || v === '' ? null : Number(v));
  const pick = (field) => {
    const c = clientMeta && clientMeta[field];
    if (c != null && c !== '') return toNum(c);
    const d = dealerMeta && dealerMeta[field];
    if (d != null && d !== '') return toNum(d);
    return null;
  };
  return {
    online_fee: pick('default_online_fee'),
    court_fee: pick('default_court_fee'),
    virtual_court_fee: pick('default_virtual_court_fee'),
    gst_percent: pick('default_gst_percent'),
  };
}

// Recompute service fee + GST server-side (never trust the client for our cut).
// challan_amount (the government fine) passes through from the client's data.
function priceLineItems(rawItems, pricing) {
  const feeFor = (type) => {
    if (type === 'virtual') return pricing.virtual_court_fee;
    if (type === 'court') return pricing.court_fee;
    return pricing.online_fee; // default 'online'
  };
  const gstPct = Number(pricing.gst_percent || 0);
  let total = 0;
  const items = (rawItems || []).map((it) => {
    const base = Number(it.challan_amount || 0);
    const fee = Number(feeFor(it.challan_type) || 0);
    const gstAmt = (fee * gstPct) / 100;
    total += base + fee + gstAmt;
    return {
      vehicle_number: it.vehicle_number,
      challan_number: it.challan_number,
      challan_type: it.challan_type || 'online',
      challan_amount: base,
      discount: 0,
      discount_code: '0',
      service_fee: fee,
      gst_percent: gstPct,
      gst_amt: gstAmt,
    };
  });
  return { items, total: Math.round(total * 100) / 100 };
}

// ── Ancestor chain (immediate dealer first … top account last) ───────────────
async function getAncestorChain(clientId) {
  const client = await User.findByPk(clientId, { attributes: ['id', 'parent_id', 'name'] });
  if (!client) throw err('Client not found', 404);
  const chain = [];
  const visited = new Set([Number(client.id)]);
  let parentId = client.parent_id;
  let guard = 0;
  while (!isTop(parentId) && guard < 50) {
    if (visited.has(Number(parentId))) break; // cycle guard
    const parent = await User.findByPk(parentId, { attributes: ['id', 'parent_id', 'name'] });
    if (!parent) break;
    visited.add(Number(parent.id));
    chain.push(parent);
    parentId = parent.parent_id;
    guard += 1;
  }
  return { client, chain };
}

// ── Create a request (payment_pending) + priced line items ───────────────────
async function createPendingRequest({ clientId, parentId, rawLineItems }) {
  const client = await User.findByPk(clientId, { attributes: ['id', 'parent_id', 'name'] });
  if (!client) throw err('Client not found', 404);

  const pricing = await resolvePricing(client);
  if (pricing.online_fee == null || pricing.gst_percent == null) {
    throw err('Pricing is not configured for this account. Please contact your dealer.', 400, 'PRICING_INCOMPLETE');
  }
  const { items, total } = priceLineItems(rawLineItems, pricing);
  if (!items.length) throw err('No challans provided for settlement', 400);
  if (total <= 0) throw err('Settlement total must be greater than zero', 400);

  const { chain } = await getAncestorChain(clientId);
  const topAccountId = chain.length ? chain[chain.length - 1].id : client.id;

  const cart = await Cart.create({
    client_id: clientId,
    parent_id: parentId || client.parent_id || 0,
    request_type: 'challan',
    item_count: items.length,
    status: 'payment_pending',
    last_updated_by: 'client',
    total_amount: total,
    top_account_id: topAccountId,
    created_at: new Date(),
    updated_at: new Date(),
  });

  for (const it of items) {
    await CartLineItem.create({ cart_id: cart.id, ...it, created_at: new Date(), updated_at: new Date() });
  }
  return { cart, total, itemCount: items.length };
}

// ── After successful payment: build the chain + notify participants ──────────
async function onPaymentSuccess(cartId) {
  const cart = await Cart.findByPk(cartId);
  if (!cart) throw err('Request not found', 404);
  // Idempotent: only build the chain once.
  const existing = await CartApproval.count({ where: { cart_id: cartId } });
  if (existing > 0) return cart;

  const { chain } = await getAncestorChain(cart.client_id);

  if (!chain.length) {
    // Client is itself the top account — nothing to approve.
    await cart.update({ status: 'settled', current_approver_id: null, updated_at: new Date() });
    await notifyParticipants(cart, {
      senderId: cart.client_id, senderName: 'Challan Settlement',
      subject: 'Challan settlement completed',
      message: `Request #${cart.id} has been paid and settled.`,
    });
    return cart;
  }

  for (let i = 0; i < chain.length; i += 1) {
    const a = chain[i];
    await CartApproval.create({
      cart_id: cart.id,
      approver_id: a.id,
      approver_name: a.name,
      level: i + 1,
      is_top: i === chain.length - 1,
      status: 'pending',
      created_at: new Date(),
    });
  }
  await cart.update({
    status: 'pending_approval',
    current_approver_id: chain[0].id, // immediate dealer acts first
    updated_at: new Date(),
  });

  await notifyParticipants(cart, {
    senderId: cart.client_id, senderName: 'Challan Settlement',
    subject: 'New challan settlement request',
    message: `A challan settlement request #${cart.id} (₹${cart.total_amount}) has been paid and is awaiting approval.`,
  });
  return cart;
}

// ── Approve / settle / reject (strict bottom-to-top) ─────────────────────────
async function act({ cartId, actorId, decision, note, requireTop = false }) {
  const cart = await Cart.findByPk(cartId);
  if (!cart) throw err('Request not found', 404);
  if (cart.status !== 'pending_approval') {
    throw err(`Request is '${cart.status}' and cannot be actioned.`, 409, 'NOT_ACTIONABLE');
  }

  const row = await CartApproval.findOne({ where: { cart_id: cartId, approver_id: actorId } });
  if (!row) throw err('You are not part of this approval chain.', 403);
  if (row.status !== 'pending') throw err('You have already acted on this request.', 409);
  if (requireTop && !row.is_top) throw err('Only the top account can place a request for settlement.', 403);
  if (Number(cart.current_approver_id) !== Number(actorId)) {
    throw err('It is not your turn yet — a lower level in the chain must approve first.', 409, 'OUT_OF_ORDER');
  }

  if (decision === 'reject') {
    await row.update({ status: 'rejected', note: note || null, acted_at: new Date() });
    await cart.update({ status: 'rejected', current_approver_id: null, updated_at: new Date() });
    await notifyParticipants(cart, {
      senderId: actorId, senderName: row.approver_name || 'Approver',
      subject: `Challan settlement request #${cart.id} rejected`,
      message: `Request #${cart.id} was rejected by ${row.approver_name || 'an approver'}.` +
        (note ? ` Reason: ${note}.` : '') +
        ' The paid amount will be refunded to the client.',
    });
    return { cart, approval: row, final: 'rejected' };
  }

  // decision === 'approve' (top account's approve = "place for settlement")
  await row.update({ status: 'approved', note: note || null, acted_at: new Date() });

  const next = await CartApproval.findOne({
    where: { cart_id: cartId, status: 'pending', level: { [Op.gt]: row.level } },
    order: [['level', 'ASC']],
  });

  if (next) {
    await cart.update({ current_approver_id: next.approver_id, updated_at: new Date() });
    await notifyParticipants(cart, {
      senderId: actorId, senderName: row.approver_name || 'Approver',
      subject: `Challan settlement request #${cart.id} approved`,
      message: `${row.approver_name || 'An approver'} approved request #${cart.id}. ` +
        `It now awaits approval from ${next.approver_name || 'the next level'}.`,
    });
    return { cart, approval: row, final: 'pending_approval', nextApproverId: next.approver_id };
  }

  // No pending level left — this was the top account. Settle.
  await cart.update({ status: 'settled', current_approver_id: null, last_updated_by: 'admin', updated_at: new Date() });
  await notifyParticipants(cart, {
    senderId: actorId, senderName: row.approver_name || 'Top Account',
    subject: `Challan settlement request #${cart.id} settled`,
    message: `Request #${cart.id} has been fully approved and placed for settlement by ${row.approver_name || 'the top account'}.`,
  });
  return { cart, approval: row, final: 'settled' };
}

// ── Notifications (in-app di_client_notifications + email) ────────────────────
async function notifyParticipants(cart, { senderId, senderName, subject, message }) {
  try {
    const approvals = await CartApproval.findAll({ where: { cart_id: cart.id }, attributes: ['approver_id'], raw: true });
    const ids = new Set([Number(cart.client_id), ...approvals.map((a) => Number(a.approver_id))]);
    ids.delete(Number(senderId)); // don't notify the actor of their own action
    const recipientIds = [...ids].filter(Boolean);
    if (!recipientIds.length) return;

    const users = await User.findAll({ where: { id: { [Op.in]: recipientIds } }, attributes: ['id', 'name', 'email'], raw: true });

    for (const u of users) {
      await ClientNotification.create({
        sender_id: senderId || cart.client_id,
        sender_name: senderName || 'Challan Settlement',
        recipient_id: u.id,
        subject,
        message,
        is_read: false,
        created_at: new Date(),
      });
      if (u.email) {
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9f9f9;border-radius:8px;">
            <h2 style="color:#2d3748;margin-top:0;">${subject}</h2>
            <div style="margin:16px 0;padding:16px;background:#fff;border-radius:6px;border:1px solid #e2e8f0;white-space:pre-line;">${message}</div>
            <p style="font-size:13px;color:#718096;">Log in to your SmartChallan account to view the request.</p>
          </div>`;
        sendMail({ to: u.email, subject, html }).catch((e) => console.error('[settlement notify email]', e.message));
      }
    }
  } catch (e) {
    console.error('[settlement notifyParticipants] failed:', e.message);
  }
}

// ── Inbox: every request where the actor is the client or an ancestor ────────
async function getInbox(actorId) {
  const actor = await User.findByPk(actorId, { attributes: ['id', 'parent_id'] });
  if (!actor) throw err('User not found', 404);

  // Actor is an ancestor of client  ⟺  client ∈ descendants(actor). Top account
  // (no parent) naturally sees the whole tree via getAllDescendants.
  const descendants = await getAllDescendants(actor.id);
  const descendantIds = descendants.map(Number).filter((id) => id !== Number(actor.id));

  // The owner sees all their own requests (incl. unpaid/failed attempts); ancestors
  // only see requests that have actually been paid and entered the chain.
  const where = {
    [Op.or]: [
      { client_id: Number(actor.id) },
      ...(descendantIds.length
        ? [{ client_id: { [Op.in]: descendantIds }, status: { [Op.in]: ['pending_approval', 'settled', 'rejected'] } }]
        : []),
    ],
  };

  const carts = await Cart.findAll({
    where,
    order: [['created_at', 'DESC']],
    include: [
      { model: CartLineItem, as: 'line_items' },
      { model: CartApproval, as: 'approvals' },
    ],
  });

  // Names for client + immediate dealer display
  const nameIds = new Set();
  carts.forEach((c) => { nameIds.add(c.client_id); nameIds.add(c.parent_id); });
  const nameRows = await User.findAll({ where: { id: { [Op.in]: [...nameIds].filter(Boolean) } }, attributes: ['id', 'name'], raw: true });
  const nameById = {};
  nameRows.forEach((u) => { nameById[u.id] = u.name; });

  // Latest payment per cart (for a status/amount summary)
  const cartIds = carts.map((c) => c.id);
  const payments = cartIds.length
    ? await Payment.findAll({ where: { cart_id: { [Op.in]: cartIds } }, order: [['created_at', 'DESC']], raw: true })
    : [];
  const paymentByCart = {};
  payments.forEach((p) => { if (!paymentByCart[p.cart_id]) paymentByCart[p.cart_id] = p; });

  return carts.map((c) => {
    const j = c.toJSON();
    j.approvals = (j.approvals || []).sort((a, b) => a.level - b.level);
    j.client_name = nameById[j.client_id] || null;
    j.dealer_name = nameById[j.parent_id] || null;
    const myRow = j.approvals.find((a) => Number(a.approver_id) === Number(actorId));
    j.my_turn = j.status === 'pending_approval' && Number(j.current_approver_id) === Number(actorId);
    j.is_top = !!(myRow && myRow.is_top);
    j.my_approval_status = myRow ? myRow.status : null;
    j.is_owner = Number(j.client_id) === Number(actorId);
    const pay = paymentByCart[j.id];
    j.payment = pay ? { status: pay.status, amount: pay.amount, mihpayid: pay.mihpayid, mode: pay.payu_mode } : null;
    return j;
  });
}

async function getRequest(cartId) {
  const cart = await Cart.findByPk(cartId, {
    include: [
      { model: CartLineItem, as: 'line_items' },
      { model: CartApproval, as: 'approvals' },
      { model: Payment, as: 'payments' },
    ],
  });
  if (!cart) throw err('Request not found', 404);
  const j = cart.toJSON();
  j.approvals = (j.approvals || []).sort((a, b) => a.level - b.level);
  return j;
}

module.exports = {
  resolvePricing,
  priceLineItems,
  getAncestorChain,
  createPendingRequest,
  onPaymentSuccess,
  act,
  notifyParticipants,
  getInbox,
  getRequest,
};
