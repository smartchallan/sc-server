const express = require('express');
const router = express.Router();
const { getVehicleByNumber } = require('../services/vehicleService');



// GET /getvehiclebynumber
router.get('/getvehiclebynumber', async (req, res) => {
  console.log('hello checkpoint 1');
  try {
    const { vehiclenumber } = req.query;
    if (!vehiclenumber) {
      return res.status(400).json({ error: 'vehiclenumber is required as a query parameter' });
    }
    const result = await getVehicleByNumber(vehiclenumber);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
  