export const handleApiError = error => {
  if (error.response) {
    if (error.response.status === 401) {
      console.error('GitHub 토큰이 유효하지 않습니다.');
    } else if (error.response.status === 404) {
      console.error('레포지토리를 찾을 수 없습니다.');
    } else if (error.response.status === 403) {
      console.error(
        'GitHub API 레이트 리밋에 도달했습니다. 잠시 후 다시 시도하세요.'
      );
    } else {
      console.error(
        'GitHub API 요청 중 오류 발생:',
        error.response.status,
        error.response.data
      );
    }
  } else if (error.request) {
    console.error('GitHub API에 연결할 수 없습니다.');
  } else {
    console.error('오류 발생:', error.message);
  }
  throw error;
};
