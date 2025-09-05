const teamService = require('../services/teamService');

exports.registerTeam = async (req, res) => {
  try {
    const team = await teamService.registerTeam(req.body);
    console.table(team);
    res.status(201).json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
