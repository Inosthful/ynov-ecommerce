const { saveOrder, db } = require('../../exo');

const inMemoryDb = {
  _products: [
    { id: 1, name: 'Clavier', price: 79.90 },
    { id: 2, name: 'Souris',  price: 29.90 },
  ],
  _orders: [],
  products: {
    findById: async (id) =>
      inMemoryDb._products.find(p => p.id === id) || null,
  },
  orders: {
    create: async (order) => {
      const saved = { id: inMemoryDb._orders.length + 1, ...order };
      inMemoryDb._orders.push(saved);
      return saved;
    },
  },
};

describe('[INTÉGRATION] saveOrder', () => {

  beforeEach(() => {
    db.products.findById = inMemoryDb.products.findById;
    db.orders.create     = inMemoryDb.orders.create;
    inMemoryDb._orders   = [];
  });

  it('crée une commande avec le bon prix depuis la DB', async () => {
    const result = await saveOrder({ productId: 1, userId: 10 });
    expect(result.price).toBe(79.90);
    expect(result.userId).toBe(10);
    expect(result.productId).toBe(1);
  });

  it('persiste la commande dans la DB en mémoire', async () => {
    await saveOrder({ productId: 2, userId: 5 });
    expect(inMemoryDb._orders).toHaveLength(1);
    expect(inMemoryDb._orders[0].price).toBe(29.90);
  });

  it('rejette si le produit est absent de la DB', async () => {
    await expect(saveOrder({ productId: 99, userId: 1 }))
      .rejects.toThrow('Product not found');
  });

});
