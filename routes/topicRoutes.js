const express = require('express');
const router = express.Router();
const topicController = require('../controllers/topicController');
const protect = require('../middleware/auth');

router.get('/', protect, topicController.getTopics);
router.get('/:id/sections', protect, topicController.getSections);
router.get('/:id/sections/:secIdx/questions', protect, topicController.getSectionQuestions);
router.post('/:id/sections/:secIdx/part/:partNum', protect, topicController.submitPart);
router.get('/:id/sections/:secIdx/result', protect, topicController.getSectionResult);
router.post('/:id/sections/:secIdx/hint', protect, topicController.hintQuestion);
router.post('/:id/sections/:secIdx/skip', protect, topicController.skipQuestion);
router.post('/:id/unlock', protect, topicController.unlockTopic);
router.post('/:id/retry', protect, topicController.retryTopic);

module.exports = router;
