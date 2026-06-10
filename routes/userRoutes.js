const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/leaderboard', userController.getLeaderboard);

router.get('/', userController.getUsers);
router.post('/', userController.createUser);
router.get('/:id', userController.getUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);
router.patch('/:id/xp', userController.addXp);
router.patch('/:id/coins', userController.updateCoins);
router.patch('/:id/stars', userController.updateStars);

module.exports = router;
