const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      default: '',
    },
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
    },
    avatar: {
      type: String,
      default: '',
    },
    password: {
      type: String,
      minlength: 6,
      select: false,
    },
    xp: {
      type: Number,
      default: 0,
    },
    coins: {
      type: Number,
      default: 0,
    },
    stars: {
      type: Number,
      default: 0,
    },
    level: {
      type: Number,
      default: 1,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    unlockedTopics: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Topic',
    }],
    loginStreak: {
      type: Number,
      default: 0,
      min: 0,
      max: 7,
    },
    lastLoginDate: {
      type: String,
      default: '',
    },
    lastTrapCreatedAt: {
      type: Date,
      default: null,
    },
    passwordResetToken: String,
    passwordResetExpires: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

userSchema.virtual('xpToNextLevel').get(function () {
  const lvl = this.constructor.calcLevel(this.xp);
  if (lvl >= 100) return 0;
  return this.constructor.xpForLevel(lvl + 1) - this.xp;
});

userSchema.statics.calcLevel = function (xp) {
  return Math.min(100, Math.floor((1 + Math.sqrt(1 + (4 * xp) / 5)) / 2));
};

userSchema.statics.xpForLevel = function (level) {
  return 5 * level * (level - 1);
};

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  if (!this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.pre('save', function (next) {
  if (this.isModified('xp')) {
    this.level = this.constructor.calcLevel(this.xp);
  }
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
