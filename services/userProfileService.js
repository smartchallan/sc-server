const bcrypt = require('bcryptjs');

module.exports = async function updateUserPassword(User, userId, currentPassword, newPassword, currentPasswordReq = true) {
  if (!userId || !newPassword) {
    throw new Error('userId and newPassword are required');
  }
  const user = await User.findByPk(userId);
  if (!user) {
    throw new Error('User not found');
  }
  if (currentPasswordReq) {
    if (!currentPassword) {
      throw new Error('currentPassword is required');
    }
    const isCurrentValid = bcrypt.compareSync(currentPassword, user.password);
    if (!isCurrentValid) {
      throw new Error('Current password is incorrect');
    }
  }
  // Hash the new password
  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  await user.update({ password: hashedPassword });
  return { message: 'Password updated successfully' };
};
