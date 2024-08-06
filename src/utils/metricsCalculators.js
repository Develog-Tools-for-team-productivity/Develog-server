import PullRequest from '../models/PullRequest.js';
import Project from '../models/Project.js';
import DailyStats from '../models/DailyStats.js';

const calculateAverage = data => {
  const total = data.reduce((sum, value) => sum + value, 0);
  return data.length > 0 ? total / data.length : 0;
};

export async function calculateCycleTime(userId, start, end) {
  const projects = await Project.find({ userId });
  const projectIds = projects.map(project => project._id);
  const repoIdToName = {};
  projects.forEach(project => {
    repoIdToName[project._id.toString()] = project.name || project.fullName;
  });

  let query = {
    repositoryId: { $in: projectIds },
  };

  if (start && end) {
    query.mergedAt = {
      $gte: start,
      $lt: end,
    };
  }

  const pullRequests = await PullRequest.find(query);
  const cycleTimeByRepo = {};

  pullRequests.forEach(pr => {
    if (pr.firstCommitAt && pr.mergedAt) {
      const cycleTime = new Date(pr.mergedAt) - new Date(pr.firstCommitAt);
      const mergeDate = pr.mergedAt.toISOString().split('T')[0];
      const repoId = pr.repositoryId.toString();

      if (!cycleTimeByRepo[repoId]) {
        cycleTimeByRepo[repoId] = {};
      }
      if (!cycleTimeByRepo[repoId][mergeDate]) {
        cycleTimeByRepo[repoId][mergeDate] = [];
      }
      cycleTimeByRepo[repoId][mergeDate].push(cycleTime);
    }
  });

  const cycleTimeData = {};
  const averageCycleTimes = {};

  for (const repoId in cycleTimeByRepo) {
    const labels = [];
    const data = [];

    Object.keys(cycleTimeByRepo[repoId])
      .sort()
      .forEach(date => {
        const totalCycleTime = cycleTimeByRepo[repoId][date].reduce(
          (a, b) => a + b,
          0
        );
        const avgCycleTime =
          totalCycleTime / cycleTimeByRepo[repoId][date].length;
        labels.push(date);
        data.push(avgCycleTime / (1000 * 60 * 60));
      });

    averageCycleTimes[repoId] = calculateAverage(data);

    cycleTimeData[repoId] = {
      labels,
      datasets: [
        {
          label: `${repoIdToName[repoId]}의 개발 주기 시간`,
          data: data,
        },
      ],
    };
  }

  const allLabels = new Set();
  Object.values(cycleTimeData).forEach(repoData => {
    repoData.labels.forEach(label => allLabels.add(label));
  });

  const sortedLabels = Array.from(allLabels).sort();
  const averageData = sortedLabels.map(label => {
    let sum = 0;
    let count = 0;
    Object.values(cycleTimeData).forEach(repoData => {
      const index = repoData.labels.indexOf(label);
      if (index !== -1) {
        sum += repoData.datasets[0].data[index];
        count++;
      }
    });
    return count > 0 ? sum / count : 0;
  });

  averageCycleTimes['average'] = calculateAverage(averageData);

  cycleTimeData['average'] = {
    labels: sortedLabels,
    datasets: [
      {
        label: '평균 개발 주기 시간',
        data: averageData,
      },
    ],
  };

  return { data: cycleTimeData, average: averageCycleTimes };
}

