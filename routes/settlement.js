const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/settlementController');

// PayU posts its result back as application/x-www-form-urlencoded (browser
// auto-submit), so parse that form body for the callback routes only.
const payuBody = express.urlencoded({ extended: false });

// ── Public PayU callbacks (added to validateClient PUBLIC_PATHS) ─────────────
router.post('/payu/callback/success', payuBody, ctrl.payuSuccess);
router.post('/payu/callback/failure', payuBody, ctrl.payuFailure);

// ── Authenticated (JWT auto-attached by the frontend) ────────────────────────
router.post('/initiate', ctrl.initiate);
router.get('/inbox', ctrl.inbox);
router.get('/:id', ctrl.detail);
router.post('/:id/approve', ctrl.approve);
router.post('/:id/settle', ctrl.settle);
router.post('/:id/reject', ctrl.reject);

module.exports = router;
