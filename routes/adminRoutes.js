const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const protect = require('../middleware/auth');
const admin = require('../middleware/admin');

router.get('/stats', protect, admin, adminController.getStats);
router.get('/users', protect, admin, adminController.getUsers);
router.get('/topics', protect, admin, adminController.getTopics);
router.get('/topics/:id', protect, admin, adminController.getTopic);
router.post('/topics', protect, admin, adminController.createTopic);
router.put('/topics/:id', protect, admin, adminController.updateTopic);

module.exports = router;
