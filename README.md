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
- **PWA** — Installable sur smartphone ; l'interface reste accessible hors ligne et les données cliniques nécessitent une connexion sécurisée

---

## Stack technique

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19 + TypeScript + Tailwind 4 |
| Backend | Express 4 + tRPC 11 |
| Base de données | PostgreSQL + Drizzle ORM (`postgres-js`) |
| Authentification | Compte local par e-mail et mot de passe, session signée côté serveur (JWT en cookie HTTP-only) |
| PWA | manifest.json + Service Worker |

---

## Démarrage rapide

### Prérequis
- Node.js 20+
- pnpm 10+
- PostgreSQL 15+ (ou Docker Compose)

### Installation

```bash
# 1. Installer les dépendances
pnpm install

# 2. Copier et configurer les variables d'environnement
cp .env.example .env
# Renseigner DATABASE_URL et JWT_SECRET

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

## Authentification et dépendance à Manus

La connexion et l'inscription actuellement utilisées par PulseBoard sont locales : l'application stocke un mot de passe haché avec bcrypt, puis remet un cookie de session signé par le serveur. La connexion OAuth Manus n'est pas nécessaire pour ces parcours ; les anciennes routes OAuth sont désactivées. Le code contient encore des modules d'infrastructure hérités de Manus pour certains services auxiliaires, mais ils ne constituent pas le fournisseur d'identité utilisé par l'écran de connexion.

Les sessions expirent après 12 heures. Un changement de mot de passe ou l'action « Déconnecter tous les appareils » incrémente la version de session du compte et invalide les anciens jetons côté serveur.

Avant un déploiement destiné à des utilisateurs réels, il faudra auditer la gestion des sessions et des mots de passe, vérifier l'envoi et l'application effective de la confirmation d'e-mail, et documenter les responsabilités d'hébergement et de traitement des identités. Un remplacement par Better Auth ou un autre fournisseur reste une option d'évolution, pas une dépendance requise par l'authentification actuelle.

## Déploiement

### Docker (application complète + PostgreSQL)

```bash
cp .env.example .env
# Remplacer JWT_SECRET et POSTGRES_PASSWORD par des secrets longs et aléatoires
docker compose up --build -d
```

L'application répond sur `http://localhost:3000` et son état peut être contrôlé sur `/healthz`.

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
- `DATABASE_URL` — URL de connexion PostgreSQL
- `JWT_SECRET` — clé secrète longue utilisée pour les sessions
- `PUBLIC_APP_URL` — adresse publique de PulseBoard

Mode de lancement du Hall :
- `HALL_SERVICE_ENABLED=false` désactive les procédures collectives côté serveur.
- `VITE_HALL_SERVICE_ENABLED=false` masque le Hall côté interface et affiche la liste d'attente.
- Pour ouvrir le Hall plus tard, définir les deux variables à `true` puis redéployer.

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
4. L'interface peut s'ouvrir hors ligne ; reconnectez-vous pour consulter ou modifier les données cliniques

---

© 2026 PulseBoard. Conçu pour les soignants sénégalais. 🇸🇳
