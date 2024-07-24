import axios from 'axios';
import DailyStats from '../models/DailyStats.js';

export const processDailyStats = async (owner, repo, githubToken) => {
  try {
    const repoResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: { Authorization: `token ${githubToken}` },
      }
    );
    const repositoryId = repoResponse.data.id.toString();
    const firstCommitDate = new Date(repoResponse.data.created_at);
    const commitsResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100&page=1`,
      {
        headers: { Authorization: `token ${githubToken}` },
      }
    );
    const lastCommitDate = new Date(commitsResponse.data[0].commit.author.date);

    if (!firstCommitDate) {
      throw new Error('레포지토리에 커밋이 없습니다');
    }

    let currentDate = new Date(firstCommitDate);
    currentDate.setUTCHours(0, 0, 0, 0);

    while (currentDate <= lastCommitDate) {
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const dailyStats = {
        repositoryId,
        date: new Date(currentDate),
        totalCommits: 0,
        bugFixTime: 0,
        pullRequests: [],
      };

      const commitsResponse = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/commits`,
        {
          params: {
            sha: 'main',
            since: currentDate.toISOString(),
            until: nextDate.toISOString(),
          },
          headers: { Authorization: `token ${githubToken}` },
        }
      );
      dailyStats.totalCommits = commitsResponse.data.length;

      const bugsResponse = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/issues`,
        {
          params: {
            state: 'closed',
            labels: 'bug',
            since: currentDate.toISOString(),
            until: nextDate.toISOString(),
          },
          headers: { Authorization: `token ${githubToken}` },
        }
      );

      let totalBugFixTime = 0;
      let bugCount = 0;
      for (const bug of bugsResponse.data) {
        const createdAt = new Date(bug.created_at);
        const closedAt = new Date(bug.closed_at);
        if (closedAt >= currentDate && closedAt < nextDate) {
          const fixTime = (closedAt - createdAt) / (1000 * 60);
          totalBugFixTime += fixTime;
          bugCount++;
        }
      }
      dailyStats.bugFixTime = bugCount > 0 ? totalBugFixTime / bugCount : 0;

      await DailyStats.findOneAndUpdate(
        { repositoryId: dailyStats.repositoryId, date: dailyStats.date },
        dailyStats,
        { upsert: true, new: true }
      );
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } catch (error) {
    console.error('일일 통계 처리 중 오류 발생:', error);
  }
};
