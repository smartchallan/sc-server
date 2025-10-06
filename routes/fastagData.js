const express = require('express');
const router = express.Router();
const fastagDataService = require('../services/fastagDataService');

// POST: /fastagdata
router.post('/', async (req, res) => {
  try {
    const { vehiclenumber } = req.body;
    if (!vehiclenumber) {
      return res.status(400).json({ error: 'vehiclenumber is required' });
    }
    const fastagData = await fastagDataService.getFastagData(vehiclenumber);
    res.json(fastagData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
