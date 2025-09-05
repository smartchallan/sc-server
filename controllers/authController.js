const authService = require('../services/authService');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await authService.loginUser(email, password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials or inactive user.' });
    }
    // Log user info (as plain object, not instance)
    console.table([user]);
    res.json({ message: 'Login successful', user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
