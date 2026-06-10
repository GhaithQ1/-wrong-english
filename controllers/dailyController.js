const User = require('../models/User');
const AppError = require('../utils/AppError');

const REWARDS = {
  1: { coins: 10, stars: 0 },
  2: { coins: 12, stars: 0 },
  3: { coins: 15, stars: 0 },
  4: { coins: 18, stars: 0 },
  5: { coins: 22, stars: 0 },
  6: { coins: 26, stars: 0 },
  7: { coins: 35, stars: 1 },
};

function dateStr(d) {
  return d.toISOString().split('T')[0];
}

function daysBetween(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return Math.round((db - da) / 86400000);
}

exports.getStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const today = dateStr(new Date());
    const streak = user.loginStreak || 0;
    const canClaim = user.lastLoginDate !== today;
    const day = streak === 0 ? 1 : streak;
    res.json({
      status: 'success',
      data: {
        streak,
        canClaim,
        todayReward: REWARDS[day],
        lastClaimDate: user.lastLoginDate,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.claim = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const today = dateStr(new Date());
    if (user.lastLoginDate === today)
      return next(new AppError('Already claimed today', 400));

    let nextDay;
    if (!user.lastLoginDate) {
      nextDay = 1;
    } else {
      const diff = daysBetween(user.lastLoginDate, today);
      if (diff === 1) {
        nextDay = (user.loginStreak % 7) + 1;
      } else {
        const s = user.loginStreak;
        if (s >= 1 && s <= 3) nextDay = 1;
        else if (s >= 4 && s <= 6) nextDay = 3;
        else nextDay = 1;
      }
    }

    const reward = REWARDS[nextDay];
    user.coins += reward.coins;
    user.stars += reward.stars;
    user.loginStreak = nextDay;
    user.lastLoginDate = today;
    await user.save();

    res.json({
      status: 'success',
      data: {
        streak: nextDay,
        reward,
        coins: user.coins,
        stars: user.stars,
      },
    });
  } catch (err) {
    next(err);
  }
};
