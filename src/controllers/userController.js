import axios from 'axios';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import User from '../models/User.js';
import Project from '../models/Project.js';

import { encryptToken, decryptToken } from '../utils/ encryption.js';
import {
  getRepositoryInfo,
  updateRepositoryInfo,
  updateProjects,
} from './repositoryController.js';
import { processPullRequests } from './pullRequestController.js';
import { processSprints } from './sprintController.js';
import { processDailyStats } from './dailyStatsController.js';
import { processIssues } from './issueController.js';

export const registerUser = async (req, res) => {
  const { email, password, teamName, githubToken, selectedRepositories } =
    req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const encryptedGithubToken = encryptToken(githubToken);
    const newUser = new User({
      email,
      password: hashedPassword,
      teamName,
      githubToken: encryptedGithubToken,
      selectedRepositories,
    });

    const savedUser = await newUser.save();

    const projects = await Promise.all(
      selectedRepositories.map(async repo => {
        try {
          const repoInfo = await getRepositoryInfo(repo.full_name, githubToken);
          const newProject = new Project({
            name: repoInfo.name,
            startDate: repoInfo.startDate,
            endDate: repoInfo.endDate,
            totalCommits: repoInfo.totalCommits,
            dailyDeployments: repoInfo.dailyDeployments,
            userId: savedUser._id,
          });
          return await newProject.save();
        } catch (error) {
          console.error('프로젝트 저장 중 오류가 발생했습니다:', error);
          return null;
        }
      })
    );

    for (const repo of selectedRepositories) {
      try {
        await processPullRequests(repo.full_name, githubToken);
        const [owner, repoName] = repo.full_name.split('/');
        await processSprints(owner, repoName, githubToken);
        await processDailyStats(owner, repoName, githubToken);
        await processIssues(owner, repoName, githubToken);
      } catch (error) {
        console.error(`${repo.full_name}의 데이터 처리 중 오류 발생:`, error);
      }
    }

    const validProjects = projects.filter(project => project !== null);
    res.status(201).json({ user: savedUser, projects: validProjects });
  } catch (err) {
    console.error('사용자 등록 중 오류가 발생했습니다:', err);
    res.status(500).json({ message: '사용자 등록 중 오류가 발생했습니다.' });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res
        .status(400)
        .json({ message: '유효하지 않은 이메일 또는 비밀번호입니다.' });
    }

    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      console.error('환경 변수에 JWT_SECRET이 정의되지 않았습니다');
      return res.status(500).json({ message: '서버 구성 오류' });
    }

    const token = jwt.sign({ userId: user._id }, secretKey, {
      expiresIn: '1h',
    });

    updateUserDataAsync(user._id);

    res.json({ token, message: '로그인에 성공했습니다.' });
  } catch (err) {
    console.error('로그인 중 오류가 발생했습니다:', err);
    res.status(500).json({ message: err.message });
  }
};

export const fetchRepositories = async (req, res) => {
  const { githubToken } = req.body;

  try {
    const response = await axios.get('https://api.github.com/user/repos', {
      headers: { Authorization: `token ${githubToken}` },
    });

    res.status(200).json(response.data);
  } catch (error) {
    console.error('레포지토리 가져오는 중 오류가 발생했습니다:', error);
    res.status(500).json({ message: error.message });
  }
};

const updateUserDataAsync = async userId => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.error('사용자를 찾을 수 없습니다.');
      return;
    }

    const githubToken = decryptToken(user.githubToken);
    if (!githubToken) {
      console.error('GitHub 토큰 복호화 실패');
      return;
    }

    const updatedRepositories = await updateRepositoryInfo(
      user.selectedRepositories,
      githubToken
    );
    user.selectedRepositories = updatedRepositories;
    await user.save();

    await updateProjects(user._id, updatedRepositories, githubToken);
  } catch (err) {
    console.error('데이터 업데이트 중 오류가 발생했습니다:', err);
  }
};
