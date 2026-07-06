const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  sequelize, User, UserMeta, UserVehicle: Vehicle,
  Wallet, WalletTransaction, BillingRate, Invoice, InvoiceCounter,
} = require('../models');
const { getSystemSettings } = require('./master.service');

// ─── Token billing model ─────────────────────────────────────────────────────
// The wallet holds VEHICLE TOKENS (whole numbers). 1 token = 1 vehicle for 1
// month. The billing cycle is fixed at 1 month, so adding/renewing a vehicle costs
// exactly 1 token and extends billed-till by 1 month.
//
// Ported from DriveInnovate. Adapted to SmartChallan's snake_case models for the
// existing entities (User, UserVehicle, UserMeta); the new billing tables keep
// DriveInnovate's camelCase attribute style.
const SUBSCRIPTION_MONTHS = 1;
const TOKENS_PER_VEHICLE = 1;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

const httpError = (message, status, extra = {}) => {
  const err = new Error(message);
  err.status = status;
  Object.assign(err, extra);
  return err;
};

/** Add `n` whole months, guarding month-length overflow (Jan 31 + 1mo → Feb 28). */
const addMonths = (date, n) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + n);
  if (d.getDate() < day) d.setDate(0);
  return d;
};

// ─── Wallet primitive ────────────────────────────────────────────────────────
/**
 * Apply a SIGNED delta to a wallet and append one ledger row, atomically.
 * MUST be called inside a transaction. Locks the wallet row FOR UPDATE so
 * concurrent debits can never both pass the balance check. Throws
 * INSUFFICIENT_FUNDS (402) when a debit would push the balance below zero.
 */
const adjustWallet = async ({
  userId, delta, type, refType, refId = null,
  counterpartyUserId = null, performedByUserId = null,
  groupRef = null, note = null, allowNegative = false, transaction,
}) => {
  if (!transaction) throw httpError('adjustWallet requires a transaction', 500);

  // Lazily create, then lock the row so we read the committed balance.
  await Wallet.findOrCreate({ where: { userId }, defaults: { userId, balance: 0 }, transaction });
  const wallet = await Wallet.findOne({ where: { userId }, lock: transaction.LOCK.UPDATE, transaction });

  if (wallet.status === 'frozen') throw httpError('This wallet is frozen. Contact support.', 423);

  const current = Math.round(Number(wallet.balance));
  const next = Math.round(current + Number(delta));
  if (!allowNegative && next < 0) {
    throw httpError('Insufficient tokens in wallet', 402, {
      code: 'INSUFFICIENT_FUNDS',
      details: { balance: current, required: Math.abs(Number(delta)), shortfall: Math.abs(next) },
    });
  }

  wallet.balance = next;
  await wallet.save({ transaction });

  const txn = await WalletTransaction.create({
    walletId: wallet.id,
    userId,
    type,
    refType,
    refId,
    amount: round2(delta),
    balanceAfter: next,
    counterpartyUserId,
    performedByUserId,
    groupRef,
    note,
  }, { transaction });

  return { wallet, txn, balanceAfter: next };
};

// ─── Rates ───────────────────────────────────────────────────────────────────
/** Effective per-vehicle price for a client: explicit rate → network default. */
const resolveRate = async (clientId) => {
  const row = await BillingRate.findOne({ where: { clientId } });
  if (row) return { monthlyPrice: Number(row.monthlyPrice), source: 'client' };
  const settings = await getSystemSettings();
  return { monthlyPrice: Number(settings.defaultMonthlyPrice || 0), source: 'default' };
};

const setRate = async ({ actor, clientId, monthlyPrice }) => {
  const cid = Number(clientId);
  if (!actor.clientIds?.includes(cid)) throw httpError('You do not have access to this client.', 403);
  const price = Number(monthlyPrice);
  if (!(price >= 0)) throw httpError('Per-vehicle price must be 0 or greater', 400);
  const [row] = await BillingRate.findOrCreate({
    where: { clientId: cid },
    defaults: { clientId: cid, monthlyPrice: price, setByUserId: actor.id },
  });
  await row.update({ monthlyPrice: price, setByUserId: actor.id });
  return { clientId: cid, monthlyPrice: price };
};

