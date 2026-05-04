const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { priceWithTax, saveOrder, convertPrice, db } = require('../exo');

// ══════════════════════════════════════════════════════════════
// FONCTION 1 : priceWithTax — OPTION A (test unitaire)
//
// Pourquoi uniquement unitaire ?
// C'est une fonction PURE : pas de réseau, pas de base de données,
// pas d'async. Elle prend des nombres/strings, retourne un string.
// Même entrée → toujours même sortie. Parfait pour l'unitaire.
// ══════════════════════════════════════════════════════════════
describe('[UNITAIRE] priceWithTax', () => {

  it('applique la TVA française (20%)', () => {
    // 100 € + 20% = 120.00
    assert.equal(priceWithTax(100, 'FR'), '120.00');
  });

  it('applique la TVA allemande (19%)', () => {
    // 100 € + 19% = 119.00
    assert.equal(priceWithTax(100, 'DE'), '119.00');
  });

  it('applique la TVA britannique (20%)', () => {
    assert.equal(priceWithTax(100, 'GB'), '120.00');
  });

  it('applique 0% de TVA aux USA', () => {
    // US: 0 → prix inchangé
    assert.equal(priceWithTax(100, 'US'), '100.00');
  });

  it('utilise 20% par défaut pour un pays inconnu (opérateur ??)', () => {
    // Le ?? dans le code applique 0.20 si le pays n'est pas dans rates
    assert.equal(priceWithTax(100, 'JP'), '120.00');
    assert.equal(priceWithTax(100, 'XX'), '120.00');
  });

  it('retourne un string avec exactement 2 décimales (.toFixed)', () => {
    const result = priceWithTax(9.99, 'FR');
    // 9.99 * 1.20 = 11.988 → arrondi à 11.99
    assert.equal(typeof result, 'string');
    assert.equal(result, '11.99');
  });

  it('gère un prix à 0', () => {
    assert.equal(priceWithTax(0, 'FR'), '0.00');
  });

});


// ══════════════════════════════════════════════════════════════
// FONCTION 2 : saveOrder — OPTION C (unitaire + intégration)
//
// Pourquoi les deux ?
//   - UNITAIRE : on mocke db pour tester la logique métier isolément
//     (le throw, l'ajout du prix produit dans la commande)
//   - INTÉGRATION : on utilise un vrai db en mémoire pour tester
//     que les deux appels s'enchaînent correctement ensemble
// ══════════════════════════════════════════════════════════════

// ── Partie A : Tests UNITAIRES (db mocké) ────────────────────
describe('[UNITAIRE] saveOrder', () => {

  // Avant chaque test, on remplace les fonctions de db par des fausses
  // pour contrôler exactement ce qu'elles retournent
  beforeEach(() => {
    db.products.findById = async () => null;    // par défaut : produit introuvable
    db.orders.create    = async () => null;     // par défaut : création vide
  });

  it('lance une erreur si le produit est introuvable', async () => {
    // db.products.findById retourne null → doit throw
    db.products.findById = async () => null;

    await assert.rejects(
      () => saveOrder({ productId: 99, userId: 1 }),
      { message: 'Product not found' }
    );
  });

  it('injecte le prix du produit dans la commande créée', async () => {
    // On simule un produit trouvé avec un prix connu
    db.products.findById = async () => ({ id: 1, name: 'Chaise', price: 49.99 });

    // On capture ce que db.orders.create reçoit comme argument
    let capturedOrder = null;
    db.orders.create = async (order) => {
      capturedOrder = order; // on mémorise ce qui a été passé
      return order;
    };

    await saveOrder({ productId: 1, userId: 2 });

    // La commande doit avoir le prix du produit (49.99), pas celui du body
    assert.equal(capturedOrder.price, 49.99);
  });

  it('retourne la commande sauvegardée', async () => {
    db.products.findById = async () => ({ id: 1, price: 29.99 });
    db.orders.create = async (order) => ({ id: 42, ...order }); // simule un ID généré

    const result = await saveOrder({ productId: 1, userId: 3 });

    assert.equal(result.id, 42);
    assert.equal(result.price, 29.99);
  });

});

