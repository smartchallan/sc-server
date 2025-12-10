const express = require('express');
const router = express.Router();
const vehicleSummaryController = require('../controllers/vehicleSummaryController');

// POST /vehiclesummary
router.post('/', vehicleSummaryController.getVehicleSummary);

module.exports = router;
