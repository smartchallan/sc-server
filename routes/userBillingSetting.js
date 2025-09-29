const express = require('express');
const router = express.Router();

module.exports = (models) => {
  const { UserBilling } = models;

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

    return router;
};
