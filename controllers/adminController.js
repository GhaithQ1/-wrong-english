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
    const { name, image, order, unlockStars, sections } = req.body;
    if (!sections || sections.length < 1)
      return next(new AppError('Topic must have at least 1 section', 400));
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      if (!s.name || !s.questions || s.questions.length !== 10)
        return next(new AppError(`Section ${i + 1} must have exactly 10 questions`, 400));
    }
    if (!order) return next(new AppError('Order is required', 400));
    const topic = await Topic.create({ name, image: image || '', order, unlockStars: unlockStars || 0, sections });
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
    const { name, image, order, unlockStars, sections } = req.body;
    if (!sections || sections.length < 1)
      return next(new AppError('Topic must have at least 1 section', 400));
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      if (!s.name || !s.questions || s.questions.length !== 10)
        return next(new AppError(`Section ${i + 1} must have exactly 10 questions`, 400));
    }
    if (!order) return next(new AppError('Order is required', 400));

    const topic = await Topic.findByIdAndUpdate(
      req.params.id,
      { name, image: image || '', order, unlockStars: unlockStars || 0, sections },
      { new: true, runValidators: true }
    );
    if (!topic) return next(new AppError('Topic not found', 404));

    res.json({ status: 'success', data: topic });
  } catch (err) {
    next(err);
  }
};

exports.deleteTopic = async (req, res, next) => {
  try {
    const UserProgress = require('../models/UserProgress');
    await UserProgress.deleteMany({ topic: req.params.id });
    const topic = await Topic.findByIdAndDelete(req.params.id);
    if (!topic) return next(new AppError('Topic not found', 404));
    res.json({ status: 'success', data: { message: 'Topic deleted' } });
  } catch (err) {
    next(err);
  }
};

exports.uploadImage = async (req, res, next) => {
  try {
    if (!req.file) return next(new AppError('No image file provided', 400));
    const url = `http://localhost:5000/uploads/avatars/${req.file.filename}`;
    res.json({ status: 'success', data: { url } });
  } catch (err) {
    next(err);
  }
};
