// ============================================================
// emailService.js — Service d'envoi d'emails
// ============================================================
// Ce fichier centralise toute la logique d'envoi d'emails.
// En production, on brancherait ici un vrai outil comme Nodemailer
// (qui envoie via SMTP) ou une API comme SendGrid / Mailgun.
// Pour l'instant, on simule l'envoi avec un console.log.
//
// L'avantage d'isoler ça dans un service séparé :
//   → les routes n'ont pas à savoir COMMENT l'email est envoyé
//   → dans les tests, on peut remplacer ce service par un faux
//     sans toucher au reste du code (c'est le principe du mock)
// ============================================================

// Envoyé quand une nouvelle commande est créée
// Paramètres :
//   - to    : adresse email du destinataire (ex: "alice@example.com")
//   - order : l'objet commande complet (id, status, productIds...)
function sendOrderConfirmation(to, order) {
  // En production : nodemailer.sendMail({ to, subject: ..., html: ... })
  console.log(`[email] Confirmation envoyée à ${to} pour la commande #${order.id}`);

  // On retourne une Promise pour simuler une opération asynchrone
  // (un vrai envoi d'email prend du temps → toujours async)
  return Promise.resolve({ to, subject: `Confirmation commande #${order.id}`, order });
}

// Envoyé quand le statut d'une commande change (ex: "shipped", "delivered")
function sendStatusUpdate(to, order) {
  console.log(`[email] Mise à jour statut envoyée à ${to} : commande #${order.id} → ${order.status}`);
  return Promise.resolve({ to, subject: `Commande #${order.id} : ${order.status}`, order });
}

// On exporte les deux fonctions pour qu'elles soient utilisables
// depuis les routes et remplaçables dans les tests
module.exports = { sendOrderConfirmation, sendStatusUpdate };
