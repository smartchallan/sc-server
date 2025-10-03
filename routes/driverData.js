const express = require('express');
const router = express.Router();
const driverDataService = require('../services/driverDataService');

// POST: /driverdata
router.post('/', async (req, res) => {
  try {
    const { driverId, dob } = req.body;
    if (!driverId) {
      return res.status(400).json({ error: 'driverId is required' });
    }else if (!dob) {
      return res.status(400).json({ error: 'dob is required' });
    }
    const driverData = await driverDataService.getDriverData(driverId, dob);
    res.json(driverData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
