# Fondation — geotech-ec7

Application PWA autonome de calcul géotechnique conforme à l'Eurocode 7
(EN 1997-1:2004, 1ʳᵉ génération). Un seul modèle de terrain, saisi une fois, alimente trois
familles de vérifications :

- **Fondations superficielles** (radier / semelle) — portance ELU (drainé/non drainé),
  glissement, tassement ELS, vérifications hydrauliques UPL/HYD, radier sur ressorts
  itératifs (couplage sol-structure, §6.6).
- **Fondations profondes** (pieux) — capacité axiale (voie 2, corrélation ξ3/ξ4),
  comportement transversal sous charge horizontale (courbes p-y : Matlock, Reese,
  pressiométrique), effet de groupe.
- **Ouvrages de soutènement** — mur en L (équilibre limite), paroi flexible phasée
  (coefficient de réaction, chaînage d'état entre phases d'excavation).

Deux briques transversales complètent l'ensemble : stabilité générale (Bishop simplifiée,
recherche automatique du cercle critique) et hydraulique de fouille (renard). Une analyse de
sensibilité paramétrique par dérivée numérique accompagne les résultats principaux.

Chaque vérification est menée en parallèle sur deux chaînes indépendantes — ELU (résistance,
taux d'exploitation) et ELS (déformation) — jamais mélangées.

## Périmètre et limites

Application d'aide au calcul, pas un logiciel de dimensionnement réglementaire clé en main :
la responsabilité du dimensionnement reste entière entre les mains de l'ingénieur du projet
(voir §13 du cahier des charges). Valeurs recommandées de l'annexe A de l'EN 1997-1:2004,
sans annexe nationale chargée — un bandeau le rappelle sur chaque écran de résultat.

PWA 100 % locale et hors ligne : aucune donnée ne quitte l'appareil, pas de serveur, pas de
compte utilisateur.

## Démarrer

```bash
npm install
npm run dev              # serveur de développement, http://localhost:3000
```

## Autres commandes

```bash
npm run build             # build de production (dist/)
npm run preview           # sert le build de production en local
npm run lint               # vérification TypeScript stricte (tsc --noEmit)
npm run test:acceptance   # suite de tests d'acceptation normatifs, en CLI
```

## Documentation

- [`cahier_des_charges_app_geotechnique.md`](cahier_des_charges_app_geotechnique.md) —
  référence normative figée (spécification technique complète, formules, clauses EC7).
- [`DEVPLAN.md`](DEVPLAN.md) — journal vivant : état d'avancement par phase, revues de code,
  tâches en cours.
- [`AGENTS.md`](AGENTS.md) — règles de collaboration et de gestion du dépôt.

## Licence

Ce projet est distribué sous licence MIT. Voir le fichier [`LICENSE`](LICENSE) pour plus de détails.

