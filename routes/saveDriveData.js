const express = require('express');
const router = express.Router();

module.exports = (models) => {
  const saveDriveDataService = require('../services/saveDriveDataService')(models);

  // POST: /savedrivedata
  router.post('/', async (req, res) => {
    try {
      const { licenseNo, dob } = req.body;
      if (!licenseNo) {
        return res.status(400).json({ error: 'licenseNo is required' });
      }

      const saved = await saveDriveDataService.saveDriverData(req.body);
      return res.status(201).json({ message: 'saved', id: saved.id });
    } catch (err) {
      console.error('Error saving driver data:', err);
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
};
