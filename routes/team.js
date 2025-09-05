const express = require('express');
const router = express.Router();
const teamController = require('../controllers/teamController');

router.post('/', teamController.registerTeam);

module.exports = router;
