const express = require('express');
const router = express.Router();
const trapController = require('../controllers/trapController');
const protect = require('../middleware/auth');

router.post('/', protect, trapController.createTrap);
router.get('/', protect, trapController.getTraps);
router.get('/:id', protect, trapController.getTrap);
router.post('/:id/attempt', protect, trapController.attemptTrap);
router.post('/:id/claim', protect, trapController.claimReward);

module.exports = router;
