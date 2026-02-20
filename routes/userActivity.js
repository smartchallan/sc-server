const express = require('express');
const router = express.Router();
const { UserActivity } = require('../models');

// POST /saveuseractivity
// Body: { user_id, action_type, description }
router.post('/', async (req, res) => {
  try {
    console.table({ endpoint: 'POST /saveuseractivity', body: req.body });

    const { user_id, parent_id, action_type, description, client_name } = req.body;

    // Validate required fields

    if (!user_id || !action_type) {
      return res.status(400).json({ 
        success: false, 
        error: 'user_id and action_type are required' 
      });
    }

    // Create user activity record
    // Handle parent_id = 0 explicitly (don't convert to null)
    const activity = await UserActivity.create({
      user_id,
      parent_id: (parent_id !== undefined && parent_id !== null) ? parent_id : null,
      action_type,
      client_name: client_name || null,
      description: description || null,
      created_at: new Date(),
      updated_at: new Date()
    });


    console.table({ 
      success: true, 
      activity_id: activity.id,
      user_id: activity.user_id,
      parent_id: activity.parent_id,
      action_type: activity.action_type,
      client_name: activity.client_name
    });

    return res.json({ 
      success: true, 
      data: activity 
    });

  } catch (err) {
    console.error('Error in POST /saveuseractivity:', err);
    return res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

// GET /saveuseractivity?user_id=123&parent_id=456
router.get('/', async (req, res) => {
  try {
    const { user_id, parent_id, action_type, limit = 100, offset = 0 } = req.query;
    
    console.table({ 
      endpoint: 'GET /saveuseractivity',
      user_id: user_id || null,
      parent_id: parent_id || null,
      action_type: action_type || null,
      limit,
      offset
    });

    // If only parent_id is present, filter by parent_id
    // Handle parent_id = 0 explicitly (don't treat as falsy)
    let where = {};
    const hasParentId = parent_id !== undefined && parent_id !== null && parent_id !== '';
    const hasUserId = user_id !== undefined && user_id !== null && user_id !== '';
    
    if (hasParentId && !hasUserId) {
      where.parent_id = parseInt(parent_id);
    } else if (hasUserId) {
      where.user_id = parseInt(user_id);
      if (hasParentId) {
        where.parent_id = parseInt(parent_id);
      }
    } else {
      return res.status(400).json({ 
        success: false, 
        error: 'user_id or parent_id is required in query params' 
      });
    }

    if (action_type) {
      where.action_type = action_type;
    }

    // Filter for last 7 days
    const { Op } = require('sequelize');
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    // Ensure created_at is set as an object with Op.gte
    where = {
      ...where,
      created_at: { [Op.gte]: sevenDaysAgo }
    };

    const activities = await UserActivity.findAll({ 
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['created_at', 'DESC']]
    });

    // Log only summary info, do NOT log activities array
    console.table({ 
      success: true, 
      count: activities.length,
      user_id: user_id || null,
      parent_id: parent_id || null,
      action_type: action_type || null,
      limit: limit,
      offset: offset
    });

    return res.json({ 
      success: true, 
      data: activities,
      count: activities.length
    });

  } catch (err) {
    console.error('Error in GET /saveuseractivity:', err);
    return res.status(500).json({ 
      success: false, 
      error: err.message 
    });
  }
});

module.exports = router;
