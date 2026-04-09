const express = require('express');
const router = express.Router();

const userVehicleService = require('../services/userVehicleService');
const { getRTODetails } = require('../services/vehicleRTOService');
const { getChallanDetails } = require('../services/vehicleChallanService');

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
        // Logging response
        console.table([result.vehicle.toJSON ? result.vehicle.toJSON() : result.vehicle]);
        // Respond immediately, then kick off RTO + challan fetch in background
        res.status(201).json(result);
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
