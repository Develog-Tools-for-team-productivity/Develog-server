import Project from '../models/Project.js';
import Sprint from '../models/Sprint.js';
import Issue from '../models/Issue.js';
import PullRequest from '../models/PullRequest.js';

const countLabels = issues => {
  const labelCounts = {};
  issues.forEach(issue => {
    issue.labels.forEach(label => {
      labelCounts[label] = (labelCounts[label] || 0) + 1;
    });
  });
  return labelCounts;
};

const getTopLabels = (labelCounts, topCount = 3) => {
  return Object.entries(labelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topCount)
    .map(([label, value]) => ({ label, value }));
};

const getUniqueAuthors = items => {
  return new Set(
    items
      .filter(item => item.author && item.author.login)
      .map(item => item.author.login)
  );
};

const getIterationLabelRatios = issues => {
  const iterations = issues.reduce((acc, issue) => {
    const iteration = issue.iteration;
    if (!acc[iteration]) acc[iteration] = [];
    acc[iteration].push(issue);
    return acc;
  }, {});

  return Object.entries(iterations).map(([iteration, iterationIssues]) => {
    const labelCounts = countLabels(iterationIssues);
    const totalIssues = iterationIssues.length;
    const labelRatios = Object.entries(labelCounts).map(([label, count]) => ({
      label,
      ratio: ((count / totalIssues) * 100).toFixed(2),
    }));

    return { iteration, labelRatios };
  });
};

const getInvestmentProfile = issues => {
  const labelCounts = countLabels(issues);
  const topLabels = getTopLabels(labelCounts);

  const investmentProfile = {
    items: topLabels.map(({ label }) => ({ label, value: 0 })),
  };
  investmentProfile.items.push({ label: 'Others', value: 0 });

  issues.forEach(issue => {
    let categorized = false;
    issue.labels.forEach(label => {
      const item = investmentProfile.items.find(item => item.label === label);
      if (item) {
        item.value++;
        categorized = true;
      }
    });
    if (!categorized) {
      investmentProfile.items.find(item => item.label === 'Others').value++;
    }
  });

  return investmentProfile;
};

const getMostActive = pullRequests => {
  const authorActivities = {};

  pullRequests.forEach(pr => {
    const { author, additions, deletions } = pr;
    const activity = additions + deletions * 0.5;

    if (authorActivities[author.username]) {
      authorActivities[author.username].active += activity;
    } else {
      authorActivities[author.username] = {
        name: author.username,
        active: activity,
        profileImageUrl: author.profileImageUrl || '',
      };
    }
  });

  const mostActive = Object.values(authorActivities)
    .sort((a, b) => b.active - a.active)
    .slice(0, 2)
    .map(author => ({
      ...author,
      active: Math.round(author.active),
    }));

  return mostActive;
};

const getSprintInvestmentProfile = (sprints, projectIssues) => {
  return sprints.map(sprint => {
    const sprintIssues = projectIssues.filter(
      issue =>
        issue.iteration === sprint.sprintName &&
        new Date(issue.closedAt) >= new Date(sprint.startDate) &&
        new Date(issue.closedAt) <= new Date(sprint.endDate)
    );

    const labelCounts = countLabels(sprintIssues);
    const totalIssues = sprintIssues.length;
    const labelRatios = Object.entries(labelCounts).map(([label, count]) => ({
      label,
      ratio: ((count / totalIssues) * 100).toFixed(2),
    }));

    const topLabels = labelRatios.sort((a, b) => b.ratio - a.ratio).slice(0, 3);

    const othersRatio = labelRatios
      .slice(3)
      .reduce((sum, item) => sum + parseFloat(item.ratio), 0)
      .toFixed(2);

    if (othersRatio > 0) {
      topLabels.push({ label: 'Others', ratio: othersRatio });
    }

    return {
      sprintName: sprint.sprintName,
      investmentProfile: topLabels,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    };
  });
};

const getSprintActivity = (sprints, issues) => {
  return sprints.map(sprint => {
    const sprintIssues = issues.filter(
      issue =>
        new Date(issue.createdAt) >= new Date(sprint.startDate) &&
        new Date(issue.createdAt) <= new Date(sprint.endDate)
    );

    return {
      sprintName: sprint.name,
      activePeople: getUniqueAuthors(sprintIssues).size,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    };
  });
};

const getProjectDeliveryMetrics = (sprints, issues) => {
  if (sprints.length === 0) return null;

  return sprints.map(sprint => {
    const sprintIssues = issues.filter(
      issue => issue.iteration === sprint.sprintName
    );
    const completedIssues = sprintIssues.filter(
      issue =>
        issue.closedAt && new Date(issue.closedAt) <= new Date(sprint.endDate)
    );
    const carryoverIssues = sprintIssues.filter(
      issue =>
        (!issue.closedAt ||
          new Date(issue.closedAt) > new Date(sprint.endDate)) &&
        issue.projectStatus === 'OPEN'
    );

    return {
      sprintName: sprint.sprintName,
      added: sprintIssues.length,
      complete: completedIssues.length,
      carryover: carryoverIssues.length,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    };
  });
};

