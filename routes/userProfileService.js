const express = require('express');
const router = express.Router();
const updateUserPassword = require('../services/userProfileService');

module.exports = (models) => {
  const { User, UserVehicle } = models;

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
  // Also cascades status change to all vehicles belonging to this user.
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
      if (!updated) {
        return res.status(404).json({ error: 'User not found.' });
      }

      // Cascade status to all vehicles of this user (client_id = user_id)
      const vehicleStatus = status === 'active' ? 'active' : 'inactive';
      await UserVehicle.update(
        { status: vehicleStatus, updated_at: new Date() },
        { where: { client_id: user_id } }
      );

      return res.json({ message: `User and their vehicles marked as ${status} successfully.` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
