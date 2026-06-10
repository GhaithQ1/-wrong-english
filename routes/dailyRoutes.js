const express = require('express');
const router = express.Router();
const dailyController = require('../controllers/dailyController');
const protect = require('../middleware/auth');

router.get('/status', protect, dailyController.getStatus);
router.post('/claim', protect, dailyController.claim);

module.exports = router;
