const express = require('express');
const router = express.Router();
const convert = require('xml-js');
const vehicleRTOService = require('../services/vehicleRTOService');

// POST: /vehiclechallan
router.post('/', async (req, res) => {
  try {
    const { vehicleNumber } = req.body;
    if (!vehicleNumber) {
      return res.status(400).json({ error: 'vehicleNumber is required' });
    }
    console.log('chkpoint 1');
    const rtoDetails = await vehicleRTOService.getRTODetails(vehicleNumber);

    // const jsonResult = convert.xml2json(challanDetails, {
    //     compact: true,
    //     spaces: 2
    // });

    res.json(rtoDetails);
  } catch (error) {
    console.log('chkpoint 2');
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
