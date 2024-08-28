import express from 'express';
import {
  saveRepositoriesInfo,
  githubAuth,
  githubCallback,
  fetchRepositories,
  getUserData,
  handleWebhook,
} from '../controllers/userController.js';
import { getProjects } from '../controllers/projectDeliveryController.js';
import { getDoraMetrics } from '../controllers/metricsController.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateToken } from '../controllers/userController.js';

const router = express.Router();

router.post('/saveRepositoriesInfo', authenticateToken, saveRepositoriesInfo);
router.get('/user-data', authenticateToken, getUserData);
router.get('/fetch-repositories', authenticateToken, fetchRepositories);
router.get('/auth/github', githubAuth);
router.get('/auth/github/callback', githubCallback);
router.get('/dora-metrics', authenticateToken, getDoraMetrics);
router.get('/projects', authenticateToken, getProjects);
router.get('/validate-token', validateToken);
router.post('/api/webhook', handleWebhook);

export default router;
