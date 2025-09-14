const express = require('express');
const router = express.Router();

module.exports = (UserVehicleRtoData) => {
  const userVehicleRtoDataService = require('../services/userVehicleRtoDataService')(UserVehicleRtoData);


  // GET /vehiclertodata/:vehicle_number
  router.get('/:vehicle_number', async (req, res) => {
    const { vehicle_number } = req.params;
    if (!vehicle_number) {
      return res.status(400).json({ error: 'vehicle_number is required' });
    }
    try {
      const rtoData = await UserVehicleRtoData.findOne({ where: { vehicle_number } });
      if (!rtoData) {
        return res.status(404).json({ error: 'No RTO data found for this vehicle number' });
      }
      res.json(rtoData);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // POST /userrtodata/register
  router.post('/register', async (req, res) => {
    try {
      const {
        vehicle_number,
        engine_number,
        chasis_number,
        created_at,
        updated_at,
        ...rest
      } = req.body;

      // Log the incoming data for debugging
      console.table([{ vehicle_number, engine_number, chasis_number, created_at, updated_at }]);

      // Validate required fields
      if (!vehicle_number && !engine_number && !chasis_number) {
        return res.status(400).json({ error: 'At least one of vehicle_number, chasis_number, or engine_number is required.' });
      }

      const rtoData = {
        vehicle_number,
        engine_number,
        chasis_number,
        created_at,
        updated_at,
        ...rest
      };

      const created = await userVehicleRtoDataService.storeRtoData(rtoData);
      res.status(201).json({ message: 'RTO data stored successfully', data: created });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};