const listRates = async (actor) => {
  const ids = (actor.clientIds || []).filter((id) => id !== actor.id);
  if (!ids.length) return [];
  const [users, rates, settings] = await Promise.all([
    User.findAll({ where: { id: ids }, attributes: ['id', 'name', 'email', 'parent_id'], raw: true }),
    BillingRate.findAll({ where: { clientId: ids }, raw: true }),
    getSystemSettings(),
  ]);
  const byId = Object.fromEntries(rates.map((r) => [r.client_id ?? r.clientId, r]));
  return users.map((u) => {
    const r = byId[u.id];
    return {
      clientId: u.id,
      name: u.name,
      email: u.email,
      parentId: u.parent_id,
      monthlyPrice: r ? Number(r.monthly_price ?? r.monthlyPrice) : Number(settings.defaultMonthlyPrice || 0),
      source: r ? 'client' : 'default',
    };
  });
};

// ─── Recharge pricing (token sale) ───────────────────────────────────────────
/** The GST % an issuer applies: their own override, else the network default. */
const resolveTaxPercent = async (issuerId, transaction) => {
  const issuerMeta = await UserMeta.findOne({ where: { user_id: issuerId }, transaction });
  if (issuerMeta?.invoice_tax_percent != null) return Number(issuerMeta.invoice_tax_percent);
  const settings = await getSystemSettings();
  return Number(settings.defaultTaxPercent || 0);
};

/**
 * Money breakdown for selling `vehicles` tokens to `buyerId` at `unitPrice`
 * (per vehicle / month). `unitPrice` defaults to the buyer's stored rate.
 */
const computeRechargeAmount = async ({ sellerId, buyerId, vehicles, unitPrice, transaction }) => {
  const count = Number(vehicles);
  if (!Number.isInteger(count) || count <= 0) throw httpError('Number of vehicles must be a positive whole number', 400);

  let price = unitPrice != null && unitPrice !== '' ? Number(unitPrice) : null;
  if (price == null) price = (await resolveRate(buyerId)).monthlyPrice;
  if (!(price >= 0)) throw httpError('Per-vehicle price must be 0 or greater', 400);

  const taxPercent = await resolveTaxPercent(sellerId, transaction);
  const baseAmount = round2(price * count);
  const taxAmount = round2((baseAmount * taxPercent) / 100);
  const total = round2(baseAmount + taxAmount);
  return { vehicles: count, unitPrice: price, taxPercent, baseAmount, taxAmount, total };
};

/** Preview a recharge for the UI: vehicles × per-vehicle price (+GST). */
const quoteRecharge = async ({ actor, toUserId, vehicles, unitPrice }) => {
  const buyerId = Number(toUserId);
  if (!actor.clientIds?.includes(buyerId)) throw httpError('You do not have access to this client.', 403);
  return computeRechargeAmount({ sellerId: actor.id, buyerId, vehicles, unitPrice });
};

// ─── Invoice numbering ───────────────────────────────────────────────────────
// The counter is per-issuer/year (each issuer gets a clean 1..N sequence), so the
// issuer id MUST be part of the number string — otherwise two issuers both emit
// "<prefix>-<year>-000001" and the globally-unique invoice_number column throws a
// unique-constraint error (Sequelize surfaces it as "Validation error").
const allocateInvoiceNumber = async ({ issuerId, prefix, date, transaction }) => {
  const year = date.getFullYear();
  const scope = String(issuerId);
  await InvoiceCounter.findOrCreate({ where: { scope, year }, defaults: { scope, year, seq: 0 }, transaction });
  const counter = await InvoiceCounter.findOne({ where: { scope, year }, lock: transaction.LOCK.UPDATE, transaction });
  const next = Number(counter.seq) + 1;
  await counter.update({ seq: next }, { transaction });
  return `${prefix || 'INV'}-${scope}-${year}-${String(next).padStart(6, '0')}`;
};

