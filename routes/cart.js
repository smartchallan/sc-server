const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');

// PUT /cart
router.put('/', cartController.update);
// POST /cart
router.post('/', cartController.create);

// GET /cart
router.get('/', cartController.get);

// GET /cart/inbox?user_id=X — every cart for descendants of X (used by ChallanRequests)
router.get('/inbox', cartController.inbox);

// PATCH /cart/:id/status — only root operations account can update
router.patch('/:id/status', cartController.updateStatus);

module.exports = router;
