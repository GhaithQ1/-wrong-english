const Trap = require('../models/Trap');
const User = require('../models/User');
const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const { validateTrapSafe, checkAnswerSafe, generateCorrectionSafe } = require('../utils/ai');

const COSTS = [10, 15, 20, 25];

exports.createTrap = async (req, res, next) => {
  try {
    const { sentence } = req.body;
    if (!sentence)
      return next(new AppError('Sentence is required', 400));

    const user = await User.findById(req.user.id);
    const count = await Trap.countDocuments({ creator: user._id });

    const cost = COSTS[count % 4];
    if (user.coins < cost)
      return next(new AppError(`تحتاج ${cost}🪙 لإنشاء فخ`, 400));

    user.coins -= cost;
    await user.save();

    const ai = await generateCorrectionSafe(sentence);
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

    const trap = await Trap.create({
      creator: user._id,
      sentence,
      correction: ai.correction,
      difficulty: ai.difficulty,
      aiValidated: true,
    });

    user.lastTrapCreatedAt = new Date();
    await user.save();

    res.status(201).json({
      status: 'success',
      data: {
        _id: trap._id,
        sentence: trap.sentence,
        correction: trap.correction,
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

    const filter = mine
      ? { creator: req.user.id }
      : { aiValidated: true };

    if (difficultyFilter) filter.difficulty = difficultyFilter;

    const traps = await Trap.find(filter)
      .sort({ createdAt: -1 })
      .populate('creator', 'name avatar')
      .populate('comments.user', 'name avatar')
      .populate('comments.replies.user', 'name avatar')
      .lean();

    const userId = req.user.id;
    const enrichComment = c => ({
      _id: c._id,
      text: c.text,
      user: c.user,
      createdAt: c.createdAt,
      likesCount: c.likes?.length || 0,
      liked: (c.likes || []).some(l => l.toString() === userId),
      repliesCount: c.replies?.length || 0,
      replies: (c.replies || []).map(r => ({
        _id: r._id,
        text: r.text,
        user: r.user,
        createdAt: r.createdAt,
        likesCount: r.likes?.length || 0,
        liked: (r.likes || []).some(l => l.toString() === userId),
      })),
    });

    if (mine) {
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
        likesCount: t.likes.length,
        liked: t.likes.some(l => l.toString() === userId),
        commentsCount: t.comments.length,
        latestComments: t.comments.slice(-2).reverse().map(enrichComment),
      })) });
    } else {
      res.json({ status: 'success', data: traps.map(t => {
        const userAttempts = t.attempts.filter(a => a.user.toString() === userId);
        const myAttempt = userAttempts.length > 0 ? userAttempts[userAttempts.length - 1] : null;
        return {
          _id: t._id,
          creator: t.creator,
          sentence: t.sentence,
          hint: t.hint,
          difficulty: t.difficulty,
          totalAttempts: t.totalAttempts,
          correctAttempts: t.correctAttempts,
          myAttempt: myAttempt ? { correct: myAttempt.correct } : null,
          likesCount: t.likes.length,
          liked: t.likes.some(l => l.toString() === userId),
          commentsCount: t.comments.length,
          latestComments: t.comments.slice(-2).reverse().map(enrichComment),
        };
      }) });
    }
  } catch (err) {
    next(err);
  }
};

