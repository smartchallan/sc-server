const express = require('express');
const router = express.Router();

module.exports = (models) => {
  router.get('/:admin_id', async (req, res) => {
    const { admin_id } = req.params;
    if (!admin_id) {
      return res.status(400).json({ error: 'admin_id is required' });
    }
    try {
      const fetchAdminData = (await import('../services/adminDataService.js')).default;
      const data = await fetchAdminData(models, admin_id);
      // Log summary for audit
      if (data.clients) {
        console.table(data.clients.map(c => ({
          client_id: c.id,
          name: c.name
        })));
      }
      res.json(data);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch admin data' });
    }
  });

  return router;
};