// ── Partie B : Tests d'INTÉGRATION (db en mémoire réelle) ────
describe('[INTÉGRATION] saveOrder', () => {

  // On crée un faux db "réaliste" : il stocke vraiment les données
  // et les retrouve, comme une vraie DB mais sans serveur
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

  beforeEach(() => {
    // Brancher notre db en mémoire sur les fonctions réelles
    db.products.findById = inMemoryDb.products.findById;
    db.orders.create     = inMemoryDb.orders.create;
    inMemoryDb._orders   = []; // remettre les commandes à zéro entre les tests
  });

  it('crée une commande avec le bon prix depuis la DB', async () => {
    const result = await saveOrder({ productId: 1, userId: 10 });

    // La commande est bien créée avec le prix du produit réel
    assert.equal(result.price, 79.90);
    assert.equal(result.userId, 10);
    assert.equal(result.productId, 1);
  });

  it('persiste la commande dans la DB en mémoire', async () => {
    await saveOrder({ productId: 2, userId: 5 });

    // La commande est bien stockée dans le tableau _orders
    assert.equal(inMemoryDb._orders.length, 1);
    assert.equal(inMemoryDb._orders[0].price, 29.90);
  });

  it('rejette si le produit est absent de la DB', async () => {
    // productId: 99 n'existe pas dans _products
    await assert.rejects(
      () => saveOrder({ productId: 99, userId: 1 }),
      { message: 'Product not found' }
    );
  });

});


// ══════════════════════════════════════════════════════════════
// FONCTION 3 : convertPrice — OPTION A (test unitaire)
//
// Pourquoi pas d'intégration ?
// L'API externe (exchangerate.host) est hors de notre contrôle :
//   - elle peut être hors ligne
//   - elle peut changer ses données
//   - elle ralentit le CI (appel réseau)
// On mocke global.fetch pour simuler sa réponse et tester
// uniquement notre logique de calcul.
// ══════════════════════════════════════════════════════════════
describe('[UNITAIRE] convertPrice', () => {

  // Après chaque test, on restaure le vrai fetch pour ne pas
  // polluer les autres suites de tests
  const originalFetch = global.fetch;
  beforeEach(() => { global.fetch = originalFetch; });

  it('convertit correctement avec un taux donné', async () => {
    // On simule : l'API répond { result: 1.1 } (1 EUR = 1.1 USD)
    global.fetch = async () => ({
      json: async () => ({ result: 1.1 }),
    });

    const result = await convertPrice(100, 'EUR', 'USD');
    // 100 * 1.1 = 110.00
    assert.equal(result, 110);
  });

  it('retourne le même prix si le taux est 1 (même devise)', async () => {
    global.fetch = async () => ({
      json: async () => ({ result: 1 }),
    });

    const result = await convertPrice(50, 'EUR', 'EUR');
    assert.equal(result, 50);
  });

  it('arrondit correctement à 2 décimales', async () => {
    // Taux avec beaucoup de décimales → doit arrondir
    global.fetch = async () => ({
      json: async () => ({ result: 0.3333 }),
    });

    const result = await convertPrice(10, 'USD', 'EUR');
    // 10 * 0.3333 = 3.333 → arrondi à 3.33
    assert.equal(result, 3.33);
  });

  it('appelle fetch avec la bonne URL (bonne devise)', async () => {
    let calledUrl = '';
    global.fetch = async (url) => {
      calledUrl = url; // on capture l'URL appelée
      return { json: async () => ({ result: 0.85 }) };
    };

    await convertPrice(100, 'USD', 'EUR');

    // Vérifie que l'URL contient bien les bonnes devises
    assert.ok(calledUrl.includes('from=USD'));
    assert.ok(calledUrl.includes('to=EUR'));
  });

  it('retourne un number (pas un string)', async () => {
    global.fetch = async () => ({
      json: async () => ({ result: 1.2 }),
    });

    const result = await convertPrice(10, 'EUR', 'USD');
    // Le + devant +(price * result).toFixed(2) convertit en number
    assert.equal(typeof result, 'number');
  });

});

// ══════════════════════════════════════════════════════════════
// TEST VOLONTAIREMENT CASSÉ — commenté pour ne pas casser la CI
//
// describe('[ÉCHEC VOLONTAIRE] priceWithTax', () => {
//   it('DOIT ÉCHOUER : affirme un résultat faux pour montrer un retour négatif', () => {
//     const result = priceWithTax(100, 'FR');
//     assert.equal(result, '999.00'); // '120.00' !== '999.00' → AssertionError
//   });
// });
// ══════════════════════════════════════════════════════════════
