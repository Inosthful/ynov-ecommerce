// ============================================================
// tests/orders.test.js — Tests d'intégration pour les commandes
// ============================================================
// Ces tests vérifient deux choses à la fois :
//   1. Que les routes HTTP répondent correctement (bons status codes, bon JSON)
//   2. Que les emails sont bien déclenchés au bon moment
//
// On utilise la technique du "mock" pour l'email :
//   → On remplace le vrai service d'email par une fausse version
//   → La fausse version ne fait qu'enregistrer les appels dans un tableau
//   → Dans les tests, on vérifie ce tableau pour savoir si l'email a été envoyé
//
// Pourquoi mocker l'email ?
//   - Éviter d'envoyer de vrais emails pendant les tests
//   - Rendre les tests rapides et déterministes
//   - Pouvoir tester le contenu de l'email (destinataire, sujet...)
// ============================================================

const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict'); // Assertions strictes (=== au lieu de ==)
const request = require('supertest');         // Simule des requêtes HTTP sans vrai serveur

// ── Mise en place du mock email ──────────────────────────────
// IMPORTANT : on charge emailService AVANT l'app.
// Pourquoi ? Node.js met les modules en cache lors du premier require().
// Si on remplace les fonctions ici, quand l'app chargera emailService
// elle récupèrera notre version modifiée depuis le cache → le mock fonctionne.

const emailService = require('../src/services/emailService');

// Ce tableau va enregistrer tous les emails "envoyés" pendant les tests
const sentEmails = [];

// On remplace sendOrderConfirmation par une fausse fonction :
//   - elle n'envoie pas de vrai email
//   - elle pousse un objet dans sentEmails pour qu'on puisse vérifier l'appel
emailService.sendOrderConfirmation = (to, order) => {
  sentEmails.push({ type: 'confirmation', to, order });
  return Promise.resolve(); // Simule une Promise résolue (comme un vrai envoi)
};

// Même chose pour sendStatusUpdate
emailService.sendStatusUpdate = (to, order) => {
  sentEmails.push({ type: 'status_update', to, order });
  return Promise.resolve();
};

// On charge l'app APRÈS avoir mis en place le mock
// (l'app va charger orders.js qui va charger emailService → notre version mockée)
const app = require('../src/index');


// ── Tests GET /api/orders ────────────────────────────────────
describe('GET /api/orders', () => {
  it('retourne la liste des commandes', async () => {
    // supertest envoie une vraie requête HTTP GET à notre app Express
    const res = await request(app).get('/api/orders');

    // On vérifie que la réponse HTTP est correcte
    assert.equal(res.status, 200);          // Code HTTP 200 = OK
    assert.ok(Array.isArray(res.body));     // Le corps de la réponse est un tableau
  });
});


// ── Tests POST /api/orders ───────────────────────────────────
describe('POST /api/orders', () => {
  // beforeEach s'exécute AVANT chaque test dans ce describe
  // On vide sentEmails pour que chaque test parte d'un état propre
  // (sinon les emails d'un test polluent les vérifications du suivant)
  beforeEach(() => sentEmails.length = 0);

  it('crée une commande valide', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ userId: 1, productIds: [1, 2] }); // .send() envoie un body JSON

    assert.equal(res.status, 201);              // 201 = Created (ressource créée)
    assert.equal(res.body.status, 'pending');   // Le statut initial est toujours "pending"
  });

  it('envoie un email de confirmation après création', async () => {
    // On crée une commande pour l'utilisateur 1 (Alice, alice@example.com)
    await request(app)
      .post('/api/orders')
      .send({ userId: 1, productIds: [1] });

    // Vérification de l'email via notre mock :
    assert.equal(sentEmails.length, 1);                    // Exactement 1 email envoyé
    assert.equal(sentEmails[0].type, 'confirmation');      // C'est bien une confirmation
    assert.equal(sentEmails[0].to, 'alice@example.com');   // Au bon destinataire
    assert.ok(sentEmails[0].order.id);                     // La commande a un ID
    assert.equal(sentEmails[0].order.status, 'pending');   // La commande est en attente
  });

  it("n'envoie pas d'email si l'utilisateur n'existe pas", async () => {
    // userId: 999 n'existe pas dans notre base d'utilisateurs
    // La commande sera créée, mais aucun email ne doit partir
    await request(app)
      .post('/api/orders')
      .send({ userId: 999, productIds: [1] });

    // Aucun email ne doit avoir été envoyé
    assert.equal(sentEmails.length, 0);
  });

  it('retourne 400 si productIds manquant', async () => {
    // On envoie un body invalide (pas de productIds)
    const res = await request(app)
      .post('/api/orders')
      .send({ userId: 1 }); // productIds absent → requête invalide

    assert.equal(res.status, 400);      // 400 = Bad Request
    assert.equal(sentEmails.length, 0); // Aucun email en cas d'erreur
  });
});


// ── Tests PATCH /api/orders/:id/status ──────────────────────
describe('PATCH /api/orders/:id/status', () => {
  beforeEach(() => sentEmails.length = 0); // Réinitialisation avant chaque test

  it('met à jour le statut', async () => {
    const res = await request(app)
      .patch('/api/orders/1/status')   // :id = 1 (commande existante)
      .send({ status: 'delivered' });

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'delivered'); // Le statut est bien mis à jour
  });

  it('envoie un email de mise à jour de statut', async () => {
    await request(app)
      .patch('/api/orders/1/status')
      .send({ status: 'shipped' });

    // La commande #1 appartient à l'utilisateur 1 (Alice)
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].type, 'status_update');        // Type correct
    assert.equal(sentEmails[0].order.status, 'shipped');      // Statut correct dans l'email
  });

  it('retourne 400 pour un statut invalide', async () => {
    // "invalid" n'est pas dans la liste des statuts autorisés
    const res = await request(app)
      .patch('/api/orders/1/status')
      .send({ status: 'invalid' });

    assert.equal(res.status, 400);
    assert.equal(sentEmails.length, 0); // Pas d'email si la validation échoue
  });

  it('retourne 404 pour une commande inexistante', async () => {
    // La commande 999 n'existe pas → 404
    const res = await request(app)
      .patch('/api/orders/999/status')
      .send({ status: 'shipped' });

    assert.equal(res.status, 404);
    assert.equal(sentEmails.length, 0); // Pas d'email si la commande n'existe pas
  });
});
