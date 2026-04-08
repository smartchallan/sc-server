const express = require('express');
const router = express.Router();

const userVehicleService = require('../services/userVehicleService');

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
        return res.status(201).json(result);
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
