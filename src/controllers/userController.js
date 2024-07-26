import axios from 'axios';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Project from '../models/Project.js';
import PullRequest from '../models/PullRequest.js';
import { processProject } from './projectController.js';
import { processPullRequests } from './pullRequestController.js';
import { processSprints } from './sprintController.js';
import { processDailyStats } from './dailyStatsController.js';
import { processIssues } from './issueController.js';
import { fetchGithubData, fetchPagedGithubData } from '../utils/api.js';

export const fetchRepositories = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const githubToken = user.githubToken;

    const repositories = await fetchPagedGithubData('user/repos', githubToken);

    const formattedRepositories = repositories.map(repo => ({
      id: repo.id,
      name: repo.full_name,
    }));

    res.json(formattedRepositories);
  } catch (error) {
    console.error('레포지토리 가져오기 오류:', error);
    res.status(500).json({
      message: '레포지토리를 가져오는 데 실패했습니다.',
      error: error.message,
    });
  }
};

export const saveRepositoriesInfo = async (req, res) => {
  try {
    const { selectedRepositories } = req.body;
    const user = await User.findById(req.user.userId);

    const results = await Promise.all(
      selectedRepositories.map(async repo => {
        try {
          const [owner, repoName] = repo.name.split('/');

          await processProject(user, repo);
          await processPullRequests(user, owner, repoName);
          await processSprints(user, owner, repoName);
          await processDailyStats(user, owner, repoName);
          await processIssues(user, owner, repoName);

          return { name: repo.name, status: 'success' };
        } catch (error) {
          console.error(`데이터 처리 중 오류 발생:`, error);
          return { name: repo.name, status: 'error', message: error.message };
        }
      })
    );

    res.json({
      message: '레포지토리 정보 저장 완료',
      results: results,
    });
  } catch (error) {
    console.error('프로젝트 저장 중 오류가 발생했습니다:', error);
    res.status(500).json({
      message: '레포지토리 정보 저장 중 오류가 발생했습니다.',
      error: error.message,
    });
  }
};

export const githubAuth = (req, res) => {
  const scopes = ['read:org', 'repo', 'user:email', 'read:project'];
  const scopeString = scopes.join(' ');

  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.GITHUB_REDIRECT_URI}&scope=${encodeURIComponent(scopeString)}`;

  res.redirect(githubAuthUrl);
};

export const githubCallback = async (req, res) => {
  const { code } = req.query;
  try {
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: { Accept: 'application/json' },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    const userData = await fetchGithubData('user', accessToken);

    let user = await User.findOne({ githubId: userData.id });
    if (!user) {
      user = new User({
        githubId: userData.id,
        teamName: userData.name || userData.login,
        githubToken: accessToken,
        selectedRepositories: [],
      });
      await user.save();
    } else {
      user.githubToken = accessToken;
      await user.save();
    }

    const secretKey = process.env.JWT_SECRET;
    if (!secretKey) {
      console.error('환경 변수에 JWT_SECRET이 정의되지 않았습니다');
      return res.status(500).json({ message: '서버 구성 오류' });
    }

    const token = jwt.sign({ userId: user._id }, secretKey, {
      expiresIn: '1h',
    });

    res.redirect(`${process.env.CLIENT_URL}/login?token=${token}`);
  } catch (error) {
    console.error('GitHub OAuth 에러:', error);
    if (error.name === 'ValidationError') {
      console.error('Validation error details:', error.errors);
    }
    res.redirect(
      `${process.env.CLIENT_URL}/login?error=github_oauth_failed&message=${encodeURIComponent(error.message)}`
    );
  }
};

export const getUserData = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const projects = await Project.find({ userId });
    const totalCommits = projects.reduce(
      (sum, project) => sum + (project.totalCommits || 0),
      0
    );

    let contributorsSet = new Set();

    for (const project of projects) {
      try {
        const pullRequests = await PullRequest.find({
          repositoryId: project._id,
        });

        for (const pr of pullRequests) {
          if (pr.author && pr.author[0] && pr.author[0].username) {
            contributorsSet.add(pr.author[0].username);
          }
          if (pr.reviews) {
            for (const review of pr.reviews) {
              if (review.reviewer) {
                contributorsSet.add(review.reviewer);
              }
            }
          }
        }
      } catch (err) {
        console.error(
          `Error fetching pull requests for project ${project.name}:`,
          err
        );
      }
    }

    const stats = [
      {
        icon: 'gitCommit',
        value: totalCommits,
        label: 'Git Commit',
      },
      {
        icon: 'cycleTime',
        value: '12d 1h',
        label: 'Cycle Time',
      },
      {
        icon: 'gitContributors',
        value: contributorsSet.size,
        label: 'Git Contributors',
      },
      {
        icon: 'investmentProfile',
        value: 4,
        label: 'Investment Profile',
      },
    ];

    const extendedStats = {
      cycleTime: {
        items: [
          { value: '16 hour', label: 'Coding' },
          { value: '2 days', label: 'PickUp' },
          { value: '7 hour', label: 'Review' },
          { value: '90 min', label: 'Deploy' },
        ],
      },
      investmentProfile: {
        items: [
          { value: 18, label: 'Functional Stories' },
          { value: 32, label: 'Non-Functional Stories' },
          { value: 50, label: 'Bugs' },
          { value: 12, label: 'Others' },
        ],
      },
    };

    res.json({ stats, extendedStats });
  } catch (error) {
    console.error('User data fetching error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
