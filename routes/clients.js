const express = require('express');
const router = express.Router();
const clientController = require('../controllers/clientController');

router.get('/', clientController.getAllClients);
router.get('/dealer/:dealer_id', clientController.getClientsByDealer);
router.get('/getclientnetwork', clientController.getClientNetwork);
router.post('/', clientController.registerClient);

module.exports = router;