const snapshotParty = (user, meta) => ({
  name: user?.name || null,
  email: user?.email || null,
  phone: user?.phone || meta?.phone || null,
  company: meta?.company_name || null,
  address: [meta?.address, meta?.city, meta?.state, meta?.zip, meta?.country].filter(Boolean).join(', ') || null,
  gstin: meta?.gstin || null,
  logoUrl: meta?.logo_url || null,
});

// ─── Vehicle activation / renewal: consume 1 token, extend billed-till 1 month ─
const addDays = (date, n) => { const d = new Date(date); d.setDate(d.getDate() + n); return d; };

/** Grace days for a client — set on the User at account creation (default 0). */
const resolveGraceDays = async (clientId, transaction) => {
  const u = await User.findByPk(clientId, { attributes: ['grace_days'], transaction });
  return u ? Number(u.grace_days || 0) : 0;
};

/** Does this owner pay for vehicles with wallet tokens? */
const ownerChargesToken = (owner) =>
  owner?.account_type === 'billable' && owner?.billing_type === 'prepaid';

/**
 * Set a vehicle's billed-till to +1 month (+ grace). Every vehicle gets an expiry
 * regardless of account type. When `chargeToken` is true (billable-prepaid owners)
 * it ALSO spends exactly 1 vehicle token from the owner's wallet — throwing
 * INSUFFICIENT_FUNDS (402) and rolling everything back when the wallet is empty.
 * Non-prepaid owners extend at no token cost. Runs inside the supplied transaction.
 */
const activateOrRenew = async ({ actor, vehicle, type, chargeToken = true, transaction }) => {
  const clientId = vehicle.client_id;
  const refType = type === 'ACTIVATION' ? 'VEHICLE_ACTIVATION' : 'VEHICLE_RENEWAL';
  const label = type === 'ACTIVATION' ? 'Activation' : 'Renewal';

  // 1. Spend 1 vehicle token for billable-prepaid owners (throws → rolls back).
  let balanceAfter = null;
  let tokenTxnId = null;
  if (chargeToken) {
    const { txn, balanceAfter: bal } = await adjustWallet({
      userId: clientId,
      delta: -TOKENS_PER_VEHICLE,
      type: 'DEBIT',
      refType,
      performedByUserId: actor?.id || null,
      refId: vehicle.id,
      note: `${label} – ${vehicle.vehicle_number || vehicle.chasis_number || `vehicle #${vehicle.id}`} (1 vehicle token)`,
      transaction,
    });
    balanceAfter = bal;
    tokenTxnId = txn.id;
  }

  // 2. ACTUAL expiry: activation from now; renewal extends from current expiry if still valid.
  const now = new Date();
  let periodStart = now;
  if (type === 'RENEWAL') {
    const cur = vehicle.subscription_expires_at ? new Date(vehicle.subscription_expires_at) : null;
    periodStart = cur && cur > now ? cur : now;
  }
  const actualExpiry = addMonths(periodStart, SUBSCRIPTION_MONTHS);

  // 3. GRACE expiry = actual + the client's grace days (set on the profile).
  const graceDays = await resolveGraceDays(clientId, transaction);
  const graceExpiry = graceDays > 0 ? addDays(actualExpiry, graceDays) : actualExpiry;

  // 4. Set both dates, reactivate the vehicle, and clear the reminder so the next
  //    term reminds again.
  await vehicle.update({
    subscription_expires_at: actualExpiry,
    grace_expires_at: graceExpiry,
    expiry_reminder_sent_at: null,
    status: 'active',
  }, { transaction });

  return { tokenTxnId, balanceAfter, periodEnd: actualExpiry, graceExpiry, graceDays };
};

/**
 * Apply the initial 1-month term to a brand-new vehicle. Charges a token only for
 * billable-prepaid owners. Meant to run inside the vehicle-create transaction so a
 * prepaid client with an empty wallet has the whole add rolled back (402).
 */
