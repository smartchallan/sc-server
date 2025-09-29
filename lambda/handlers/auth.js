const authController = require('../../controllers/authController');
const { registerUser } = require('../../services/authService');

exports.login = async (event) => {
  try {
    const body = JSON.parse(event.body);
    const result = await authController.loginLambda(body); // You may need to refactor login for Lambda
    return { statusCode: 200, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};

exports.register = async (event) => {
  try {
    console.log('welcome to auth register handler');
    const body = JSON.parse(event.body);
    // Validate mandatory fields as in your Express route
    if (!body.userType || !body.name || !body.email || !body.phone || !body.password) {
      return { statusCode: 400, body: JSON.stringify({ error: 'userType, name, email, and phone are required.' }) };
    }
    // Role-based mandatory fields
    if (body.userType === 'dealer' && !body.admin_id) {
      return { statusCode: 400, body: JSON.stringify({ error: 'admin_id is required for dealer registration.' }) };
    }
    if (body.userType === 'client' && (!body.admin_id || !body.dealer_id)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'admin_id and dealer_id are required for client registration.' }) };
    }
    if (body.userType === 'team' && (!body.admin_id || !body.dealer_id || !body.client_id)) {
      return { statusCode: 400, body: JSON.stringify({ error: 'admin_id, dealer_id, and client_id are required for team registration.' }) };
    }
    const user = await registerUser(body);
    return { statusCode: 201, body: JSON.stringify({ message: 'User registered successfully', user }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
