const express = require('express');
const router = express.Router();

const userVehicleService = require('../services/userVehicleService');

module.exports = (UserVehicle) => {
  const serviceFactory = userVehicleService;

  // Register a new vehicle
  router.post('/register', async (req, res) => {
    const { vehicle_number, chasis_number, engine_number, client_id, dealer_id, admin_id } = req.body;

    // Logging request
    console.table([{ vehicle_number, chasis_number, engine_number, client_id, dealer_id, admin_id }]);

    try {
      const service = serviceFactory(UserVehicle);
      const result = await service.registerVehicle(req.body);

      if (result && result.message === 'vehicle already registered') {
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
      res.json({ vehicles });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};
