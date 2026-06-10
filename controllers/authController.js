const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');

const ADMIN_EMAIL = 'ghaithdrh@gmail.com';

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return next(new AppError('Email already in use', 400));
    const role = email === ADMIN_EMAIL ? 'admin' : 'user';
    const user = await User.create({ name, email, password, role });
    const token = signToken(user);
    res.status(201).json({
      status: 'success',
      token,
      data: { id: user._id, name: user.name, email: user.email, role: user.role, xp: user.xp, coins: user.coins, stars: user.stars },
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return next(new AppError('Email and password required', 400));
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password)))
      return next(new AppError('Invalid email or password', 401));
    if (email === ADMIN_EMAIL && user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
    }
    const token = signToken(user);
    res.json({
      status: 'success',
      token,
      data: { id: user._id, name: user.name, email: user.email, role: user.role, xp: user.xp, coins: user.coins, stars: user.stars },
    });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new AppError('User not found', 404));
    res.json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
};
