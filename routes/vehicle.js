const express = require('express');
const router = express.Router();
const { getVehicleByNumber } = require('../services/vehicleService');

// POST /getvehiclebynumber
router.post('/getvehiclebynumber', async (req, res) => {
  try {
    const { vehiclenumber } = req.body;
    if (!vehiclenumber) {
      return res.status(400).json({ error: 'vehiclenumber is required' });
    }
    const result = await getVehicleByNumber(vehiclenumber);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
