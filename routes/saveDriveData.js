const express = require('express');
const router = express.Router();

module.exports = (models) => {
  const saveDriveDataService = require('../services/saveDriveDataService')(models);

  // POST: /savedrivedata
  router.post('/', async (req, res) => {
    try {
      const { licenseNo, dob, client_id, clientId } = req.body;
      if (!licenseNo) {
        return res.status(400).json({ error: 'licenseNo is required' });
      }
      const cid = client_id || clientId;
      if (!cid) {
        return res.status(400).json({ error: 'client_id is required' });
      }

      const saved = await saveDriveDataService.saveDriverData(req.body);
      return res.status(201).json({ message: 'saved', id: saved.id });
    } catch (err) {
      console.error('Error saving driver data:', err);
      const status = err.status || 500;
      return res.status(status).json({ error: err.message });
    }
  });

  return router;
};
