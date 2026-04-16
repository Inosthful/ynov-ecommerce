const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/index');

describe('GET /api/products', () => {
  it('retourne la liste des produits', async () => {
    const res = await request(app).get('/api/products');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.ok(res.body.length > 0);
  });

  it('chaque produit a les champs requis', async () => {
    const res = await request(app).get('/api/products');
    for (const p of res.body) {
      assert.ok('id' in p);
      assert.ok('name' in p);
      assert.ok('price' in p);
      assert.ok('stock' in p);
    }
  });
});

describe('GET /api/products/:id', () => {
  it('retourne un produit existant', async () => {
    const res = await request(app).get('/api/products/1');
    assert.equal(res.status, 200);
    assert.equal(res.body.id, 1);
  });

  it('retourne 404 pour un produit inexistant', async () => {
    const res = await request(app).get('/api/products/999');
    assert.equal(res.status, 404);
  });
});

describe('POST /api/products', () => {
  it('crée un produit valide', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ name: 'Test', price: 9.99 });
    assert.equal(res.status, 201);
    assert.equal(res.body.name, 'Test');
  });

  it('retourne 400 si name manquant', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ price: 9.99 });
    assert.equal(res.status, 400);
  });
});
