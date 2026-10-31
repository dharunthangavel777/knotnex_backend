import request from 'supertest';
import app from '../../src/app';

describe('Campaigns & Donations Integration Tests', () => {
  it('GET /api/v1/campaigns returns active institutional campaigns', async () => {
    const res = await request(app).get('/api/v1/campaigns');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const first = res.body.data[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('title');
    expect(first).toHaveProperty('goalAmount');
  });

  it('POST /api/v1/campaigns/:id/donate records a pledge contribution', async () => {
    const res = await request(app)
      .post('/api/v1/campaigns/camp-1/donate')
      .send({
        amount: 1000,
        donorName: 'Test Supporter',
        message: 'Keep up the impactful work!',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.amount).toBe(1000);
  });
});

