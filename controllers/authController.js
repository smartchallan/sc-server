const authService = require('../services/authService');

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    if (!result) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
    // Check user status
    if (result.user && result.user.status && result.user.status.toLowerCase() !== 'active') {
      return res.status(403).json({ error: 'Account is deactivated.' });
    }
    // Log user info (as plain object, not instance)
    console.table([result]);
    res.json({ message: 'Login successful', ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
