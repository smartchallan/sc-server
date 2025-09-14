const express = require('express');
const router = express.Router();

module.exports = (models) => {
  const fetchAdminData = require('../services/adminDataService');

  router.get('/:admin_id', async (req, res) => {
    const { admin_id } = req.params;
    if (!admin_id) {
      return res.status(400).json({ error: 'admin_id is required' });
    }
    try {
      const data = await fetchAdminData(models, admin_id);
      console.table([{ admin_id, dealers: data.dealers.length, clients: data.clients.length, vehicles: data.vehicles.length }]);
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch admin data' });
    }
  });

  return router;
};
