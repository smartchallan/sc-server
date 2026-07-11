/**
 * PayU (PayUBiz / PayUMoney) classic hosted-checkout integration.
 *
 * PayU's gateway does not need a Node SDK: you build a set of parameters plus a
 * SHA-512 request hash, the browser form-POSTs them to PayU's payment page, and
 * PayU form-POSTs the signed result back to your surl/furl. This module owns the
 * config + both hash directions.
 *
 * Sandbox defaults are PayU's public test merchant credentials, so the module
 * works out-of-the-box against https://test.payu.in. Override via env for prod:
 *   PAYU_MERCHANT_KEY, PAYU_MERCHANT_SALT, PAYU_BASE_URL, PAYU_SURL, PAYU_FURL
 *
 * Request hash  = sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
 * Response hash = sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 * (PayU docs "Merchant Hashing Reference".)
 */
const crypto = require('crypto');
require('dotenv').config();

const CONFIG = {
  key: process.env.PAYU_MERCHANT_KEY || 'gtKFFx',            // PayU public test key
  salt: process.env.PAYU_MERCHANT_SALT || 'eCwWELxi',        // PayU public test salt
  baseUrl: process.env.PAYU_BASE_URL || 'https://test.payu.in/_payment',
  // Server callback endpoints PayU redirects the browser back to (must be public / no JWT).
  surl: process.env.PAYU_SURL || 'http://localhost:3001/settlement/payu/callback/success',
  furl: process.env.PAYU_FURL || 'http://localhost:3001/settlement/payu/callback/failure',
};

const sha512 = (str) => crypto.createHash('sha512').update(str).digest('hex');

/** Amount must be a fixed 2-decimal string for the hash to match PayU. */
const fmtAmount = (amount) => Number(amount).toFixed(2);

/**
 * Build the params + request hash for a new PayU transaction.
 * `udf1..5` are optional user-defined fields (we stash the cart id in udf1).
 * Returns { action, params } — the frontend auto-POSTs `params` to `action`.
 */
function buildPaymentRequest({ txnid, amount, productinfo, firstname, email, phone, udf1 = '', udf2 = '', udf3 = '', udf4 = '', udf5 = '' }) {
  const amt = fmtAmount(amount);
  const hashSeq = [CONFIG.key, txnid, amt, productinfo, firstname, email, udf1, udf2, udf3, udf4, udf5, '', '', '', '', '', CONFIG.salt];
  const hash = sha512(hashSeq.join('|'));

  const params = {
    key: CONFIG.key,
    txnid,
    amount: amt,
    productinfo,
    firstname,
    email,
    phone,
    udf1, udf2, udf3, udf4, udf5,
    surl: CONFIG.surl,
    furl: CONFIG.furl,
    hash,
  };
  return { action: CONFIG.baseUrl, params };
}

/**
 * Verify the reverse hash PayU sends on its success/failure callback.
 * `body` is the raw form-POST payload from PayU. Returns true when authentic.
 */
function verifyResponse(body) {
  if (!body || !body.hash) return false;
  const status = body.status || '';
  const udf1 = body.udf1 || '', udf2 = body.udf2 || '', udf3 = body.udf3 || '', udf4 = body.udf4 || '', udf5 = body.udf5 || '';
  const seq = [
    CONFIG.salt, status, '', '', '', '', '',
    udf5, udf4, udf3, udf2, udf1,
    body.email || '', body.firstname || '', body.productinfo || '',
    body.amount || '', body.txnid || '', CONFIG.key,
  ];
  const expected = sha512(seq.join('|'));
  // additionalCharges, when present, prepends to the hash sequence — handle both.
  if (body.additionalCharges) {
    const withAc = sha512([body.additionalCharges, ...seq].join('|'));
    if (withAc.toLowerCase() === String(body.hash).toLowerCase()) return true;
  }
  return expected.toLowerCase() === String(body.hash).toLowerCase();
}

/** Generate a unique, PayU-safe txnid (alphanumeric, <= 25 chars recommended). */
function generateTxnId() {
  const rand = crypto.randomBytes(4).toString('hex');
  return `SC${Date.now().toString(36)}${rand}`.slice(0, 25).toUpperCase();
}

module.exports = {
  CONFIG,
  buildPaymentRequest,
  verifyResponse,
  generateTxnId,
  fmtAmount,
};
