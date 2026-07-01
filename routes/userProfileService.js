const express = require('express');
const router = express.Router();
const updateUserPassword = require('../services/userProfileService');
const { purgeVehicleData } = require('../services/vehicleService');

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

      // Cascade status to this user's vehicles (client_id = user_id). Vehicles
      // only support 'active' / 'deleted'. This is a status-only toggle (RTO/challan
      // data is preserved) so enabling the account restores the vehicles.
      const now = new Date();
      if (status === 'active') {
        // Re-activate: bring the soft-deleted vehicles back and clear deleted_at.
        await UserVehicle.update(
          { status: 'active', deleted_at: null, updated_at: now },
          { where: { client_id: user_id, status: 'deleted' } }
        );
      } else {
        // Disable: delete the currently-active vehicles (leaving earlier deletions
        // with their original deleted_at) and purge their RTO/challan data.
        const activeVehicles = await UserVehicle.findAll({
          where: { client_id: user_id, status: 'active' },
          attributes: ['vehicle_number']
        });
        const vehicleNumbers = activeVehicles.map(v => v.vehicle_number).filter(Boolean);
        await UserVehicle.update(
          { status: 'deleted', deleted_at: now, updated_at: now },
          { where: { client_id: user_id, status: 'active' } }
        );
        await purgeVehicleData(models, { client_id: user_id, vehicleNumbers });
      }

      return res.json({ message: `User and their vehicles marked as ${status} successfully.` });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
};
