const express = require('express');
const router = express.Router();
const dealerController = require('../controllers/dealerController');

router.get('/', dealerController.getAllDealers);

module.exports = router;
