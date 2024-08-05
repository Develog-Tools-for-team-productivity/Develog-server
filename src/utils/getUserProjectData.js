import { collectProjectData } from '../utils/dataCollectors.js';
import {
  calculateTimeStats,
  calculateLabelStats,
  calculateContributorStats,
} from '../utils/statsCalculators.js';

export const getUserProjectData = async (
  projects,
  startDate,
  endDate,
  githubToken
) => {
  let pullRequestsData = [];
  let totalCommits = 0;
  let issues = [];

  for (const project of projects) {
    try {
      const projectData = await collectProjectData(
        project,
        startDate,
        endDate,
        githubToken
      );
      pullRequestsData = pullRequestsData.concat(projectData.pullRequests);
      totalCommits += projectData.commits;
      issues = issues.concat(projectData.issues);
    } catch (error) {
      console.error(`프로젝트 ${project.fullName} 데이터 수집 중 오류:`, error);
    }
  }

  const timeStats = calculateTimeStats(pullRequestsData);
  const labelStats = calculateLabelStats(issues);
  const contributorStats = calculateContributorStats(pullRequestsData);

  return {
    pullRequestsData,
    totalCommits,
    timeStats,
    labelStats,
    ...contributorStats,
  };
};
