// db est un objet exporté pour pouvoir être remplacé dans les tests
const db = {
  products: {
    findById: async (id) => null,
  },
  orders: {
    create: async (order) => order,
  },
};

function priceWithTax(price, country) {
  const rates = { FR: 0.20, DE: 0.19, GB: 0.20, US: 0 };
  const rate = rates[country] ?? 0.20;
  return (price * (1 + rate)).toFixed(2);
}

async function saveOrder(order) {
  const product = await db.products.findById(order.productId);
  if (!product) throw new Error('Product not found');
  const saved = await db.orders.create({ ...order, price: product.price });
  return saved;
}

async function convertPrice(price, fromCurrency, toCurrency) {
  const res = await fetch(
    `https://api.exchangerate.host/convert?from=${fromCurrency}&to=${toCurrency}`
  );
  const { result } = await res.json();
  return +(price * result).toFixed(2);
}

module.exports = { priceWithTax, saveOrder, convertPrice, db };
