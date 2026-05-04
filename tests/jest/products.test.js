const request = require('supertest');
const app = require('../../src/index');

describe('GET /api/products', () => {
  it('retourne la liste des produits', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('chaque produit a les champs requis', async () => {
    const res = await request(app).get('/api/products');
    for (const p of res.body) {
      expect(p).toHaveProperty('id');
      expect(p).toHaveProperty('name');
      expect(p).toHaveProperty('price');
      expect(p).toHaveProperty('stock');
    }
  });
});

describe('GET /api/products/:id', () => {
  it('retourne un produit existant', async () => {
    const res = await request(app).get('/api/products/1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(1);
  });

  it('retourne 404 pour un produit inexistant', async () => {
    const res = await request(app).get('/api/products/999');
    expect(res.status).toBe(404);
  });
});

describe('POST /api/products', () => {
  it('crée un produit valide', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ name: 'Test', price: 9.99 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Test');
  });

  it('retourne 400 si name manquant', async () => {
    const res = await request(app)
      .post('/api/products')
      .send({ price: 9.99 });
    expect(res.status).toBe(400);
  });
});
