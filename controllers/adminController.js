const Topic = require('../models/Topic');
const User = require('../models/User');
const AppError = require('../utils/AppError');

exports.getStats = async (req, res, next) => {
  try {
    const usersCount = await User.countDocuments();
    const topicsCount = await Topic.countDocuments();
    res.json({ status: 'success', data: { users: usersCount, topics: topicsCount } });
  } catch (err) {
    next(err);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password');
    res.json({ status: 'success', data: users });
  } catch (err) {
    next(err);
  }
};

exports.createTopic = async (req, res, next) => {
  try {
    const { name, order, unlockStars, questions } = req.body;
    if (!questions || questions.length !== 10)
      return next(new AppError('Topic must have exactly 10 questions', 400));
    if (!order) return next(new AppError('Order is required', 400));
    const topic = await Topic.create({ name, order, unlockStars: unlockStars || 0, questions });
    res.status(201).json({ status: 'success', data: topic });
  } catch (err) {
    next(err);
  }
};

exports.getTopics = async (req, res, next) => {
  try {
    const topics = await Topic.find().sort('order').select('name order unlockStars');
    res.json({ status: 'success', data: topics });
  } catch (err) {
    next(err);
  }
};

exports.getTopic = async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return next(new AppError('Topic not found', 404));
    res.json({ status: 'success', data: topic });
  } catch (err) {
    next(err);
  }
};

exports.updateTopic = async (req, res, next) => {
  try {
    const { name, order, unlockStars, questions } = req.body;
    if (!questions || questions.length !== 10)
      return next(new AppError('Topic must have exactly 10 questions', 400));
    if (!order) return next(new AppError('Order is required', 400));

    const topic = await Topic.findByIdAndUpdate(
      req.params.id,
      { name, order, unlockStars: unlockStars || 0, questions },
      { new: true, runValidators: true }
    );
    if (!topic) return next(new AppError('Topic not found', 404));

    res.json({ status: 'success', data: topic });
  } catch (err) {
    next(err);
  }
};