const getPlanningAccuracy = (sprints, issues) => {
  if (sprints.length === 0) return null;

  const firstSprint = sprints[0];
  const preSprintIssues = issues.filter(
    issue => new Date(issue.createdAt) < new Date(firstSprint.startDate)
  );

  const sprintPlanningAccuracy = sprints.map(sprint => {
    const completedIssues = preSprintIssues.filter(
      issue =>
        issue.status === 'CLOSED' &&
        new Date(issue.closedAt) >= new Date(sprint.startDate) &&
        new Date(issue.closedAt) <= new Date(sprint.endDate)
    );

    const accuracy =
      preSprintIssues.length > 0
        ? (completedIssues.length / preSprintIssues.length) * 100
        : 0;

    return {
      sprintName: sprint.sprintName,
      planningAccuracy: accuracy.toFixed(2),
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    };
  });

  const overallAccuracy =
    sprintPlanningAccuracy.reduce(
      (sum, sprint) => sum + parseFloat(sprint.planningAccuracy),
      0
    ) / sprintPlanningAccuracy.length;

  return {
    overall: overallAccuracy.toFixed(2),
    sprints: sprintPlanningAccuracy,
  };
};

const getProjectData = (
  project,
  projectIssues,
  projectSprints,
  projectPullRequests
) => {
  const sortedSprints = projectSprints
    .filter(sprint => sprint && sprint.startDate && sprint.endDate)
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  const hasNoSprints = sortedSprints.length === 0;
  const teamSize = getUniqueAuthors(projectIssues).size;
  const investmentProfile = getInvestmentProfile(projectIssues);
  const planningAccuracy = hasNoSprints
    ? null
    : getPlanningAccuracy(sortedSprints, projectIssues);

  return {
    projectId: project._id,
    projectName: project.name,
    projectNumber: project.length,
    teamSize,
    topContributors: getTopLabels(countLabels(projectIssues), 2),
    mostActive: getMostActive(projectPullRequests),
    sprintActivity: hasNoSprints
      ? []
      : getSprintActivity(sortedSprints, projectIssues),
    projectDate: hasNoSprints
      ? []
      : sortedSprints.map(({ startDate, endDate }) => ({ startDate, endDate })),
    overallInvestmentProfile: investmentProfile,
    sprintInvestmentProfiles: hasNoSprints
      ? []
      : getSprintInvestmentProfile(sortedSprints, projectIssues),
    projectDeliveryMetrics: hasNoSprints
      ? null
      : getProjectDeliveryMetrics(sortedSprints, projectIssues),
    planningAccuracy,
    summaryData: {
      activePeople: teamSize,
      investmentProfile: investmentProfile.items,
      planningAccuracy: planningAccuracy ? planningAccuracy.overall : 0,
    },
  };
};

export const getProjects = async (req, res) => {
  try {
    const [projects, sprints, issues, pullRequests] = await Promise.all([
      Project.find(),
      Sprint.find(),
      Issue.find(),
      PullRequest.find(),
    ]);

    const totalProjects = projects.length;
    const uniquePeople = getUniqueAuthors(issues);
    const totalPeople = uniquePeople.size;

    const labelCounts = countLabels(issues);
    const top3Labels = getTopLabels(labelCounts);
    const othersCount =
      Object.values(labelCounts).reduce((sum, count) => sum + count, 0) -
      top3Labels.reduce((sum, { value }) => sum + value, 0);

    const summaryData = {
      totalProjects,
      totalPeople,
      labelSummary: [...top3Labels, { label: 'Others', value: othersCount }],
    };

    const projectDeliveryData = projects
      .map(project => {
        const projectIssues = issues.filter(
          issue => issue.projectId.toString() === project._id.toString()
        );
        const projectSprints = sprints.filter(
          sprint => sprint.projectId.toString() === project._id.toString()
        );

        const projectPullRequests = pullRequests.filter(
          pr =>
            pr.repositoryId &&
            pr.repositoryId.toString() === project._id.toString()
        );

        if (projectPullRequests.length === 0) {
          console.warn('No pull requests found for project:', project._id);
        }

        return getProjectData(
          project,
          projectIssues,
          projectSprints,
          projectPullRequests
        );
      })
      .filter(Boolean);

    const iterationLabelRatios = getIterationLabelRatios(issues);

    res.json({ iterationLabelRatios, projectDeliveryData, summaryData });
  } catch (error) {
    console.error(
      '프로젝트 데이터 불러오는 중 에러가 생겼습니다',
      error.message
    );
    res.status(500).json({ message: 'Error fetching project data' });
  }
};