const getAllDatesBetween = (start, end) => {
  const dates = [];
  let currentDate = new Date(start);
  while (currentDate <= end) {
    dates.push(new Date(currentDate).toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return dates;
};

export async function calculateDeployFrequency(userId, start, end) {
  const projects = await Project.find({ userId });
  const deployFrequencyByRepo = {};

  projects.forEach(project => {
    if (project.dailyDeployments) {
      project.dailyDeployments.forEach(deployment => {
        const date = deployment.date.toISOString().split('T')[0];
        if (new Date(date) >= start && new Date(date) <= end) {
          if (!deployFrequencyByRepo[project._id]) {
            deployFrequencyByRepo[project._id] = {};
          }
          if (!deployFrequencyByRepo[project._id][date]) {
            deployFrequencyByRepo[project._id][date] = 0;
          }
          deployFrequencyByRepo[project._id][date] += deployment.count;
        }
      });
    }
  });
  const repoIdToName = {};
  projects.forEach(project => {
    repoIdToName[project._id.toString()] = project.name || project.fullName;
  });

  const deployFrequencyData = {};
  const allDates = getAllDatesBetween(start, end);
  const totalDays = allDates.length;

  for (const repoId in deployFrequencyByRepo) {
    const labels = [];
    const data = [];

    allDates.forEach(date => {
      const deployCount = deployFrequencyByRepo[repoId][date] || 0;
      labels.push(date);
      data.push(deployCount);
    });

    deployFrequencyData[repoId] = {
      labels,
      datasets: [
        {
          label: `${repoIdToName[repoId]}의 배포빈도`,
          data: data,
        },
      ],
    };
  }

  const allLabels = new Set();
  Object.values(deployFrequencyData).forEach(repoData => {
    repoData.labels.forEach(label => allLabels.add(label));
  });

  const sortedLabels = Array.from(allLabels).sort();
  const averageData = sortedLabels.map(label => {
    let sum = 0;
    let count = 0;
    Object.values(deployFrequencyData).forEach(repoData => {
      const index = repoData.labels.indexOf(label);
      if (index !== -1) {
        sum += repoData.datasets[0].data[index];
        count++;
      }
    });
    return count > 0 ? sum / count : 0;
  });

  const averageDeployFrequencies = { average: calculateAverage(averageData) };

  deployFrequencyData['average'] = {
    labels: sortedLabels,
    datasets: [
      {
        label: '평균 배포 빈도',
        data: averageData,
      },
    ],
  };

  return {
    data: deployFrequencyData,
    average: averageDeployFrequencies,
    totalDays,
  };
}

export async function calculateMTTR(userId, start, end) {
  const projects = await Project.find({ userId });
  const projectIds = projects.map(project => project._id);
  const repoIdToName = {};
  projects.forEach(project => {
    repoIdToName[project._id.toString()] = project.name || project.fullName;
  });

  let query = {
    repositoryId: { $in: projectIds },
    date: {
      $gte: start,
      $lt: end,
    },
  };

  const dailyStats = await DailyStats.find(query);
  const mttrByRepo = {};

  dailyStats.forEach(stat => {
    if (stat.bugFixTime > 0) {
      const date = stat.date.toISOString().split('T')[0];
      const repoId = stat.repositoryId.toString();

      if (!mttrByRepo[repoId]) {
        mttrByRepo[repoId] = {};
      }
      if (!mttrByRepo[repoId][date]) {
        mttrByRepo[repoId][date] = [];
      }
      mttrByRepo[repoId][date].push(stat.bugFixTime);
    }
  });

  const mttrData = {};
  const averageMTTRs = {};

  for (const repoId in mttrByRepo) {
    const labels = [];
    const data = [];

    Object.keys(mttrByRepo[repoId])
      .sort()
      .forEach(date => {
        const totalMTTR = mttrByRepo[repoId][date].reduce((a, b) => a + b, 0);
        const avgMTTR = totalMTTR / mttrByRepo[repoId][date].length;
        labels.push(date);
        data.push(avgMTTR);
      });

    averageMTTRs[repoId] = calculateAverage(data);

    mttrData[repoId] = {
      labels,
      datasets: [
        {
          label: `${repoIdToName[repoId]}의 복구 시간`,
          data: data,
        },
      ],
    };
  }

  const allLabels = new Set();
  Object.values(mttrData).forEach(repoData => {
    repoData.labels.forEach(label => allLabels.add(label));
  });

  const sortedLabels = Array.from(allLabels).sort();
  const averageData = sortedLabels.map(label => {
    let sum = 0;
    let count = 0;
    Object.values(mttrData).forEach(repoData => {
      const index = repoData.labels.indexOf(label);
      if (index !== -1) {
        sum += repoData.datasets[0].data[index];
        count++;
      }
    });
    return count > 0 ? sum / count : 0;
  });

  averageMTTRs['average'] = calculateAverage(averageData);

  mttrData['average'] = {
    labels: sortedLabels,
    datasets: [
      {
        label: '평균 복구 시간',
        data: averageData,
      },
    ],
  };

  return { data: mttrData, average: averageMTTRs };
}

export async function calculateCFR(userId, start, end) {
  const projects = await Project.find({ userId });
  const projectIds = projects.map(project => project._id);
  const repoIdToName = {};
  projects.forEach(project => {
    repoIdToName[project._id.toString()] = project.name || project.fullName;
  });

  let query = {
    repositoryId: { $in: projectIds },
    date: {
      $gte: start,
      $lt: end,
    },
  };

  const dailyStats = await DailyStats.find(query);
  const cfrByRepo = {};

  projects.forEach(project => {
    const projectId = project._id.toString();
    cfrByRepo[projectId] = {};
  });

  dailyStats.forEach(stat => {
    const date = stat.date.toISOString().split('T')[0];
    const repoId = stat.repositoryId.toString();

    if (!cfrByRepo[repoId][date]) {
      cfrByRepo[repoId][date] = { deployments: 0, failures: 0 };
    }

    cfrByRepo[repoId][date].deployments += 1;
    if (stat.bugFixTime > 0) {
      cfrByRepo[repoId][date].failures += 1;
    }
  });

  const cfrData = {};
  const averageCFRs = {};
  const cumulativeDeployments = {};
  const cumulativeFailures = {};

  for (const repoId in cfrByRepo) {
    const labels = [];
    const data = [];
    cumulativeDeployments[repoId] = 0;
    cumulativeFailures[repoId] = 0;

    Object.keys(cfrByRepo[repoId])
      .sort()
      .forEach(date => {
        const { deployments, failures } = cfrByRepo[repoId][date];
        cumulativeDeployments[repoId] += deployments;
        cumulativeFailures[repoId] += failures;
        const cfr =
          cumulativeDeployments[repoId] > 0
            ? (cumulativeFailures[repoId] / cumulativeDeployments[repoId]) * 100
            : 0;
        labels.push(date);
        data.push(cfr);
      });

    averageCFRs[repoId] = calculateAverage(data);

    cfrData[repoId] = {
      labels,
      datasets: [
        {
          label: `${repoIdToName[repoId]}의 변경 실패율`,
          data: data,
        },
      ],
    };
  }

  const allLabels = new Set();
  Object.values(cfrData).forEach(repoData => {
    repoData.labels.forEach(label => allLabels.add(label));
  });

  const sortedLabels = Array.from(allLabels).sort();
  const averageData = sortedLabels.map(label => {
    let sum = 0;
    let count = 0;
    Object.values(cfrData).forEach(repoData => {
      const index = repoData.labels.indexOf(label);
      if (index !== -1) {
        sum += repoData.datasets[0].data[index];
        count++;
      }
    });
    return count > 0 ? sum / count : 0;
  });

  averageCFRs['average'] = calculateAverage(averageData);

  cfrData['average'] = {
    labels: sortedLabels,
    datasets: [
      {
        label: '평균 변경 실패율',
        data: averageData,
      },
    ],
  };

  return { data: cfrData, average: averageCFRs };
}
