const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { registerUser } = require('../services/authService');
const { sendWelcomeEmail } = require('../services/emailService');
// require('dotenv').config();

router.post('/login', authController.login);
const bcrypt = require('bcryptjs');

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
            dealer_id,
            gtin,
            company_name,
            business_category
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

    // Hash password before registration, trim spaces
    const cleanPassword = password ? password.trim() : '';
    const hashedPassword = bcrypt.hashSync(cleanPassword, 10);

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
            dealer_id,
            gtin,
            company_name,
            business_category
        };

        // If registering a dealer, set admin_id to logged-in user id
        if (userType === 'dealer') {
            userData.admin_id = req.body.admin_id;
        }
        if (userType === 'client') {
            userData.admin_id = req.body.admin_id;
        }
        console.table('register user data is' + JSON.stringify(userData));
        const regResult = await registerUser(userData);
        // regResult: { user: userObj, userMeta }
        const { sendEmail } = req.body;
        if (sendEmail) {
            try {
                // Log values to verify
                console.log('Sending welcome email with:', {
                    username: regResult.user.email,
                    name: regResult.user.name,
                    password: req.body.password
                });
                // Use email as username, and the original password from req.body
                await sendWelcomeEmail(regResult.user.email, regResult.user.name, regResult.user.email, req.body.password);
            } catch (emailErr) {
                console.error('Failed to send welcome email:', emailErr);
            }
        }
        res.status(201).json({ message: 'User registered successfully', user: regResult });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
