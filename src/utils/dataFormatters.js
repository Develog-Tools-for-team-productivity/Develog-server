export const formatStats = projectData => {
  const { totalCommits = 0 } = projectData;
  const {
    totalCodingTime = 0,
    totalPickUpTime = 0,
    totalReviewTime = 0,
    totalDeployTime = 0,
    totalPRCount = 0,
  } = projectData.timeStats || {};
  const { uniqueLabelsCount = 0 } = projectData.labelStats;
  const { contributorsCount = 0 } = projectData;

  const cycleTime = calculateAverageTime(
    totalCodingTime + totalPickUpTime + totalReviewTime + totalDeployTime,
    totalPRCount
  );

  return [
    {
      icon: 'gitCommit',
      value: totalCommits,
      label: 'Git Commit',
    },
    {
      icon: 'cycleTime',
      value: cycleTime,
      label: '작업 주기 시간',
    },
    {
      icon: 'gitContributors',
      value: contributorsCount,
      label: '프로젝트 참여자',
    },
    {
      icon: 'investmentProfile',
      value: uniqueLabelsCount,
      label: '프로젝트 주요 작업',
    },
  ];
};

export const formatExtendedStats = projectData => {
  const timeStats = projectData.timeStats || {};
  const labelStats = projectData.labelStats || {};

  const {
    totalPRCount = 0,
    totalCodingTime = 0,
    totalPickUpTime = 0,
    totalReviewTime = 0,
    totalDeployTime = 0,
  } = timeStats;

  const { allLabelCounts = {} } = labelStats;

  const cycleTimeItems = [
    {
      value: calculateAverageTime(totalCodingTime, totalPRCount),
      label: 'Coding',
    },
    {
      value: calculateAverageTime(totalPickUpTime, totalPRCount),
      label: 'PR 대기 시간',
    },
    {
      value: calculateAverageTime(totalReviewTime, totalPRCount),
      label: '코드 리뷰',
    },
    {
      value: calculateAverageTime(totalDeployTime, totalPRCount),
      label: '배포',
    },
  ];

  const sortedLabels = Object.entries(allLabelCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => ({ value: count, label: name }));

  const othersCount = Math.max(Object.keys(allLabelCounts).length - 3, 0);

  return {
    cycleTime: {
      items: cycleTimeItems,
    },
    investmentProfile: {
      items: [...sortedLabels, { value: othersCount, label: 'Others' }],
    },
  };
};

export const formatCycleTimeListData = pullRequests => {
  return pullRequests.map(pr => ({
    pullRequest: pr.title,
    author: pr.author ? pr.author.username : 'N/A',
    repositories: pr.repositoryName,
    cycleTime: calculateTimeString(pr.mergedAt, pr.firstCommitAt),
    codingTime: calculateTimeString(pr.prSubmittedAt, pr.firstCommitAt),
    pickUp: calculateTimeString(pr.firstReviewAt, pr.prSubmittedAt),
    review: calculateTimeString(pr.allApprovedAt, pr.firstReviewAt),
    deploy: calculateTimeString(pr.mergedAt, pr.allApprovedAt),
    commits: pr.commitCount || 'N/A',
    prSize: pr.additions + pr.deletions * 0.5,
  }));
};

const calculateAverageTime = (totalTime, count) => {
  if (count === 0) return '0 min';
  const averageTime = totalTime / count;
  return formatTime(averageTime);
};

const calculateTimeString = (endDate, startDate) => {
  if (!endDate || !startDate) return 'N/A';
  const timeDiff = new Date(endDate) - new Date(startDate);
  return formatTime(timeDiff);
};

const formatTime = timeInMs => {
  const days = Math.floor(timeInMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor(
    (timeInMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
  );
  const minutes = Math.floor((timeInMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours} hour`;
  return `${minutes} min`;
};
