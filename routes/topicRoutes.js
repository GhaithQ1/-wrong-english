const express = require('express');
const router = express.Router();
const topicController = require('../controllers/topicController');
const protect = require('../middleware/auth');

router.get('/', protect, topicController.getTopics);
router.get('/:id', protect, topicController.getTopic);
router.get('/:id/progress', protect, topicController.getProgress);
router.post('/:id/section1', protect, topicController.submitSection1);
router.post('/:id/section2', protect, topicController.submitSection2);
router.post('/:id/unlock', protect, topicController.unlockTopic);
router.post('/:id/retry', protect, topicController.retryTopic);
router.post('/:id/hint', protect, topicController.hintQuestion);
router.post('/:id/skip', protect, topicController.skipQuestion);
router.post('/:id/submit', protect, topicController.submitAnswers);
router.get('/:id/result', protect, topicController.getResult);

module.exports = router;
