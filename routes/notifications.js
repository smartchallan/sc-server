const express = require('express');
const router = express.Router();
const { sendMail } = require('../services/emailService');

module.exports = (models) => {
  const { ClientNotification, User } = models;

  // POST /notifications — dealer sends a notification/message to a client
  router.post('/', async (req, res) => {
    const { sender_id, sender_name, recipient_id, subject, message } = req.body;
    if (!sender_id || !recipient_id || !subject || !message) {
      return res.status(400).json({ error: 'sender_id, recipient_id, subject, and message are required.' });
    }
    try {
      const notification = await ClientNotification.create({
        sender_id,
        sender_name: sender_name || 'Dealer',
        recipient_id,
        subject,
        message,
        is_read: false,
        created_at: new Date(),
      });

      // Also send email to the client
      const recipient = await User.findOne({ where: { id: recipient_id } });
      if (recipient && recipient.email) {
        const html = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#f9f9f9;border-radius:8px;">
            <h2 style="color:#2d3748;">New Notification from ${sender_name || 'Your Dealer'}</h2>
            <p><b>Subject:</b> ${subject}</p>
            <div style="margin:16px 0;padding:16px;background:#fff;border-radius:6px;border:1px solid #e2e8f0;white-space:pre-line;">
              ${message}
            </div>
            <p style="font-size:13px;color:#718096;">Login to your SmartChallan account to view all notifications.</p>
          </div>`;
        sendMail({ to: recipient.email, subject, html }).catch(err =>
          console.error('[notifications] email send failed:', err)
        );
      }

      return res.status(201).json({ message: 'Notification sent successfully.', notification });
    } catch (err) {
      console.error('[POST /notifications]', err);
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /notifications?recipient_id=X — get all notifications for a client
  router.get('/', async (req, res) => {
    const { recipient_id, sender_id } = req.query;
    if (!recipient_id && !sender_id) {
      return res.status(400).json({ error: 'recipient_id or sender_id is required.' });
    }
    try {
      const where = {};
      if (recipient_id) where.recipient_id = recipient_id;
      if (sender_id) where.sender_id = sender_id;
      const notifications = await ClientNotification.findAll({
        where,
        order: [['created_at', 'DESC']],
        limit: 200,
      });
      return res.json({ notifications });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // GET /notifications/unread-count?recipient_id=X
  router.get('/unread-count', async (req, res) => {
    const { recipient_id } = req.query;
    if (!recipient_id) return res.status(400).json({ error: 'recipient_id is required.' });
    try {
      const count = await ClientNotification.count({ where: { recipient_id, is_read: false } });
      return res.json({ unread: count });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // PUT /notifications/:id/read — mark a notification as read
  router.put('/:id/read', async (req, res) => {
    try {
      await ClientNotification.update({ is_read: true }, { where: { id: req.params.id } });
      return res.json({ message: 'Marked as read.' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // PUT /notifications/read-all?recipient_id=X — mark all as read
  router.put('/read-all', async (req, res) => {
    const { recipient_id } = req.query;
    if (!recipient_id) return res.status(400).json({ error: 'recipient_id is required.' });
    try {
      await ClientNotification.update({ is_read: true }, { where: { recipient_id, is_read: false } });
      return res.json({ message: 'All notifications marked as read.' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  // DELETE /notifications/:id?sender_id=X — only the sender can delete their notification
  router.delete('/:id', async (req, res) => {
    const { sender_id } = req.query;
    if (!sender_id) return res.status(400).json({ error: 'sender_id is required.' });
    try {
      const notif = await ClientNotification.findOne({ where: { id: req.params.id } });
      if (!notif) return res.status(404).json({ error: 'Notification not found.' });
      if (String(notif.sender_id) !== String(sender_id)) return res.status(403).json({ error: 'Not authorized to delete this notification.' });
      await notif.destroy();
      return res.json({ message: 'Notification deleted.' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
};
