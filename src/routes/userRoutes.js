import express from 'express';
import {
  registerUser,
  loginUser,
  fetchRepositories,
} from '../controllers/userController.js';
import { getRepositoryInfo } from '../controllers/repositoryController.js';

const router = express.Router();

router.post('/registerUser', registerUser);
router.post('/login', loginUser);
router.post('/fetch-repositories', fetchRepositories);
router.post('/getRepositoryInfo', getRepositoryInfo);

export default router;
