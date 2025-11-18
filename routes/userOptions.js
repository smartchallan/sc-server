const express = require('express');
const router = express.Router();
const { UserOptions } = require('../models');

// POST /useroptions
// Body: { user_id, user_role, settings: { key1: value1, key2: value2, ... } }
router.post('/', async (req, res) => {
  try {
    const { user_id, user_role, settings } = req.body;
    if (!user_id || !user_role || typeof settings !== 'object' || !settings) {
      return res.status(400).json({ success: false, error: 'user_id, user_role, and settings object are required' });
    }
    const results = [];
    for (const [option_key, option_value] of Object.entries(settings)) {
      // Check if option exists
      const [option, created] = await UserOptions.findOrCreate({
        where: { user_id, user_role, option_key },
        defaults: {
          option_value,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      if (!created) {
        // Update if exists
        option.option_value = option_value;
        option.updated_at = new Date();
        await option.save();
        results.push({ option_key, updated: true });
      } else {
        results.push({ option_key, created: true });
      }
    }
    return res.json({ success: true, results });
  } catch (err) {
    console.error('Error in /useroptions:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});


// GET /useroptions?user_id=123
router.get('/', async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) {
      return res.status(400).json({ success: false, error: 'user_id is required in query params' });
    }
    const options = await UserOptions.findAll({ where: { user_id } });
    if (!options.length) {
      return res.json({ success: true, user_role: null, options: {} });
    }
    // Assume all options for a user have the same user_role
    const user_role = options[0].user_role;
    const settings = {};
    for (const opt of options) {
      settings[opt.option_key] = opt.option_value;
    }
    return res.json({ success: true, user_role, options: settings });
  } catch (err) {
    console.error('Error in GET /useroptions:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
