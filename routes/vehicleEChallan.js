const express = require('express');
const router = express.Router();
const convert = require('xml-js');
const vehicleChallanService = require('../services/vehicleChallanService');

// POST: /vehiclechallan
router.post('/', async (req, res) => {
  try {
    const { vehicleNumber, clientID } = req.body;
    if (!vehicleNumber) {
      return res.status(400).json({ error: 'vehicleNumber is required' });
    }
    if (!clientID) {
      return res.status(400).json({ error: 'client id is required' });
    }
    console.log('chkpoint 1');
    const challanDetails = await vehicleChallanService.getChallanDetails(vehicleNumber, clientID);

    // const jsonResult = convert.xml2json(challanDetails, {
    //     compact: true,
    //     spaces: 2
    // });

    res.json(challanDetails);
  } catch (error) {
    console.log('chkpoint 2');
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
