const express = require('express');
const router = express.Router();

const userVehicleService = require('../services/userVehicleService');
const { getRTODetails } = require('../services/vehicleRTOService');
const { getChallanDetails } = require('../services/vehicleChallanService');
const { sequelize } = require('../models');
const billingService = require('../services/billing.service');

/**
 * Fire-and-forget: fetch RTO + challan data for a newly registered vehicle.
 * Runs after the HTTP response has already been sent — errors are only logged.
 */
function triggerInitialDataFetch(vehicle_number, client_id) {
  setImmediate(async () => {
    console.table({ action: 'initial_data_fetch_start', vehicle_number, client_id });
    const results = await Promise.allSettled([
      getRTODetails(vehicle_number, client_id),
      getChallanDetails(vehicle_number, client_id),
    ]);
    results.forEach((r, i) => {
      const label = i === 0 ? 'RTO' : 'Challan';
      if (r.status === 'rejected') {
        console.error(`[initial_data_fetch] ${label} failed for ${vehicle_number}:`, r.reason?.message || r.reason);
      } else {
        console.table({ action: `initial_data_fetch_${label}_ok`, vehicle_number });
      }
    });
  });
}

module.exports = (UserVehicle, models) => {
  const serviceFactory = userVehicleService;

  // Register a new vehicle
  router.post('/register', async (req, res) => {
    const { vehicle_number, chasis_number, engine_number, client_id } = req.body;

    // Logging request
    console.table([{ vehicle_number, chasis_number, engine_number, client_id }]);

    try {
      // Trial account vehicle limit check
      if (models && models.User && client_id) {
        const user = await models.User.findOne({ where: { id: client_id } });
        if (user && user.account_type === 'trial') {
          const LIMIT = parseInt(process.env.TRIAL_VEHICLE_LIMIT, 10) || 10;
          const { Op } = require('sequelize');
          const count = await UserVehicle.count({
            where: { client_id, status: { [Op.ne]: 'deleted' } }
          });
          if (count >= LIMIT) {
            return res.status(403).json({
              error: `Trial accounts can only add up to ${LIMIT} vehicles. Please upgrade to add more.`
            });
          }
        }
      }

      const service = serviceFactory(UserVehicle);
      const result = await service.registerVehicle(req.body);

      console.log('checkpoint 1');

      if (result && result.message === 'vehicle already registered') {
        console.log('Vehicle registration failed:', result.message);
        return res.status(400).json({ message: result.message });
      }

      if (result && result.vehicle) {
        // Apply the 1-month subscription term (+ grace) to the new vehicle. Billable
        // -prepaid owners also spend 1 token — if their wallet is empty the whole add
        // is rolled back (the vehicle row is removed) and we return 402.
        try {
          const owner = models && models.User && client_id
            ? await models.User.findByPk(client_id)
            : null;
          const chargeToken = billingService.ownerChargesToken(owner);
          await sequelize.transaction(async (t) => {
            const v = await UserVehicle.findOne({ where: { id: result.vehicle.id }, lock: t.LOCK.UPDATE, transaction: t });
            await billingService.activateOrRenew({
              actor: { id: req.client?.id }, vehicle: v, type: 'ACTIVATION', chargeToken, transaction: t,
            });
          });
        } catch (termErr) {
          if (termErr.status === 402 || termErr.code === 'INSUFFICIENT_FUNDS') {
            // Prepaid client with no tokens — undo the add so nothing is charged.
            await UserVehicle.destroy({ where: { id: result.vehicle.id } });
            return res.status(402).json({ error: termErr.message, code: termErr.code, details: termErr.details });
          }
          // Non-fatal (e.g. transient): keep the vehicle; expiry can be set later.
          console.error('[register] failed to apply subscription term:', termErr.message);
        }

        // Reload so the response carries the freshly-set expiry dates.
        const fresh = await UserVehicle.findByPk(result.vehicle.id);
        console.table([fresh ? fresh.toJSON() : result.vehicle]);
        res.status(201).json({ message: result.message, vehicle: fresh || result.vehicle });
        const vn = (result.vehicle.vehicle_number || vehicle_number || '').trim().toUpperCase();
        if (vn && client_id) triggerInitialDataFetch(vn, client_id);
        return;
      }

      // Fallback
      return res.status(200).json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get vehicles by admin_id, dealer_id, or client_id
  router.get('/', async (req, res) => {
    try {
      const { admin_id, dealer_id, client_id } = req.query;
      const service = serviceFactory(UserVehicle);
      const vehicles = await service.getUserVehicles({ admin_id, dealer_id, client_id });
      // Logging response
      console.table(vehicles);
      res.json({ vehicles });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};
