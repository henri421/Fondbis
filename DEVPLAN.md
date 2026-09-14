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
| — | Brique §9.3 solveur matriciel | 🟡 Codée et validée (10/10 T_SOLV.1-3), 3 durcissements requis avant la phase 4 (voir revue) |
| 4 | Module C niveau 2 : phasage et coefficient de réaction | ❌ Non commencé |
| 5 | Module B transversal : courbes de réaction p-y | ❌ Non commencé |
| 6 | Stabilité générale + hydraulique | 🟡 En avance, non finalisé (à confronter aux tests §12.6) |
| 7 | Radier sur ressorts itératifs, export structural | ❌ Non commencé |
| — | Sensibilité paramétrique (§12.1) | ❌ Absente |

## Revue de la brique §9.3 (2026-09-14, par Claude)

Livrée par Gemini : `src/core/solveurPoutreRessorts.ts` (élément Euler-Bernoulli 6 DDL,
assemblage, Newton sur raideur sécante) + `src/validation/acceptanceTestsSolveur.ts`
(T_SOLV.1-3). Revue faite en relisant le code (matrice élémentaire, transformation,
récupération des efforts internes vérifiées terme à terme contre la formulation standard) et
en ré-exécutant les tests de façon indépendante (`npm run test:acceptance`, pas seulement en
faisant confiance au rapport) : **10/10 passent**, algèbre cohérente avec un calcul manuel de
contrôle sur T_SOLV.2 et T_SOLV.3.

**1 bug corrigé directement (pas besoin de repasser par Gemini) :** `metadataNorme.ts`
attribuait à cette brique la référence *« EN 1997-1:2004 Section 9.3 »* avec statut
`Normative`. Cette clause n'existe pas sous ce sens — le vrai §9.3 de l'EC7 traite des
« actions, données géométriques et situations de calcul » des ouvrages de soutènement, rien à
voir avec un solveur EF. La méthode poutre-sur-ressorts est une pratique numérique
professionnelle, pas une clause EC7 citable : corrigé en `Informative` avec une référence
honnête (CDC §9.3 + contexte Section 9 EC7). Un tel travers est exactement ce que le CDC §13
interdit (« aucun de ces éléments ne doit être inventé ») — à surveiller sur les prochaines
livraisons, notamment quand un nom de clause « sonne juste » sans être vérifié.

**Wiring redéfait par le scaffold AI Studio, re-corrigé :** `bun.lock` réintroduit et
`package-lock.json` supprimé (repris dans l'autre sens), `scripts/runAcceptanceTests.ts`
créé en doublon de `src/validation/runAcceptanceCli.ts` sans être branché dans
`package.json` — le rapport « 10/10 » ne pouvait donc pas venir de `npm run test:acceptance`
tel quel. Consolidé sur `scripts/runAcceptanceTests.ts` (sortie plus complète), l'ancien
fichier supprimé, script npm rebranché, `package-lock.json` réimposé.

**3 limites techniques identifiées, pas bloquantes pour la brique isolée mais à corriger
avant la phase 4** (paroi phasée = dizaines de ressorts non linéaires simultanés + phases
d'excavation transitoirement instables — c'est exactement le terrain où ces limites
deviennent dangereuses) :

1. La relaxation numérique est présente dans la signature (`omega`) mais figée à `1.0` —
   jamais utilisée. Sans relaxation, un système à plusieurs ressorts plastifiables peut
   osciller indéfiniment entre deux états actifs au lieu de converger.
2. Le solveur linéaire régularise silencieusement les lignes quasi singulières (`M[p][p] =
   1.0; x[p] = 0.0`) sans le signaler. Un mécanisme réel (ex. phase d'excavation avant pose
   d'un buton) produirait un déplacement à zéro silencieux au lieu d'un avertissement — c'est
   précisément le genre de résultat faux-silencieux que le CDC (§10) demande d'exclure.
3. Les efforts internes aux nœuds intérieurs partagés par deux éléments sont moyennés. Correct
   tant qu'il n'y a pas de charge concentrée sur ce nœud (cas actuel, poutre à 2 nœuds), mais
   dès qu'un maillage à plusieurs éléments porte un appui ou une charge sur un nœud interne
   (le cas normal en phase 4/5), la moyenne masque la discontinuité réelle de V et M de part
   et d'autre du nœud.

## Prochaine tâche à confier à Gemini : durcissement de la brique avant la phase 4

Petite tâche ciblée, pas une réécriture. Copier tel quel dans la session AI Studio.

---

**Contexte.** Suite directe de la tâche précédente sur `src/core/solveurPoutreRessorts.ts`
(déjà livré et validé, 10/10 tests). Trois corrections ciblées avant de bâtir la paroi phasée
dessus (§8.4 du CDC — plusieurs dizaines de ressorts non linéaires simultanés, phases
potentiellement instables).

**1. Relaxation numérique réelle.** Le paramètre `omega` existe mais vaut toujours 1.0.
Détecter l'oscillation (un ressort qui bascule élastique↔plastifié de façon répétée sur 2-3
itérations consécutives sans converger) et réduire `omega` (ex. passer à 0.5) pour les
itérations suivantes le temps que ça se stabilise. Ne change rien au comportement des cas déjà
testés (T_SOLV.1-3), qui convergent sans osciller.

**2. Détection de mécanisme.** Quand le pivot de Gauss tombe sous le seuil de singularité
(`maxVal < 1e-13`), ne pas juste régulariser silencieusement : remonter l'information dans le
résultat (nouveau champ `convergence.avertissements: string[]`, ou équivalent) avec un message
explicite identifiant le DDL en cause (nœud + direction), pour qu'une UI de phasage puisse
afficher « phase instable, appui manquant » plutôt qu'un déplacement nul silencieux.

**3. Efforts internes aux nœuds intermédiaires.** Remplacer la moyenne aux nœuds partagés par
deux valeurs distinctes de part et d'autre du nœud (`effortsInternes` doit pouvoir exposer
`gauche`/`droite` ou équivalent, pas un seul triplet N/V/M moyenné), pour représenter
correctement une discontinuité due à une charge ou une réaction ponctuelle sur ce nœud. Ajuster
`ModalNoteDeCalcul.tsx`/UI seulement si la signature change de façon incompatible — sinon ne
pas toucher à l'UI dans cette tâche.

**Tests à ajouter dans `acceptanceTestsSolveur.ts` :**
- **T_SOLV.4** : reprendre une configuration à 2 ressorts non linéaires de raideurs et plafonds
  volontairement mal proportionnés pour osciller sans relaxation (à construire par
  tâtonnement — l'objectif du test est `convergence.convergé === true` en moins de 100
  itérations, à comparer avec/sans le correctif). Documenter dans le message du test le nombre
  d'itérations avant/après.
- **T_SOLV.5** : poutre à 3 nœuds (2 éléments), aucun appui au nœud central sauf une charge
  ponctuelle dessus → mécanisme réel (rotation libre ou translation libre selon le montage
  choisi). Vérifier qu'un avertissement de singularité est bien présent et identifie le bon
  DDL.
- **T_SOLV.6** : poutre à 3 nœuds, charge ponctuelle Fy sur le nœud central, appuis aux deux
  extrémités (bi-appuyée) — vérifier que `effortsInternes` du nœud central expose deux valeurs
  de tranchant différentes de part et d'autre (saut égal à la charge appliquée), pas une
  moyenne masquant le saut.

**Ne pas** : commencer la surcouche paroi phasée (§8.4) dans cette tâche — uniquement le
durcissement de la brique et ses 3 tests supplémentaires.

---

## Après le durcissement de la brique §9.3

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
