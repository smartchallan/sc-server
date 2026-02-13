const { sendWelcomeEmail } = require('./emailService');
const { User, UserMeta } = require('../models');
const bcrypt = require('bcryptjs');

async function loginUser(email, password) {
    console.table([{ email, password: '***' }]);

    console.log('in loginUser', User);

    // let user;

    // // Try Sequelize style (findOne with where)
    // if (typeof User.findOne === 'function') {
    //     try {
    const user = await User.findOne({ where: { email: email } });
    console.log('in user login service', user );
    //     } catch (e) {
    //         // If error, try Mongoose style
    //         user = await User.findOne({ email });
    //     }
    // } else if (typeof User.find === 'function') {
    //     // Try Mongoose find
    //     user = await User.findOne({ email });
    // } else {
    //     console.table([{ error: 'User model does not support findOne or find.' }]);
    //     return null;
    // }

    if (!user) {
        console.table([{ error: 'Invalid credentials.' }]);
        return null;
    }

    const userObj = user.toJSON ? user.toJSON() : user;


    // Compare hashed password, trim spaces
    const cleanPassword = password ? password.trim() : '';
    console.log('Login password:', `"${cleanPassword}"`);
    console.log('DB hash:', `"${userObj.password}"`);
    const isPasswordValid = bcrypt.compareSync(cleanPassword, userObj.password);
    if (!isPasswordValid) {
        console.table([{ error: 'Invalid credentials.' }]);
        return null;
    }

    // Fetch user_meta for this user
    const userMeta = await UserMeta.findOne({ where: { user_id: userObj.id } });
    const userMetaObj = userMeta ? (userMeta.toJSON ? userMeta.toJSON() : userMeta) : null;

    // Combine user and userMeta data
    const response = {
        user: userObj,
        userMeta: userMetaObj
    };

    console.table([response]);
    return response;
}

async function registerUser(data) {
    console.log('Registering user:', data);

    // Hash password before saving, trim spaces
    const cleanPassword = data.password ? data.password.trim() : '';
    const hashedPassword = bcrypt.hashSync(cleanPassword, 10);
    console.log('Registering user with password:', `"${cleanPassword}"`);
    console.log('Generated hash:', `"${hashedPassword}"`);
    const userData = {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.userType,
        parent_id: typeof data.parent_id !== 'undefined' ? data.parent_id : null
    };

    // Create user record
    const user = await User.create(userData);
    const userObj = user.toJSON ? user.toJSON() : user;

    // Prepare UserMeta data
    const userMetaData = {
        user_id: userObj.id,
        phone: data.phone,
        address: data.address,
        country: data.country,
        city: data.city,
        state: data.state,
        zip: data.pin,
        gtin: data.gtin,
        company_name: data.company_name,
        business_category: data.business_category
        // Add other UserMeta fields if needed
    };

    // Create user_meta record
    const userMeta = await UserMeta.create(userMetaData);

    // Log both records
    console.table([userObj]);
    console.table([userMeta.toJSON ? userMeta.toJSON() : userMeta]);

    // Welcome email is sent from routes/auth.js if needed
    // Return combined response
    return {
        user: userObj,
        userMeta: userMeta.toJSON ? userMeta.toJSON() : userMeta
    };
}

module.exports = {
    loginUser,
    registerUser
};