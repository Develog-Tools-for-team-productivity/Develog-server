import axios from 'axios';
import Project from '../models/Project.js';

export const getRepositoryInfo = async (repoFullName, githubToken) => {
  try {
    const [owner, repo] = repoFullName.split('/');

    const repoResponse = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: { Authorization: `token ${githubToken}` },
      }
    );
    const name = repoResponse.data.name;
    const startDate = new Date(repoResponse.data.created_at);
    let endDate = startDate;
    let totalCommits = 0;
    let commitPage = 1;
    let hasNextCommitPage = true;
    while (hasNextCommitPage) {
      const commitsResponse = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/commits?per_page=100&page=${commitPage}`,
        {
          headers: { Authorization: `token ${githubToken}` },
        }
      );
      totalCommits += commitsResponse.data.length;
      hasNextCommitPage = commitsResponse.data.length === 100;
      commitPage++;
    }

    let dailyDeployments = {};
    let page = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      const prResponse = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&base=main&per_page=100&page=${page}`,
        {
          headers: { Authorization: `token ${githubToken}` },
        }
      );

      for (const pr of prResponse.data) {
        if (pr.merged_at) {
          const mergeDate = new Date(pr.merged_at);
          const branchName = pr.head.ref;

          const compareResponse = await axios.get(
            `https://api.github.com/repos/${owner}/${repo}/compare/${pr.base.sha}...${pr.head.sha}`,
            {
              headers: { Authorization: `token ${githubToken}` },
            }
          );

          const branchCommits = compareResponse.data.total_commits;

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

      hasNextPage = prResponse.data.length === 100;
      page++;
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
