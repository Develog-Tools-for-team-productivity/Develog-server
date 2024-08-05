export const calculateTimeStats = pullRequests => {
  let totalCodingTime = 0;
  let totalPickUpTime = 0;
  let totalReviewTime = 0;
  let totalDeployTime = 0;
  let totalPRCount = pullRequests.length;

  for (const pr of pullRequests) {
    if (pr.mergedAt && pr.firstCommitAt) {
      totalCodingTime += new Date(pr.mergedAt) - new Date(pr.firstCommitAt);
    }
    if (pr.firstCommitAt && pr.firstReviewAt) {
      totalPickUpTime +=
        new Date(pr.firstReviewAt) - new Date(pr.firstCommitAt);
    }
    if (pr.firstReviewAt && pr.allApprovedAt) {
      totalReviewTime +=
        new Date(pr.allApprovedAt) - new Date(pr.firstReviewAt);
    }
    if (pr.allApprovedAt && pr.mergedAt) {
      totalDeployTime += new Date(pr.mergedAt) - new Date(pr.allApprovedAt);
    }
  }

  return {
    totalCodingTime,
    totalPickUpTime,
    totalReviewTime,
    totalDeployTime,
    totalPRCount,
  };
};

export const calculateLabelStats = issues => {
  const allUniqueLabels = new Set();
  const allLabelCounts = {};

  for (const issue of issues) {
    if (issue.labels && issue.labels.length > 0) {
      issue.labels.forEach(label => {
        allUniqueLabels.add(label);
        allLabelCounts[label] = (allLabelCounts[label] || 0) + 1;
      });
    }
  }

  return {
    uniqueLabelsCount: allUniqueLabels.size,
    allLabelCounts,
    allUniqueLabels,
  };
};

export const calculateContributorStats = pullRequests => {
  const contributorsSet = new Set();

  for (const pr of pullRequests) {
    if (pr.author && pr.author.username) {
      contributorsSet.add(pr.author.username);
    }
    if (pr.reviews) {
      for (const review of pr.reviews) {
        if (review.reviewer) {
          contributorsSet.add(review.reviewer);
        }
      }
    }
  }

  return { contributorsCount: contributorsSet.size };
};
