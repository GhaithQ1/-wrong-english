const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
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
    password: {
      type: String,
      required: [true, 'Password is required'],
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
    traps: [{
      sentence: { type: String, required: true, trim: true },
      correction: { type: String, required: true, trim: true },
      hint: { type: String, trim: true, default: '' },
      difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
      aiValidated: { type: Boolean, default: false },
      totalAttempts: { type: Number, default: 0 },
      correctAttempts: { type: Number, default: 0 },
      rewardClaimed: { type: Boolean, default: false },
      attempts: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        answer: { type: String, required: true },
        correct: { type: Boolean, required: true },
        createdAt: { type: Date, default: Date.now },
      }],
    }],
  },
  { timestamps: true }
);

userSchema.statics.calcLevel = function (xp) {
  if (xp >= 250) return 3;
  if (xp >= 100) return 2;
  return 1;
};

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
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
