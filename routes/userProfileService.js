const express = require('express');
const router = express.Router();
const updateUserPassword = require('../services/userProfileService');

module.exports = (models) => {
  const { User } = models;

  // PUT /userprofile/update/:userId
  router.put('/updatepassword/:userId', async (req, res) => {
    const userId = req.params.userId;
    const { currentPassword, newPassword, currentPasswordReq } = req.body;

    if (currentPasswordReq === false) {
      if (!newPassword) {
        return res.status(400).json({ error: 'newPassword is required.' });
      }
      try {
        const result = await updateUserPassword(User, userId, null, newPassword, false);
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    } else {
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'currentPassword and newPassword are required.' });
      }
      try {
        const result = await updateUserPassword(User, userId, currentPassword, newPassword, true);
        res.json(result);
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    }
  });

  // PUT /userprofile/status
  router.put('/status', async (req, res) => {
    const { user_id, status } = req.body;
    if (!user_id || !status || !['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'user_id and status (active/inactive) are required.' });
    }
    try {
      const [updated] = await User.update(
        { status, updated_at: new Date() },
        { where: { id: user_id } }
      );
      if (updated) {
        return res.json({ message: 'User status updated successfully.' });
      } else {
        return res.status(404).json({ error: 'User not found.' });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
