const express = require('express');
const router = express.Router();
const vehicleReportController = require('../controllers/vehicleReportController');

// POST /getvehiclereport
router.post('/', vehicleReportController.getVehicleReport);

module.exports = router;
