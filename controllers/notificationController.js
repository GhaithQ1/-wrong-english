const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');

exports.getNotifications = async (req, res, next) => {
  try {
    const [unread, read] = await Promise.all([
      Notification.find({ user: req.user.id, read: false })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate('fromUser', 'name')
        .populate('trap', 'sentence')
        .lean(),
      Notification.find({ user: req.user.id, read: true })
        .sort({ createdAt: -1 })
        .limit(10)
        .populate('fromUser', 'name')
        .populate('trap', 'sentence')
        .lean(),
    ]);

    res.json({
      status: 'success',
      data: { unread, read, unreadCount: unread.length },
    });
  } catch (err) {
    next(err);
  }
};

exports.markAllRead = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user.id, read: false },
      { read: true }
    );
    res.json({ status: 'success' });
  } catch (err) {
    next(err);
  }
};

exports.markRead = async (req, res, next) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { read: true },
      { new: true }
    );
    if (!notif) return next(new AppError('Notification not found', 404));
    res.json({ status: 'success' });
  } catch (err) {
    next(err);
  }
};