const activateVehicleOnAdd = async ({ actor, vehicle, chargeToken, transaction }) =>
  activateOrRenew({ actor, vehicle, type: 'ACTIVATION', chargeToken, transaction });

/**
 * Renew an existing vehicle (+1 month from current expiry). Billable-prepaid owners
 * spend 1 token (fails if the wallet is empty); everyone else extends at no cost.
 * Opens its own transaction.
 */
const renewVehicle = async ({ actor, vehicleId }) => {
  return sequelize.transaction(async (t) => {
    const vehicle = await Vehicle.findOne({ where: { id: vehicleId }, lock: t.LOCK.UPDATE, transaction: t });
    if (!vehicle) throw httpError('Vehicle not found', 404);
    if (actor.clientIds && !actor.clientIds.includes(vehicle.client_id)) throw httpError('You do not have access to this vehicle.', 403);
    const owner = await User.findByPk(vehicle.client_id, { attributes: ['billing_type', 'account_type'], transaction: t });
    const result = await activateOrRenew({ actor, vehicle, type: 'RENEWAL', chargeToken: ownerChargesToken(owner), transaction: t });
    return {
      balanceAfter: result.balanceAfter,
      subscriptionExpiresAt: result.periodEnd,
      graceExpiresAt: result.graceExpiry,
    };
  });
};

/**
 * Papa-only manual override of a vehicle's expiry dates. Does NOT touch wallets or
 * tokens — it's an administrative correction. Pass `subscriptionExpiresAt` (actual)
 * and optionally `graceExpiresAt` (defaults to the same). Reactivates the vehicle
 * when the new expiry is in the future and clears the reminder flag.
 */
const setVehicleExpiry = async ({ actor, vehicleId, subscriptionExpiresAt, graceExpiresAt }) => {
  if (actor.role !== 'papa') throw httpError('Only the network owner can override vehicle expiry.', 403);
  const vehicle = await Vehicle.findByPk(vehicleId);
  if (!vehicle) throw httpError('Vehicle not found', 404);

  const actual = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null;
  if (subscriptionExpiresAt && isNaN(actual?.getTime())) throw httpError('Invalid expiry date', 400);
  const grace = graceExpiresAt ? new Date(graceExpiresAt) : actual;
  if (graceExpiresAt && isNaN(grace?.getTime())) throw httpError('Invalid grace date', 400);
  if (actual && grace && grace < actual) throw httpError('Grace expiry cannot be before the actual expiry', 400);

  const updates = {
    subscription_expires_at: actual,
    grace_expires_at: grace,
    expiry_reminder_sent_at: null,
  };
  // Reactivate if the new validity is in the future; deactivate if already past grace.
  if (grace) updates.status = grace > new Date() ? 'active' : 'deleted';
  await vehicle.update(updates);
  return {
    id: vehicle.id,
    subscriptionExpiresAt: vehicle.subscription_expires_at,
    graceExpiresAt: vehicle.grace_expires_at,
    status: vehicle.status,
  };
};

/**
 * Set a client account's grace period (extra days beyond the 1-month term on each
 * activation/renewal). A dealer/top account can set it for any account in its
 * network. Applies to future add/renew — existing vehicle dates are unchanged.
 */
const setClientGrace = async ({ actor, clientId, graceDays }) => {
  const cid = Number(clientId);
  if (actor.clientIds && !actor.clientIds.includes(cid)) throw httpError('You do not have access to this client.', 403);
  const days = parseInt(graceDays, 10);
  if (!Number.isInteger(days) || days < 0) throw httpError('Grace days must be a whole number of 0 or greater', 400);
  const user = await User.findByPk(cid);
  if (!user) throw httpError('Client not found', 404);
  await user.update({ grace_days: days });
  return { clientId: cid, graceDays: days };
};

/**
 * Set a client account's billing plan: account_type (trial | billable) and, when
 * billable, billing_type (prepaid | postpaid). A dealer/top account can change it
 * for any account in its network. Non-billable accounts default billing_type to
 * postpaid (the token wallet only applies to billable-prepaid).
 */
