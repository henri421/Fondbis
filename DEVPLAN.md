# DEVPLAN — Fondation (GeoTech EC7)

Suivi vivant. Le cahier des charges (`cahier_des_charges_app_geotechnique.md`) reste la
référence normative figée ; ce document porte l'état d'avancement et la prochaine tâche à
confier.

## Rôles (AGENTS.md)

- **Claude** : architecture, specs précises, revue, correction, validation contre le CDC,
  décide de l'ordre des tâches.
- **Agent Google AI Studio (Gemini)** : implémentation du code sur spec fournie.

## État au 2026-09-14

**Wiring.** Dépôt local reconnecté à `origin/main`. Nettoyage effectué :
`package.json` renommé (`react-example` → `geotech-ec7`), dépendances mortes retirées
(`@google/genai`, `express`, `dotenv`, `@types/express`, `motion` — aucun usage dans `src/`,
résidus du scaffold AI Studio qui supposait un déploiement serveur), doublon `vite` en
dependency+devDependency corrigé, `metadata.json.majorCapabilities` vidé (la déclaration
`SERVER_SIDE_GEMINI_API` risquait de faire réintroduire un serveur par l'agent AI Studio à
la prochaine session). `npm run test:acceptance` ajouté (exécute les tests du §12 en CLI via
`tsx`, sans passer par l'UI).

Build et typecheck vérifiés propres après nettoyage (`npm run lint`, `npm run build`).

**Phases CDC 0 à 3 : validées.** Les 7 tests d'acceptation du §12.2 à §12.5 (T0.1, T0.2,
T1.1, T1.2, T1.3, T2.1, T3.1) ont été exécutés en CLI contre les valeurs de référence du CDC
— tous passent, écarts dans les tolérances prescrites. Conformément au §11 du CDC
(« aucune phase ne démarre avant validation de la précédente »), la phase 4 peut démarrer.

**Avance sur le phasage.** Les briques stabilité générale (Bishop simplifiée, §9.1) et
hydraulique de fouille (renard, §9.2) sont déjà codées, normalement prévues en phase 6.
L'UPL/HYD du §6.4 est également fait, intégré au module radier.

**Manque confirmé, indépendant des phases suivantes.** Analyse de sensibilité paramétrique
par dérivée numérique (§12.1) — explicitement requise par le CDC, absente du code. Peut être
traitée en parallèle, ne dépend de rien d'autre.

## Table de phasage (état réel vs CDC §11)

| Phase | Contenu | Statut |
|-|-|-|
| 0 | Noyau : stratigraphie, nappe, profil de contraintes, config normative | ✅ Validé (T0.1, T0.2) |
| 1 | Module A : radier, portance ELU, glissement, tassement ELS | ✅ Validé (T1.1-T1.3), UPL/HYD inclus |
| 2 | Module C niveau 1 : mur en L | ✅ Validé (T2.1) |
| 3 | Module B : pieu axial isolé puis groupe | ⚠️ Isolé validé (T3.1) ; **groupe de pieux (§7.6) non vérifié** — à confirmer avant de considérer la phase 3 close |
| — | Brique §9.3 solveur matriciel | ❌ Absente — prérequis des phases 4, 5, 7 |
| 4 | Module C niveau 2 : phasage et coefficient de réaction | ❌ Non commencé |
| 5 | Module B transversal : courbes de réaction p-y | ❌ Non commencé |
| 6 | Stabilité générale + hydraulique | 🟡 En avance, non finalisé (à confronter aux tests §12.6) |
| 7 | Radier sur ressorts itératifs, export structural | ❌ Non commencé |
| — | Sensibilité paramétrique (§12.1) | ❌ Absente |

## Prochaine tâche à confier à Gemini : brique §9.3, solveur poutre sur appuis élastiques

Le CDC place cette brique en prérequis implicite des phases 4, 5 et 7 (« à mutualiser »,
§6.6 et §8.4) mais ne la numérote pas comme une phase propre. Décision : on l'extrait en
tâche autonome, testée indépendamment, avant d'attaquer la phase 4. Une paroi phasée bâtie
directement sur un solveur non éprouvé serait le pire endroit pour découvrir un bug
d'assemblage matriciel.

