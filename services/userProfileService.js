const bcrypt = require('bcryptjs');

module.exports = async function updateUserPassword(User, userId, currentPassword, newPassword) {
  if (!userId || !currentPassword || !newPassword) {
    throw new Error('userId, currentPassword, and newPassword are required');
  }
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }
  // Verify current password
  const isCurrentValid = bcrypt.compareSync(currentPassword, user.password);
  if (!isCurrentValid) {
    throw new Error('Current password is incorrect');
  }
  // Hash the new password
  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  await user.update({ password: hashedPassword });
  return { message: 'Password updated successfully' };
};