const ACCOUNT_TYPES = ['trial', 'billable', 'demo'];
const BILLING_TYPES = ['prepaid', 'postpaid'];
const setClientAccount = async ({ actor, clientId, accountType, billingType }) => {
  const cid = Number(clientId);
  if (actor.clientIds && !actor.clientIds.includes(cid)) throw httpError('You do not have access to this client.', 403);
  const user = await User.findByPk(cid);
  if (!user) throw httpError('Client not found', 404);

  const updates = {};
  if (accountType !== undefined) {
    if (!ACCOUNT_TYPES.includes(accountType)) throw httpError('Invalid account type', 400);
    updates.account_type = accountType;
  }
  const effectiveType = updates.account_type ?? user.account_type;
  if (effectiveType === 'billable') {
    const bt = billingType ?? user.billing_type ?? 'postpaid';
    if (!BILLING_TYPES.includes(bt)) throw httpError('Invalid billing type', 400);
    updates.billing_type = bt;
  } else if (accountType !== undefined) {
    // Non-billable accounts don't use the token wallet — normalise to postpaid.
    updates.billing_type = 'postpaid';
  }

  await user.update(updates);
  return { clientId: cid, accountType: user.account_type, billingType: user.billing_type };
};

// ─── Token movements: mint + recharge (the chain) ────────────────────────────
/** Papa mints vehicle tokens into its own wallet — the origin of all tokens. */
const mintCoins = async ({ actor, amount, note }) => {
  if (actor.role !== 'papa') throw httpError('Only the network owner can mint tokens.', 403);
  const amt = Number(amount);
  if (!Number.isInteger(amt) || amt <= 0) throw httpError('Enter a whole number of vehicle tokens', 400);
  return sequelize.transaction(async (t) => {
    const { balanceAfter, txn } = await adjustWallet({
      userId: actor.id, delta: amt, type: 'MINT', refType: 'MINT',
      performedByUserId: actor.id, note: note || `Minted ${amt} vehicle token${amt > 1 ? 's' : ''}`, transaction: t,
    });
    return { balanceAfter, transactionId: txn.id };
  });
};

/**
 * Recharge a DIRECT child's wallet with VEHICLE TOKENS (the chain: papa → dealer →
 * client). The parent enters the number of vehicles; that many TOKENS move from
 * the parent's wallet to the child's (parent must hold enough). The ₹ value of the
 * sale = `vehicles × per-vehicle price` (+ GST) is captured on a printable
 * RECHARGE invoice. Token moves + invoice are atomic (shared groupRef).
 */
