const Topic = require('../models/Topic');
const UserProgress = require('../models/UserProgress');
const User = require('../models/User');
const AppError = require('../utils/AppError');

const DIFFICULTY_REWARDS = {
  easy: { xp: 10, coins: 1 },
  medium: { xp: 15, coins: 2 },
  hard: { xp: 20, coins: 3 },
};

function calcPartBonus(correct, total) {
  const pct = correct / total;
  if (pct === 1) return 8;
  if (pct >= 0.8) return 5;
  if (pct >= 0.6) return 3;
  return 1;
}

function calcSectionFinalBonus(correct, total) {
  const pct = correct / total;
  if (pct === 1) return { coins: 12, stars: 3 };
  if (pct >= 0.8) return { coins: 8, stars: 2 };
  if (pct >= 0.6) return { coins: 5, stars: 1 };
  return { coins: 2, stars: 0 };
}

// --- Topics List ---

exports.getTopics = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const topics = await Topic.find().select('name image order unlockStars sections.name').sort({ order: 1 });
    const unlockedIds = (user.unlockedTopics || []).map(id => id.toString());
    const result = await Promise.all(topics.map(async (t) => {
      const progress = await UserProgress.findOne({ user: req.user.id, topic: t._id });
      const isUnlocked = t.unlockStars === 0
        || unlockedIds.includes(t._id.toString())
        || progress?.completed;
      const sectionsCount = t.sections ? t.sections.length : 0;
      const sectionsDone = progress ? progress.sections.filter(s => s.completed).length : 0;
      return {
        _id: t._id,
        name: t.name,
        image: t.image,
        order: t.order,
        unlockStars: t.unlockStars,
        unlocked: isUnlocked,
        sectionsCount,
        sectionsDone,
        completed: progress?.completed || false,
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

// --- Sections ---

exports.getSections = async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id).select('name image sections.name');
    if (!topic) return next(new AppError('Topic not found', 404));
    const progress = await UserProgress.findOne({ user: req.user.id, topic: topic._id });
    const sections = topic.sections.map((s, i) => {
      const sp = progress?.sections?.find(p => p.sectionIndex === i);
      return {
        index: i,
        name: s.name,
        part1Done: sp?.part1?.completed || false,
        part2Done: sp?.part2?.completed || false,
        completed: sp?.completed || false,
        locked: i > 0 && !progress?.sections?.find(p => p.sectionIndex === i - 1)?.completed,
      };
    });
    // First section always unlocked
    if (sections.length > 0) sections[0].locked = false;
    res.json({ status: 'success', data: { name: topic.name, image: topic.image, sections } });
  } catch (err) {
    next(err);
  }
};

exports.getSectionQuestions = async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return next(new AppError('Topic not found', 404));
    const secIdx = parseInt(req.params.secIdx);
    const section = topic.sections[secIdx];
    if (!section) return next(new AppError('Section not found', 404));
    const part = parseInt(req.query.part) || 1;
    if (part !== 1 && part !== 2) return next(new AppError('Part must be 1 or 2', 400));
    const start = part === 1 ? 0 : 5;
    const questions = section.questions.slice(start, start + 5).map(q => ({
      sentence: q.sentence,
      choices: q.choices,
      difficulty: q.difficulty,
    }));
    res.json({ status: 'success', data: { name: section.name, questions } });
  } catch (err) {
    next(err);
  }
};

// --- Submit Part ---

