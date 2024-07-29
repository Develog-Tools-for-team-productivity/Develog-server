import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from 'vitest';
import supertest from 'supertest';
import app from '../src/server.js';
import connectDB from '../src/config/db.js';
import mongoose from 'mongoose';
import User from '../src/models/User.js';

vi.mock('node-fetch', () => {
  return {
    default: vi.fn(),
  };
});

const request = supertest(app);

describe('User API', () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await User.deleteMany({});
    vi.resetAllMocks();
  });

  it('should login a user', async () => {
    await request.post('/api/registerUser').send({
      password: 'password123',
      teamName: 'Test Team',
      githubToken: 'testtoken',
      selectedRepositories: ['repo1', 'repo2'],
    });

    const res = await request.post('/api/login').send({
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
  });

  it('should fetch repositories', async () => {
    const mockRepositories = [
      { id: 1, name: 'repo1' },
      { id: 2, name: 'repo2' },
    ];

    const mockResponse = {
      ok: true,
      json: async () => mockRepositories,
    };

    const fetchMock = await import('node-fetch');
    fetchMock.default.mockResolvedValue(mockResponse);

    const res = await request.post('/api/fetch-repositories').send({
      githubToken: 'fake_token',
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toEqual(mockRepositories);

    expect(fetchMock.default).toHaveBeenCalledWith(
      'https://api.github.com/user/repos',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'token fake_token',
        }),
      })
    );
  });
});
