const express = require('express');
const router = express.Router();

const userVehicleService = require('../services/userVehicleService');

module.exports = (UserVehicle) => {
  // Register a new vehicle
  router.post('/register', async (req, res) => {
    const {
      vehicle_number,
      chasis_number,
      engine_number,
      client_id,
      dealer_id,
      admin_id
    } = req.body;

    // Logging request
    console.table([{ vehicle_number, chasis_number, engine_number, client_id, dealer_id, admin_id }]);

    // Validate mandatory fields

    if(!vehicle_number && !chasis_number && !engine_number ){
        console.log('hell o');
        return res.status(400).json({ error: 'At least one of vehicle_number, chasis_number, or engine_number is required.' });
    }
    if (!client_id || !dealer_id || !admin_id) {
      return res.status(400).json({ error: 'client_id, dealer_id, and admin_id are required.' });
    }

    try {
      const vehicle = await UserVehicle.create({
        vehicle_number,
        chasis_number,
        engine_number,
        client_id,
        dealer_id,
        admin_id,
        status: 'active'
      });

      // Logging response
      console.table([vehicle.toJSON()]);

      res.status(201).json({ message: 'Vehicle registered successfully', vehicle });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get vehicles by admin_id, dealer_id, or client_id
  router.get('/', async (req, res) => {
    try {
      const { admin_id, dealer_id, client_id } = req.query;
      const service = userVehicleService(UserVehicle);
      const vehicles = await service.getUserVehicles({ admin_id, dealer_id, client_id });
      res.json({ vehicles });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};
