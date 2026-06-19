const express = require('express');
const router = express.Router();
const trapController = require('../controllers/trapController');
const protect = require('../middleware/auth');

router.post('/', protect, trapController.createTrap);
router.get('/', protect, trapController.getTraps);
router.get('/:id', protect, trapController.getTrap);
router.post('/:id/attempt', protect, trapController.attemptTrap);
router.post('/:id/claim', protect, trapController.claimReward);
router.post('/:id/like', protect, trapController.toggleLike);
router.post('/:id/comment', protect, trapController.addComment);
router.post('/:id/comment/:commentId/like', protect, trapController.toggleCommentLike);
router.post('/:id/comment/:commentId/reply', protect, trapController.addReply);
router.post('/:id/comment/:commentId/reply/:replyId/like', protect, trapController.toggleReplyLike);
router.delete('/:id/comment/:commentId', protect, trapController.deleteComment);

module.exports = router;
