import { fetchGithubData, fetchPagedGithubData } from '../utils/api.js';
import Project from '../models/Project.js';

export const getRepositoryInfo = async (repoFullName, githubToken) => {
  try {
    const [owner, repo] = repoFullName.split('/');

    const repoData = await fetchGithubData(
      `/repos/${owner}/${repo}`,
      githubToken
    );
    const name = repoData.name;
    const startDate = new Date(repoData.created_at);
    let endDate = startDate;
    let totalCommits = 0;

    const commitsData = await fetchPagedGithubData(
      `/repos/${owner}/${repo}/commits`,
      githubToken,
      { per_page: 100 }
    );
    totalCommits = commitsData.length;

    let dailyDeployments = {};
    const pullRequests = await fetchPagedGithubData(
      `/repos/${owner}/${repo}/pulls`,
      githubToken,
      {
        state: 'closed',
        base: 'main',
        per_page: 100,
      }
    );

    for (const pr of pullRequests) {
      if (pr.merged_at) {
        const mergeDate = new Date(pr.merged_at);
        const branchName = pr.head.ref;

        const compareData = await fetchGithubData(
          `/repos/${owner}/${repo}/compare/${pr.base.sha}...${pr.head.sha}`,
          githubToken
        );
        const branchCommits = compareData.total_commits;

        const dateKey = mergeDate.toISOString().split('T')[0];
        if (!dailyDeployments[dateKey]) {
          dailyDeployments[dateKey] = {
            date: mergeDate,
            count: 0,
            branchNames: new Set(),
          };
        }
        dailyDeployments[dateKey].count += branchCommits;
        dailyDeployments[dateKey].branchNames.add(branchName);

        if (mergeDate > endDate) {
          endDate = mergeDate;
        }
      }
    }

    dailyDeployments = Object.values(dailyDeployments).map(deploy => ({
      date: deploy.date,
      count: deploy.count,
      branchName: Array.from(deploy.branchNames).join(', '),
    }));

    return { name, startDate, endDate, totalCommits, dailyDeployments };
  } catch (error) {
    console.error(
      '레포지토리 정보 가져오기 오류:',
      error.response ? error.response.data : error.message
    );
    throw error;
  }
};

export const updateRepositoryInfo = async (repositories, githubToken) => {
  return await Promise.all(
    repositories.map(async repo => {
      try {
        return await getRepositoryInfo(repo.full_name, githubToken);
      } catch (error) {
        console.error(
          `리포지토리 ${repo.full_name}을(를) 업데이트하는 동안 오류가 발생했습니다:`,
          error
        );
        return repo;
      }
    })
  );
};

export const updateProjects = async (userId, repositories, githubToken) => {
  for (const repo of repositories) {
    if (!repo || !repo.full_name) {
      console.error('잘못된 리포지토리 개체:', repo);
      continue;
    }
    try {
      const repoInfo = await getRepositoryInfo(repo.full_name, githubToken);
      await Project.findOneAndUpdate(
        { userId: userId, name: repoInfo.name },
        {
          startDate: repoInfo.startDate,
          endDate: repoInfo.endDate,
          totalCommits: repoInfo.totalCommits,
          dailyDeployments: repoInfo.dailyDeployments,
        },
        { upsert: true, new: true }
      );
    } catch (error) {
      console.error(
        `${repo.full_name}에 대한 프로젝트 업데이트 오류 발생:`,
        error
      );
    }
  }
};
