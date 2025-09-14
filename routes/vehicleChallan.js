const express = require('express');
const router = express.Router();
const vehicleChallanService = require('../services/vehicleChallanService');

// POST: /vehiclechallan
router.post('/', async (req, res) => {
  try {
    const { vehicleNumber } = req.body;
    if (!vehicleNumber) {
      return res.status(400).json({ error: 'vehicleNumber is required' });
    }
    const challanDetails = await vehicleChallanService.getChallanDetails(vehicleNumber);
    res.json(challanDetails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
