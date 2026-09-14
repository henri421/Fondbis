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

## Durcissement de la brique §9.3 (TERMINÉ - 13/13 tests validés)

Livré et validé conformément aux spécifications :
1. **Relaxation numérique dynamique** : détection des cycles d'oscillation (basculement alterné élastique ↔ plastifié) et ajustement automatique d'omega à 0.5 (configurable via `OptionsSolveurPoutre`).
2. **Détection de mécanisme / instabilité** : interception des pivots quasi-nuls (< 1e-13) dans `resoudreSystemeLineaire`, non-régularisation silencieuse, alimentation explicite de `convergence.avertissements` désignant le DDL singulier (nœud + direction), et mise à `convergé = false`.
3. **Efforts internes discontinus aux nœuds intermédiaires** : distinction des sections amont (`gauche` : $x^-$) et aval (`droite` : $x^+$) pour chaque nœud dans `EffortNodal`, avec conservation de valeurs représentatives nominales pour rétrocompatibilité.
4. **Nouveaux tests d'acceptation normatifs validés** :
   - **T_SOLV.4** : cas oscillant (100 itérations sans relaxation vs convergence en 3 itérations avec relaxation).
   - **T_SOLV.5** : poutre libre en translation horizontale X (détection explicite du mécanisme et du DDL singulier).
   - **T_SOLV.6** : poutre bi-appuyée avec charge ponctuelle centrale (restitution exacte du saut de tranchant $\Delta V = P = 60$ kN entre gauche et droite, et $M = 90$ kNm).

**Bilan de la suite de tests : 13 / 13 tests d'acceptation réussis (100%).**

Revue Claude (2026-09-14) : 13/13 ré-exécutés indépendamment, algèbre de la détection de
singularité vérifiée à la main (élimination de Gauss tracée manuellement sur T_SOLV.5 : le
DDL 6/nœud 2/direction x tombe bien à un pivot nul, cohérent avec la chaîne axiale non
retenue). Rien à corriger cette fois — la brique est saine. Wiring re-cassé par le scaffold
AI Studio (bun.lock réintroduit, package-lock.json supprimé) et re-corrigé, comme la fois
précédente ; voir note dans `AGENTS.md` ajoutée pour que ça cesse de se reproduire.

---

## Prochaine tâche à confier à Gemini : brique §8.2, profil de pression limite le long d'un écran

Avant l'algorithme de phasage lui-même (§8.4) : il lui faut en entrée, à chaque nœud du
maillage vertical et pour chaque phase (fond de fouille variable), les bornes de pression
active/passive à donner au solveur comme `reactionMin`/`reactionMax` des ressorts de sol.
Cette brique-là est réutilisable telle quelle par la berlinoise et la paroi de pieux sécants
ensuite. Copier tel quel dans la session AI Studio.

---

**Contexte.** `src/modules/soutenement/pousseeButee.ts` calcule déjà `Ka`/`Kp`/`K0` par
Rankine/Coulomb (`calculerCoefficientsPousseeButee`) et une poussée résultante pour un écran
homogène (`calculerPousseeSimple`, validé par T2.1). Il manque le profil de pression **le
long de la paroi**, sur plusieurs couches, avec des niveaux de terrain différents de part et
d'autre (côté retenu et côté fouille), pour nourrir le solveur `resoudrePoutreSurRessorts`
brique par brique du maillage.

**Tâche.** Créer `src/modules/soutenement/pressionLimiteParoi.ts`, fonction
`calculerProfilPressionLimite`. Réutiliser explicitement l'existant plutôt que réinventer :
- `construireMaillageVertical` (`src/core/maillage.ts`) pour les nœuds.
- `calculerProfilContraintes` (`src/core/profilContraintes.ts`) pour `sigma_vPrime(z)` et
  `u(z)` — appelé **deux fois**, une fois avec la cote de terrain naturel et l'hydrogéologie du
  côté amont (retenu), une fois avec celles du côté aval (fouille, cote de fond de fouille
  courante) : les deux côtés n'ont pas la même colonne de sol ni forcément la même nappe.
- `calculerParametresDeCalcul` (`src/core/deriveesSol.ts`) pour obtenir `phi'_d`/`c'_d` par
  couche selon le jeu de facteurs partiels actif (même pattern que
  `modules/radier/portanceELU.ts`), conformément à la règle des deux chaînes parallèles
  ELU/ELS du §5.4 — ne pas mélanger caractéristique et calcul.
- `calculerCoefficientsPousseeButee` pour `Ka`/`Kp` par couche à partir de `phi'_d`/`c'_d`.

**Calcul par nœud du maillage, pour chaque côté indépendamment :**
```
Pa(z) = Ka(couche) * sigma_vPrime_amont(z) - 2*c'_d*sqrt(Ka(couche))   [borne active, coté amont]
Pp(z) = Kp(couche) * sigma_vPrime_aval(z)  + 2*c'_d*sqrt(Kp(couche))   [borne passive, coté aval]
```
Plafonner à 0 si négatif (traction impossible dans le sol). Au-dessus du fond de fouille côté
aval (sol excavé, pas de colonne de sol), `Pp(z) = 0`. Ajouter séparément la pression d'eau
`u(z)` de chaque côté (déjà fournie par `calculerProfilContraintes`) à un champ distinct
`pressionEauDifferentielle(z) = u_amont(z) - u_aval(z)`, sans la mélanger dans `Pa`/`Pp` — le
CDC §8.2 demande la pression d'eau différentielle séparément, pas fondue dans la poussée
effective (cohérence avec la distinction contrainte totale/effective déjà faite dans le noyau).

