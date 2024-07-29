import Project from '../models/Project.js';
import { getRepositoryInfo } from '../controllers/repositoryController.js';

export async function processProject(user, repo) {
  const repoInfo = await getRepositoryInfo(repo.name, user.githubToken);

  const newProject = new Project({
    name: repoInfo.name,
    fullName: repo.name,
    startDate: repoInfo.startDate,
    endDate: repoInfo.endDate,
    totalCommits: repoInfo.totalCommits,
    dailyDeployments: repoInfo.dailyDeployments,
    userId: user._id,
  });

  return await newProject.save();
}
