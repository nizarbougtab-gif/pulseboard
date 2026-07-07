# PulseBoard — Sénégal 🇸🇳

> **"Ton service dans ta poche"** — L'outil de gestion médicale pensé pour les équipes soignantes sénégalaises.

PulseBoard est une Progressive Web App (PWA) qui aide les médecins, internes, résidents et chefs de service des hôpitaux sénégalais à gérer leurs patients, générer leurs relèves et communiquer en équipe — le tout depuis leur smartphone, même avec une connexion instable.

---

## Fonctionnalités principales

- **Dashboard multi-services** — Vue lits + liste des patients avec badges statut (Critique / Modéré / Stable)
- **Fiches patients complètes** — Allergies, antécédents, constantes, notes DAR/SOAP, tâches
- **Relève automatique** — Générée par priorité, copiable pour WhatsApp, exportable en PDF
- **Messagerie d'équipe** — Chat sécurisé lié au service, logs cliniques horodatés
- **Alertes** — DPS manquante, allergie non documentée, sortie prévue
- **PWA** — Installable sur smartphone, fonctionne hors ligne

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19 + TypeScript + Tailwind 4 |
| Backend | Express 4 + tRPC 11 |
| Base de données | MySQL + Drizzle ORM |
| Auth | OAuth via Manus |
| PWA | manifest.json + Service Worker |

---

## Démarrage rapide

### Prérequis
- Node.js 20+
- pnpm 10+
- MySQL 8+

### Installation

```bash
# 1. Installer les dépendances
pnpm install

# 2. Copier et configurer les variables d'environnement
cp .env.example .env
# Renseigner DATABASE_URL, VITE_OAUTH_PORTAL_URL, VITE_APP_ID

# 3. Pousser le schéma en base
pnpm db:push

# 4. Lancer le serveur de développement
pnpm dev
```

Le serveur démarre sur `http://localhost:3000`. Les hôpitaux sénégalais sont automatiquement insérés au premier démarrage si la table est vide.

---

## Structure du projet

```
├── client/
│   ├── src/
│   │   ├── pages/          # Home, Dashboard, ServiceView, PatientView
│   │   ├── components/     # RelevePanel, ServiceChat, AdmitPatient...
│   │   └── index.css       # Variables CSS --pulseboard-*
│   ├── public/
│   │   ├── manifest.json   # PWA manifest
│   │   ├── sw.js           # Service Worker (cache offline)
│   │   └── icons/          # Icônes de l'application
│   └── index.html
├── server/
│   ├── routers.ts          # Toutes les procédures tRPC
│   ├── db.ts               # Fonctions DB + seed hôpitaux
│   └── _core/              # Auth, OAuth, serveur Express
├── drizzle/
│   └── schema.ts           # Schéma base de données
└── README.md
```

---

## Déploiement

### Vercel / Netlify (Frontend uniquement)

```bash
pnpm build
# Le dossier dist/ est prêt à déployer
```

### Déploiement complet (avec backend)

```bash
# Build production
pnpm build

# Lancer en production
NODE_ENV=production node dist/index.js
```

Variables d'environnement requises en production :
- `DATABASE_URL` — URL de connexion MySQL
- `VITE_OAUTH_PORTAL_URL` — URL du portail OAuth
- `VITE_APP_ID` — ID de l'application

---

## Hôpitaux inclus

PulseBoard est préconfiguré avec les établissements sénégalais de référence :

- CHU Aristide Le Dantec (Dakar)
- CHU de Fann (Dakar)
- Hôpital Principal de Dakar
- Hôpital Abass Ndao (Dakar)
- CHR de Thiès
- Hôpital de Ziguinchor
- Hôpital de Tambacounda
- Centre de Santé de Pikine
- Hôpital Régional de Saint-Louis
- CHR de Kaolack
- Hôpital de Diourbel
- Hôpital Youssou Mbargane (Rufisque)

---

## PWA — Installation sur smartphone

1. Ouvrir l'application dans Chrome mobile
2. Appuyer sur "Ajouter à l'écran d'accueil"
3. L'icône PulseBoard apparaît sur l'écran d'accueil
4. L'application fonctionne hors ligne pour la consultation des données mises en cache

---

© 2026 PulseBoard. Conçu pour les soignants sénégalais. 🇸🇳
