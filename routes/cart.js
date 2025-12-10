const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');

// PUT /cart
router.put('/', cartController.update);
// POST /cart
router.post('/', cartController.create);

// GET /cart
router.get('/', cartController.get);

module.exports = router;
