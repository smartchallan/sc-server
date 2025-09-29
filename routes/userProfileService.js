const express = require('express');
const router = express.Router();
const updateUserPassword = require('../services/userProfileService');

module.exports = (models) => {
  const { User } = models;

  // PUT /userprofile/update/:userId
  router.put('/userprofile/update/:userId', async (req, res) => {
    const userId = req.params.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword are required.' });
    }

    try {
      const result = await updateUserPassword(User, userId, currentPassword, newPassword);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
