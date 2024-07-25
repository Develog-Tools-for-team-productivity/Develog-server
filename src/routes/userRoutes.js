import express from 'express';
import {
  registerUser,
  loginUser,
  fetchRepositories,
  getUserData,
} from '../controllers/userController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/registerUser', registerUser);
router.post('/login', loginUser);
router.post('/fetch-repositories', fetchRepositories);

router.get('/user-data', authenticateToken, getUserData);

export default router;
