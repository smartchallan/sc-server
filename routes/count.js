const express = require('express');
const router = express.Router();
const { getDealerCount, getClientCount, getVehicleCount } = require('../services/countService');

router.get('/getdealercount', async (req, res) => {
    console.log('inside get dealer count');
    try {
        const admin_id = req.query.admin_id;
        if (!admin_id) {
            return res.status(400).json({ error: 'admin_id is required' });
        }
        const count = await getDealerCount(admin_id);
        res.json({ count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/getclientcount', async (req, res) => {
    try {
        const admin_id = req.query.admin_id;
        if (!admin_id) {
            return res.status(400).json({ error: 'admin_id is required' });
        }
        const count = await getClientCount(admin_id);
        res.json({ count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/getvehiclecount', async (req, res) => {
    try {
        const count = await getVehicleCount();
        res.json({ count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
