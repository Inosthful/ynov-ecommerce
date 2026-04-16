const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/index');

describe('GET /api/orders', () => {
  it('retourne la liste des commandes', async () => {
    const res = await request(app).get('/api/orders');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
  });
});

describe('POST /api/orders', () => {
  it('crée une commande valide', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ userId: 1, productIds: [1, 2] });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, 'pending');
  });

  it('retourne 400 si productIds manquant', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ userId: 1 });
    assert.equal(res.status, 400);
  });
});

describe('PATCH /api/orders/:id/status', () => {
  it('met à jour le statut', async () => {
    const res = await request(app)
      .patch('/api/orders/1/status')
      .send({ status: 'delivered' });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'delivered');
  });

  it('retourne 400 pour un statut invalide', async () => {
    const res = await request(app)
      .patch('/api/orders/1/status')
      .send({ status: 'invalid' });
    assert.equal(res.status, 400);
  });
});
