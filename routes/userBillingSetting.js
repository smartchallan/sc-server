const express = require('express');
const router = express.Router();
const { sendMail } = require('../services/emailService');

const DAYS_15 = 15 * 24 * 60 * 60 * 1000;

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

module.exports = (models) => {
  const { UserBilling, User } = models;
  console.log('UserBilling model:', UserBilling);

  // POST /userbillingsetting

  router.post('/userbillingsetting', async (req, res) => {
    const {
      user_id,
      user_type,
      billing_type,
      cost_per_month_per_vehicle,
      cost_per_challan_request,
      billing_plan_status,
      plan_start_dt,
      plan_end_dt
    } = req.body;

    console.table([{ user_id, user_type, billing_type, cost_per_month_per_vehicle, cost_per_challan_request, billing_plan_status, plan_start_dt, plan_end_dt }]);

    if (!user_id || !user_type || !billing_type) {
      return res.status(400).json({ error: 'user_id, user_type, and billing_type are required.' });
    }

    try {
      // Lookup for active billing plan for this user
      const activeBilling = await UserBilling.findOne({
        where: {
          user_id,
          user_type,
          billing_plan_status: 'active'
        }
      });

      if (activeBilling) {
        // Update previous active record to inactive and update timestamps
        await activeBilling.update({
          billing_plan_status: 'inactive',
          plan_end_dt: new Date(),
          updated_dt: new Date()
        });
      }

      // Insert new billing record
      const billingRecord = await UserBilling.create({
        user_id,
        user_type,
        billing_type,
        cost_per_month_per_vehicle,
        cost_per_challan_request,
        billing_plan_status,
        plan_start_dt,
        plan_end_dt
      });

      console.table([billingRecord.toJSON()]);
      res.status(201).json({ message: 'Billing setting created', billingRecord });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  
    router.get('/userbillingsetting', async (req, res) => {
      const client_id = req.query.client_id;
      if (!client_id) {
        return res.status(400).json({ error: 'client_id is required as query param.' });
      }
      try {
        const billingRecords = await UserBilling.findAll({
          where: { user_id: client_id }
        });
        res.json({ billingRecords });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // PATCH /userbillingsetting/:id — dealer updates plan_end_dt (billed till date)
    router.patch('/userbillingsetting/:id', async (req, res) => {
      const { plan_end_dt, billing_plan_status } = req.body;
      if (!plan_end_dt) {
        return res.status(400).json({ error: 'plan_end_dt is required.' });
      }
      try {
        const record = await UserBilling.findOne({ where: { id: req.params.id } });
        if (!record) return res.status(404).json({ error: 'Billing record not found.' });
        const updates = { plan_end_dt };
        if (billing_plan_status) updates.billing_plan_status = billing_plan_status;
        await record.update(updates);
        return res.json({ message: 'Billing record updated.', record });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    });

    // PUT /clientbilling — dealer sets/updates billed-till date for a client
    router.put('/clientbilling', async (req, res) => {
      const { client_id, dealer_id, plan_end_dt } = req.body;
      if (!client_id || !dealer_id || !plan_end_dt) {
        return res.status(400).json({ error: 'client_id, dealer_id, and plan_end_dt are required.' });
      }
      try {
        // Upsert: find active record or create
        let record = await UserBilling.findOne({
          where: { user_id: client_id, billing_plan_status: 'active' }
        });
        if (record) {
          await record.update({ plan_end_dt });
        } else {
          record = await UserBilling.create({
            user_id: client_id,
            user_type: 'client',
            billing_type: 'postpaid',
            billing_plan_status: 'active',
            plan_start_dt: new Date(),
            plan_end_dt,
          });
        }

        // Promote the client's account to 'billable' if not already
        try {
          const clientUser = await User.findOne({ where: { id: client_id }, attributes: ['id', 'account_type'] });
          if (clientUser && clientUser.account_type !== 'billable') {
            await clientUser.update({ account_type: 'billable' });
          }
        } catch (acctErr) {
          console.error('[billing] failed to update account_type to billable:', acctErr);
        }

        // Send email alert to dealer if expiry is within 15 days
        const days = daysUntil(plan_end_dt);
        if (days !== null && days <= 15) {
          const dealer = await User.findOne({ where: { id: dealer_id }, attributes: ['email', 'name'] });
          const client = await User.findOne({ where: { id: client_id }, attributes: ['email', 'name'] });
          if (dealer && dealer.email) {
            const expiryLabel = days <= 0 ? 'already expired' : `expiring in ${days} day${days !== 1 ? 's' : ''}`;
            const html = `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#fff8e1;border-radius:8px;border:1px solid #ffe082;">
                <h2 style="color:#e65100;">⚠️ Billing Expiry Alert</h2>
                <p>The subscription for your client <b>${client?.name || `#${client_id}`}</b> is <b>${expiryLabel}</b>.</p>
                <p><b>Billed Till:</b> ${new Date(plan_end_dt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                <p style="font-size:13px;color:#757575;">Please renew their subscription or update the billing date in your SmartChallan dealer panel.</p>
              </div>`;
            sendMail({ to: dealer.email, subject: `Billing expiry alert — ${client?.name || `Client #${client_id}`}`, html })
              .catch(err => console.error('[billing] email send failed:', err));
          }
        }

        return res.json({ message: 'Billing updated.', record });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    });

    // GET /userbillingsetting/dealer?dealer_id=X — fetch active billing records for all clients under a dealer
    router.get('/userbillingsetting/dealer', async (req, res) => {
      const { dealer_id } = req.query;
      if (!dealer_id) return res.status(400).json({ error: 'dealer_id is required.' });
      try {
        // Get all clients in dealer's network first via subquery-style approach
        const { User } = models;
        const clients = await User.findAll({ where: { parent_id: dealer_id }, attributes: ['id'] });
        const clientIds = clients.map(c => c.id);
        if (clientIds.length === 0) return res.json({ billingRecords: [] });
        const { Op } = require('sequelize');
        const billingRecords = await UserBilling.findAll({
          where: { user_id: { [Op.in]: clientIds }, billing_plan_status: 'active' }
        });
        return res.json({ billingRecords });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    });

    return router;
};
