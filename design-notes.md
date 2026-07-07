# Design Notes - MedBoard Sénégal Refonte

## Couleurs (CSS Variables)
- --g: #00853F (vert principal Sénégal)
- --g-dark: #005f2d
- --red: #D92B35 (critique/alertes)
- --amber: #c87a00 (modéré)
- --blue: #1a56a0 (info)
- --bg: #ffffff, --bg2: #f7f8f6, --bg3: #eff0ee
- --text: #111510, --text2: #555c52, --text3: #9ba398

## Layout
- Sidebar fixe (230px) avec logo drapeau Sénégal, navigation, services, user
- Topbar avec titre service, horloge, recherche, boutons action
- Main content avec stats grid, toolbar (filtres/vues), table/grille patients
- Side panel pour détails patient

## Onglets Service (d'après images)
- Lits (vue hospitalisation)
- Garde
- Consult. (consultations - avec bouton "Ajouter une consultation")
- Relève

## Fiche Patient (d'après image interieur.jpeg)
- Header: Nom, badge J+X, statut "Entrant", Sans lit/Box, Age, Motif
- Alertes: DPS non renseignée, X tâches
- Traitement habituel
- Onglets: Suivi, Tâches, Vitaux, Obs, Fichiers
- Première note d'admission avec boutons + Note DAR, + Note SOAP

## Font
- Sora (principale)
- Playfair Display (serif accent)
