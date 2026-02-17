const express = require('express');
const router = express.Router();
const { getNetworkStats } = require('../controllers/networkStatsController');

// GET /getnetworkstats?id=123
router.get('/', getNetworkStats);

module.exports = router;
