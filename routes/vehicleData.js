const express = require('express');
const router = express.Router();
const VehicleData = require('../mongoose/vehicle_data');

// GET /vehicle-data/all
router.get('/all', async (req, res) => {
  try {
    const data = await VehicleData.find({});
    console.table(data);
    res.json({ vehicleData: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