const transferCoins = async ({ actor, toUserId, vehicles, unitPrice, note }) => {
  const recipientId = Number(toUserId);
  if (recipientId === Number(actor.id)) throw httpError('Cannot transfer to your own wallet', 400);

  const recipient = await User.findByPk(recipientId);
  if (!recipient) throw httpError('Recipient not found', 404);
  if (Number(recipient.parent_id) !== Number(actor.id)) {
    throw httpError('You can only add vehicles to your own direct clients.', 403);
  }

  const count = Number(vehicles);
  if (!Number.isInteger(count) || count <= 0) throw httpError('Enter a whole number of vehicles', 400);

  const money = await computeRechargeAmount({ sellerId: actor.id, buyerId: recipientId, vehicles: count, unitPrice });
  const detail = `${count} vehicle${count > 1 ? 's' : ''} × ₹${money.unitPrice}/mo`;
  const groupRef = crypto.randomUUID();

  return sequelize.transaction(async (t) => {
    // Persist the per-vehicle price the parent set/changed at recharge.
    if (unitPrice != null && unitPrice !== '') {
      const [rateRow] = await BillingRate.findOrCreate({
        where: { clientId: recipientId },
        defaults: { clientId: recipientId, monthlyPrice: money.unitPrice, setByUserId: actor.id },
        transaction: t,
      });
      await rateRow.update({ monthlyPrice: money.unitPrice, setByUserId: actor.id }, { transaction: t });
    }

    // Pre-create + lock both wallets in a stable order.
    await Wallet.findOrCreate({ where: { userId: actor.id }, defaults: { userId: actor.id, balance: 0 }, transaction: t });
    await Wallet.findOrCreate({ where: { userId: recipientId }, defaults: { userId: recipientId, balance: 0 }, transaction: t });
    for (const uid of [actor.id, recipientId].sort((a, b) => a - b)) {
      await Wallet.findOne({ where: { userId: uid }, lock: t.LOCK.UPDATE, transaction: t });
    }

    // Move TOKENS (vehicles). Parent must hold >= count tokens.
    const debit = await adjustWallet({
      userId: actor.id, delta: -count, type: 'DEBIT', refType: 'TRANSFER',
      counterpartyUserId: recipientId, performedByUserId: actor.id, groupRef,
      note: note || `Recharge to ${recipient.name} — ${detail}`, transaction: t,
    });
    const credit = await adjustWallet({
      userId: recipientId, delta: count, type: 'CREDIT', refType: 'TRANSFER',
      counterpartyUserId: actor.id, performedByUserId: actor.id, groupRef,
      note: note || `Recharge from ${actor.name} — ${detail}`, transaction: t,
    });

    // Invoice for the token sale (seller = actor, buyer = recipient).
    const [seller, sellerMeta, buyer, buyerMeta] = await Promise.all([
      User.findByPk(actor.id, { transaction: t }),
      UserMeta.findOne({ where: { user_id: actor.id }, transaction: t }),
      User.findByPk(recipientId, { transaction: t }),
      UserMeta.findOne({ where: { user_id: recipientId }, transaction: t }),
    ]);
    const invoiceNumber = await allocateInvoiceNumber({ issuerId: actor.id, prefix: sellerMeta?.invoice_prefix, date: new Date(), transaction: t });
    const invoice = await Invoice.create({
      invoiceNumber,
      type: 'RECHARGE',
      status: 'PAID',
      clientId: recipientId,
      issuedByUserId: actor.id,
      vehicleId: null,
      vehicleCount: count,
      cycle: 'MONTHLY',
      cycleMonths: SUBSCRIPTION_MONTHS,
      periodStart: null,
      periodEnd: null,
      monthlyPrice: money.unitPrice,
      baseAmount: money.baseAmount,
      taxPercent: money.taxPercent,
      taxAmount: money.taxAmount,
      totalAmount: money.total,
      walletTransactionId: debit.txn.id,
      issuerSnapshot: snapshotParty(seller, sellerMeta),
      clientSnapshot: snapshotParty(buyer, buyerMeta),
      vehicleSnapshot: null,
    }, { transaction: t });
    await debit.txn.update({ refId: invoice.id }, { transaction: t });

    return {
      fromBalance: debit.balanceAfter, toBalance: credit.balanceAfter,
      vehicles: count, unitPrice: money.unitPrice, amount: money.total,
      invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, groupRef,
    };
  });
};

// ─── Reads ───────────────────────────────────────────────────────────────────
const serializeTxn = (t) => ({
  id: t.id,
  type: t.type,
  refType: t.refType,
  refId: t.refId,
  tokenType: t.tokenType,
  amount: Number(t.amount),
  balanceAfter: Number(t.balanceAfter),
  counterpartyUserId: t.counterpartyUserId,
  counterpartyName: t.counterparty?.name || null,
  note: t.note,
  createdAt: t.get('createdAt') || t.get('created_at'),
});

const TXN_INCLUDE = [{ model: User, as: 'counterparty', attributes: ['id', 'name'] }];

const getMyWallet = async (user) => {
  const [wallet] = await Wallet.findOrCreate({ where: { userId: user.id }, defaults: { userId: user.id, balance: 0 } });
  const recent = await WalletTransaction.findAll({
    where: { userId: user.id }, include: TXN_INCLUDE, order: [['created_at', 'DESC']], limit: 15,
  });
  return { userId: user.id, balance: Number(wallet.balance), status: wallet.status, recent: recent.map(serializeTxn) };
};

