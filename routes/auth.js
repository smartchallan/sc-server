const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { registerUser } = require('../services/authService');
63*
router.post('/login', authController.login);
router.post('/register', async (req, res) => {
    console.log('inside register user');
    try {
        const {
            userType,
            name,
            email,
            password,
            phone,
            address,
            country,
            city,
            state,
            pin,
            admin_id,
            dealer_id
        } = req.body;

        // Validate mandatory fields
        if (!userType || !name || !email || !phone || !password) {
            return res.status(400).json({ error: 'userType, name, email, and phone are required.' });
        }

        // Role-based mandatory fields
        if (userType === 'dealer' && !req.body.admin_id) {
            return res.status(400).json({ error: 'admin_id is required for dealer registration.' });
        }
        if (userType === 'client' && (!req.body.admin_id || !req.body.dealer_id)) {
            return res.status(400).json({ error: 'admin_id and dealer_id are required for client registration.' });
        }
        if (userType === 'team' && (!req.body.admin_id || !req.body.dealer_id || !req.body.client_id)) {
            return res.status(400).json({ error: 'admin_id, dealer_id, and client_id are required for team registration.' });
        }

        const userData = {
            userType,
            name,
            email,
            password,
            phone,
            address,
            country,
            city,
            state,
            pin,
            admin_id,
            dealer_id
        };

        // If registering a dealer, set admin_id to logged-in user id
        if (userType === 'dealer') {
            userData.admin_id = req.body.admin_id;
        }
         if (userType === 'client') {
            userData.admin_id = req.body.admin_id;
        }
        console.table('register user data is' + userData);
        const user = await registerUser(userData);
        
        res.status(201).json({ message: 'User registered successfully', user });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
