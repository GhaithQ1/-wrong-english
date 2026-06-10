const Topic = require('../models/Topic');
const UserProgress = require('../models/UserProgress');
const User = require('../models/User');
const AppError = require('../utils/AppError');

const DIFFICULTY_REWARDS = {
  easy: { xp: 10, coins: 1 },
  medium: { xp: 15, coins: 2 },
  hard: { xp: 20, coins: 3 },
};

function calcSectionBonus(correct, total) {
  const pct = correct / total;
  if (pct === 1) return 8;
  if (pct >= 0.8) return 5;
  if (pct >= 0.6) return 3;
  return 1;
}

function calcFinalBonus(correct, total) {
  const pct = correct / total;
  if (pct === 1) return { coins: 12, stars: 3 };
  if (pct >= 0.8) return { coins: 8, stars: 2 };
  if (pct >= 0.6) return { coins: 5, stars: 1 };
  return { coins: 2, stars: 0 };
}

exports.getTopics = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const topics = await Topic.find().select('-questions').sort({ order: 1 });
    const unlockedIds = (user.unlockedTopics || []).map(id => id.toString());
    const result = await Promise.all(topics.map(async (t) => {
      const progress = req.user
        ? await UserProgress.findOne({ user: req.user.id, topic: t._id })
        : null;
      const isUnlocked = t.unlockStars === 0
        || unlockedIds.includes(t._id.toString())
        || progress?.completed;
      return {
        _id: t._id,
        name: t.name,
        order: t.order,
        unlockStars: t.unlockStars,
        unlocked: isUnlocked,
        section1Done: progress?.section1?.completed || false,
        section2Done: progress?.section2?.completed || false,
        completed: progress?.completed || false,
        rewards: progress?.rewards || null,
      };
    }));
    res.json({ status: 'success', data: result });
  } catch (err) {
    next(err);
  }
};

exports.unlockTopic = async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return next(new AppError('Topic not found', 404));
    if (topic.unlockStars === 0) return next(new AppError('This topic is free', 400));

    const user = await User.findById(req.user.id);
    const unlockedIds = (user.unlockedTopics || []).map(id => id.toString());
    if (unlockedIds.includes(topic._id.toString()))
      return next(new AppError('Already unlocked', 400));
    if (user.stars < topic.unlockStars)
      return next(new AppError(`Need ${topic.unlockStars}⭐ to unlock`, 400));

    user.stars -= topic.unlockStars;
    user.unlockedTopics.push(topic._id);
    await user.save();

    res.json({ status: 'success', data: { stars: user.stars, message: 'Topic unlocked!' } });
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

exports.getProgress = async (req, res, next) => {
  try {
    const progress = await UserProgress.findOne({
      user: req.user.id,
      topic: req.params.id,
    });
    if (!progress) {
      return res.json({
        status: 'success',
        data: {
          section1: { completed: false, correct: 0, total: 5 },
          section2: { completed: false, correct: 0, total: 5 },
          completed: false,
          rewards: null,
        },
      });
    }
    res.json({
      status: 'success',
      data: {
        section1: { completed: progress.section1.completed, correct: progress.section1.correct, total: 5 },
        section2: { completed: progress.section2.completed, correct: progress.section2.correct, total: 5 },
        totalCorrect: progress.totalCorrect,
        completed: progress.completed,
        rewards: progress.rewards,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.retryTopic = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.coins < 10) return next(new AppError('Need 10 coins to retry', 400));

    const progress = await UserProgress.findOne({ user: req.user.id, topic: req.params.id });
    if (!progress?.completed) return next(new AppError('Complete the topic first', 400));

    user.coins -= 10;
    await user.save();
    await UserProgress.deleteOne({ user: req.user.id, topic: req.params.id });

    res.json({ status: 'success', data: { coins: user.coins, message: 'Topic reset. You can retry now.' } });
  } catch (err) {
    next(err);
  }
};

exports.hintQuestion = async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return next(new AppError('Topic not found', 404));

    const user = await User.findById(req.user.id);
    if (user.coins < 10) return next(new AppError('تحتاج 10🪙 للتلميح', 400));

    const idx = req.body.questionIndex;
    if (idx === undefined || idx < 0 || idx > 9)
      return next(new AppError('Invalid question index', 400));
    if (!topic.questions[idx].hint)
      return next(new AppError('لا يوجد تلميح لهذا السؤال', 400));

    user.coins -= 10;
    await user.save();

    res.json({ status: 'success', data: { hint: topic.questions[idx].hint, coins: user.coins } });
  } catch (err) {
    next(err);
  }
};

