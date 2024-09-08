import crypto from 'crypto';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Project from '../models/Project.js';
import { processProject } from './projectController.js';
import { processPullRequests } from './pullRequestController.js';
import { processSprints } from './sprintController.js';
import { processDailyStats } from './dailyStatsController.js';
import { processIssues } from './issueController.js';
import { fetchGithubData, fetchPagedGithubData } from '../utils/api.js';
import { getDateRange } from '../utils/getDataRange.js';
import { getUserProjectData } from '../utils/getUserProjectData.js';
import {
  formatStats,
  formatExtendedStats,
  formatCycleTimeListData,
} from '../utils/dataFormatters.js';

export const fetchRepositories = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const repositories = await fetchPagedGithubData(
      'user/repos',
      user.githubToken
    );
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
    const existingRepositories = user.selectedRepositories.map(repo => repo.id);
    const newRepositories = selectedRepositories.filter(
      repo => !existingRepositories.includes(repo.id)
    );

    user.selectedRepositories = [
      ...user.selectedRepositories,
      ...newRepositories,
    ];
    await user.save();

    const results = await Promise.all(
      newRepositories.map(async repo => {
        try {
          const [owner, repoName] = repo.name.split('/');
          const webhookUrl = `${process.env.SERVER_URL}/api/webhook`;
          const webhookSecret = process.env.WEBHOOK_SECRET;
          const existingWebhooks = await getExistingWebhooks(
            owner,
            repoName,
            user.githubToken
          );
          const existingWebhook = existingWebhooks.find(
            hook => hook.config.url === webhookUrl
          );

          await processProject(user, repo);
          await processPullRequests(user, owner, repoName);
          await processSprints(user, owner, repoName);
          await processDailyStats(user, owner, repoName);
          await processIssues(user, owner, repoName);

          if (!existingWebhook) {
            await createWebhook(
              owner,
              repoName,
              user.githubToken,
              webhookUrl,
              webhookSecret
            );
          }

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
  const scopes = [
    'read:org',
    'repo',
    'user:email',
    'read:project',
    'admin:org_hook',
  ];
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
    const emailsData = await fetchGithubData('user/emails', accessToken);
    const primaryEmail =
      emailsData.find(email => email.primary)?.email || emailsData[0]?.email;

    let user = await User.findOne({ githubId: userData.id });
    if (!user) {
      user = new User({
        githubId: userData.id,
        userImg: userData.avatar_url,
        teamName: userData.name || userData.login,
        githubToken: accessToken,
        selectedRepositories: [],
        email: primaryEmail,
      });
    } else {
      user.githubToken = accessToken;
      user.email = primaryEmail;
    }
    await user.save();

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
    const { userId } = req.user;
    const { startDate, endDate } = getDateRange(req.query);

    const [projects, userInfo] = await Promise.all([
      Project.find({ userId }),
      User.findById(userId),
    ]);

    const projectData = await getUserProjectData(
      projects,
      startDate,
      endDate,
      userInfo.githubToken
    );

    res.json({
      stats: formatStats(projectData),
      extendedStats: formatExtendedStats(projectData),
      cycleTimeListData: formatCycleTimeListData(projectData.pullRequestsData),
      selectedRepositories: userInfo.selectedRepositories,
      userInfo: userInfo,
    });
  } catch (error) {
    console.error('회원 정보 불러오기 실패:', error);
    res.status(500).json({
      message: '회원 정보를 불러오는 데 실패했습니다.',
    });
  }
};

export const validateToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res
        .status(401)
        .json({ isValid: false, message: '토큰이 없습니다' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res
        .status(401)
        .json({ isValid: false, message: '사용자를 찾지 못했습니다' });
    }

    res.json({ isValid: true });
  } catch (error) {
    console.error('토큰이 유효하지 않습니다:', error);
    res.status(401).json({ isValid: false, message: '유효하지않은 토큰' });
  }
};

async function getExistingWebhooks(owner, repo, accessToken) {
  const url = `https://api.github.com/repos/${owner}/${repo}/hooks`;
  try {
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    return response.data;
  } catch (error) {
    console.error('웹훅 목록 가져오기 오류:', error.response.data);
    throw error;
  }
}

async function createWebhook(owner, repo, accessToken, webhookUrl, secret) {
  const url = `https://api.github.com/repos/${owner}/${repo}/hooks`;
  const data = {
    name: 'web',
    active: true,
    events: ['push', 'pull_request'],
    config: {
      url: webhookUrl,
      content_type: 'json',
      secret: secret,
    },
  };

  try {
    const response = await axios.post(url, data, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    console.log('웹훅 생성 응답:', response.data);
    return response.data;
  } catch (error) {
    console.error('웹훅 생성 중 오류:', error.response.data);
    throw error;
  }
}

export const handleWebhook = async (req, res) => {
  console.log('Headers:', req.headers);

  const signature = req.headers['x-hub-signature-256'];
  const event = req.headers['x-github-event'];
  const payload = req.body;
  const secret = process.env.WEBHOOK_SECRET;

  console.log('WEBHOOK_SECRET:', secret);

  if (!event || !secret) {
    console.error('필수 웹훅 정보가 누락되었습니다');
    return res.status(400).send('잘못된 요청: 필요한 정보가 누락되었습니다.');
  }

  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');
  const signatureBuffer = Buffer.from(signature || '', 'utf8');
  const digestBuffer = Buffer.from(digest, 'utf8');

  if (
    signatureBuffer.length !== digestBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, digestBuffer)
  ) {
    console.error('웹훅 요청이 유효하지 않습니다 (시그니처 불일치)');
    return res.status(401).send('Unauthorized');
  }

  console.log('웹훅 연결 완료:', event);

  try {
    switch (event) {
      case 'push':
        console.log('Push 이벤트 수신:', payload.repository.name);
        await handlePushEvent(payload);
        break;
      case 'pull_request':
        console.log('Pull Request 이벤트 수신:', payload.repository.name);
        break;
      default:
        console.log(`처리되지 않은 이벤트: ${event}`);
    }

    console.log('웹훅 과정 완료');
    res.status(200).send('OK');
  } catch (error) {
    console.error('웹훅 처리 중 오류:', error);
    res.status(500).send('Internal Server Error');
  }
};

async function handlePushEvent(payload) {
  const repoName = payload.repository.full_name;
  const branch = payload.ref.split('/').pop();
  const commits = payload.commits;

  console.log(`Repository: ${repoName}`);
  console.log(`Branch: ${branch}`);
  console.log(`Number of commits: ${commits.length}`);
}
