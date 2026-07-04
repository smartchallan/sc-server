const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { registerUser } = require('../services/authService');
const { sendWelcomeEmail, sendClientRegistrationNotification } = require('../services/emailService');
// require('dotenv').config();

router.post('/login', authController.login);

// GET /auth/me — returns fresh user record for the JWT bearer
router.get('/me', async (req, res) => {
    try {
        const userId = req.client?.id;
        if (!userId) return res.status(401).json({ error: 'INVALID_TOKEN' });

        const { User } = require('../models');
        const user = await User.findOne({
            where: { id: userId },
            attributes: ['id', 'name', 'email', 'status', 'account_type', 'trial_expires_at', 'parent_id'],
        });
        if (!user) return res.status(404).json({ error: 'USER_NOT_FOUND' });

        res.json({ user: user.toJSON() });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/register', async (req, res) => {
    console.log('inside register user');
    try {
        const {
            name,
            email,
            password,
            phone,
            address,
            country,
            city,
            state,
            pin,
            parent_id,
            gtin,
            company_name,
            business_category,
            dealer_name,
            dealer_id,
            account_type,
            billing_type,
            grace_days,
        } = req.body;

        // Validate mandatory fields
        if (!name || !email || !phone || !password) {
            return res.status(400).json({ error: 'name, email, phone, and password are required.' });
        }

        // parent_id is mandatory for all registrations
        if (typeof req.body.parent_id === 'undefined' || req.body.parent_id === null) {
            return res.status(400).json({ error: 'parent_id is required for registration.' });
        }

        const userData = {
            name,
            email,
            password: password,
            phone,
            address,
            country,
            city,
            state,
            pin,
            parent_id,
            gtin,
            company_name,
            business_category,
            account_type: account_type || 'trial',
            billing_type,
            grace_days,
        };
        console.table('register user data is' + JSON.stringify(userData));
        const regResult = await registerUser(userData);

        // Notify operations team of new client registration
        sendClientRegistrationNotification({
            name, email, phone, company_name, business_category, city, state,
            dealer_name, dealer_id
        }).catch(err => console.error('Failed to send registration notification:', err));

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
                await sendWelcomeEmail(regResult.user.email, regResult.user.name, regResult.user.email, req.body.password, dealer_name, dealer_id);
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