const listTransactions = async ({ user, targetUserId, page = 1, limit = 25, direction, from, to }) => {
  let userId = user.id;
  if (targetUserId && Number(targetUserId) !== Number(user.id)) {
    if (!user.clientIds?.includes(Number(targetUserId))) throw httpError('You do not have access to this wallet.', 403);
    userId = Number(targetUserId);
  }

  const where = { userId };
  // Direction: credit = tokens in (amount > 0), debit = tokens out (amount < 0).
  if (direction === 'credit') where.amount = { [Op.gt]: 0 };
  else if (direction === 'debit') where.amount = { [Op.lt]: 0 };
  // Date range on created_at (inclusive; `to` covers the whole day).
  if (from || to) {
    where.created_at = {};
    if (from) where.created_at[Op.gte] = new Date(`${from}T00:00:00`);
    if (to)   where.created_at[Op.lte] = new Date(`${to}T23:59:59.999`);
  }

  const lim = Math.min(Number(limit) || 25, 5000); // high cap allows export of all rows
  const offset = (Math.max(Number(page) || 1, 1) - 1) * lim;
  const { count, rows } = await WalletTransaction.findAndCountAll({
    where, include: TXN_INCLUDE, order: [['created_at', 'DESC']], limit: lim, offset,
  });
  return { total: count, page: Number(page) || 1, limit: lim, rows: rows.map(serializeTxn) };
};

const listNetworkWallets = async (user) => {
  const children = await User.findAll({
    where: { parent_id: user.id },
    attributes: ['id', 'name', 'email', 'status', 'billing_type'],
    raw: true,
  });
  if (!children.length) return [];
  const ids = children.map((c) => c.id);
  const [wallets, rates, settings] = await Promise.all([
    Wallet.findAll({ where: { userId: ids }, raw: true }),
    BillingRate.findAll({ where: { clientId: ids }, raw: true }),
    getSystemSettings(),
  ]);
  const walByUser = Object.fromEntries(wallets.map((w) => [w.user_id ?? w.userId, w]));
  const rateByUser = Object.fromEntries(rates.map((r) => [r.client_id ?? r.clientId, Number(r.monthly_price ?? r.monthlyPrice)]));
  return children.map((c) => {
    const w = walByUser[c.id];
    return {
      id: c.id,
      name: c.name,
      email: c.email,
      status: c.status,
      billingType: c.billing_type || 'postpaid',
      balance: w ? Number(w.balance) : 0,
      monthlyPrice: rateByUser[c.id] ?? Number(settings.defaultMonthlyPrice || 0),
      rateSource: rateByUser[c.id] != null ? 'client' : 'default',
    };
  });
};

const serializeInvoice = (inv) => {
  const j = inv.toJSON();
  return {
    id: j.id,
    invoiceNumber: j.invoiceNumber,
    type: j.type,
    status: j.status,
    clientId: j.clientId,
    issuedByUserId: j.issuedByUserId,
    vehicleId: j.vehicleId,
    vehicleCount: j.vehicleCount,
    tokenType: j.tokenType,
    accountable: j.accountable,
    cycle: j.cycle,
    cycleMonths: j.cycleMonths,
    periodStart: j.periodStart,
    periodEnd: j.periodEnd,
    monthlyPrice: Number(j.monthlyPrice),
    baseAmount: Number(j.baseAmount),
    taxPercent: Number(j.taxPercent),
    taxAmount: Number(j.taxAmount),
    totalAmount: Number(j.totalAmount),
    issuerSnapshot: j.issuerSnapshot,
    clientSnapshot: j.clientSnapshot,
    vehicleSnapshot: j.vehicleSnapshot,
    client: j.client,
    issuer: j.issuer,
    vehicle: j.vehicle,
    createdAt: j.created_at || j.createdAt,
  };
};

