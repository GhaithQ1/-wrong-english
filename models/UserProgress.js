const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionIndex: { type: Number, required: true },
  selectedIndex: { type: Number, required: true },
  correct: { type: Boolean, required: true },
}, { _id: false });

const sectionSchema = new mongoose.Schema({
  answers: [answerSchema],
  correct: { type: Number, default: 0 },
  total: { type: Number, default: 5 },
  bonus: { type: Number, default: 0 },
  completed: { type: Boolean, default: false },
}, { _id: false });

const userProgressSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topic: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  section1: { type: sectionSchema, default: () => ({}) },
  section2: { type: sectionSchema, default: () => ({}) },
  totalCorrect: { type: Number, default: 0 },
  rewards: {
    xp: { type: Number, default: 0 },
    coins: { type: Number, default: 0 },
    stars: { type: Number, default: 0 },
  },
  completed: { type: Boolean, default: false },
}, { timestamps: true });

userProgressSchema.index({ user: 1, topic: 1 }, { unique: true });

module.exports = mongoose.model('UserProgress', userProgressSchema);
