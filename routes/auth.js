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
            business_category
        } = req.body;

        // Validate mandatory fields
        if (!name || !email || !phone || !password) {
            return res.status(400).json({ error: 'name, email, phone, and password are required.' });
        }

        // parent_id is mandatory for all registrations
        if (typeof req.body.parent_id === 'undefined' || req.body.parent_id === null) {
            return res.status(400).json({ error: 'parent_id is required for registration.' });
        }

    // Hash password before registration, trim spaces
    const cleanPassword = password ? password.trim() : '';
    const hashedPassword = bcrypt.hashSync(cleanPassword, 10);

        const userData = {
            name,
            email,
            password: hashedPassword,
            phone,
            address,
            country,
            city,
            state,
            pin,
            parent_id,
            gtin,
            company_name,
            business_category
        };
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
