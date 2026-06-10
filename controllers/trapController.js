const User = require('../models/User');
const AppError = require('../utils/AppError');
const { validateTrapSafe, checkAnswerSafe } = require('../utils/ai');

const COSTS = [10, 15, 20, 25];

exports.createTrap = async (req, res, next) => {
  try {
    const { sentence, correction } = req.body;
    if (!sentence || !correction)
      return next(new AppError('Sentence and correction are required', 400));

    const user = await User.findById(req.user.id);
    const count = user.traps.length;




    
    const cost = COSTS[count % 4];
    if (user.coins < cost)
      return next(new AppError(`تحتاج ${cost}🪙 لإنشاء فخ`, 400));

    user.coins -= cost;
    await user.save();

    const ai = await validateTrapSafe(sentence, correction);
    if (!ai.valid) {
      user.coins += cost;
      await user.save();
      return res.status(400).json({
        status: 'fail',
        message: ai.reason || 'الفخ غير صالح',
        refund: cost,
        coins: user.coins,
      });
    }

    user.traps.push({ sentence, correction, difficulty: ai.difficulty, aiValidated: true });
    user.lastTrapCreatedAt = new Date();
    await user.save();

    const trap = user.traps[user.traps.length - 1];
    res.status(201).json({
      status: 'success',
      data: {
        _id: trap._id,
        sentence: trap.sentence,
        difficulty: trap.difficulty,
        cost,
        coins: user.coins,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getTraps = async (req, res, next) => {
  try {
    const mine = req.query.mine === 'true';
    const difficultyFilter = req.query.difficulty;
    const mongoose = require('mongoose');
    const userId = new mongoose.Types.ObjectId(req.user.id);

    if (mine) {
      const user = await User.findById(req.user.id).lean();
      let traps = (user.traps || []).slice().reverse();
      if (difficultyFilter) traps = traps.filter(t => t.difficulty === difficultyFilter);
      res.json({ status: 'success', data: traps.map(t => ({
        _id: t._id,
        sentence: t.sentence,
        hint: t.hint,
        difficulty: t.difficulty,
        correction: t.correction,
        totalAttempts: t.totalAttempts,
        correctAttempts: t.correctAttempts,
        rewardClaimed: t.rewardClaimed,
        attempts: t.attempts,
        aiValidated: t.aiValidated,
      })) });
    } else {
      const matchStage = { $match: { 'traps.aiValidated': true } };
      if (difficultyFilter) matchStage.$match['traps.difficulty'] = difficultyFilter;

      const traps = await User.aggregate([
        { $unwind: '$traps' },
        matchStage,
        { $sort: { 'traps._id': -1 } },
        {
          $addFields: {
            myAttempts: {
              $filter: {
                input: '$traps.attempts',
                as: 'a',
                cond: { $eq: ['$$a.user', userId] },
              },
            },
          },
        },
        {
          $project: {
            _id: '$traps._id',
            creator: { _id: '$_id', name: '$name' },
            sentence: '$traps.sentence',
            hint: '$traps.hint',
            difficulty: '$traps.difficulty',
            totalAttempts: '$traps.totalAttempts',
            correctAttempts: '$traps.correctAttempts',
            myAttempt: {
              $cond: {
                if: { $gt: [{ $size: '$myAttempts' }, 0] },
                then: { correct: { $arrayElemAt: ['$myAttempts.correct', 0] } },
                else: null,
              },
            },
          },
        },
      ]);
      res.json({ status: 'success', data: traps });
    }
  } catch (err) {
    next(err);
  }
};

exports.getTrap = async (req, res, next) => {
  try {
    const user = await User.findOne(
      { 'traps._id': req.params.id },
      { 'traps.$': 1, name: 1 }
    );
    if (!user || !user.traps || !user.traps.length)
      return next(new AppError('Trap not found', 404));

    const trap = user.traps[0];
    const isCreator = user._id.toString() === req.user.id;

    let myAttempt = null;
    if (!isCreator) {
      const found = trap.attempts.find(
        a => a.user.toString() === req.user.id
      );
      if (found) myAttempt = { correct: found.correct, answer: found.answer };
    }

    res.json({
      status: 'success',
      data: {
        _id: trap._id,
        creator: { name: user.name },
        sentence: trap.sentence,
        hint: trap.hint,
        difficulty: trap.difficulty,
        ...(isCreator ? {
          correction: trap.correction,
          totalAttempts: trap.totalAttempts,
          correctAttempts: trap.correctAttempts,
          rewardClaimed: trap.rewardClaimed,
        } : {
          totalAttempts: trap.totalAttempts,
          correctAttempts: trap.correctAttempts,
        }),
        ...(myAttempt ? { myAttempt } : {}),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.attemptTrap = async (req, res, next) => {
  try {
    const { answer } = req.body;
    if (!answer) return next(new AppError('Answer is required', 400));

    const user = await User.findOne(
      { 'traps._id': req.params.id },
      { 'traps.$': 1, name: 1, coins: 1 }
    );
    if (!user || !user.traps || !user.traps.length)
      return next(new AppError('Trap not found', 404));

    const trap = user.traps[0];

    if (user._id.toString() === req.user.id)
      return next(new AppError('لا يمكنك حل فخّك الخاص', 400));

    const already = trap.attempts.find(a => a.user.toString() === req.user.id);
    if (already)
      return next(new AppError('لقد حاولت هذا الفخ من قبل', 400));

    const normalizedAnswer = answer.trim().toLowerCase();
    const normalizedCorrection = trap.correction.trim().toLowerCase();
    let correct = normalizedAnswer === normalizedCorrection;

    if (!correct) {
      const ai = await checkAnswerSafe(trap.sentence, trap.correction, answer);
      correct = ai.correct;
    }

    const solver = await User.findById(req.user.id);
    let coinsEarned = 0;
    if (correct) {
      coinsEarned = 2;
      solver.coins += coinsEarned;
      await solver.save();
    }

    await User.findOneAndUpdate(
      { 'traps._id': req.params.id },
      {
        $push: {
          'traps.$.attempts': {
            user: req.user.id,
            answer,
            correct,
          },
        },
        $inc: {
          'traps.$.totalAttempts': 1,
          ...(correct ? { 'traps.$.correctAttempts': 1 } : {}),
        },
      }
    );

    res.json({
      status: 'success',
      data: {
        correct,
        answer,
        correction: correct ? trap.correction : undefined,
        coinsEarned,
        totalCorrect: trap.correctAttempts + (correct ? 1 : 0),
        totalAttempts: trap.totalAttempts + 1,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.claimReward = async (req, res, next) => {
  try {
    const user = await User.findOne(
      { 'traps._id': req.params.id },
      { 'traps.$': 1, coins: 1 }
    );
    if (!user || !user.traps || !user.traps.length)
      return next(new AppError('Trap not found', 404));

    const trap = user.traps[0];

    if (user._id.toString() !== req.user.id)
      return next(new AppError('أنت لست صاحب هذا الفخ', 403));

    if (trap.rewardClaimed)
      return next(new AppError('المكافأة مسحوبة مسبقاً', 400));

    if (trap.totalAttempts === 0)
      return next(new AppError('لا يوجد محاولات بعد', 400));

    const ratio = trap.correctAttempts / trap.totalAttempts;
    let reward;
    if (ratio > 0.5) reward = 10;
    else if (ratio === 0.5) reward = 15;
    else reward = 25;

    user.coins += reward;
    await User.findOneAndUpdate(
      { 'traps._id': req.params.id },
      { $set: { 'traps.$.rewardClaimed': true } }
    );
    await user.save();

    res.json({
      status: 'success',
      data: { reward, coins: user.coins },
    });
  } catch (err) {
    next(err);
  }
};
