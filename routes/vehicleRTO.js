const express = require('express');
const router = express.Router();
const convert = require('xml-js');
const vehicleRTOService = require('../services/vehicleRTOService');

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
    console.log('[vehicleRTO] POST request received', { vehicleNumber, clientID });
    const rtoDetails = await vehicleRTOService.getRTODetails(vehicleNumber, clientID);
    console.log('[vehicleRTO] Success for', vehicleNumber);
    res.json(rtoDetails);
  } catch (error) {
    console.error('[vehicleRTO] ERROR:', error.message);
    console.error('[vehicleRTO] Stack:', error.stack);
    res.status(500).json({ error: error.message });
  }
});


// GET: /vehicleRTO?clientID=...&vehicleNumber=...
router.get('/', async (req, res) => {
  try {
    const { clientId, vehicleNumber } = req.query;
    if (!clientId) {
      return res.status(400).json({ error: 'clientId is required' });
    }

    // Access models from app locals
    const VehicleRTOData = req.app.locals.models?.VehicleRTOData;
    const UserVehicle = req.app.locals.models?.UserVehicle;
    
    if (!VehicleRTOData) {
      return res.status(500).json({ error: 'VehicleRTOData model not found' });
    }
    if (!UserVehicle) {
      return res.status(500).json({ error: 'UserVehicle model not found' });
    }

    // First, get active vehicle numbers for the client
    let vehicleWhere = { client_id: clientId, status: 'active' };
    if (vehicleNumber) {
      vehicleWhere.vehicle_number = vehicleNumber;
    }
    
    const activeVehicles = await UserVehicle.findAll({
      where: vehicleWhere,
      attributes: ['vehicle_number']
    });
    
    const activeVehicleNumbers = activeVehicles.map(v => v.vehicle_number);
    
    // If no active vehicles found, return empty array
    if (activeVehicleNumbers.length === 0) {
      return res.json([]);
    }

    // Query RTO data only for active vehicles
    let where = { 
      client_id: clientId,
      vehicle_number: activeVehicleNumbers
    };

    const results = await VehicleRTOData.findAll({ where });
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