exports.skipQuestion = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.coins < 5) return next(new AppError('تحتاج 5🪙 للتخطي', 400));

    user.coins -= 5;
    await user.save();

    res.json({ status: 'success', data: { coins: user.coins } });
  } catch (err) {
    next(err);
  }
};



exports.submitSection1 = async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return next(new AppError('Topic not found', 404));

    const existing = await UserProgress.findOne({ user: req.user.id, topic: topic._id });
    if (existing?.section1?.completed)
      return next(new AppError('Section 1 already completed', 400));

    const { answers } = req.body;
    if (!answers || answers.length !== 5)
      return next(new AppError('Exactly 5 answers required', 400));

    const results = answers.map((a, i) => ({
      questionIndex: a.questionIndex,
      selectedIndex: a.skipped ? -1 : a.selectedIndex,
      skipped: a.skipped || false,
      correct: !a.skipped && a.selectedIndex === topic.questions[i].correctIndex,
    }));

    const section1Correct = results.filter(r => r.correct).length;
    let xp = 0, coins = 0;

    results.forEach((r, i) => {
      if (r.correct) {
        const d = topic.questions[i].difficulty;
        xp += DIFFICULTY_REWARDS[d].xp;
        coins += DIFFICULTY_REWARDS[d].coins;
      }
    });

    const bonus = calcSectionBonus(section1Correct, 5);
    coins += bonus;

    await UserProgress.findOneAndUpdate(
      { user: req.user.id, topic: topic._id },
      {
        user: req.user.id,
        topic: topic._id,
        section1: { answers: results, correct: section1Correct, total: 5, bonus, completed: true },
      },
      { upsert: true, new: true }
    );

    res.json({
      status: 'success',
      data: {
        section: 1,
        correct: section1Correct,
        total: 5,
        rewards: { xp, coins },
        bonus,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.submitSection2 = async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return next(new AppError('Topic not found', 404));

    const progress = await UserProgress.findOne({ user: req.user.id, topic: topic._id });
    if (!progress?.section1?.completed)
      return next(new AppError('Complete Section 1 first', 400));
    if (progress.section2.completed)
      return next(new AppError('Section 2 already completed', 400));

    const { answers } = req.body;
    if (!answers || answers.length !== 5)
      return next(new AppError('Exactly 5 answers required', 400));

    const results = answers.map((a, i) => ({
      questionIndex: a.questionIndex,
      selectedIndex: a.skipped ? -1 : a.selectedIndex,
      skipped: a.skipped || false,
      correct: !a.skipped && a.selectedIndex === topic.questions[i + 5].correctIndex,
    }));

    const section2Correct = results.filter(r => r.correct).length;
    let xp = 0, coins = 0, stars = 0;

    results.forEach((r, i) => {
      if (r.correct) {
        const d = topic.questions[i + 5].difficulty;
        xp += DIFFICULTY_REWARDS[d].xp;
        coins += DIFFICULTY_REWARDS[d].coins;
      }
    });

    const bonus = calcSectionBonus(section2Correct, 5);
    coins += bonus;

    const totalCorrect = progress.section1.correct + section2Correct;
    const finalBonus = calcFinalBonus(totalCorrect, 10);
    coins += finalBonus.coins;
    stars += finalBonus.stars;

    const s1Xp = progress.section1.answers.reduce((sum, a) => {
      if (!a.correct) return sum;
      return sum + DIFFICULTY_REWARDS[topic.questions[a.questionIndex].difficulty].xp;
    }, 0);
    const s1Coins = progress.section1.answers.reduce((sum, a) => {
      if (!a.correct) return sum;
      return sum + DIFFICULTY_REWARDS[topic.questions[a.questionIndex].difficulty].coins;
    }, 0);

    const totalXp = s1Xp + xp;
    const totalCoins = s1Coins + progress.section1.bonus + coins;
    const totalStars = stars;

    const perfectXp = totalCorrect === 10 ? 100 : 0;

    const user = await User.findById(req.user.id);
    user.xp += xp + perfectXp;
    user.coins += coins;
    user.stars += stars;
    await user.save();

    await UserProgress.findOneAndUpdate(
      { user: req.user.id, topic: topic._id },
      {
        section2: { answers: results, correct: section2Correct, total: 5, bonus, completed: true },
        totalCorrect,
        rewards: { xp: totalXp, coins: totalCoins, stars: totalStars },
        completed: true,
      }
    );

    res.json({
      status: 'success',
      data: {
        section: 2,
        section1Correct: progress.section1.correct,
        section2Correct,
        totalCorrect,
        rewards: { xp: totalXp + perfectXp, coins: totalCoins, stars: totalStars },
        bonuses: { midSection: bonus, finalSection: finalBonus.coins, finalStars: finalBonus.stars },
        perfectXp,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.submitAnswers = async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return next(new AppError('Topic not found', 404));

    const { answers } = req.body;
    if (!answers || answers.length !== 10)
      return next(new AppError('Exactly 10 answers required', 400));

    const results = answers.map((a, i) => ({
      questionIndex: a.questionIndex,
      selectedIndex: a.selectedIndex,
      correct: a.selectedIndex === topic.questions[i].correctIndex,
    }));

    const section1Correct = results.slice(0, 5).filter(r => r.correct).length;
    const section2Correct = results.slice(5).filter(r => r.correct).length;
    const totalCorrect = section1Correct + section2Correct;

    let xp = 0, coins = 0, stars = 0;

    results.forEach((r, i) => {
      if (r.correct) {
        const d = topic.questions[i].difficulty;
        xp += DIFFICULTY_REWARDS[d].xp;
        coins += DIFFICULTY_REWARDS[d].coins;
      }
    });

    const bonus1 = calcSectionBonus(section1Correct, 5);
    const bonus2 = calcSectionBonus(section2Correct, 5);
    coins += bonus1 + bonus2;

    const finalBonus = calcFinalBonus(totalCorrect, 10);
    coins += finalBonus.coins;
    stars += finalBonus.stars;

    const perfectXp = totalCorrect === 10 ? 100 : 0;

    const user = await User.findById(req.user.id);
    user.xp += xp + perfectXp;
    user.coins += coins;
    user.stars += stars;
    await user.save();

    await UserProgress.findOneAndUpdate(
      { user: req.user.id, topic: topic._id },
      {
        user: req.user.id,
        topic: topic._id,
        section1: { answers: results.slice(0, 5), correct: section1Correct, total: 5, bonus: bonus1, completed: true },
        section2: { answers: results.slice(5), correct: section2Correct, total: 5, bonus: bonus2, completed: true },
        totalCorrect,
        rewards: { xp: xp + perfectXp, coins, stars },
        completed: true,
      },
      { upsert: true, new: true }
    );

    res.json({
      status: 'success',
      data: {
        section1Correct,
        section2Correct,
        totalCorrect,
        rewards: { xp: xp + perfectXp, coins, stars },
        breakdown: {
          perQuestion: xp,
          midSection: bonus1 + bonus2,
          finalSection: finalBonus.coins,
          finalStars: finalBonus.stars,
        },
        perfectXp,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getResult = async (req, res, next) => {
  try {
    const progress = await UserProgress.findOne({
      user: req.user.id,
      topic: req.params.id,
    }).populate('topic', 'name');
    if (!progress) return next(new AppError('No result found for this topic', 404));
    res.json({ status: 'success', data: progress });
  } catch (err) {
    next(err);
  }
};
