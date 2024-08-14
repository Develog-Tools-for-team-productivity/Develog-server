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

  let totalCount = 0;

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
    totalCount++;
  });

  investmentProfile.items = investmentProfile.items.map(item => ({
    ...item,
    percentage: Math.round((item.value / totalCount) * 100),
  }));

  investmentProfile.totalCount = totalCount;

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
      ratio: Math.round((count / totalIssues) * 100),
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
        new Date(issue.closedAt) >= new Date(sprint.startDate) &&
        new Date(issue.closedAt) <= new Date(sprint.endDate)
    );

    const uniqueAuthors = getUniqueAuthors(sprintIssues);

    return {
      sprintName: sprint.name,
      activeIssuePeople: uniqueAuthors.size,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    };
  });
};

const getProjectDeliveryMetrics = (sprints, issues) => {
  if (sprints.length === 0) return null;

  return sprints.map(sprint => {
    const sprintStartDate = new Date(sprint.startDate);
    const sprintEndDate = new Date(sprint.endDate);

    const addedIssues = issues.filter(issue => {
      const issueCreatedAt = new Date(issue.createdAt);
      return (
        issueCreatedAt >= sprintStartDate && issueCreatedAt <= sprintEndDate
      );
    });

    const sprintIssues = issues.filter(issue =>
      sprint.issues.some(sprintIssue => sprintIssue.title === issue.title)
    );

    const completedIssues = sprintIssues.filter(issue => {
      const issueClosedAt = new Date(issue.closedAt);
      return issueClosedAt >= sprintStartDate && issueClosedAt <= sprintEndDate;
    });

    const carryoverIssues = sprintIssues.filter(issue => {
      return !issue.closedAt || new Date(issue.closedAt) > sprintEndDate;
    });

    return {
      sprintName: sprint.name,
      added: addedIssues.length,
      complete: completedIssues.length,
      carryover: carryoverIssues.length,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    };
  });
};

const formatProjectDeliveryMetrics = metricsArray => {
  if (!metricsArray) return null;

  const total = metricsArray.reduce(
    (acc, sprint) => {
      acc.added += sprint.added;
      acc.complete += sprint.complete;
      acc.carryover += sprint.carryover;
      return acc;
    },
    { added: 0, complete: 0, carryover: 0 }
  );

  const formattedTotal = [
    { label: 'Added', value: total.added },
    { label: 'Complete', value: total.complete },
    { label: 'Carryover', value: total.carryover },
  ];

  const sprints = metricsArray.reduce((acc, sprint) => {
    acc[sprint.sprintName] = [
      { label: 'Added', value: sprint.added },
      { label: 'Complete', value: sprint.complete },
      { label: 'Carryover', value: sprint.carryover },
    ];
    return acc;
  }, {});

  return {
    total: formattedTotal,
    sprints: sprints,
  };
};

const getPlanningAccuracy = formattedMetrics => {
  if (!formattedMetrics) return null;

  const calculateAccuracy = (complete, total) => {
    if (total === 0) return 0;
    return Math.round((complete / total) * 100);
  };

  let totalComplete = 0;
  let totalCarryover = 0;

  const sprintAccuracies = Object.entries(formattedMetrics.sprints).map(
    ([sprintName, metrics]) => {
      const complete = metrics.find(m => m.label === 'Complete').value;
      const carryover = metrics.find(m => m.label === 'Carryover').value;
      const total = complete + carryover;
      const value = calculateAccuracy(complete, total);

      totalComplete += complete;
      totalCarryover += carryover;

      return { sprintName, value };
    }
  );

  const totalValue = calculateAccuracy(
    totalComplete,
    totalComplete + totalCarryover
  );

  return {
    sprints: sprintAccuracies,
    total: totalValue,
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
  const rawProjectDeliveryMetrics = hasNoSprints
    ? null
    : getProjectDeliveryMetrics(sortedSprints, projectIssues);
  const projectDeliveryMetrics = hasNoSprints
    ? null
    : formatProjectDeliveryMetrics(rawProjectDeliveryMetrics);
  const planningAccuracy = hasNoSprints
    ? null
    : getPlanningAccuracy(projectDeliveryMetrics);

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
    projectDeliveryMetrics,
    planningAccuracy,
    summaryData: {
      activePeople: teamSize,
      investmentProfile: investmentProfile.items,
      totalInvestmentCount: investmentProfile.totalCount,
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
