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
    // Update last_login_at for successful login
    try {
      const { User } = require('../models');
      if (result.user && result.user.id) {
        const now = new Date();
        await User.update({ last_login_at: now }, { where: { id: result.user.id } });
        // reflect updated value in response object
        result.user.last_login_at = now;
      }
    } catch (updErr) {
      console.error('Failed updating last_login_at for user:', updErr);
    }
    // Fetch user_options from di_user_options table
    const { UserOptions } = require('../models');
    let user_options = {};
    if (result.user && result.user.id) {
      const options = await UserOptions.findAll({ where: { user_id: result.user.id } });
      for (const opt of options) {
        let val = opt.option_value;
        if (typeof val === 'string') {
          if (val.toLowerCase() === 'true' || val === '1') val = true;
          else if (val.toLowerCase() === 'false' || val === '0') val = false;
        }
        user_options[opt.option_key] = typeof val === 'boolean' ? val : !!val;
      }
    }
    // Log user info (as plain object, not instance)
    console.table([{...result, user_options_count: Object.keys(user_options).length}]);
    // Include parent_id at top-level for convenience (falls back to null)
    const parent_id = result && result.user && typeof result.user.parent_id !== 'undefined' ? result.user.parent_id : null;
    res.json({ message: 'Login successful', parent_id, ...result, user_options });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
