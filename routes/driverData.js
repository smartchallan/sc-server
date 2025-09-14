const express = require('express');
const router = express.Router();
const driverDataService = require('../services/driverDataService');

// POST: /driverdata
router.post('/', async (req, res) => {
  try {
    const { driverId } = req.body;
    if (!driverId) {
      return res.status(400).json({ error: 'driverId is required' });
    }
    const driverData = await driverDataService.getDriverData(driverId);
    res.json(driverData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
