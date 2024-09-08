import Project from '../models/Project.js';
import { getRepositoryInfo } from '../controllers/repositoryController.js';

export async function processProject(user, repo) {
  try {
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
  } catch (error) {
    console.error(`프로젝트 처리 중 오류 발생: ${error.message}`);
    throw error;
  }
}
