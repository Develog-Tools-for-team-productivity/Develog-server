import axios from 'axios';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Issue from '../models/Issue.js';
import Project from '../models/Project.js';
import PullRequest from '../models/PullRequest.js';
import { processProject } from './projectController.js';
import { processPullRequests } from './pullRequestController.js';
import { processSprints } from './sprintController.js';
import { processDailyStats } from './dailyStatsController.js';
import { processIssues } from './issueController.js';
import { fetchGithubData, fetchPagedGithubData } from '../utils/api.js';
import { getDailyCommits } from '../utils/getDailyCommits.js';

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
    const emailsData = await fetchGithubData('user/emails', accessToken);
    const primaryEmail =
      emailsData.find(email => email.primary)?.email || emailsData[0]?.email;

    let user = await User.findOne({ githubId: userData.id });

    if (!user) {
      user = new User({
        githubId: userData.id,
        teamName: userData.name || userData.login,
        githubToken: accessToken,
        selectedRepositories: [],
        email: primaryEmail,
      });
      await user.save();
    } else {
      user.githubToken = accessToken;
      user.email = primaryEmail;
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
    const user = req.user;
    const userId = user.userId;
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 10);
    const { startDate: queryStartDate, endDate: queryEndDate } = req.query;
    const actualStartDate = queryStartDate
      ? new Date(queryStartDate)
      : startDate;
    const actualEndDate = queryEndDate ? new Date(queryEndDate) : endDate;
    const projects = await Project.find({ userId });
    const userInfo = await User.findById(userId);
    let pullRequestsData = [];

    let totalCommits = 0;
    let contributorsSet = new Set();
    let allUniqueLabels = new Set();
    let allLabelCounts = {};
    let totalCodingTime = 0;
    let totalPickUpTime = 0;
    let totalPRCount = 0;
    let totalReviewTime = 0;
    let totalDeployTime = 0;

    for (const project of projects) {
      try {
        const pullRequests = await PullRequest.find({
          repositoryId: project._id,
          createdAt: { $gte: actualStartDate, $lte: actualEndDate },
        });

        pullRequestsData = pullRequestsData.concat(pullRequests);

        for (const pr of pullRequests) {
          totalPRCount++;
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

          if (pr.mergedAt && pr.firstCommitAt) {
            const mergedTime = new Date(pr.mergedAt);
            const firstCommitTime = new Date(pr.firstCommitAt);
            totalCodingTime += mergedTime - firstCommitTime;
          }

          if (pr.firstCommitAt && pr.firstReviewAt) {
            const firstCommitAt = new Date(pr.firstCommitAt);
            const firstReviewAt = new Date(pr.firstReviewAt);
            totalPickUpTime += firstReviewAt - firstCommitAt;
          }

          if (pr.firstReviewAt && pr.allApprovedAt) {
            const firstReviewAt = new Date(pr.firstReviewAt);
            const allApprovedAt = new Date(pr.allApprovedAt);
            totalReviewTime += allApprovedAt - firstReviewAt;
          }

          if (pr.allApprovedAt && pr.mergedAt) {
            const allApprovedAt = new Date(pr.allApprovedAt);
            const mergedAt = new Date(pr.mergedAt);
            totalDeployTime += mergedAt - allApprovedAt;
          }
        }

        const [owner, repo] = project.fullName.split('/');

        try {
          const commits = await getDailyCommits(
            owner,
            repo,
            userInfo.githubToken,
            actualStartDate,
            actualEndDate
          );
          totalCommits += commits;
        } catch (error) {
          console.error(
            `Failed to get commits for ${owner}/${repo}:`,
            error.message
          );
        }

        const issues = await Issue.find({
          repositoryId: project._id,
          createdAt: { $gte: actualStartDate, $lte: actualEndDate },
        });

        for (const issue of issues) {
          if (issue.labels && issue.labels.length > 0) {
            issue.labels.forEach(label => {
              allUniqueLabels.add(label);
              allLabelCounts[label] = (allLabelCounts[label] || 0) + 1;
            });
          }
        }
      } catch (err) {
        console.error('라벨을 찾을 수 없습니다.');
      }
    }

    const getAverageTime = (totalTime, totalPRCount) => {
      const averageTime = totalPRCount > 0 ? totalTime / totalPRCount : 0;
      const days = Math.floor(averageTime / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (averageTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      );
      const minutes = Math.floor(
        (averageTime % (1000 * 60 * 60)) / (1000 * 60)
      );

      if (days > 0) {
        return `${days}d ${hours}h`;
      } else if (hours > 0) {
        return `${hours} hour`;
      } else {
        return `${minutes} min`;
      }
    };

    const uniqueLabelsCount = allUniqueLabels.size;
    const sortedLabels = Object.entries(allLabelCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name, count]) => ({ value: count, label: name }));
    const othersCount = Math.max(Object.keys(allLabelCounts).length - 3, 0);
    const contributors = contributorsSet.size;
    const codingTime = getAverageTime(totalCodingTime, totalPRCount);
    const pickUpTime = getAverageTime(totalPickUpTime, totalPRCount);
    const reviewTime = getAverageTime(totalReviewTime, totalPRCount);
    const deployTime = getAverageTime(totalDeployTime, totalPRCount);
    const totalCycleTime =
      totalCodingTime + totalPickUpTime + totalReviewTime + totalDeployTime;
    const cycleTime = getAverageTime(totalCycleTime, totalPRCount);

    const stats = [
      {
        icon: 'gitCommit',
        value: totalCommits,
        label: 'Git Commit',
      },
      {
        icon: 'cycleTime',
        value: cycleTime,
        label: 'Cycle Time',
      },
      {
        icon: 'gitContributors',
        value: contributors,
        label: 'Git Contributors',
      },
      {
        icon: 'investmentProfile',
        value: uniqueLabelsCount,
        label: 'Investment Profile',
      },
    ];

    const extendedStats = {
      cycleTime: {
        items: [
          { value: codingTime, label: 'Coding' },
          { value: pickUpTime, label: 'PickUp' },
          { value: reviewTime, label: 'Review' },
          { value: deployTime, label: 'Deploy' },
        ],
      },
      investmentProfile: {
        items: [...sortedLabels, { value: othersCount, label: 'Others' }],
      },
    };

    const cycleTimeListData = pullRequestsData.map(pr => {
      const getTimeString = timeInMs => {
        const hours = timeInMs / (1000 * 60 * 60);
        if (hours < 1) {
          const minutes = timeInMs / (1000 * 60);
          return `${Math.round(minutes)} min`;
        } else if (hours < 24) {
          return `${Math.round(hours)} hours`;
        } else {
          const days = timeInMs / (1000 * 60 * 60 * 24);
          return `${Math.round(days)} days`;
        }
      };

      return {
        pullRequest: pr.title,
        author: pr.author ? pr.author[0].username : 'N/A',
        repositories: pr.repositoryName,
        cycleTime:
          pr.mergedAt && pr.firstCommitAt
            ? getTimeString(new Date(pr.mergedAt) - new Date(pr.firstCommitAt))
            : 'N/A',
        codingTime:
          pr.firstCommitAt && pr.prSubmittedAt
            ? getTimeString(
                new Date(pr.prSubmittedAt) - new Date(pr.firstCommitAt)
              )
            : 'N/A',
        pickUp:
          pr.prSubmittedAt && pr.firstReviewAt
            ? getTimeString(
                new Date(pr.firstReviewAt) - new Date(pr.prSubmittedAt)
              )
            : 'N/A',
        review:
          pr.firstReviewAt && pr.allApprovedAt
            ? getTimeString(
                new Date(pr.allApprovedAt) - new Date(pr.firstReviewAt)
              )
            : 'N/A',
        deploy:
          pr.allApprovedAt && pr.mergedAt
            ? getTimeString(new Date(pr.mergedAt) - new Date(pr.allApprovedAt))
            : 'N/A',
        commits: pr.commitCount ? pr.commitCount : 'N/A',
        prSize: (pr.additions + pr.deletions) / 0.5,
      };
    });

    res.json({
      stats,
      extendedStats,
      cycleTimeListData,
      selectedRepositories: userInfo.selectedRepositories,
    });
  } catch (error) {
    console.error('회원 정보 불러오기에 실패하였습니다.:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
