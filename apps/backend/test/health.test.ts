import request from 'supertest';
import app from '../src/index';

describe('GET /health', () => {
  it('returns shared health payload', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'backend-ok' });
  });
});
