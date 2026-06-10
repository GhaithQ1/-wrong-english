const AppError = require('../utils/AppError');

const admin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return next(new AppError('Admin access only', 403));
};

module.exports = admin;
