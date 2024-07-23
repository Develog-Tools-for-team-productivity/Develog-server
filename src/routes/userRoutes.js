import express from 'express';
import {
  registerUser,
  loginUser,
  fetchRepositories,
  getRepositoryInfo,
} from '../controllers/userController.js';

const router = express.Router();

router.post('/registerUser', registerUser);
router.post('/login', loginUser);
router.post('/fetch-repositories', fetchRepositories);
router.post('/getRepositoryInfo', getRepositoryInfo);

export default router;
