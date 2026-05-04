const request = require('supertest');

// jest.mock() remplace le module AVANT que l'app ne le charge
// C'est plus propre que la mutation manuelle qu'on faisait avec node:test
jest.mock('../../src/services/emailService', () => ({
  sendOrderConfirmation: jest.fn(),
  sendStatusUpdate: jest.fn(),
}));

const emailService = require('../../src/services/emailService');
const app = require('../../src/index');

describe('GET /api/orders', () => {
  it('retourne la liste des commandes', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('POST /api/orders', () => {
  beforeEach(() => jest.clearAllMocks());

  it('crée une commande valide', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ userId: 1, productIds: [1, 2] });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('pending');
  });

  it('envoie un email de confirmation après création', async () => {
    await request(app)
      .post('/api/orders')
      .send({ userId: 1, productIds: [1] });

    expect(emailService.sendOrderConfirmation).toHaveBeenCalledTimes(1);
    expect(emailService.sendOrderConfirmation).toHaveBeenCalledWith(
      'alice@example.com',
      expect.objectContaining({ status: 'pending' })
    );
  });

  it("n'envoie pas d'email si l'utilisateur n'existe pas", async () => {
    await request(app)
      .post('/api/orders')
      .send({ userId: 999, productIds: [1] });

    expect(emailService.sendOrderConfirmation).not.toHaveBeenCalled();
  });

  it('retourne 400 si productIds manquant', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ userId: 1 });
    expect(res.status).toBe(400);
    expect(emailService.sendOrderConfirmation).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/orders/:id/status', () => {
  beforeEach(() => jest.clearAllMocks());

  it('met à jour le statut', async () => {
    const res = await request(app)
      .patch('/api/orders/1/status')
      .send({ status: 'delivered' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('delivered');
  });

  it('envoie un email de mise à jour de statut', async () => {
    await request(app)
      .patch('/api/orders/1/status')
      .send({ status: 'shipped' });

    expect(emailService.sendStatusUpdate).toHaveBeenCalledTimes(1);
    expect(emailService.sendStatusUpdate).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ status: 'shipped' })
    );
  });

  it('retourne 400 pour un statut invalide', async () => {
    const res = await request(app)
      .patch('/api/orders/1/status')
      .send({ status: 'invalid' });
    expect(res.status).toBe(400);
    expect(emailService.sendStatusUpdate).not.toHaveBeenCalled();
  });

  it('retourne 404 pour une commande inexistante', async () => {
    const res = await request(app)
      .patch('/api/orders/999/status')
      .send({ status: 'shipped' });
    expect(res.status).toBe(404);
    expect(emailService.sendStatusUpdate).not.toHaveBeenCalled();
  });
});
