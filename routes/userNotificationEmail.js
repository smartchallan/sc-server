const express = require('express');
const router = express.Router();
const { DiUserNotificationReceivers } = require('../models');

// POST /usernotificationemail
// Body: { user_id, user_role, notification_type, value, status }
router.post('/', async (req, res) => {
  try {
    const { user_id, user_role, notification_type, value, status } = req.body;
    if (!user_id || !user_role || !notification_type || !value) {
      return res.status(400).json({ success: false, error: 'user_id, user_role, notification_type and value are required' });
    }

    // Check for existing record (by user, type and value)
    const existing = await DiUserNotificationReceivers.findOne({ where: { user_id, notification_type, value } });
    if (existing) {
      return res.json(false);
    }

    const created = await DiUserNotificationReceivers.create({
      user_id,
      user_role,
      notification_type,
      value,
      status: typeof status === 'undefined' ? true : !!status,
      created_at: new Date(),
      updated_at: new Date()
    });

    console.table(created.toJSON());
    return res.status(201).json({ success: true, data: created });
  } catch (err) {
    console.error('Error in POST /usernotificationemail:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /usernotificationemail?user_id=123
router.get('/', async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id is required in query params' });
    }

    const rows = await DiUserNotificationReceivers.findAll({ where: { user_id, status: true } });
    console.table(rows.map(r => r.toJSON()));
    return res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error in GET /usernotificationemail:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PUT /usernotificationemail/:id
// Body: { status }
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (typeof status === 'undefined') {
      return res.status(400).json({ success: false, error: 'status is required in body' });
    }

    const row = await DiUserNotificationReceivers.findByPk(id);
    if (!row) return res.status(404).json({ success: false, error: 'record not found' });

    row.status = !!status;
    row.updated_at = new Date();
    await row.save();

    console.table(row.toJSON());
    return res.json({ success: true, data: row });
  } catch (err) {
    console.error('Error in PUT /usernotificationemail/:id:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
