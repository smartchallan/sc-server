const express = require('express');
const router = express.Router();
const { sendMail } = require('../services/emailService');

/**
 * POST /sendemail
 * Generic email sender. Can be called from the client wherever an email is needed.
 *
 * Body:
 *   to      {string}  Comma-separated recipient emails. Falls back to STAKEHOLDER_EMAILS env var.
 *   subject {string}  Email subject.
 *   body    {string}  Email body — treated as HTML if it starts with '<', plain text otherwise.
 */
router.post('/', async (req, res) => {
  try {
    const { subject, body } = req.body;
    const to = req.body.to || process.env.STAKEHOLDER_EMAILS;

    if (!to) {
      return res.status(400).json({ success: false, error: 'No recipients: provide "to" or set STAKEHOLDER_EMAILS in env.' });
    }
    if (!subject) {
      return res.status(400).json({ success: false, error: '"subject" is required.' });
    }
    if (!body) {
      return res.status(400).json({ success: false, error: '"body" is required.' });
    }

    // Wrap plain-text body in minimal HTML for consistent rendering
    const html = body.trimStart().startsWith('<')
      ? body
      : `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;">${body.replace(/\n/g, '<br/>')}</div>`;

    await sendMail({ to, subject, html });

    console.log(`[sendemail] Sent "${subject}" → ${to}`);
    return res.json({ success: true, message: 'Email sent successfully.' });
  } catch (err) {
    console.error('[sendemail] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
