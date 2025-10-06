const express = require('express');
const router = express.Router();

module.exports = (models) => {
  const { VehicleRTOData } = models;

  // GET /getvehiclertodata?client_id=123&vehicle_number=DL4CBA2350
  router.get('/getvehiclertodata', async (req, res) => {
    const { client_id, vehicle_number } = req.query;
    if (!client_id) {
      return res.status(400).json({ error: 'client_id is required' });
    }
    try {
      let where = { client_id };
      if (vehicle_number) {
        where.vehicle_number = vehicle_number;
      }
      const records = await VehicleRTOData.findAll({ where });
      res.json(records);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