exports.getTrap = async (req, res, next) => {
  try {
    const trap = await Trap.findById(req.params.id)
      .populate('creator', 'name avatar')
      .populate('comments.user', 'name avatar')
      .populate('comments.replies.user', 'name avatar');
    if (!trap) return next(new AppError('Trap not found', 404));

    const userId = req.user.id;
    const isCreator = trap.creator._id.toString() === userId;

    const enrichComment = c => ({
      _id: c._id,
      text: c.text,
      user: c.user,
      createdAt: c.createdAt,
      likesCount: c.likes?.length || 0,
      liked: (c.likes || []).some(l => l.toString() === userId),
      repliesCount: c.replies?.length || 0,
      replies: (c.replies || []).map(r => ({
        _id: r._id,
        text: r.text,
        user: r.user,
        createdAt: r.createdAt,
        likesCount: r.likes?.length || 0,
        liked: (r.likes || []).some(l => l.toString() === userId),
      })),
    });

    let myAttempt = null;
    if (!isCreator) {
      const found = trap.attempts.find(a => a.user.toString() === userId);
      if (found) myAttempt = { correct: found.correct, answer: found.answer };
    }

    res.json({
      status: 'success',
      data: {
        _id: trap._id,
        creator: { name: trap.creator.name, avatar: trap.creator.avatar },
        sentence: trap.sentence,
        hint: trap.hint,
        difficulty: trap.difficulty,
        likesCount: trap.likes.length,
        liked: trap.likes.some(l => l.toString() === userId),
        comments: trap.comments.map(enrichComment),
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

    const trap = await Trap.findById(req.params.id);
    if (!trap) return next(new AppError('Trap not found', 404));

    if (trap.creator.toString() === req.user.id)
      return next(new AppError('لا يمكنك حل فخّك الخاص', 400));

    const already = trap.attempts.find(a => a.user.toString() === req.user.id);
    if (already)
      return next(new AppError('لقد حاولت هذا الفخ من قبل', 400));

    const ai = await checkAnswerSafe(trap.sentence, trap.correction, answer);
    const correct = ai.correct;

    const solver = await User.findById(req.user.id);
    let coinsEarned = 0;
    if (correct) {
      coinsEarned = 2;
      solver.coins += coinsEarned;
      await solver.save();
    }

    trap.attempts.push({ user: req.user.id, answer, correct });
    trap.totalAttempts += 1;
    if (correct) trap.correctAttempts += 1;
    await trap.save();

    res.json({
      status: 'success',
      data: {
        correct,
        answer,
        correction: correct ? trap.correction : undefined,
        coinsEarned,
        totalCorrect: trap.correctAttempts,
        totalAttempts: trap.totalAttempts,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.claimReward = async (req, res, next) => {
  try {
    const trap = await Trap.findById(req.params.id);
    if (!trap) return next(new AppError('Trap not found', 404));

    const user = await User.findById(req.user.id);
    if (trap.creator.toString() !== user._id.toString())
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
    trap.rewardClaimed = true;
    await trap.save();
    await user.save();

    res.json({
      status: 'success',
      data: { reward, coins: user.coins },
    });
  } catch (err) {
    next(err);
  }
};

exports.toggleLike = async (req, res, next) => {
  try {
    const trap = await Trap.findById(req.params.id);
    if (!trap) return next(new AppError('Trap not found', 404));

    const userId = req.user.id;
    const idx = trap.likes.findIndex(l => l.toString() === userId);

    if (idx > -1) {
      trap.likes.splice(idx, 1);
      await trap.save();
    } else {
      trap.likes.push(userId);
      await trap.save();

      // Notify creator
      if (trap.creator.toString() !== userId) {
        const exists = await Notification.findOne({
          user: trap.creator,
          type: 'like',
          trap: trap._id,
          fromUser: userId,
        });
        if (!exists) {
          await Notification.create({
            user: trap.creator,
            type: 'like',
            trap: trap._id,
            fromUser: userId,
          });
          await Notification.autoCleanup(trap.creator);
        }
      }
    }

    res.json({
      status: 'success',
      data: { likesCount: trap.likes.length, liked: idx === -1 },
    });
  } catch (err) {
    next(err);
  }
};

exports.addComment = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim())
      return next(new AppError('Comment text is required', 400));

    const trap = await Trap.findById(req.params.id);
    if (!trap) return next(new AppError('Trap not found', 404));

    const comment = { user: req.user.id, text: text.trim(), likes: [] };
    trap.comments.push(comment);
    await trap.save();

    const populated = await Trap.findById(trap._id)
      .populate('comments.user', 'name avatar')
      .lean();
    const savedComment = populated.comments[populated.comments.length - 1];
    savedComment.likesCount = 0;
    savedComment.liked = false;
    savedComment.repliesCount = 0;
    savedComment.replies = [];

    // Notify creator
    if (trap.creator.toString() !== req.user.id) {
      await Notification.create({
        user: trap.creator,
        type: 'comment',
        trap: trap._id,
        fromUser: req.user.id,
      });
      await Notification.autoCleanup(trap.creator);
    }

    res.status(201).json({
      status: 'success',
      data: { comment: savedComment, commentsCount: trap.comments.length },
    });
  } catch (err) {
    next(err);
  }
};

exports.deleteComment = async (req, res, next) => {
  try {
    const trap = await Trap.findById(req.params.id);
    if (!trap) return next(new AppError('Trap not found', 404));

    // Try top-level comment
    const comment = trap.comments.id(req.params.commentId);
    if (comment) {
      if (comment.user.toString() !== req.user.id)
        return next(new AppError('لا يمكنك حذف تعليق غير تعليقك', 403));
      comment.deleteOne();
      await trap.save();
      return res.json({ status: 'success', data: { commentsCount: trap.comments.length } });
    }

    // Try nested reply
    for (const c of trap.comments) {
      const reply = c.replies.id(req.params.commentId);
      if (reply) {
        if (reply.user.toString() !== req.user.id)
          return next(new AppError('لا يمكنك حذف تعليق غير تعليقك', 403));
        reply.deleteOne();
        await trap.save();
        return res.json({ status: 'success', data: { commentsCount: trap.comments.length } });
      }
    }

    return next(new AppError('Comment not found', 404));
  } catch (err) {
    next(err);
  }
};

exports.toggleCommentLike = async (req, res, next) => {
  try {
    const trap = await Trap.findById(req.params.id);
    if (!trap) return next(new AppError('Trap not found', 404));

    const comment = trap.comments.id(req.params.commentId);
    if (!comment) return next(new AppError('Comment not found', 404));

    const userId = req.user.id;
    const idx = comment.likes.findIndex(l => l.toString() === userId);
    if (idx > -1) {
      comment.likes.splice(idx, 1);
    } else {
      comment.likes.push(userId);
      // Notify comment owner
      if (comment.user.toString() !== userId) {
        const exists = await Notification.findOne({
          user: comment.user,
          type: 'comment_like',
          trap: trap._id,
          fromUser: userId,
        });
        if (!exists) {
          await Notification.create({
            user: comment.user,
            type: 'comment_like',
            trap: trap._id,
            fromUser: userId,
          });
          await Notification.autoCleanup(comment.user);
        }
      }
    }
    await trap.save();

    res.json({
      status: 'success',
      data: { likesCount: comment.likes.length, liked: idx === -1 },
    });
  } catch (err) {
    next(err);
  }
};

exports.toggleReplyLike = async (req, res, next) => {
  try {
    const trap = await Trap.findById(req.params.id);
    if (!trap) return next(new AppError('Trap not found', 404));

    const comment = trap.comments.id(req.params.commentId);
    if (!comment) return next(new AppError('Comment not found', 404));

    const reply = comment.replies.id(req.params.replyId);
    if (!reply) return next(new AppError('Reply not found', 404));

    const userId = req.user.id;
    const idx = reply.likes.findIndex(l => l.toString() === userId);
    if (idx > -1) {
      reply.likes.splice(idx, 1);
    } else {
      reply.likes.push(userId);
      // Notify reply owner
      if (reply.user.toString() !== userId) {
        const exists = await Notification.findOne({
          user: reply.user,
          type: 'reply_like',
          trap: trap._id,
          fromUser: userId,
        });
        if (!exists) {
          await Notification.create({
            user: reply.user,
            type: 'reply_like',
            trap: trap._id,
            fromUser: userId,
          });
          await Notification.autoCleanup(reply.user);
        }
      }
    }
    await trap.save();

    res.json({
      status: 'success',
      data: { likesCount: reply.likes.length, liked: idx === -1 },
    });
  } catch (err) {
    next(err);
  }
};

exports.addReply = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim())
      return next(new AppError('Reply text is required', 400));

    const trap = await Trap.findById(req.params.id);
    if (!trap) return next(new AppError('Trap not found', 404));

    const comment = trap.comments.id(req.params.commentId);
    if (!comment) return next(new AppError('Comment not found', 404));

    const reply = { user: req.user.id, text: text.trim(), likes: [] };
    comment.replies.push(reply);
    await trap.save();

    const populated = await Trap.findById(trap._id)
      .populate('comments.replies.user', 'name avatar')
      .lean();
    const populatedComment = populated.comments.find(c => c._id.toString() === req.params.commentId);
    const savedReply = populatedComment ? populatedComment.replies.slice(-1)[0] : null;

    // Notify comment owner
    if (comment.user.toString() !== req.user.id) {
      await Notification.create({
        user: comment.user,
        type: 'comment_reply',
        trap: trap._id,
        fromUser: req.user.id,
      });
      await Notification.autoCleanup(comment.user);
    }

    savedReply.likesCount = 0;
    savedReply.liked = false;

    res.status(201).json({
      status: 'success',
      data: { reply: savedReply, commentsCount: trap.comments.length },
    });
  } catch (err) {
    next(err);
  }
};