Copier ce qui suit tel quel dans la session AI Studio.

---

**Contexte.** Fondation est une app géotechnique EC7 (React 19 + Vite + TS strict, PWA
offline, IndexedDB, pas de backend). Conventions déjà en place à respecter : types stricts
dans `src/types/`, référence de clause normative via `CLAUSES_EC7` (`src/norme/metadataNorme.ts`),
retour de chaque fonction de calcul avec `clauseReference` et `statutNormatif`, pas de valeur
codée en dur, code et commentaires en français.

**Tâche.** Créer `src/core/solveurPoutreRessorts.ts` : solveur d'éléments finis pour poutre
plane sur appuis élastiques, à réutiliser tel quel par le module C niveau 2 (paroi phasée),
le module B transversal (pieu latéral) et l'extension radier sur ressorts.

**Élément.** Poutre plane à 2 nœuds, 3 DDL par nœud (axial, transversal, rotation) — matrice
de rigidité élémentaire standard 6×6 (Euler-Bernoulli), assemblage en matrice bande ou creuse,
factorisation directe (pas besoin d'itératif pour la partie linéaire).

**Ressorts.** Appuis ponctuels élastoplastiques : raideur `k` linéaire jusqu'à une réaction
plafond `Fmax` (positive et négative, bornes indépendantes — cas poussée d'un côté / butée de
l'autre). Au-delà, réaction plafonnée, pas de raideur négative. Résolution non linéaire par
itération de Newton sur la raideur sécante de chaque ressort, jusqu'à convergence sur le champ
de déplacement (critère : norme du résidu de déplacement entre deux itérations < 1e-4, relatif
à la plus grande flèche, plafond 100 itérations avec avertissement explicite si non convergé —
ne jamais renvoyer un résultat non convergé sans le signaler).

**Interface attendue (à adapter aux conventions du repo, pas figée dans la forme) :**

```typescript
export interface NoeudPoutre {
  x: number; y: number; // position [m]
}

export interface RessortNodal {
  noeudIndex: number;
  raideur: number;        // kN/m ou kN.m/rad selon direction
  direction: 'x' | 'y' | 'rotation';
  reactionMax?: number;   // plafond positif [kN ou kN.m], absent = illimité
  reactionMin?: number;   // plafond négatif, absent = illimité
}

export interface ChargeNodale {
  noeudIndex: number;
  Fx?: number; Fy?: number; Mz?: number;
}

export interface ResultatSolveurPoutre {
  deplacements: Array<{ noeudIndex: number; ux: number; uy: number; rz: number }>;
  reactionsRessorts: Array<{ noeudIndex: number; direction: string; reaction: number; plastifie: boolean }>;
  effortsInternes: Array<{ noeudIndex: number; N: number; V: number; M: number }>;
  convergence: { convergé: boolean; iterations: number; residuFinal: number };
}

export function resoudrePoutreSurRessorts(
  noeuds: NoeudPoutre[],
  E: number, I: number, A: number,           // section constante en phase 1, section variable = amélioration ultérieure
  ressorts: RessortNodal[],
  chargesAppliquees: ChargeNodale[],
  appuisBloques: Array<{ noeudIndex: number; direction: 'x' | 'y' | 'rotation' }>, // appuis rigides classiques (encastrement, etc.)
): ResultatSolveurPoutre;
```

**Exigence de non-régression.** Le solveur doit accepter un état initial (déplacements +
statut de plastification de chaque ressort) en entrée optionnelle, pour permettre l'usage en
phasage (§8.4) où chaque phase repart de l'état final de la précédente — ne pas fermer cette
porte dans la signature même si elle n'est pas exercée par les tests de cette tâche.

**Tests d'acceptation à coder dans `src/validation/acceptanceTestsSolveur.ts`, même format que
`acceptanceTests.ts` existant (id, nom, valeurAttendue, valeurObtenue, tolerance, succes) :**

- **T_SOLV.1 — Cantilever, référence poutre classique.** Poutre encastrée-libre, longueur
  L = 5.00 m, E = 30e6 kPa (béton), I = 0.0208 m⁴ (section 0.5×0.5 m : `I = b*h³/12`),
  charge ponctuelle P = 100 kN transversale en bout, aucun ressort. Comparer à la solution
  fermée de résistance des matériaux :
  ```
  flèche en bout   : delta = P*L³/(3*E*I)
  moment à l'encastrement : M = -P*L
  effort tranchant : V = P (constant)
  ```
  Tolérance relative 0.5 % (discrétisation en éléments finis, pas exact analytiquement selon
  le maillage — si le résultat est exact car un seul élément suffit pour Euler-Bernoulli,
  resserrer la tolérance à 0.01 %).

- **T_SOLV.2 — Ressort linéaire, équilibre global.** Même poutre, sans charge en bout mais un
  ressort linéaire `k = 500 kN/m` ajouté au nœud libre en direction `y`, charge ponctuelle
  P = 50 kN au même nœud. Vérifier : réaction du ressort = `k * uy_noeud` (cohérence
  Hooke locale) et équilibre global des forces verticales : somme(charges appliquées) =
  somme(réactions ressorts + réactions appuis bloqués), résidu < 1e-6 kN.

- **T_SOLV.3 — Plastification et convergence.** Même configuration que T_SOLV.2 mais
  `reactionMax = 20 kN` sur le ressort et charge P = 50 kN (dépasse la capacité du ressort).
  Vérifier : `convergence.convergé === true`, réaction du ressort plafonnée exactement à
  20 kN (`plastifie: true`), et que l'équilibre global reste respecté (le complément est repris
  par un déplacement plus grand, pas par une violation d'équilibre).

**Ne pas** : inventer des coefficients géotechniques, ne pas commencer la surcouche paroi
phasée (§8.4) ou pieu transversal (§7.7) dans cette tâche — uniquement la brique générique et
ses 3 tests. La suite viendra en tâche séparée une fois cette brique validée.

---

## Après validation de la brique §9.3

Dans l'ordre, une tâche Gemini à la fois, chacune revue et testée avant la suivante :

1. **Phase 4 — Module C niveau 2** (`src/modules/soutenement/paroiPhasee.ts`) : algorithme de
   phasage du §8.4, appui sur `resoudrePoutreSurRessorts` avec l'état initial chaîné entre
   phases. Sorties par phase : déformée, M, V, réaction de chaque appui, taux de mobilisation
   de la butée. Ajouter l'onglet UI correspondant sur le modèle des `Onglet*.tsx` existants.
2. **Phase 5 — Module B transversal** (`src/modules/pieux/comportementTransversal.ts`) :
   courbes p-y (Matlock argiles molles, Reese sables), même solveur, convergence Newton sur
   raideur sécante.
3. **Groupe de pieux (§7.6)**, complément de la phase 3 restée ouverte : coefficient
   d'efficacité, rupture en bloc, tassement de groupe.
4. **Sensibilité paramétrique (§12.1)** : peut être traitée à tout moment en parallèle,
   indépendante du solveur — dérivée numérique sur les paramètres de sol principaux, affichage
   de la dispersion à côté de chaque résultat.
5. **Phase 6, finalisation** : recherche automatique du cercle critique (grille de centres/
   rayons + raffinement local, déjà en partie présente) et écoulement/réseau simplifié,
   confrontés aux cas de référence publiés (§12.6 — liste à obtenir de l'ingénieur).
6. **Phase 7** : radier sur ressorts itératifs (§6.6, boucle décrite dans le CDC, réutilise le
   solveur de plaque à mutualiser avec la brique matricielle), export vers les modules
   structuraux (format d'échange à définir avec Aedificium/Structura).

## Wiring restant (hors code de calcul)

- README.md, LICENSE — à écrire avant toute publication.
- Décision de visibilité : rester privé tant que la phase 4 n'est pas validée (outil à
  responsabilité réglementaire, cf. §13 du CDC). Repasser en public + GitHub Pages, à
  l'anonyme `henri421` comme le reste de la suite, une fois mûr.
- Une fois public : ajouter l'entrée dans `Structura/index.html` (hub WebAedificium).
