import express from 'express';
import {
  saveRepositoriesInfo,
  githubAuth,
  githubCallback,
  fetchRepositories,
  getUserData,
} from '../controllers/userController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/saveRepositoriesInfo', authenticateToken, saveRepositoriesInfo);
router.get('/user-data', authenticateToken, getUserData);
router.get('/fetch-repositories', authenticateToken, fetchRepositories);
router.get('/auth/github', githubAuth);
router.get('/auth/github/callback', githubCallback);

export default router;
