// ============================================================
// routes/orders.js — Endpoints HTTP pour les commandes
// ============================================================
// Ce fichier définit toutes les routes liées aux commandes :
//   GET    /api/orders           → liste toutes les commandes
//   GET    /api/orders/:id       → récupère une commande par son ID
//   POST   /api/orders           → crée une nouvelle commande
//   PATCH  /api/orders/:id/status → met à jour le statut d'une commande
// ============================================================

const express = require('express');
const router = express.Router(); // Routeur Express isolé pour ce fichier

// Les "bases de données" en mémoire (tableaux JS simples)
const orders = require('../data/orders');
const products = require('../data/products');
const users = require('../data/users');

// Le service d'envoi d'email (qu'on pourra remplacer dans les tests)
const emailService = require('../services/emailService');

// Feature flag : si ENABLE_STRICT_INVENTORY=true dans le .env,
// on vérifie que les produits commandés existent vraiment
const ENABLE_STRICT_INVENTORY = process.env.ENABLE_STRICT_INVENTORY === 'true';


// ── GET /api/orders ──────────────────────────────────────────
// Retourne toutes les commandes (pas de filtre, pas de pagination)
router.get('/', (req, res) => {
  res.json(orders); // Sérialise le tableau en JSON et répond 200 automatiquement
});


// ── GET /api/orders/:id ──────────────────────────────────────
// Retourne une commande précise identifiée par son ID dans l'URL
router.get('/:id', (req, res) => {
  // req.params.id est une string ("1"), parseInt la convertit en nombre (1)
  const id = parseInt(req.params.id);

  // Array.find() parcourt le tableau et retourne le premier élément
  // qui satisfait la condition, ou undefined si aucun ne correspond
  const order = orders.find(o => o.id === id);

  if (!order) {
    // 404 = ressource introuvable
    return res.status(404).json({ error: 'Order not found' });
  }

  res.json(order);
});


// ── POST /api/orders ─────────────────────────────────────────
// Crée une nouvelle commande et envoie un email de confirmation
router.post('/', (req, res) => {
  // req.body contient le JSON envoyé par le client
  // On attend : { userId: 1, productIds: [1, 2] }
  const { userId, productIds } = req.body;

  // Validation : les deux champs sont obligatoires
  // et productIds doit être un tableau (pas juste un nombre)
  if (!userId || !productIds || !Array.isArray(productIds)) {
    // 400 = requête invalide (mauvais format ou données manquantes)
    return res.status(400).json({ error: 'userId and productIds[] are required' });
  }

  // Validation optionnelle du stock (activée via variable d'environnement)
  if (ENABLE_STRICT_INVENTORY) {
    // On filtre les IDs de produits qui n'existent pas dans notre catalogue
    const unknown = productIds.filter(id => !products.find(p => p.id === id));
    if (unknown.length > 0) {
      // 422 = données valides côté format, mais incorrectes côté logique métier
      return res.status(422).json({ error: 'Some products are unavailable', ids: unknown });
    }
  }

  // Construction de l'objet commande
  const newOrder = {
    id: orders.length + 1,              // ID auto-incrémenté (simplifié)
    userId,                              // Qui a passé la commande
    productIds,                          // Quels produits
    total: 0,                            // Calcul du total (non implémenté)
    status: 'pending',                   // Statut initial : en attente
    createdAt: new Date().toISOString().split('T')[0], // Date du jour (YYYY-MM-DD)
  };

  // Ajout de la commande dans le tableau en mémoire
  orders.push(newOrder);

  // Recherche de l'utilisateur pour récupérer son email
  // (userId vient du body, on cherche l'objet complet dans users)
  const user = users.find(u => u.id === userId);
  if (user) {
    // On déclenche l'envoi d'email UNIQUEMENT si l'utilisateur existe
    // (userId pourrait pointer vers un user inexistant)
    emailService.sendOrderConfirmation(user.email, newOrder);
  }

  // 201 = ressource créée avec succès (différent du 200 classique)
  res.status(201).json(newOrder);
});


// ── PATCH /api/orders/:id/status ─────────────────────────────
// Met à jour uniquement le statut d'une commande existante
// PATCH = modification partielle (≠ PUT qui remplace tout l'objet)
router.patch('/:id/status', (req, res) => {
  const id = parseInt(req.params.id);
  const order = orders.find(o => o.id === id);

  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const { status } = req.body;

  // Liste fermée des statuts autorisés (on refuse tout autre valeur)
  const validStatuses = ['pending', 'shipped', 'delivered', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  // Mutation directe de l'objet en mémoire
  // (en base de données, ce serait un UPDATE SQL)
  order.status = status;

  // Notification par email du changement de statut
  const user = users.find(u => u.id === order.userId);
  if (user) {
    emailService.sendStatusUpdate(user.email, order);
  }

  res.json(order);
});


// Exporte le routeur pour qu'il soit monté dans src/index.js
module.exports = router;
