const settlementService = require('../services/settlementService');
const payu = require('../services/payuService');
const { Cart, Payment, User } = require('../models');

// Origins the browser may be redirected back to after payment (mirrors the CORS
// allowlist in server.js). Anything else falls back to APP_REDIRECT_BASE.
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://app.smartchallan.com', 'http://app.smartchallan.com',
  'https://smartchallan.technoton.co.in', 'http://smartchallan.technoton.co.in',
  'https://stage.smartchallan.com',
  'https://challan.nigraani.com', 'http://challan.nigraani.com',
  'https://globalafs.smartchallan.com', 'http://globalafs.smartchallan.com',
  'https://challan.eyeonfleet.com', 'http://challan.eyeonfleet.com',
  'https://smartchallan.vt4india.com', 'http://smartchallan.vt4india.com',
];
const DEFAULT_REDIRECT = process.env.APP_REDIRECT_BASE || 'http://localhost:5173';

const safeOrigin = (origin) => (ALLOWED_ORIGINS.includes(origin) ? origin : DEFAULT_REDIRECT);
// The SPA uses HashRouter; the authenticated dashboard lives at /#/smartboard.
const redirectUrl = (origin, params) =>
  `${safeOrigin(origin)}/#/smartboard?${new URLSearchParams(params).toString()}`;

const fail = (res, e) =>
  res.status(e.statusCode || 500).json({ success: false, message: e.message, code: e.code });

// ─── POST /settlement/initiate ───────────────────────────────────────────────
// Client raises a request: server prices it, creates a payment_pending cart, and
// returns the PayU params for the browser to auto-POST to the gateway.
const initiate = async (req, res) => {
  try {
    const actorId = req.client && req.client.id;
    if (!actorId) return res.status(401).json({ success: false, message: 'Authentication required' });

    const client = await User.findByPk(actorId, { attributes: ['id', 'parent_id', 'name', 'email'] });
    if (!client) return res.status(404).json({ success: false, message: 'Client not found' });

    const { line_items, payer = {}, return_origin } = req.body;

    const { cart, total } = await settlementService.createPendingRequest({
      clientId: client.id,
      parentId: client.parent_id,
      rawLineItems: line_items,
    });

    const firstname = (payer.firstname || client.name || 'Customer').toString().slice(0, 60);
    const email = (payer.email || client.email || '').toString();
    const phone = (payer.phone || '').toString();

    const txnid = payu.generateTxnId();
    const productinfo = `Challan Settlement #${cart.id}`;
    const { action, params } = payu.buildPaymentRequest({
      txnid, amount: total, productinfo, firstname, email, phone, udf1: String(cart.id),
    });

    await Payment.create({
      cart_id: cart.id,
      user_id: client.id,
      gateway: 'payu',
      txnid,
      amount: total,
      productinfo,
      firstname,
      email,
      phone,
      status: 'initiated',
      request_hash: params.hash,
      return_origin: return_origin || null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return res.json({ success: true, cart_id: cart.id, amount: total, action, params });
  } catch (e) {
    console.error('[settlement initiate]', e);
    return fail(res, e);
  }
};

// ─── POST /settlement/payu/callback/success (PUBLIC) ─────────────────────────
const payuSuccess = async (req, res) => {
  const body = req.body || {};
  const payment = body.txnid ? await Payment.findOne({ where: { txnid: body.txnid } }) : null;
  const origin = (payment && payment.return_origin) || DEFAULT_REDIRECT;

  try {
    if (!payment) throw new Error('Unknown transaction');

    const verified = payu.verifyResponse(body);
    const success = verified && String(body.status).toLowerCase() === 'success';

    await payment.update({
      status: success ? 'success' : 'failure',
      mihpayid: body.mihpayid || null,
      payu_mode: body.mode || null,
      bank_ref_num: body.bank_ref_num || body.bankcode || null,
      error_code: body.error || (verified ? null : 'HASH_MISMATCH'),
      error_message: body.error_Message || body.field9 || (verified ? null : 'Response hash verification failed'),
      response: body,
      updated_at: new Date(),
    });

    if (!success) {
      await Cart.update({ status: 'payment_failed', updated_at: new Date() }, { where: { id: payment.cart_id } });
      return res.redirect(redirectUrl(origin, { settlement: 'failure', cart: payment.cart_id }));
    }

    await Cart.update(
      { transaction_id: body.mihpayid || payment.txnid, updated_at: new Date() },
      { where: { id: payment.cart_id } },
    );
    await settlementService.onPaymentSuccess(payment.cart_id);

    return res.redirect(redirectUrl(origin, { settlement: 'success', cart: payment.cart_id }));
  } catch (e) {
    console.error('[settlement payuSuccess]', e);
    return res.redirect(redirectUrl(origin, { settlement: 'error' }));
  }
};

// ─── POST /settlement/payu/callback/failure (PUBLIC) ─────────────────────────
const payuFailure = async (req, res) => {
  const body = req.body || {};
  const payment = body.txnid ? await Payment.findOne({ where: { txnid: body.txnid } }) : null;
  const origin = (payment && payment.return_origin) || DEFAULT_REDIRECT;
  try {
    if (payment) {
      await payment.update({
        status: 'failure',
        mihpayid: body.mihpayid || null,
        error_code: body.error || 'PAYMENT_FAILED',
        error_message: body.error_Message || body.field9 || 'Payment failed or cancelled',
        response: body,
        updated_at: new Date(),
      });
      await Cart.update({ status: 'payment_failed', updated_at: new Date() }, { where: { id: payment.cart_id } });
    }
    return res.redirect(redirectUrl(origin, { settlement: 'failure', cart: payment ? payment.cart_id : '' }));
  } catch (e) {
    console.error('[settlement payuFailure]', e);
    return res.redirect(redirectUrl(origin, { settlement: 'failure' }));
  }
};

// ─── GET /settlement/inbox ───────────────────────────────────────────────────
const inbox = async (req, res) => {
  try {
    const actorId = req.client && req.client.id;
    const data = await settlementService.getInbox(actorId);
    return res.json({ success: true, data });
  } catch (e) { return fail(res, e); }
};

// ─── GET /settlement/:id ─────────────────────────────────────────────────────
const detail = async (req, res) => {
  try {
    const data = await settlementService.getRequest(req.params.id);
    return res.json({ success: true, data });
  } catch (e) { return fail(res, e); }
};

// ─── POST /settlement/:id/approve | /settle | /reject ────────────────────────
const approve = async (req, res) => {
  try {
    const result = await settlementService.act({
      cartId: req.params.id, actorId: req.client.id, decision: 'approve', note: req.body.note,
    });
    return res.json({ success: true, message: 'Approved', data: result });
  } catch (e) { return fail(res, e); }
};

const settle = async (req, res) => {
  try {
    const result = await settlementService.act({
      cartId: req.params.id, actorId: req.client.id, decision: 'approve', note: req.body.note, requireTop: true,
    });
    return res.json({ success: true, message: 'Placed for settlement', data: result });
  } catch (e) { return fail(res, e); }
};

const reject = async (req, res) => {
  try {
    const result = await settlementService.act({
      cartId: req.params.id, actorId: req.client.id, decision: 'reject', note: req.body.note,
    });
    return res.json({ success: true, message: 'Rejected', data: result });
  } catch (e) { return fail(res, e); }
};

module.exports = { initiate, payuSuccess, payuFailure, inbox, detail, approve, settle, reject };
