const express = require('express');
const router = express.Router();
const fastagDataService = require('../services/fastagDataService');

// POST: /fastagdata
router.post('/', async (req, res) => {
  try {
    const { fastagNumber } = req.body;
    if (!fastagNumber) {
      return res.status(400).json({ error: 'fastagNumber is required' });
    }
    const fastagData = await fastagDataService.getFastagData(fastagNumber);
    res.json(fastagData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
