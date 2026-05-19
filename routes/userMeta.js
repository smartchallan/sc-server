const express = require('express');
const router = express.Router();

const PRICING_FIELDS = [
  'default_online_fee',
  'default_court_fee',
  'default_virtual_court_fee',
  'default_gst_percent',
];

const PAYMENT_FIELDS = ['upi_id', 'upi_payee_name'];

const toNum = (v) => (v == null || v === '' ? null : Number(v));

module.exports = (models) => {
  const { User, UserMeta } = models;

  // PUT /usermeta — upsert pricing/UPI/profile fields for a given user_id.
  // Only allowed: payment + pricing fields here (kept narrow on purpose).
  router.put('/', async (req, res) => {
    try {
      const { user_id } = req.body;
      if (!user_id) return res.status(400).json({ error: 'user_id is required.' });

      const updates = {};
      for (const f of [...PAYMENT_FIELDS, ...PRICING_FIELDS]) {
        if (Object.prototype.hasOwnProperty.call(req.body, f)) {
          updates[f] = req.body[f] === '' ? null : req.body[f];
        }
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No updatable fields provided.' });
      }

      let meta = await UserMeta.findOne({ where: { user_id } });
      if (meta) {
        await meta.update(updates);
      } else {
        meta = await UserMeta.create({ user_id, ...updates });
      }
      return res.json({ message: 'User meta updated.', meta });
    } catch (err) {
      console.error('[usermeta PUT] error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /usermeta/pricing?client_id=X
  // Resolves effective pricing + UPI payee info for a client.
  // - UPI: comes from the immediate dealer (parent) only. If parent has no UPI, payment service unavailable.
  // - Pricing: client override on user_meta > dealer (parent) defaults. If unset everywhere, falls back to null
  //   (caller should treat that as "not configured" and avoid showing a price).
  router.get('/pricing', async (req, res) => {
    try {
      const { client_id } = req.query;
      if (!client_id) return res.status(400).json({ error: 'client_id is required.' });

      const client = await User.findOne({ where: { id: client_id }, attributes: ['id', 'parent_id', 'name'] });
      if (!client) return res.status(404).json({ error: 'Client not found.' });

      const clientMeta = await UserMeta.findOne({ where: { user_id: client.id }, raw: true });

      let dealerMeta = null;
      let dealer = null;
      if (client.parent_id) {
        dealer = await User.findOne({ where: { id: client.parent_id }, attributes: ['id', 'name'] });
        dealerMeta = await UserMeta.findOne({ where: { user_id: client.parent_id }, raw: true });
      }

      const pick = (field) => {
        const c = clientMeta && clientMeta[field];
        if (c != null && c !== '') return { value: toNum(c), source: 'client' };
        const d = dealerMeta && dealerMeta[field];
        if (d != null && d !== '') return { value: toNum(d), source: 'dealer' };
        return { value: null, source: null };
      };

      const pricing = {
        online_fee: pick('default_online_fee'),
        court_fee: pick('default_court_fee'),
        virtual_court_fee: pick('default_virtual_court_fee'),
        gst_percent: pick('default_gst_percent'),
      };

      const upi = {
        upi_id: dealerMeta && dealerMeta.upi_id ? dealerMeta.upi_id : null,
        payee_name: (dealerMeta && dealerMeta.upi_payee_name) || (dealer && dealer.name) || null,
        dealer_id: dealer ? dealer.id : null,
        dealer_name: dealer ? dealer.name : null,
      };

      const paymentAvailable = !!upi.upi_id;
      const pricingComplete = !!(pricing.online_fee.value != null && pricing.gst_percent.value != null);

      return res.json({
        client_id: client.id,
        client_name: client.name,
        parent_id: client.parent_id,
        upi,
        pricing,
        paymentAvailable,
        pricingComplete,
      });
    } catch (err) {
      console.error('[usermeta/pricing GET] error:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /usermeta?user_id=X — fetch raw meta for a user (used by the profile UI)
  router.get('/', async (req, res) => {
    try {
      const { user_id } = req.query;
      if (!user_id) return res.status(400).json({ error: 'user_id is required.' });
      const meta = await UserMeta.findOne({ where: { user_id }, raw: true });
      return res.json({ meta: meta || null });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
};
