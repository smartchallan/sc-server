const express = require('express');
const router = express.Router();

module.exports = (models) => {
  const { updateVehicleStatus } = require('../services/vehicleService');

  router.put('/', async (req, res) => {
    const { vehicle_id, status } = req.body;
    try {
      const result = await updateVehicleStatus(models, vehicle_id, status);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
};