**Interface (à adapter, pas figée) :**
```typescript
export interface PointPressionLimite {
  cote: number;
  Pa: number;  // kPa, borne active côté amont
  Pp: number;  // kPa, borne passive côté aval (0 au-dessus du fond de fouille)
  pressionEauDifferentielle: number; // kPa, amont - aval
}

export function calculerProfilPressionLimite(
  coteTerrainAmont: number,
  coteFondFouille: number, // = coteTerrainNaturel côté aval
  couches: CoucheGeotechnique[],
  hydrogeologieAmont: Hydrogeologie,
  hydrogeologieAval: Hydrogeologie,
  maillage: number[],
  configurationNormative: ConfigurationNormative,
  etat: 'ELS' | 'ELU'
): PointPressionLimite[];
```

**Test d'acceptation T_PRESS.1** dans `src/validation/acceptanceTestsSolveur.ts` (ou nouveau
fichier `acceptanceTestsSoutenement.ts`, au choix, mais branché dans
`scripts/runAcceptanceTests.ts`) : couche unique phi'=30°, c'=0, gamma=18 kN/m³, terrain amont
à la cote 100, fond de fouille à la cote 97 (3 m d'excavation), pas de nappe, valeurs
caractéristiques (jeu M1, facteurs =1). À la cote 90 (10 m sous le TN amont, 7 m sous le fond
de fouille) :
```
Ka = 0.33333, Kp = 3.00000
sigma'_v amont(90) = 18 * 10 = 180.00 kPa  ->  Pa = 60.00 kPa
sigma'_v aval(90)  = 18 * 7  = 126.00 kPa  ->  Pp = 378.00 kPa
```
Tolérance 0.5 %. Vérifier en plus qu'à la cote 98 (entre le TN amont et le fond de fouille,
donc au-dessus du fond de fouille côté aval) `Pp = 0` exactement, et `Pa = Ka * 18 * 2 = 12.00
kPa`.

**Ne pas** : commencer `paroiPhasee.ts` ou l'algorithme de phasage dans cette tâche — cette
brique se suffit à elle-même et doit être testée seule avant d'être consommée par le solveur.

---

## Prochaines étapes (selon plan)

Dans l'ordre, une tâche Gemini à la fois, chacune revue et testée avant la suivante :

1. **Brique §8.2 — profil de pression limite** (ci-dessus, à livrer en premier).
2. **Phase 4 — Module C niveau 2** (`src/modules/soutenement/paroiPhasee.ts`) : algorithme de
   phasage du §8.4, consommant la brique de pression limite ci-dessus pour dériver les
   `reactionMin`/`reactionMax` des ressorts à chaque profondeur et chaque phase, appui sur
   `resoudrePoutreSurRessorts` avec l'état initial chaîné entre phases. Sorties par phase :
   déformée, M, V, réaction de chaque appui, taux de mobilisation de la butée. Ajouter l'onglet
   UI correspondant sur le modèle des `Onglet*.tsx` existants.
3. **Phase 5 — Module B transversal** (`src/modules/pieux/comportementTransversal.ts`) :
   courbes p-y (Matlock argiles molles, Reese sables), même solveur, convergence Newton sur
   raideur sécante.
4. **Groupe de pieux (§7.6)**, complément de la phase 3 restée ouverte : coefficient
   d'efficacité, rupture en bloc, tassement de groupe.
5. **Sensibilité paramétrique (§12.1)** : peut être traitée à tout moment en parallèle,
   indépendante du solveur — dérivée numérique sur les paramètres de sol principaux, affichage
   de la dispersion à côté de chaque résultat.
6. **Phase 6, finalisation** : recherche automatique du cercle critique (grille de centres/
   rayons + raffinement local, déjà en partie présente) et écoulement/réseau simplifié,
   confrontés aux cas de référence publiés (§12.6 — liste à obtenir de l'ingénieur).
7. **Phase 7** : radier sur ressorts itératifs (§6.6, boucle décrite dans le CDC, réutilise le
   solveur de plaque à mutualiser avec la brique matricielle), export vers les modules
   structuraux (format d'échange à définir avec Aedificium/Structura).

## Wiring restant (hors code de calcul)

- README.md, LICENSE — à écrire avant toute publication.
- Décision de visibilité : rester privé tant que la phase 4 n'est pas validée (outil à
  responsabilité réglementaire, cf. §13 du CDC). Repasser en public + GitHub Pages, à
  l'anonyme `henri421` comme le reste de la suite, une fois mûr.
- Une fois public : ajouter l'entrée dans `Structura/index.html` (hub WebAedificium).