const listInvoices = async ({ user, page = 1, limit = 25, clientId, vehicleId, type }) => {
  const scopeIds = user.clientIds || [user.id];
  const where = { clientId: scopeIds };
  if (clientId) {
    if (!scopeIds.includes(Number(clientId))) throw httpError('You do not have access to this client.', 403);
    where.clientId = Number(clientId);
  }
  if (vehicleId) where.vehicleId = Number(vehicleId);
  if (type && ['RECHARGE', 'ACTIVATION', 'RENEWAL'].includes(type)) where.type = type;

  const lim = Math.min(Number(limit) || 25, 200);
  const offset = (Math.max(Number(page) || 1, 1) - 1) * lim;
  const { count, rows } = await Invoice.findAndCountAll({
    where,
    include: [
      { model: User, as: 'client', attributes: ['id', 'name'] },
      { model: Vehicle, as: 'vehicle', attributes: ['id', 'vehicle_number'] },
    ],
    order: [['created_at', 'DESC']],
    limit: lim,
    offset,
  });
  return { total: count, page: Number(page) || 1, limit: lim, rows: rows.map(serializeInvoice) };
};

const getInvoice = async (user, id) => {
  const inv = await Invoice.findByPk(id, {
    include: [
      { model: User, as: 'client', attributes: ['id', 'name', 'email'] },
      { model: User, as: 'issuer', attributes: ['id', 'name', 'email'] },
      { model: Vehicle, as: 'vehicle', attributes: ['id', 'vehicle_number', 'chasis_number', 'engine_number'] },
    ],
  });
  if (!inv) throw httpError('Invoice not found', 404);
  const scopeIds = user.clientIds || [user.id];
  if (!scopeIds.includes(inv.clientId)) throw httpError('You do not have access to this invoice.', 403);
  return serializeInvoice(inv);
};

// ─── Issuer billing settings (GST + branding on UserMeta) ────────────────────
const getBillingSettings = async (user) => {
  const meta = await UserMeta.findOne({ where: { user_id: user.id } });
  const settings = await getSystemSettings();
  return {
    gstin: meta?.gstin || '',
    invoiceTaxPercent: meta?.invoice_tax_percent != null ? Number(meta.invoice_tax_percent) : null,
    invoicePrefix: meta?.invoice_prefix || '',
    logoUrl: meta?.logo_url || '',
    companyName: meta?.company_name || '',
    address: meta?.address || '',
    effectiveTaxPercent: meta?.invoice_tax_percent != null ? Number(meta.invoice_tax_percent) : Number(settings.defaultTaxPercent || 0),
  };
};

const updateBillingSettings = async (user, { gstin, invoiceTaxPercent, invoicePrefix, logoUrl }) => {
  const [meta] = await UserMeta.findOrCreate({ where: { user_id: user.id }, defaults: { user_id: user.id } });
  const updates = {};
  if (gstin !== undefined) updates.gstin = gstin || null;
  if (invoicePrefix !== undefined) updates.invoice_prefix = invoicePrefix || null;
  if (logoUrl !== undefined) updates.logo_url = logoUrl || null;
  if (invoiceTaxPercent !== undefined) {
    const v = invoiceTaxPercent === '' || invoiceTaxPercent === null ? null : Number(invoiceTaxPercent);
    if (v !== null && (isNaN(v) || v < 0 || v > 100)) throw httpError('Tax % must be between 0 and 100', 400);
    updates.invoice_tax_percent = v;
  }
  await meta.update(updates);
  return getBillingSettings(user);
};

module.exports = {
  SUBSCRIPTION_MONTHS,
  TOKENS_PER_VEHICLE,
  adjustWallet,
  resolveRate,
  setRate,
  listRates,
  computeRechargeAmount,
  quoteRecharge,
  ownerChargesToken,
  activateOrRenew,
  activateVehicleOnAdd,
  renewVehicle,
  setVehicleExpiry,
  setClientGrace,
  setClientAccount,
  mintCoins,
  transferCoins,
  getMyWallet,
  listTransactions,
  listNetworkWallets,
  listInvoices,
  getInvoice,
  getBillingSettings,
  updateBillingSettings,
};
