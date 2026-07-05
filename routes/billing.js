const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const resolveBillingActor = require('../middleware/resolveBillingActor');

// All billing routes need the derived actor (role + network scope). `validateClient`
// (app-level) has already verified the JWT and set req.client before we get here.
router.use(resolveBillingActor);

// Billing-management guard: papa OR anyone with a downline (dealer) may recharge /
// manage. This is what lets a DEALER recharge its own direct sub-dealers/clients.
const requireBillingManager = (req, res, next) => {
  const u = req.user;
  if (u?.role === 'papa' || u?.hasClients === true) return next();
  return res.status(403).json({ success: false, message: 'You do not have permission to manage billing.' });
};

// ── Wallet (any authenticated user may view their OWN wallet/ledger) ──────────
router.get('/wallet',              billingController.getMyWallet);
router.get('/wallet/transactions', billingController.getTransactions);

// ── Network chain (papa + any dealer over their own direct children) ─────────
router.get('/network/wallets',  requireBillingManager, billingController.getNetworkWallets);
router.post('/mint',            requireBillingManager, billingController.mint);      // service enforces papa-only
router.post('/transfer',        requireBillingManager, billingController.transfer);

// ── Rate card (papa / dealer) ────────────────────────────────────────────────
router.get('/rates',                requireBillingManager, billingController.getRates);
router.put('/rates/:clientId',      requireBillingManager, billingController.setRate);

// ── Grace period per client account (dealer / papa) ──────────────────────────
router.put('/clients/:clientId/grace', requireBillingManager, billingController.setClientGrace);

// ── Quote (preview cost before charging) ─────────────────────────────────────
router.get('/quote', billingController.getQuote);

// ── Renew a vehicle's subscription ───────────────────────────────────────────
router.post('/vehicles/:id/renew', billingController.renewVehicle);

// ── Papa: manually override a vehicle's expiry (no token spend) ──────────────
router.put('/vehicles/:id/expiry', billingController.setVehicleExpiry);

// ── Invoices ─────────────────────────────────────────────────────────────────
router.get('/invoices',     billingController.getInvoices);
router.get('/invoices/:id', billingController.getInvoice);

// ── Issuer billing settings (GST + branding) ─────────────────────────────────
router.get('/settings',  billingController.getSettings);
router.put('/settings',  requireBillingManager, billingController.updateSettings);

module.exports = router;
