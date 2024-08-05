export const getDateRange = query => {
  const { startDate: queryStartDate, endDate: queryEndDate } = query;
  const endDate = queryEndDate ? new Date(queryEndDate) : new Date();
  const startDate = queryStartDate
    ? new Date(queryStartDate)
    : new Date(endDate.getTime() - 10 * 24 * 60 * 60 * 1000);

  if (startDate > endDate) {
    throw new Error('시작 날짜는 종료 날짜보다 늦을 수 없습니다.');
  }

  return { startDate, endDate };
};
