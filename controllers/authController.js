const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const axios = require('axios');
const User = require('../models/User');
const AppError = require('../utils/AppError');

const ADMIN_EMAIL = 'ghaithdrh@gmail.com';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
}

function userData(user) {
  const level = User.calcLevel(user.xp);
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    xp: user.xp,
    coins: user.coins,
    stars: user.stars,
    level,
    xpToNextLevel: level >= 100 ? 0 : User.xpForLevel(level + 1) - user.xp,
  };
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return next(new AppError('Email already in use', 400));
    const role = email === ADMIN_EMAIL ? 'admin' : 'user';
    const user = await User.create({ name, email, password, role });
    const token = signToken(user);
    res.status(201).json({
      status: 'success',
      token,
      data: userData(user),
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return next(new AppError('Email and password required', 400));
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password)))
      return next(new AppError('Invalid email or password', 401));
    if (email === ADMIN_EMAIL && user.role !== 'admin') {
      user.role = 'admin';
      await user.save();
    }
    const token = signToken(user);
    res.json({
      status: 'success',
      token,
      data: userData(user),
    });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return next(new AppError('User not found', 404));
    res.json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const updates = {};
    if (req.body.name) updates.name = req.body.name.trim();
    if (req.file) updates.avatar = '/uploads/avatars/' + req.file.filename;

    const user = await User.findByIdAndUpdate(req.user.id, updates, {
      new: true,
      runValidators: true,
    });
    if (!user) return next(new AppError('User not found', 404));

    res.json({ status: 'success', data: user });
  } catch (err) {
    next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return next(new AppError('Email is required', 400));

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ status: 'success', message: 'If that email is registered, a verification code has been sent.' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    user.passwordResetToken = hashedCode;
    user.passwordResetExpires = Date.now() + 600000; // 10 minutes
    await user.save();

    await transporter.sendMail({
      from: `"Wrong English" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Code',
      html: `
        <div style="max-width:520px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0f0f1a;border-radius:16px;overflow:hidden;border:1px solid #2a2a3e;">
            <div style="padding:32px 28px 0;text-align:center;">
            <img src="https://api.dicebear.com/7.x/thumbs/svg?seed=WE&backgroundColor=f0c040" alt="" style="width:80px;height:80px;border-radius:50%;border:3px solid #f0c040;display:inline-block;" />
          </div>
          <div style="padding:32px 28px;text-align:center;">
            <h1 style="color:#f0c040;font-size:1.4rem;font-weight:700;margin:0 0 8px;">Wrong English</h1>
            <p style="color:#b0b0c0;font-size:0.95rem;margin:0 0 24px;">Your password reset code</p>
            <div style="background:#1a1a2e;border:1px solid #3a3a5e;border-radius:14px;padding:24px 16px;margin:0 0 20px;letter-spacing:10px;font-size:2.2rem;font-weight:800;color:#f0c040;">${code.split('').join(' ')}</div>
            <p style="color:#888;font-size:0.85rem;margin:0 0 4px;">This code expires in <strong style="color:#f0c040;">10 minutes</strong>.</p>
            <p style="color:#555;font-size:0.75rem;margin:20px 0 0;">If you didn't request this, you can safely ignore this email.</p>
          </div>
          <div style="padding:16px 28px;border-top:1px solid #2a2a3e;text-align:center;">
            <p style="color:#555;font-size:0.7rem;margin:0;">Wrong English &mdash; Learn English through mistakes</p>
          </div>
        </div>
      `,
    });

    res.json({ status: 'success', message: 'A 6-digit code has been sent to your email.' });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { email, code, password } = req.body;
    if (!email || !code || !password) return next(new AppError('Email, code, and password are required', 400));
    if (password.length < 6) return next(new AppError('Password must be at least 6 characters', 400));

    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
    const user = await User.findOne({
      email,
      passwordResetToken: hashedCode,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) return next(new AppError('Invalid or expired code', 400));

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    const jwtToken = signToken(user);
    res.json({
      status: 'success',
      token: jwtToken,
      data: userData(user),
    });
  } catch (err) {
    next(err);
  }
};

const REDIRECT_URI = 'http://localhost:5000/api/auth/google/callback';

exports.googleAuth = async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect('/?error=no_code');

    // Exchange code for tokens
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    const { access_token } = tokenRes.data;

    // Fetch user info
    const infoRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: 'Bearer ' + access_token },
    });

    const { id: googleId, email, name, picture } = infoRes.data;
    if (!email) return res.redirect('/?error=no_email');

    // Find or create user
    let user = await User.findOne({ email });
    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        if (picture && !user.avatar) user.avatar = picture;
        await user.save();
      }
    } else {
      user = await User.create({
        googleId,
        name: name || email.split('@')[0],
        email,
        avatar: picture || '',
        role: email === ADMIN_EMAIL ? 'admin' : 'user',
      });
    }

    const token = signToken(user);
    const ud = userData(user);
    const encoded = encodeURIComponent(JSON.stringify(ud));
    res.redirect(`http://localhost:5000/?token=${token}&user=${encoded}`);
  } catch (err) {
    console.error('Google auth error:', err.response?.data || err.message);
    res.redirect('/?error=auth_failed');
  }
};
