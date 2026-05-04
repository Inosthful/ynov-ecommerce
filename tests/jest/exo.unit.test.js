const { priceWithTax, saveOrder, convertPrice, db } = require('../../exo');

// ── priceWithTax ─────────────────────────────────────────────
describe('priceWithTax', () => {

  it('applique la TVA française (20%)', () => {
    expect(priceWithTax(100, 'FR')).toBe('120.00');
  });

  it('applique la TVA allemande (19%)', () => {
    expect(priceWithTax(100, 'DE')).toBe('119.00');
  });

  it('applique la TVA britannique (20%)', () => {
    expect(priceWithTax(100, 'GB')).toBe('120.00');
  });

  it('applique 0% de TVA aux USA', () => {
    expect(priceWithTax(100, 'US')).toBe('100.00');
  });

  it('utilise 20% par défaut pour un pays inconnu', () => {
    expect(priceWithTax(100, 'JP')).toBe('120.00');
    expect(priceWithTax(100, 'XX')).toBe('120.00');
  });

  it('retourne un string avec exactement 2 décimales', () => {
    expect(typeof priceWithTax(9.99, 'FR')).toBe('string');
    expect(priceWithTax(9.99, 'FR')).toBe('11.99');
  });

  it('gère un prix à 0', () => {
    expect(priceWithTax(0, 'FR')).toBe('0.00');
  });

});


// ── saveOrder (db mocké) ──────────────────────────────────────
describe('saveOrder', () => {

  beforeEach(() => {
    db.products.findById = jest.fn().mockResolvedValue(null);
    db.orders.create    = jest.fn().mockResolvedValue(null);
  });

  it('lance une erreur si le produit est introuvable', async () => {
    await expect(saveOrder({ productId: 99, userId: 1 }))
      .rejects.toThrow('Product not found');
  });

  it('injecte le prix du produit dans la commande créée', async () => {
    db.products.findById.mockResolvedValue({ id: 1, name: 'Chaise', price: 49.99 });
    db.orders.create.mockImplementation(order => Promise.resolve(order));

    await saveOrder({ productId: 1, userId: 2 });

    expect(db.orders.create).toHaveBeenCalledWith(
      expect.objectContaining({ price: 49.99 })
    );
  });

  it('retourne la commande sauvegardée', async () => {
    db.products.findById.mockResolvedValue({ id: 1, price: 29.99 });
    db.orders.create.mockResolvedValue({ id: 42, price: 29.99 });

    const result = await saveOrder({ productId: 1, userId: 3 });
    expect(result.id).toBe(42);
    expect(result.price).toBe(29.99);
  });

});


// ── convertPrice (fetch mocké) ────────────────────────────────
describe('convertPrice', () => {

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('convertit correctement avec un taux donné', async () => {
    global.fetch.mockResolvedValue({ json: async () => ({ result: 1.1 }) });
    expect(await convertPrice(100, 'EUR', 'USD')).toBe(110);
  });

  it('retourne le même prix si le taux est 1', async () => {
    global.fetch.mockResolvedValue({ json: async () => ({ result: 1 }) });
    expect(await convertPrice(50, 'EUR', 'EUR')).toBe(50);
  });

  it('arrondit correctement à 2 décimales', async () => {
    global.fetch.mockResolvedValue({ json: async () => ({ result: 0.3333 }) });
    expect(await convertPrice(10, 'USD', 'EUR')).toBe(3.33);
  });

  it('appelle fetch avec la bonne URL', async () => {
    global.fetch.mockResolvedValue({ json: async () => ({ result: 0.85 }) });
    await convertPrice(100, 'USD', 'EUR');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('from=USD')
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('to=EUR')
    );
  });

  it('retourne un number (pas un string)', async () => {
    global.fetch.mockResolvedValue({ json: async () => ({ result: 1.2 }) });
    expect(typeof await convertPrice(10, 'EUR', 'USD')).toBe('number');
  });

});
