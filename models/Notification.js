const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['like', 'comment'], required: true },
  trap: { type: mongoose.Schema.Types.ObjectId, ref: 'Trap', required: true },
  fromUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  read: { type: Boolean, default: false },
}, { timestamps: true });

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

notificationSchema.statics.autoCleanup = async function (userId) {
  const count = await this.countDocuments({ user: userId });
  if (count > 50) {
    const toDelete = await this.find({ user: userId })
      .sort({ createdAt: 1 })
      .limit(count - 50)
      .select('_id');
    if (toDelete.length > 0) {
      await this.deleteMany({ _id: { $in: toDelete.map(d => d._id) } });
    }
  }
};

module.exports = mongoose.model('Notification', notificationSchema);