exports.submitPart = async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return next(new AppError('Topic not found', 404));
    const secIdx = parseInt(req.params.secIdx);
    const partNum = parseInt(req.params.partNum);
    const section = topic.sections[secIdx];
    if (!section) return next(new AppError('Section not found', 404));
    if (partNum !== 1 && partNum !== 2) return next(new AppError('Part must be 1 or 2', 400));

    let progress = await UserProgress.findOne({ user: req.user.id, topic: topic._id });
    if (!progress) {
      progress = new UserProgress({
        user: req.user.id,
        topic: topic._id,
        sections: topic.sections.map((_, i) => ({
          sectionIndex: i,
          part1: { answers: [], correct: 0, total: 5, bonus: 0, completed: false },
          part2: { answers: [], correct: 0, total: 5, bonus: 0, completed: false },
          completed: false,
        })),
      });
    }

    const sp = progress.sections.find(p => p.sectionIndex === secIdx);

    // If part 2 but part 1 not done
    if (partNum === 2 && !sp.part1.completed)
      return next(new AppError('Complete Part 1 first', 400));

    const partKey = partNum === 1 ? 'part1' : 'part2';
    if (sp[partKey].completed)
      return next(new AppError(`Part ${partNum} already completed`, 400));

    const { answers } = req.body;
    if (!answers || answers.length !== 5)
      return next(new AppError('Exactly 5 answers required', 400));

    const startIdx = partNum === 1 ? 0 : 5;
    const results = answers.map((a, i) => ({
      questionIndex: startIdx + i,
      selectedIndex: a.skipped ? -1 : a.selectedIndex,
      skipped: a.skipped || false,
      correct: !a.skipped && a.selectedIndex === section.questions[startIdx + i].correctIndex,
    }));

    const partCorrect = results.filter(r => r.correct).length;
    let xp = 0, coins = 0;

    results.forEach((r, i) => {
      if (r.correct) {
        const d = section.questions[startIdx + i].difficulty;
        xp += DIFFICULTY_REWARDS[d].xp;
        coins += DIFFICULTY_REWARDS[d].coins;
      }
    });

    const bonus = calcPartBonus(partCorrect, 5);
    coins += bonus;

    sp[partKey] = {
      answers: results, correct: partCorrect, total: 5, bonus, completed: true,
    };

    if (partNum === 2 || (partNum === 1 && sp.part2.completed)) {
      let stars = 0;

      const p1Answers = sp.part1.answers || [];
      const p2Answers = sp.part2.answers || [];
      let totalXp = 0;
      p1Answers.forEach(a => {
        if (a.correct) totalXp += DIFFICULTY_REWARDS[section.questions[a.questionIndex].difficulty].xp;
      });
      p2Answers.forEach(a => {
        if (a.correct) totalXp += DIFFICULTY_REWARDS[section.questions[a.questionIndex].difficulty].xp;
      });

      const part1Correct = sp.part1.correct;
      const part2Correct = sp.part2.correct;
      const totalCorrect = part1Correct + part2Correct;
      const finalBonus = calcSectionFinalBonus(totalCorrect, 10);
      coins += finalBonus.coins;
      stars += finalBonus.stars;
      const perfectXp = totalCorrect === 10 ? 100 : 0;

      const user = await User.findById(req.user.id);
      user.xp += totalXp + perfectXp;
      user.coins += coins;
      user.stars += stars;
      await user.save();

      sp.completed = true;

      // Check if all sections done
      const allDone = topic.sections.every((_, i) => {
        if (i === secIdx) return true;
        const other = progress.sections.find(p => p.sectionIndex === i);
        return other?.completed || false;
      });
      if (allDone) progress.completed = true;

      // Mark the setPath for the topic as modified
      progress.markModified('sections');
      await progress.save();

      return res.json({
        status: 'success',
        data: {
          part: partNum,
          correct: partCorrect,
          total: 5,
          rewards: { xp, coins, stars },
          bonus,
          sectionCorrect: totalCorrect,
          finalBonus: { coins: finalBonus.coins, stars: finalBonus.stars },
          perfectXp,
          sectionCompleted: true,
        },
      });
    }

    progress.markModified('sections');
    await progress.save();

    res.json({
      status: 'success',
      data: {
        part: partNum,
        correct: partCorrect,
        total: 5,
        rewards: { xp, coins },
        bonus,
        sectionCompleted: false,
      },
    });
  } catch (err) {
    next(err);
  }
};

// --- Results ---

exports.getSectionResult = async (req, res, next) => {
  try {
    const progress = await UserProgress.findOne({
      user: req.user.id,
      topic: req.params.id,
    });
    if (!progress) return next(new AppError('No results found', 404));

    const secIdx = parseInt(req.params.secIdx);
    const sp = progress.sections?.find(p => p.sectionIndex === secIdx);
    if (!sp) return next(new AppError('Section not found in progress', 404));

    res.json({
      status: 'success',
      data: {
        part1: { correct: sp.part1.correct, total: 5, bonus: sp.part1.bonus },
        part2: { correct: sp.part2.correct, total: 5, bonus: sp.part2.bonus },
        totalCorrect: (sp.part1.correct || 0) + (sp.part2.correct || 0),
        completed: sp.completed,
      },
    });
  } catch (err) {
    next(err);
  }
};

// --- Retry ---

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

// --- Hint & Skip ---

exports.hintQuestion = async (req, res, next) => {
  try {
    const topic = await Topic.findById(req.params.id);
    if (!topic) return next(new AppError('Topic not found', 404));

    const secIdx = parseInt(req.params.secIdx);
    const section = topic.sections[secIdx];
    if (!section) return next(new AppError('Section not found', 404));

    const user = await User.findById(req.user.id);
    if (user.coins < 10) return next(new AppError('تحتاج 10🪙 للتلميح', 400));

    const idx = req.body.questionIndex;
    if (idx === undefined || idx < 0 || idx > 9)
      return next(new AppError('Invalid question index', 400));
    if (!section.questions[idx].hint)
      return next(new AppError('لا يوجد تلميح لهذا السؤال', 400));

    user.coins -= 10;
    await user.save();

    res.json({ status: 'success', data: { hint: section.questions[idx].hint, coins: user.coins } });
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
