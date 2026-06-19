const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  sentence: { type: String, required: true },
  choices: { type: [String], required: true, validate: v => v.length === 4 },
  correctIndex: { type: Number, required: true, min: 0, max: 3 },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], required: true },
  hint: { type: String, default: '' },
});

const sectionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  questions: { type: [questionSchema], required: true, validate: v => v.length === 10 },
});

const topicSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    image: { type: String, default: '' },
    order: { type: Number, required: true },
    unlockStars: { type: Number, default: 0 },
    sections: { type: [sectionSchema], required: true, validate: v => v.length >= 1 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Topic', topicSchema);
