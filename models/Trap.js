const mongoose = require('mongoose');

const trapSchema = new mongoose.Schema({
  creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sentence: { type: String, required: true, trim: true },
  correction: { type: String, default: '', trim: true },
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
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    replies: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      text: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
      likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    }],
  }],
}, { timestamps: true });

module.exports = mongoose.model('Trap', trapSchema);
