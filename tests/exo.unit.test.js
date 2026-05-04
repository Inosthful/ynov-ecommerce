const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { priceWithTax, saveOrder, convertPrice, db } = require('../exo');

// ── priceWithTax ─────────────────────────────────────────────
describe('[UNITAIRE] priceWithTax', () => {

  it('applique la TVA française (20%)', () => {
    assert.equal(priceWithTax(100, 'FR'), '120.00');
  });

  it('applique la TVA allemande (19%)', () => {
    assert.equal(priceWithTax(100, 'DE'), '119.00');
  });

  it('applique la TVA britannique (20%)', () => {
    assert.equal(priceWithTax(100, 'GB'), '120.00');
  });

  it('applique 0% de TVA aux USA', () => {
    assert.equal(priceWithTax(100, 'US'), '100.00');
  });

  it('utilise 20% par défaut pour un pays inconnu (opérateur ??)', () => {
    assert.equal(priceWithTax(100, 'JP'), '120.00');
    assert.equal(priceWithTax(100, 'XX'), '120.00');
  });

  it('retourne un string avec exactement 2 décimales (.toFixed)', () => {
    const result = priceWithTax(9.99, 'FR');
    assert.equal(typeof result, 'string');
    assert.equal(result, '11.99');
  });

  it('gère un prix à 0', () => {
    assert.equal(priceWithTax(0, 'FR'), '0.00');
  });

});


// ── saveOrder (db mocké) ──────────────────────────────────────
describe('[UNITAIRE] saveOrder', () => {

  beforeEach(() => {
    db.products.findById = async () => null;
    db.orders.create    = async () => null;
  });

  it('lance une erreur si le produit est introuvable', async () => {
    await assert.rejects(
      () => saveOrder({ productId: 99, userId: 1 }),
      { message: 'Product not found' }
    );
  });

  it('injecte le prix du produit dans la commande créée', async () => {
    db.products.findById = async () => ({ id: 1, name: 'Chaise', price: 49.99 });

    let capturedOrder = null;
    db.orders.create = async (order) => {
      capturedOrder = order;
      return order;
    };

    await saveOrder({ productId: 1, userId: 2 });
    assert.equal(capturedOrder.price, 49.99);
  });

  it('retourne la commande sauvegardée', async () => {
    db.products.findById = async () => ({ id: 1, price: 29.99 });
    db.orders.create = async (order) => ({ id: 42, ...order });

    const result = await saveOrder({ productId: 1, userId: 3 });
    assert.equal(result.id, 42);
    assert.equal(result.price, 29.99);
  });

});


// ── convertPrice (fetch mocké) ────────────────────────────────
describe('[UNITAIRE] convertPrice', () => {

  const originalFetch = global.fetch;
  beforeEach(() => { global.fetch = originalFetch; });

  it('convertit correctement avec un taux donné', async () => {
    global.fetch = async () => ({ json: async () => ({ result: 1.1 }) });
    assert.equal(await convertPrice(100, 'EUR', 'USD'), 110);
  });

  it('retourne le même prix si le taux est 1', async () => {
    global.fetch = async () => ({ json: async () => ({ result: 1 }) });
    assert.equal(await convertPrice(50, 'EUR', 'EUR'), 50);
  });

  it('arrondit correctement à 2 décimales', async () => {
    global.fetch = async () => ({ json: async () => ({ result: 0.3333 }) });
    assert.equal(await convertPrice(10, 'USD', 'EUR'), 3.33);
  });

  it('appelle fetch avec la bonne URL', async () => {
    let calledUrl = '';
    global.fetch = async (url) => {
      calledUrl = url;
      return { json: async () => ({ result: 0.85 }) };
    };

    await convertPrice(100, 'USD', 'EUR');
    assert.ok(calledUrl.includes('from=USD'));
    assert.ok(calledUrl.includes('to=EUR'));
  });

  it('retourne un number (pas un string)', async () => {
    global.fetch = async () => ({ json: async () => ({ result: 1.2 }) });
    assert.equal(typeof await convertPrice(10, 'EUR', 'USD'), 'number');
  });

});
