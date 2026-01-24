const express = require('express');
const router = express.Router();

module.exports = (models) => {
  const fetchDriverService = require('../services/fetchDriverService')(models);

  // GET: /fetchdriver?client_id=123
  router.get('/', async (req, res) => {
    try {
      const client_id = req.query.client_id || req.query.clientId;
      if (!client_id) {
        return res.status(400).json({ error: 'client_id is required' });
      }

      const drivers = await fetchDriverService.fetchByClient(client_id);
      return res.json({ drivers });
    } catch (err) {
      console.error('Error fetching driver data:', err);
      const status = err.status || 500;
      return res.status(status).json({ error: err.message });
    }
  });

  return router;
};
