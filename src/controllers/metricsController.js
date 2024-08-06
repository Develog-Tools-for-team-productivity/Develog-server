import {
  calculateCycleTime,
  calculateDeployFrequency,
  calculateMTTR,
  calculateCFR,
} from '../utils/metricsCalculators.js';
import Project from '../models/Project.js';
import User from '../models/User.js';

export const getDoraMetrics = async (req, res) => {
  try {
    const userId = req.user.userId;
    const userInfo = await User.findById(userId);
    const { startDate, endDate } = req.query;

    const start = new Date(startDate + 'T00:00:00Z');
    const end = new Date(endDate + 'T23:59:59.999Z');

    const [cycleTimeData, deployFrequencyData, mttrData, cfrData] =
      await Promise.all([
        calculateCycleTime(userId, start, end),
        calculateDeployFrequency(userId, start, end),
        calculateMTTR(userId, start, end),
        calculateCFR(userId, start, end),
      ]);

    const selectedRepositories = await Promise.all(
      userInfo.selectedRepositories.map(async repo => {
        const project = await Project.findOne({
          userId,
          fullName: repo.name,
        });
        return {
          id: project ? project._id : null,
          name: repo.name,
        };
      })
    );

    res.json({
      cycleTimeData,
      deployFrequencyData,
      mttrData,
      cfrData,
      selectedRepositories,
    });
  } catch (error) {
    console.error('DORA Metrics 계산 중 에러가 생겼습니다:', error);
    res.status(500).json({ message: '서버 에러가 생겼습니다' });
  }
};
