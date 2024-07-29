import axios from 'axios';
import DailyStats from '../models/DailyStats.js';
import Project from '../models/Project.js';
import { handleApiError } from '../utils/handleApiError.js';
import { getDailyCommits } from '../utils/getDailyCommits.js';

const githubApi = axios.create({
  baseURL: 'https://api.github.com',
});

const getRepoInfo = async (owner, repo, token) => {
  try {
    const response = await githubApi.get(`/repos/${owner}/${repo}`, {
      headers: { Authorization: `token ${token}` },
    });
    return {
      id: response.data.id.toString(),
      fullName: response.data.full_name,
      createdAt: new Date(response.data.created_at),
    };
  } catch (error) {
    handleApiError(error);
  }
};

const getLastCommitDate = async (owner, repo, token) => {
  try {
    const response = await githubApi.get(`/repos/${owner}/${repo}/commits`, {
      params: { per_page: 1 },
      headers: { Authorization: `token ${token}` },
    });
    if (response.data.length === 0) {
      throw new Error('레포지토리에 커밋이 없습니다');
    }
    return new Date(response.data[0].commit.author.date);
  } catch (error) {
    handleApiError(error);
  }
};

const getDailyBugFixTime = async (owner, repo, token, since, until) => {
  try {
    const response = await githubApi.get(`/repos/${owner}/${repo}/issues`, {
      params: {
        state: 'closed',
        labels: 'bug',
        since: since.toISOString(),
        until: until.toISOString(),
      },
      headers: { Authorization: `token ${token}` },
    });

    let totalBugFixTime = 0;
    let bugCount = 0;
    for (const bug of response.data) {
      const createdAt = new Date(bug.created_at);
      const closedAt = new Date(bug.closed_at);
      if (closedAt >= since && closedAt < until) {
        const fixTime = (closedAt - createdAt) / (1000 * 60);
        totalBugFixTime += fixTime;
        bugCount++;
      }
    }
    return bugCount > 0 ? totalBugFixTime / bugCount : 0;
  } catch (error) {
    handleApiError(error);
  }
};

const getProjectIdByRepoId = async fullName => {
  const project = await Project.findOne({ fullName: fullName });
  return project ? project._id : null;
};

const saveDailyStats = async stats => {
  try {
    await DailyStats.findOneAndUpdate(
      { repositoryId: stats.repositoryId, date: stats.date },
      stats,
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error('데이터베이스 저장 중 오류 발생:', error);
    throw error;
  }
};

export const processDailyStats = async (user, owner, repo) => {
  const githubToken = user.githubToken;

  if (!githubToken) {
    throw new Error('GitHub 토큰이 없습니다.');
  }

  try {
    const repoInfo = await getRepoInfo(owner, repo, githubToken);

    const lastCommitDate = await getLastCommitDate(owner, repo, githubToken);
    const projectId = await getProjectIdByRepoId(repoInfo.fullName);

    let currentDate = new Date(repoInfo.createdAt);
    currentDate.setUTCHours(0, 0, 0, 0);

    while (currentDate <= lastCommitDate) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const dailyStats = {
        repositoryId: projectId,
        date: new Date(currentDate),
        totalCommits: await getDailyCommits(
          owner,
          repo,
          githubToken,
          currentDate,
          nextDate
        ),
        bugFixTime: await getDailyBugFixTime(
          owner,
          repo,
          githubToken,
          currentDate,
          nextDate
        ),
        pullRequests: [],
      };

      await saveDailyStats(dailyStats);

      currentDate.setDate(currentDate.getDate() + 1);
    }
  } catch (error) {
    console.error('일일 통계 처리 중 오류 발생:', error);
    throw error;
  }
};
