# Contribuer à PulseBoard

## Commits et branche principale

- Un commit doit regrouper une intention cohérente et complète.
- Préfixer le sujet par `Add:`, `Fix:`, `Refactor:`, `Docs:`, `Chore:` ou `Security:`.
- Avant un push, vérifier `git status`, lancer `pnpm check` et `pnpm test`, puis relire `git log -5 --oneline`.
- Ne pas réécrire ni forcer la branche `main` partagée. Pour une correction, créer une branche et intégrer un diff relu.

## Données et bêta

- La bêta utilise uniquement des scénarios entièrement fictifs. Ne jamais y copier des données d'un patient réel.
- Ne pas ajouter de cache hors ligne pour les données cliniques sans conception de chiffrement, de gestion des clés et de résolution des conflits validée.
