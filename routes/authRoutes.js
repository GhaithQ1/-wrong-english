const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const protect = require('../middleware/auth');
const upload = require('../middleware/upload');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', protect, authController.getMe);
router.put('/profile', protect, upload.single('avatar'), authController.updateProfile);

router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

router.get('/google', (req, res) => {
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' +
    'client_id=' + process.env.GOOGLE_CLIENT_ID +
    '&redirect_uri=' + encodeURIComponent('http://localhost:5000/api/auth/google/callback') +
    '&response_type=code' +
    '&scope=openid%20email%20profile';
  res.redirect(url);
});
router.get('/google/callback', authController.googleAuth);

module.exports = router;
