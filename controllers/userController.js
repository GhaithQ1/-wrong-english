const User = require('../models/User');
const AppError = require('../utils/AppError');

exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find();
    res.json({ status: 'success', data: users });
  } catch (err) {
    next(err);
  }
};

exports.createUser = async (req, res, next) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
};

exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return next(new AppError('User not found', 404));
    res.json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!user) return next(new AppError('User not found', 404));
    res.json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return next(new AppError('User not found', 404));
    res.json({ status: 'success', data: null });
  } catch (err) {
    next(err);
  }
};

exports.addXp = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return next(new AppError('Amount must be a positive number', 400));
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $inc: { xp: amount } },
      { new: true }
    );
    if (!user) return next(new AppError('User not found', 404));
    res.json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
};

exports.updateCoins = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (amount === undefined) return next(new AppError('Amount is required', 400));
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $inc: { coins: amount } },
      { new: true }
    );
    if (!user) return next(new AppError('User not found', 404));
    res.json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
};

exports.updateStars = async (req, res, next) => {
  try {
    const { amount } = req.body;
    if (amount === undefined) return next(new AppError('Amount is required', 400));
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $inc: { stars: amount } },
      { new: true }
    );
    if (!user) return next(new AppError('User not found', 404));
    res.json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
};

exports.getLeaderboard = async (req, res, next) => {
  try {
    const users = await User.find().sort({ xp: -1 }).limit(20);
    res.json({ status: 'success', data: users });
  } catch (err) {
    next(err);
  }
};
