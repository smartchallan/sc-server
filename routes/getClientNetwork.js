const express = require('express');
const router = express.Router();
const controller = require('../controllers/getClientNetworkController');

// GET /getclientnetwork
router.get('/', controller.getClientNetwork);

module.exports = router;
