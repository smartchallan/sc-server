const express = require('express');
const router = express.Router();
const { sendWelcomeEmail } = require('../services/emailService');

// POST /testemail
// Body: { email, name }
router.post('/', async (req, res) => {
  try {
    const { email, name, username, password} = req.body;
    if (!email || !name) {
      return res.status(400).json({ success: false, error: 'email and name are required' });
    }
    await sendWelcomeEmail(email, name, username, password);
    return res.json({ success: true, message: 'Test email sent successfully' });
  } catch (err) {
    console.error('Error in /testemail:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
