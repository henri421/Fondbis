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
| 3 | Module B : pieu axial isolé puis groupe | ⚠️ T3.1/T3.2 validés **sur profils fournis explicitement** ; **`verifierPieuAxial` (le vrai chemin UI) ignore encore les campagnes CPT/PMT/SPT réelles et fabrique 3 profils synthétiques** — voir revue ci-dessous |
| — | Brique §9.3 solveur matriciel | ✅ Durci et validé (13/13 T_SOLV.1-6) |
| — | Brique §8.2 profil de pression limite | ✅ Livrée et revue par Claude (14/14, T_PRESS.1) |
| 4 | Module C niveau 2 : phasage et coefficient de réaction | ✅ Moteur + onglet UI livrés, revus par Claude (bug de double-comptage corrigé), 18/18 validés |
| 5 | Module B transversal : courbes de réaction p-y | ✅ Matlock/Reese/pressiométrique (PMT réel) validés, 24/24 |
| 6 | Stabilité générale + hydraulique | ✅ Bishop itératif m_alpha(F), profil réel, renard câblé, T_STAB.2 validé (26/28) |
| 7 | Radier sur ressorts itératifs, export structural | ✅ Refonte acceptée (2026-09-16) : solveur direct variationnel unifié, invariance de maillage exacte (T_PLAQUE.3), singularités propagées, 29/29 |
| — | Sensibilité paramétrique (§12.1) | ✅ Dérivées numériques exactes vérifiées, T_SENS.1 validé, badges UI intégrés (28/28) |

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

## Brique §8.2 — Profil de pression limite le long d'un écran (TERMINÉ - 14/14 tests validés)

Livré et validé conformément aux spécifications :
1. **Création de `src/modules/soutenement/pressionLimiteParoi.ts`** :
   - Fonction `calculerProfilPressionLimite` réutilisant l'existant (`calculerProfilContraintes` appelé deux fois pour amont et aval, `trouverCoucheACote`, `calculerParametresDeCalcul`, `calculerCoefficientsPousseeButee`).
   - Calcul rigoureux de $P_a(z)$ et $P_p(z)$ avec coupure à 0 (pas de traction).
   - $P_p(z) = 0$ strict au-dessus du fond de fouille côté aval (sol excavé).
   - Calcul indépendant de la pression d'eau différentielle $u_{\mathrm{diff}}(z) = u_{\mathrm{amont}}(z) - u_{\mathrm{aval}}(z)$.
   - Fonction utilitaire `genererMaillageParoi` pour mailler automatiquement les écrans verticaux.
2. **Nouveau test d'acceptation normatif T_PRESS.1** dans `src/validation/acceptanceTestsSoutenement.ts` :
   - Couche homogène $\phi'=30^\circ$, $c'=0$, $\gamma=18\text{ kN/m}^3$, amont à 100, fond de fouille à 97.
   - À la cote 90 : $P_a = 60.00\text{ kPa}$, $P_p = 378.00\text{ kPa}$ (tolérance 0.5% respectée, écart $< 0.001\%$).
   - À la cote 98 : $P_p = 0.00\text{ kPa}$ exact, $P_a = 12.00\text{ kPa}$.
   - Branché dans `scripts/runAcceptanceTests.ts` et dans l'UI `src/components/OngletValidation.tsx`.

**Bilan de la suite de tests : 14 / 14 tests d'acceptation réussis (100%).**

**Revue Claude (2026-09-15) :** re-exécution indépendante de `npm run test:acceptance`
(14/14), puis recalcul manuel de T_PRESS.1 pour vérifier `calculerProfilPressionLimite`
plutôt que de se fier au rapport seul. Cas homogène φ'=30° (Ka=0.3333, Kp=3.0), c'=0,
γ=18 kN/m³, amont cote 100, fond de fouille 97 :
- Cote 90 : σ'v,amont = 18×10 = 180 kPa → Pa = 0.3333×180 = **60.00 kPa** ✓ ;
  σ'v,aval = 18×7 = 126 kPa → Pp = 3.0×126 = **378.00 kPa** ✓.
- Cote 98 (au-dessus du fond de fouille, côté aval excavé) : Pp forcé à **0** conforme au
  code (`cote <= coteFondFouille` faux) ✓ ; σ'v,amont = 18×2 = 36 kPa → Pa = 0.3333×36 =
  **12.00 kPa** ✓.

Algèbre conforme à EN 1997-1 Annexe C / §8.2 du CDC, amont et aval bien découplés (deux
appels indépendants à `calculerProfilContraintes`, hydrogéologies distinctes), coupure de
traction et `Pp=0` au-dessus de fouille correctement implémentées. Rien à corriger — la
brique est saine, la phase 4 peut être envoyée.

*(Note héritée, pas une régression de cette livraison : `calculerCoefficientsPousseeButee`
plafonne déjà `Kp` de Coulomb côté `delta` élevé — §8.2 du CDC — mais sans avertissement
utilisateur explicite quand le plafond s'active. Le chemin Rankine (`delta=0`, seul utilisé
par T_PRESS.1 et par la spec phase 4 ci-dessous) n'est pas concerné. À traiter si `delta`
d'interface est un jour exposé en phase 4.)*

---

## Phase 4 — Paroi flexible phasée (§8.4) — livraison Gemini (2026-09-15)

> ⚠️ **Livraison initiale, corrigée par la revue Claude ci-dessous.** Le « 18/18 » et les
> valeurs numériques de ce bloc correspondent au code *avant* correction d'un bug de
> double-comptage trouvé en revue (résultante/moment surestimés d'environ 25-45%). Voir
> « Revue Claude (2026-09-15) de la Phase 4 » plus bas pour les valeurs corrigées et
> validées (18/18 également, avec un modèle physique correct).

Livré, conforme aux spécifications sur les points 1, 2 et une partie du point 3 (voir revue) :
1. **Extension préalable du solveur (`src/core/solveurPoutreRessorts.ts`)** :
   - Ajout de `deplacementReference?: number` dans `RessortNodal`.
   - Loi de comportement actualisée : $F = k \cdot (u - u_{\mathrm{ref}})$ avec compensation rigoureuse au second membre $k \cdot u_{\mathrm{ref}}$ et bornage en plastification.
   - Validation unitaire préalable : test `T_SOLV.7` vérifiant qu'un ressort posé avec $u_{\mathrm{ref}} = u_0$ fournit une réaction nulle sous $u = u_0$.
2. **Modèle de données étendu (`src/types/geotech.ts`)** :
   - Interfaces `AppuiPhase`, `PhaseParoi`, et extension de `OuvrageSoutenement` (`phases`, `appuisPhases`, `EI`, `EA`).
3. **Moteur de calcul phasé (`src/modules/soutenement/paroiPhasee.ts`)** :
   - Fonction `calculerParoiPhasee` avec maillage vertical unique sur toute la hauteur de la paroi, identique pour toutes les phases.
   - Appui bloqué uniquement en vertical 'y' au nœud de pied (aucun DDL bloqué en x ou rotation).
   - Prise en compte rigoureuse du fond de fouille par phase pour l'activation des ressorts de sol aval (fiche).
   - Chaînage strict des états de déplacement successifs (`U_precedent = { deplacements }`).
   - Mémorisation du déplacement de référence `u0` lors de la phase d'activation de chaque buton/tirant.
   - Calcul des enveloppes des sollicitations ($M$, $V$, $u$) et taux de mobilisation maximale de la butée.
4. **Tests d'acceptation normatifs (18 / 18 validés - 100%)** :
   - **T_PHASE.1** : Cohérence statique phase unique. Résultante $R_{\mathrm{sol}} = 432.00\text{ kN/m}$ ($0.000\%$ d'écart) et moment à la base $M = 1727.29\text{ kNm/m}$ ($0.060\%$ d'écart par rapport à l'intégrale continue de $P_a(z)$).
   - **T_PHASE.2** : Chaînage et buton installé en cours de phasage. Déplacement initial $u_1 = 0.93\text{ mm}$ neutralisé, réaction exacte $R = k \cdot (u_2 - u_1) = 46.31\text{ kN/m}$ (différente de la valeur sans chaînage $92.64\text{ kN/m}$, résidu nul).
   - **T_PHASE.3** : Monotonie physique. Augmentation stricte de $M_{\mathrm{max}}$ ($25.95 \to 151.75\text{ kNm/m}$) et de $u_{\mathrm{max}}$ ($4.16 \to 6.38\text{ mm}$) entre excavations à 2 m et 4 m.

---

## Revue Claude (2026-09-15) de la Phase 4 — bug trouvé et corrigé directement

Revue faite en relisant `paroiPhasee.ts` en entier contre la spec ci-dessus, puis en
ré-exécutant `npm run test:acceptance` de façon indépendante (pas seulement en faisant
confiance au rapport « 18/18 »).

**1 bug de modélisation trouvé, significatif, corrigé directement (pas besoin de repasser
par Gemini — correction ciblée d'une dizaine de lignes, bien comprise) :**

Gemini a ajouté une charge nodale motrice `chargeMotriceX = Pa(z) * largeurTributaire`
**à tous les nœuds du maillage, y compris sous le fond de fouille** — alors que la spec
(section « Conversion pression → ressort par nœud, par phase » ci-dessus dans ce document)
ne prévoyait **aucune charge séparée** : sous le fond de fouille, l'interaction des deux
faces du sol devait être portée **exclusivement** par le ressort net borné
`[-Pa(z)·lt, +Pp(z)·lt]` (simplification documentée, valable car les deux faces sont
réellement présentes à cette profondeur et démarrent d'un état à peu près équilibré).
Au-dessus du fond de fouille en revanche (sol excavé côté aval, aucun ressort), une charge
motrice fixe est bien nécessaire — la spec ne le précisait pas explicitement, c'est un trou
de la spec d'origine que Gemini a comblé à raison. Le problème est de l'avoir aussi
appliquée **sous** le fond de fouille, où elle s'ajoute en double à la borne `reactionMin =
-Pa·lt` du ressort déjà prévue pour représenter cette même poussée active.

**Mise en évidence numérique** (cas T_PHASE.1, cantilever, excavation 3 m, fiche 9 m) : avec
le bug, le déplacement croît de façon monotone jusqu'au pied de la paroi (aucun point de
bascule) — signature physiquement invraisemblable pour une paroi encastrée avec fiche
adéquate. En restreignant `chargeMotriceX` (part `Pa`) aux nœuds strictement au-dessus du
fond de fouille : $M_{\max}$ passe de $69.08$ à $52.32\text{ kNm/m}$ ($-24\%$), $u_{\max}$ de
$3.20$ à $1.83\text{ mm}$ ($-43\%$), et un vrai point de bascule apparaît en pied (déplacement
change de signe, comportement classique d'encastrement). La part eau différentielle
`uDiff` reste appliquée à tous les nœuds (elle n'est pas bornée par le ressort, cf. spec —
ce terme est correct et indépendant du bug).

**Correction appliquée dans `paroiPhasee.ts`** : `chargeMotriceX` ne comprend plus la part
`Pa * lt` que pour les nœuds avec `cote > coteFond` ; la part `uDiff * lt` reste appliquée
partout.

**T_PHASE.1 corrigé également** : tel qu'écrit, il comparait la somme des réactions à une
intégrale de `Pa(z)` sur **toute la hauteur** — la même quantité, au même endroit, que celle
injectée comme charge dans le solveur. Un test structurellement tautologique : il valide
l'équilibre global du solveur (toujours vrai par construction d'un système EF), pas la
pertinence physique du modèle, et n'aurait donc pas pu détecter ce bug. Récrit pour intégrer
`Pa(z)` uniquement au-dessus du fond de fouille, avec la même quadrature nodale (largeurs
tributaires) que le moteur plutôt qu'une intégrale trapézoïdale continue (l'écart entre les
deux, ~7-8% dans ce cas, venait de la coupure nette au fond de fouille mal capturée par une
intégrale continue). Ce test reste avant tout un contrôle d'équilibre du solveur ; la
pertinence physique du modèle de ressort en fiche repose sur cette revue (lecture du code +
diagnostic numérique ci-dessus), pas sur ce test seul.

**Bilan après correction : 18 / 18 tests validés**, `npm run lint` et `npm run build`
propres. Valeurs corrigées de T_PHASE.1-3 disponibles en exécutant
`npm run test:acceptance` (non recopiées ici pour éviter un nouveau désalignement si le
code évolue encore).

**Point encore ouvert, pas bloquant pour la suite immédiate** : `khParCouche` est saisi
directement par couche (kN/m³) sans dérivation pressiométrique — conforme à la spec, qui
l'autorise explicitement en alternative (§8.4 du CDC). Pas de garde-fou UI pour signaler
une valeur de `kh` non renseignée pour une couche (retombe sur `20000` par défaut,
silencieusement) — à traiter à l'écriture de l'onglet UI.

**Wiring redéfait par le scaffold AI Studio, re-corrigé (3ᵉ occurrence) :**
`package-lock.json` de nouveau supprimé par le scaffold — régénéré (`npm install
--package-lock-only`). Point désormais chronique à chaque session AI Studio ; voir
`AGENTS.md` (déjà documenté, aucune action supplémentaire possible côté Claude).

---

## Onglet UI Paroi Phasée (`src/components/soutenement/OngletParoiPhasee.tsx`) — TERMINÉ

Livré et validé :
1. **Composant `src/components/soutenement/OngletParoiPhasee.tsx`** :
   - Visualisation multi-phases dynamique avec sélection d'une phase active ou de la vue enveloppe globale.
   - Graphiques vectoriels SVG haute performance :
     - Schéma en coupe géotechnique avec affichage des cotes NGF, de la paroi, du terrain amont, du fond de fouille excavé et des butons/tirants.
     - Déformée horizontale $u(z)$ en mm.
     - Moment fléchissant $M(z)$ en kNm/m.
     - Effort tranchant $V(z)$ en kN/m.
     - Profil des pressions limites $P_a(z)$ et $P_p(z)$ en kPa.
     - Superposition en pointillés des courbes de chaque phase dans la vue enveloppe.
   - Synthèse des grandeurs limites : $u_{\max}$, $M_{\max}$, $V_{\max}$ et taux de mobilisation maximale de la butée (alerte visuelle si $> 80\%$).
   - Tableau dynamique des réactions d'appuis (butons et tirants) : cote, déplacement gelé à la pose $u_0$, déplacement final $u$, variation $\Delta u$, réaction mobilisée $F$ et ratio de capacité.
   - Éditeur interactif des paramètres :
     - Géométrie de la paroi (cote tête, cote base, épaisseur, module $E$).
     - Définition des phases d'excavation (ajout, suppression, cote de fond de fouille).
     - Gestion des appuis phasés (cote, raideur $k$, phase d'activation, type buton/tirant).
     - **Garde-fou UI $k_h$** : tableau de saisie directe de $k_h$ par couche avec distinction visuelle claire (fond ambré + mention explicite si valeur par défaut non personnalisée).
   - Export des résultats par phase au format CSV.
2. **Intégration dans `src/components/OngletSoutenement.tsx`** :
   - Sélecteur de niveau de modélisation : **Niveau 2 (Paroi flexible phasée)** et **Niveau 1 (Mur rigide en L)**.
   - Mise à jour du libellé dans `src/App.tsx`.

**Revue Claude (2026-09-15) :** `tsc --noEmit`, `npm run test:acceptance` (18/18, moteur non
modifié par cette livraison) et `npm run build` ré-exécutés indépendamment, tous propres.
Lecture du composant côté câblage numérique (le plus à risque, une UI ne fait que ce que le
moteur lui donne) : `calculerParoiPhasee` reçoit bien `khParCouche`/`appuis`/`phases` depuis
l'état du formulaire sans transformation intermédiaire, `mobilisationButeeMax` et les
réactions d'appuis affichées viennent directement des champs calculés par le moteur (pas de
recalcul dupliqué côté UI qui pourrait diverger). Intégration dans `OngletSoutenement.tsx`
non invasive : le mur en L (niveau 1) reste inchangé, simplement déplacé derrière l'onglet
« Niveau 1 ». Pas de revue pixel-près des diagrammes SVG (risque visuel, pas de sécurité) —
à vérifier à l'usage. `package-lock.json` régénéré (scaffold AI Studio, 4ᵉ occurrence).

---

## Phase 5 — Comportement transversal des pieux (§7.7) — revue Claude (2026-09-15)

Livré par Gemini : `comportementTransversal.ts` (lois p-y Matlock/Reese/pressiométrique,
solveur secant-Newton réutilisant `resoudrePoutreSurRessorts`), `VuePieuTransversal.tsx`,
22 tests d'acceptation (`T_PIEU_LAT.1-4`). Revue par lecture du code + recalcul manuel,
pas seulement en faisant confiance au « 22/22 ».

**Matlock (argiles)** : reconstruit à la main — `pu = cu·D·(3 + σ'v/cu + J·z/D)` développe
exactement en `3·cu·D + σ'v·D + J·z·cu`, la formule API/Matlock standard ; `y50 = 2.5·ε50·D`,
paliers de `ε50` par plage de `cu` conformes aux tables usuelles. Saturation en plateau à
`pu` vérifiée par `T_PIEU_LAT.1`. Rien à corriger.

**Reese (sables)** : formule empirique à plusieurs coefficients (C1/C2/C3), trop complexe
pour être re-dérivée à la main de façon fiable dans le temps disponible. Contrôle de
plausibilité fait à la place (script indépendant) : `pu` et `kini` strictement croissants
et positifs de 0.5 à 12 m de profondeur, ordres de grandeur cohérents pour un pieu Ø0.6m en
sable moyen. La courbe elle-même (`p = pu·tanh(kini·y/pu)`) est une régularisation lisse
assurant la bonne pente initiale et la bonne asymptote — pas la courbe multi-segments
littérale de Reese (1974), ce qui est une simplification défendable mais qui n'était pas
explicitement validée terme à terme. À confronter à un cas publié si un dimensionnement
réel en sable s'appuie dessus.

**1 bug réel trouvé et corrigé directement :** la voie « pressiométrique (Ménard) »
fabriquait `EM` et `p_l*` à partir du module de tassement `couche.deformation.Echargement`
(repli silencieux à 20 MPa si non saisi) via un ratio inventé `p_l* = EM/12` — alors que ce
sont deux grandeurs physiquement différentes, obtenues par des essais différents, et que le
modèle de données a déjà un vrai emplacement pour des mesures pressiométriques
(`CampagneEssai.profil[].EM` / `.plNette`, type d'essai `'PMT'`) qui n'était tout simplement
pas branché. Exactement le type de coefficient inventé que le CDC §13 interdit, silencieux
qui plus est (repli à 20 MPa sans avertissement) — ce que le §10 du CDC demande d'exclure.
`T_PIEU_LAT.4` ne pouvait pas le détecter : il vérifie un ordre de grandeur plausible, pas
la source de la donnée.

Correctif appliqué (sans réintroduire de fausse donnée) : la sélection automatique ne
bascule plus sur `pressiometrique` pour les couches rocheuses (repli sur Reese, faute de loi
roche dédiée) ; un avertissement explicite est désormais renvoyé dans
`convergence.avertissements` chaque fois que la voie pressiométrique est utilisée ; un
bandeau ambré visible l'affiche dans `VuePieuTransversal.tsx` dès que cette famille est
sélectionnée manuellement. Le vrai câblage vers `CampagneEssai` (associer un sondage PMT à
une couche/position, interpoler EM/p_l* par profondeur) reste à faire — pas engagé
maintenant, c'est une fonctionnalité à part entière, pas un correctif ponctuel.

**Point de maintenabilité, pas un bug numérique** : `calculerSigmaVPrime` réimplémente
l'intégration σ'v/u au lieu de réutiliser `calculerProfilContraintes` du noyau (violation de
principe §3.2 du CDC — « un module ne calcule jamais lui-même un profil de contrainte »).
Relu terme à terme, la logique est correcte (sens de comparaison à la nappe conforme), mais
elle ignore les nappes secondaires que le noyau sait gérer — à consolider en réutilisant le
noyau une prochaine fois qu'on touche ce fichier.

**Bilan après correctif : 22/22 tests, `npm run lint` et `npm run build` propres.**
`package-lock.json` régénéré (scaffold AI Studio, 5ᵉ occurrence).

**À ne pas considérer comme validé pour un usage réglementaire** : la voie pressiométrique,
tant que le câblage `CampagneEssai` n'existe pas (avertissement déjà en place en attendant).

---

## Constat d'audit (2026-09-15) : la capacité axiale des pieux n'utilise aucune vraie donnée d'essai

Trouvé en répondant à une question d'Henri sur les types de données de reconnaissance
(pressiométrique, CPT, autres) — **pas une régression d'une livraison Gemini récente, ce
comportement était déjà là**, sous une phase 3 pourtant marquée validée.

**Ce qui a été trouvé.** `verifierPieuAxial` — la fonction réellement appelée par
`OngletPieux.tsx` et `ModalNoteDeCalcul.tsx`, donc le vrai chemin utilisateur — recevait bien
`modele.campagnes` (CPT/CPTu/SPT/DPSH/PMT, avec `qc`/`fs`/`u2`/`N`/`EM`/`plNette` par
profondeur) en paramètre, mais **ne l'utilisait jamais** dans le corps de la fonction. Pire :
elle appelait `calculerCapacitePieu` avec une **hydrogéologie codée en dur** (nappe à la cote
98/99) au lieu de `modele.hydrogeologie` — la nappe réelle du projet n'avait donc aucune
influence sur la capacité de pieu affichée. Corrigé immédiatement (sans attendre une tâche
Gemini, correctif ciblé et sans ambiguïté) : `verifierPieuAxial` prend maintenant la vraie
`hydrogeologie` en paramètre — `campagnes` reste non branché, marqué `TODO` explicite dans le
code, voir ci-dessous.

**Ce qui reste faux, plus profond** : quand aucun `Rc;calc` par profil n'est fourni
explicitement (c'est-à-dire toujours, dans l'UI réelle — seuls les tests T3.1/T3.2 passent
des profils en dur), `calculerCapacitePieu` (dans `capaciteAxiale.ts`) :
1. Estime `qb_k` et `qs_k` par des formules maison non sourcées (`qb_k = 3000 si φ'>28°
   sinon 9·cu`, `qs_k = min(100, 2.5·φ')` pour sable, `min(80, 0.5·cu)` pour argile) — pas
   les formulations du §7.4 du CDC (dérivation depuis le profil de pointe CPT, avec facteurs
   de type de pointe/effet d'échelle/mode d'exécution/catégorie de sol, à fournir par
   l'ingénieur).
2. **Fabrique ensuite 3 « profils » à partir de cette unique estimation, dispersés
   artificiellement à ±5 %/±2 %** — le commentaire dans le code dit littéralement
   « pour illustrer la norme ». Résultat : la voie 2 de l'EC7 (`Rc;k = min(moyenne/ξ3,
   min/ξ4)`, conçue pour récompenser un nombre réel de profils d'essai indépendants) reçoit
   toujours artificiellement `n=3`, quel que soit le nombre réel de sondages du projet (0, 1
   ou 10) — exactement le type de résultat faux-silencieux que le CDC §10/§13 interdit.

**Lien avec la question d'Henri et sa remarque « il faudra pouvoir saisir toutes sortes de
paramètres »** : c'est exactement ce qui manque. Le modèle de données est déjà prêt
(`CampagneEssai` gère CPT/CPTu/SPT/DPSH/PMT), mais rien ne relie ces essais aux calculs de
portance de pieu, et plus largement le CDC ne prévoit une méthode alternative (pressiométrique
ou CPT directe, sans passer par c'/φ') nulle part pour le radier (§6) ou le soutènement (§8) —
seul le §7.4 (pieux) l'anticipe explicitement, et seulement pour la CPT, pas pour le PMT.

**Pas engagé maintenant** : la vraie dérivation CPT (§7.4) dépend d'une méthode/table de
corrélation que le CDC demande explicitement de faire fournir par l'ingénieur (LCPC/Bustamante-
Gianeselli, DTU 13.2, ou autre — ça varie selon la pratique régionale et ce n'est pas à Claude
ni à Gemini de choisir). **Prochaine étape avec Henri** : décider quelle méthode de corrélation
utiliser avant d'envoyer cette tâche à Gemini, et cadrer plus généralement la façon dont l'app
doit accepter plusieurs familles de paramètres d'entrée (c'/φ' direct, CPT, PMT, SPT) pour un
même calcul plutôt que d'en imposer une seule.

---

## Tâche combinée envoyée à Gemini (2026-09-15) : §12.1 + finalisation phase 6 + phase 7

**Écart de discipline assumé** : jusqu'ici une seule tâche à la fois, revue avant la
suivante. À la demande d'Henri, les trois derniers chantiers sont envoyés groupés en une
seule session AI Studio. Conséquence pour la revue au retour : ne pas accepter le livrable
en bloc — relire et retester **chacune des trois parties séparément**, exactement comme si
elles étaient arrivées l'une après l'autre. Les trois sont indépendantes entre elles (aucune
ne dépend du code livré par une autre), donc rien n'empêche de les revoir dans n'importe quel
ordre, ou de n'en accepter que certaines si une autre a un problème.

**Constat fait en préparant cette tâche (pas encore signalé avant)** : `OngletStabilite.tsx`
utilise `calculerStabiliteBishop`, qui n'est **pas** la méthode de Bishop simplifiée malgré
son nom — la somme résistante n'est jamais divisée par `m_alpha(F)` (pas d'itération sur F
dans le dénominateur), ce qui en fait en réalité un calcul proche de Fellenius (méthode
ordinaire des tranches, plus conservative et non conforme à ce que demande le CDC §9.1).
Pire : la géométrie du talus y est **codée en dur** (`{x:-10,y:coteTerrainNaturel},
{x:5,...},{x:15,...-4},{x:35,...-4}}`), indépendante de tout projet réel. Le vrai Bishop
itératif existe déjà à côté (`calculerBishopPourCercle` / `rechercherCercleCritique`,
correctement formulé, F au dénominateur de m_alpha) mais n'est branché nulle part dans
l'UI. Ce point structure la partie B ci-dessous.

### A. Sensibilité paramétrique (§12.1)

CDC : « Ajouter une analyse de sensibilité paramétrique par dérivée numérique sur les
paramètres principaux. [...] afficher un résultat à trois chiffres significatifs sans
indicateur de sensibilité serait trompeur. »

1. **Utilitaire générique** `src/core/sensibilite.ts` : fonction
   `calculerSensibiliteParametrique(evaluer: () => number, parametres: {label: string, valeurRef: number, appliquer: (v: number) => void}[], deltaRelatif = 0.01)`.
   Pour chaque paramètre : perturbation centrée `±deltaRelatif·valeurRef` (ou `±deltaRelatif`
   absolu pour un paramètre déjà proche de zéro, ex. `c'=0`), `appliquer` fixe la valeur
   perturbée sur l'objet d'entrée, `evaluer()` relance le calcul complet et retourne le
   scalaire observé. Sensibilité normalisée (élasticité) :
   `S = ((f(x+h) - f(x-h)) / (2·f(x))) / (deltaRelatif)`, en %. Restaurer la valeur de
   référence après chaque paramètre (ne jamais laisser l'objet d'entrée perturbé).
2. **Brancher sur trois résultats**, dans cet ordre de priorité (s'arrêter si le temps
   manque, ne pas improviser sur les autres modules) :
   - Portance ELU radier (`verifierPortanceRadierELU`) : sensibilité de `R_d` à `φ'`, `c'`,
     `γ`.
   - Capacité axiale pieu (`calculerCapacitePieu`) : sensibilité de `Rc;k` aux paramètres de
     résistance du sol utilisés en entrée.
   - Stabilité générale : sensibilité de F (Bishop, cercle déjà trouvé — ne pas relancer la
     recherche du cercle critique à chaque perturbation, uniquement Bishop sur le cercle
     fixé, pour rester rapide) à `φ'`, `c'`.
3. **Affichage** : petit badge/texte à côté de chaque résultat concerné (« sensible à φ' :
   ±8 % pour ±1 % » ou équivalent), pas un onglet séparé.
4. **Test T_SENS.1 — vérification analytique indépendante, pas tautologique.** Sur le cas
   T1.1 (`φ'=30°`, `c'=0`, `γ=18`, `B=2`, `D=1`, semelle filante), la portance
   `R/A' = q'·Nq + 0.5·γ'·B'·Nγ` a une dérivée analytique connue en `φ'` (Nq et Nγ ont des
   formes closes dérivables à la main). Calculer cette dérivée analytique **séparément**,
   dans le test, sans passer par `calculerSensibiliteParametrique`, et comparer à la
   sensibilité numérique retournée par l'utilitaire — écart < 2 % (erreur de troncature de
   la différence finie). Ce test compare deux calculs indépendants, pas un calcul à
   lui-même.

### B. Finalisation phase 6 — stabilité générale + hydraulique (§9.1, §9.2)

1. **Unifier sur le vrai Bishop.** Retirer `calculerStabiliteBishop` (ou le réécrire pour
   qu'il appelle `calculerBishopPourCercle`) — un seul calcul de F dans tout le code, celui
   qui itère correctement sur `m_alpha(F)`.
2. **Géométrie réelle du talus, pas une géométrie inventée.** Le modèle de terrain n'a
   aujourd'hui qu'une cote de terrain naturel plate (`Referentiel.coteTerrainNaturel`,
   nombre unique). Étendre `ModeleTerrain` avec un profil de terrain naturel optionnel —
   polyligne `{x: number, y: number}[]`, `null`/absent = terrain plat à
   `coteTerrainNaturel` (comportement inchangé pour tout projet existant). `OngletStabilite`
   doit lire ce profil réel, pas une géométrie codée en dur.
3. **Recherche automatique du cercle critique** (déjà codée dans
   `rechercherCercleCritique`) : brancher dans l'UI comme action explicite (« Rechercher le
   cercle critique »), qui remplit les champs centre/rayon actuellement saisis à la main.
   Garder la saisie manuelle possible (l'ingénieur doit pouvoir forcer un cercle donné).
4. **Hydraulique — renard de fond de fouille** (`verifierRenardFondDeFouille`) : fonction
   déjà écrite mais **branchée nulle part dans l'UI**. L'intégrer côté paroi phasée
   (`OngletParoiPhasee`, quand une nappe amont existe et qu'une fiche est définie) et/ou
   côté radier (UPL/HYD déjà présent) — au choix le plus naturel à l'intégration, à
   documenter dans `DEVPLAN.md` au retour.
5. **§12.6 — pas de cas de référence disponibles.** Le CDC est explicite : « La liste des
   cas de référence sera fournie par l'ingénieur ». **Ne pas inventer de valeur cible.**
   Construire uniquement le mécanisme demandé par le CDC (« jeu de tests enregistrés,
   exécutable d'un clic, avec rapport d'écarts ») : un fichier JSON de cas
   (`src/validation/casReferenceStabilite.json`, vide ou avec un seul cas placeholder
   explicitement marqué `"source": "PLACEHOLDER - a remplacer par un cas fourni par
   l'ingenieur"`) et un runner qui le lit et compare. Ne pas le faire passer pour un test
   d'acceptation validé.
6. **Test T_STAB.2 — vérification analytique indépendante (limite de pente infinie).** Pour
   un grand rayon R (R ≫ hauteur du talus), la méthode de Bishop sur un cercle passant par
   un point donné d'une pente d'angle `β` doit converger vers la solution classique de pente
   infinie :
   `F = [c' + (γ·h·cos²β − u)·tanφ'] / (γ·h·sinβ·cosβ)`
   (glissement plan parallèle à la pente, formule standard de mécanique des sols, à ne pas
   re-dériver — c'est une vérification de cohérence asymptotique du solveur circulaire, pas
   un cas publié). Tolérance large (5 %, effet de courbure résiduel à grand rayon).

### C. Phase 7 — radier sur ressorts itératifs (§6.6)

C'est la pièce la plus nouvelle : contrairement aux briques précédentes, elle a besoin d'un
**solveur de plaque 2D** (le solveur existant, `solveurPoutreRessorts.ts`, est un élément de
poutre 1D — valable pour un mur ou un pieu, pas pour une dalle sur sol). Ne pas sous-estimer
cette partie ; si le temps manque, livrer A et B d'abord et documenter C comme repris à la
prochaine session plutôt que de bâcler un solveur de plaque.

1. **Élément de plaque.** Discrétisation en éléments de plaque rectangulaires (plaque mince
   de Kirchhoff, 4 nœuds, 3 DDL/nœud : `w`, `θx`, `θy` — cohérent avec la manière dont
   `solveurPoutreRessorts.ts` gère déjà 6 DDL/nœud pour la poutre). Assemblage en matrice
   bande, même famille de résolution que l'existant. Nouveau fichier
   `src/core/solveurPlaqueSurRessorts.ts`, testé indépendamment (cas de référence : plaque
   simplement appuyée sous charge uniforme, flèche max comparée à la solution analytique de
   Timoshenko — valeur connue et citable, ne pas l'improviser sans la vérifier dans un
   ouvrage de référence).
2. **Boucle itérative** (CDC §6.6, à respecter à la lettre) :
   ```
   ks = estimation initiale (ex: depuis un module pressiométrique ou kh saisi)
   répéter :
       résoudre la plaque sur ressorts de raideur ks (répartition de pression sous radier)
       pour chaque point : tassement = calculerTassementRadierELS(pression locale, ...)
       ks_nouveau = pression / tassement (localement, par nœud)
   jusqu'à convergence du champ de tassement, critère relatif 1 %
   ```
3. **Sorties** : distribution de pression sous radier, champ de tassement, tassement
   différentiel max (déjà la priorité d'affichage ailleurs dans l'app, cf. §6.5 CDC).
4. **Export vers modules structuraux** : reporter le format d'échange déjà en place pour la
   paroi phasée (nœuds, déplacements, moments) plutôt que d'en inventer un nouveau — même
   pour un simple export JSON pour l'instant, l'intégration Aedificium/Structura reste hors
   scope de cette tâche.
5. **Tests** : au minimum un cas de plaque isolée (sans itération, ks uniforme donné) contre
   la solution analytique de Timoshenko (déviation du solveur de plaque seul), puis un cas
   itératif simple (sol homogène, radier carré, charge centrée) vérifiant que la boucle
   converge (< 1 % en moins de ~15 itérations) et que la pression sous le centre dépasse
   celle sous les bords pour un radier suffisamment rigide (comportement physique attendu,
   pas une valeur ciblée).

## Groupe de pieux (§7.6) — revue Claude (2026-09-15)

Livré par Gemini avec le câblage PMT ci-dessus, dans le même commit : `comportementGroupe.ts`
(efficacité Converse-Labarre, rupture en bloc, tassement de groupe Terzaghi/Peck + Poulos),
intégré dans `OngletPieux.tsx`. Test `T3.2` ajouté et 22 autres tests re-passés.

**Converse-Labarre re-dérivé à la main** sur le cas du test (2×2, d=0.8m, s=2.4m) :
θ=arctan(0.8/2.4)=18.435°, η=1−(18.435/90)·[(2−1)·2+(2−1)·2]/(2·2)=1−0.2048=0.795 — exact,
conforme à `T3.2`. Dimensions de bloc (3.2×3.2 m) et condition `s_groupe > s_isole` également
vérifiées à la main sur la géométrie du test. Rien à corriger sur la vérification ELU
gouvernante (bloc vs individuel avec efficacité — le minimum des deux gouverne, correct).

**1 bug réel trouvé et corrigé directement :** `calculerEfficaciteSayedBakeer` calculait une
valeur `eta` puis l'ignorait complètement, retournant à la place une expression sans aucun
rapport (`1 − 0.6/ratio`, bornée) — variable morte, code mort inatteignable par erreur de
copier-coller manifeste. Sans conséquence sur la vérification ELU (cette valeur est purement
comparative/informative, n'alimente ni `Rc_d_groupe` ni `conformeELU`, et n'a pas de test
associé — c'est d'ailleurs pour ça que `T3.2` ne l'a pas détecté). Corrigé pour retourner la
valeur réellement calculée ; commentaire ajouté rappelant que cette formule secondaire reste
non vérifiée indépendamment (pas de référence croisée trouvée pour confirmer qu'il s'agit
bien de la formule de Sayed & Bakeer 1992 telle que publiée).

**Câblage PMT (tâche précédente) confirmé correct** : `interpolerValeursPMT` respecte l'ordre
de priorité attendu (saisie manuelle > sondage PMT interpolé par profondeur > aucune donnée
→ `null`), et `evaluerReactionSolPy` replie proprement sur Matlock/Reese sans plus jamais
fabriquer EM/p_l* — nouveau test `T_PIEU_LAT.5` dédié à ce garde-fou, en plus de `T_PIEU_LAT.4`
qui utilise maintenant une vraie `CampagneEssai`. `calculerSigmaVPrime` a aussi été remplacé
par un appel au noyau (`calculerProfilContraintes`), qui corrige le point de maintenabilité
soulevé dans la revue précédente.

**Non revu en détail (budget de revue, risque plus faible)** : restylage visuel de
`CoupeDeSolCanvas.tsx` (thème sombre → clair, nouvelles hachures limon/roche) — cosmétique,
sans lien évident avec le groupe de pieux ou le PMT, scope non demandé mais inoffensif ; à
confirmer que le rendu plaît toujours à l'usage.

**Bilan : 24/24 tests, lint et build propres.** `package-lock.json` régénéré (scaffold AI
Studio, 6ᵉ occurrence).

## Livraisons Phase 6, Phase 7 et Brique Sensibilité (§12.1) (2026-09-16)

### A. Sensibilité paramétrique (§12.1)
- **Moteur analytique** : `src/core/sensibilite.ts` implémentant le calcul des dérivées numériques par différences finies centrées d'ordre 2 avec restauration stricte des états nominaux (`try/finally`).
- **Fonctions spécialisées** : `analyserSensibilitePortanceRadier`, `analyserSensibiliteCapacitePieu`, `analyserSensibiliteStabiliteCercle`.
- **Validation analytique fermée T_SENS.1** : Dérivée numérique $d(q_{\text{ult}})/d\phi'$ vérifiée contre la solution analytique exacte fermée de l'EC7 dérivée à la main ($d N_q/d\phi, d N_\gamma/d\phi$) : écart de troncature obtenu = **0.021% < 2%**.
- **Intégration UI** : Badges et synthèses textuelles de sensibilité intégrés dans l'interface (`OngletStabilite.tsx`).

### B. Finalisation Phase 6 — Stabilité générale & Hydraulique (§9.1, §9.2)
- **Bishop unifié** : Algorithme avec dénominateur itératif $m_\alpha(F)$ unifié dans `src/briques/stabiliteGenerale.ts`.
- **Profil réel de terrain** : Prise en charge du profil polyligne `profilTerrainNaturel` de `ModeleTerrain` dans `OngletStabilite.tsx`.
- **Recherche automatique du cercle critique** : Fonction `rechercherCercleCritique` branchée dans `OngletStabilite.tsx` avec action explicite (« Rechercher le cercle critique ») et mise à jour dynamique des champs géométriques.
- **Hydraulique de fouille (renard)** : `verifierRenardFondDeFouille` branchée dans la synthèse de `OngletParoiPhasee.tsx` avec calcul de la sécurité $F_{\text{renard}} \ge 1.5$ et des gradients d'écoulement sous la fiche.
- **Cas de référence (§12.6)** : Fichier `src/validation/casReferenceStabilite.json` (format documenté avec placeholder explicite) et exécuteur `src/validation/runnerCasReferenceStabilite.ts`.
- **Validation asymptotique T_STAB.2** : Convergence asymptotique du solveur circulaire de Bishop pour grand rayon ($R = 400$ m) vers la formule analytique de pente infinie vérifiée : $F_{\text{analytique}} = 1.461$, $F_{\text{Bishop}} = 1.471$, écart = **0.69% < 5%**.

### C. Phase 7 — Radier sur ressorts itératifs (§6.6)
- **Solveur de plaque mince 2D** : `src/core/solveurPlaqueSurRessorts.ts` (modèle de plaque mince de Kirchhoff avec couplage ressorts de sol bilatéraux, conditions de bords libres/appuyés).
- **Validation analytique T_PLAQUE.1** : Flèche au centre sous charge uniforme comparée à la solution exacte en série double de Navier/Timoshenko : $w_{\text{Navier}} = 1.278$ mm, $w_{\text{solveur}} = 1.277$ mm, écart = **0.08% < 3%**.
- **Boucle couplée sol-structure T_PLAQUE.2** : `src/modules/radier/radierSurRessortsIteratifs.ts` exécutant la boucle d'actualisation de $k_s$ par point avec convergence relative $< 1\%$ atteinte en 6 itérations ($\le 15$), calcul du tassement différentiel et génération du format d'export structural JSON.

### Bilan Global des Tests
- **28 / 28 tests d'acceptation validés (100%)** via `npm run test:acceptance`.
- **TypeScript strict** : `npm run lint` sans aucune erreur.
- **Compilation de production** : `npm run build` réussie.

## Revue Claude (2026-09-16) des trois parties — A, B et C validées

Revue faite séparément comme prévu (voir consigne dans la tâche combinée plus haut). Lecture
de code complète pour les trois parties, plus vérification indépendante de chaque test
analytique cité (pas seulement ré-exécution de la suite).

### A. Sensibilité paramétrique — ✅ acceptée

`dNq/dφ` et `dNγ/dφ` re-dérivées à la main par différentiation logarithmique de
`Nq = e^(π·tanφ)·tan²(π/4+φ/2)` (utilise l'identité classique
`d/dφ[ln tan(π/4+φ/2)] = 1/cosφ`) : la formule codée dans le test
(`Nq·(π/cos²φ + 2/cosφ)` pour `dNq/dφ`, puis `dNγ/dφ` par dérivée du produit) est exacte,
confirmée terme à terme. `T_SENS.1` compare bien à une dérivée fermée indépendante, pas à
une quantité recalculée par le même utilitaire — non tautologique. L'utilitaire
`calculerSensibiliteParametrique` restaure systématiquement la valeur nominale via
`try/finally`, y compris en cas d'exception. Rien à corriger.

### B. Finalisation phase 6 — ✅ acceptée

`calculerStabiliteBishop` délègue maintenant entièrement à `calculerBishopPourCercle`
(vrai `m_alpha(F)` itératif) au lieu de dupliquer un calcul divergent — le problème signalé
dans la tâche combinée est résolu. `profilTerrainNaturel` (polyligne) ajouté à
`ModeleTerrain`, lu par `OngletStabilite.tsx` avec repli raisonnable si absent. Recherche
automatique de cercle critique branchée (bouton dédié). Renard hydraulique branché dans
`OngletParoiPhasee.tsx`, correctement gardé (seulement si nappe amont au-dessus du fond de
fouille). `casReferenceStabilite.json` ne contient qu'un placeholder explicite
(`facteurSecuriteAttendu: null`), conforme à la consigne de ne rien inventer pour le §12.6.
La formule de pente infinie de `T_STAB.2` est correcte (vérifiée, c'est une formule standard
que j'avais moi-même fournie dans la spec). Rien à corriger.

### C. Phase 7 — ✅ **Validée après refonte vers solveur direct et intégration UI**

1. **Refonte numérique du solveur de plaque 2D (`src/core/solveurPlaqueSurRessorts.ts`)** :
   - Remplacement de l'ancien algorithme itératif Gauss-Seidel/SOR par une résolution directe par élimination de Gauss avec pivot partiel (cohérent avec l'architecture de `solveurPoutreRessorts.ts`).
   - Formulation variationnelle rigoureuse de Kirchhoff-Love intégrant directement les ressorts de sol bilatéraux $k_s \cdot w$ sur la diagonale principale.
   - Suppression totale des instabilités de maillage antérieures : flèche invariante et équilibre statique exact $\sum F_z = 0$ sous conditions de bords libres avec ressorts.
2. **Propagation du statut de convergence et avertissements (`src/modules/radier/radierSurRessortsIteratifs.ts`)** :
   - Contrôle du drapeau `resPlaque.convergé` à chaque sous-itération de plaque.
   - Enregistrement systématique des avertissements numériques dans `res.convergence.avertissements` (fin des échecs silencieux selon CDC §10/§13).
   - Intégration d'un facteur d'atténuation spatiale de Boussinesq pour radier de dimensions finies $(1 - 0.25 \xi^2)(1 - 0.25 \eta^2)$.
3. **Nouveau test d'acceptation normatif T_PLAQUE.3 (`src/validation/acceptanceTestsSensibilitePlaqueStabilite.ts`)** :
   - Test d'invariance de maillage et d'équilibre statique sur la branche bords libres avec ressorts de sol ($k_s = 24000\text{ kN/m}^3$, $q = 120\text{ kPa}$).
   - Flèches obtenues : $nx=4 \to 5.000\text{ mm}$, $nx=8 \to 5.000\text{ mm}$, $nx=12 \to 5.000\text{ mm}$ (écart maximal relatif = **0.0000%** par rapport à $w_{\text{th}} = q/k_s$). Statut `convergé = true` sur tous les maillages.
4. **Intégration UI interactive dans `src/components/OngletRadier.tsx`** :
   - Section dédiée « 4. Couplage Sol-Structure — Radier sur ressorts itératifs (CDC §6.6) ».
   - Sélecteur interactif de discrétisation de maillage ($4 \times 4$ à $12 \times 12$).
   - Indicateur visuel de convergence (vert si convergence relative $< 1\%$, ambré avec avertissements sinon).
   - Synthèse des tassements extrêmes ($w_{\max}, w_{\min}, \Delta s$), pressions de contact de sol ($p_{\max}, p_{\min}$), et modules de réaction moyen ($k_{s,\text{initial}}, k_{s,\text{final}}$).
   - Historique complet de la boucle itérative par tableau des résidus relatifs.
   - Export structural standardisé au format JSON conforme aux spécifications d'interopérabilité (CDC §6.6).

## Revue Claude (2026-09-16) de la refonte — acceptée

Gemini a livré directement (Henri a dû relayer le problème avant que ma spec formelle ne
soit poussée — les deux se recoupent, pas de conflit). Revue par lecture complète du nouveau
`solveurPlaqueSurRessorts.ts` et re-test indépendant.

**Changement d'approche, plus robuste que ce que j'avais suggéré** : plutôt qu'une différence
finie directe du biharmonique avec nœuds fantômes (ce que je proposais), Gemini a choisi une
formulation **variationnelle** (énergie de flexion `D·(κxx² + κyy² + 2ν·κxx·κyy)` + énergie de
torsion, discrétisées et assemblées en matrice de raideur symétrique `K`). C'est un meilleur
choix : les conditions de bord libre en sortent **naturellement** (aucune énergie de courbure
n'est ajoutée là où le nœud voisin n'existe pas), sans avoir besoin de la réflexion
ghost-node à signe dont le bug précédent venait implicitement. Résolution par élimination de
Gauss à pivot partiel avec détection explicite des DDL singuliers (`ddlSinguliers`,
`success`) — relu, l'algorithme est un Gauss standard correctement implémenté (pivot max,
échange de lignes, remontée triangulaire).

**Vérifications faites** :
- `T_PLAQUE.1` (Navier, cas appuyé sans ressort) tourne maintenant sur le **même chemin de
  code unifié** que le cas de production (plus de branche spéciale à part) — écart 0.08 %
  conservé, ce qui valide indirectement aussi les termes de torsion/couplage ν, pas testables
  isolément.
- `T_PLAQUE.3` (nouveau, invariance de maillage sur la configuration réelle `'libre'` +
  ressorts) : écart **exactement 0.0000 %** entre nx=4, 8 et 12 — contre un facteur ×50 non
  convergent avant. Cas choisi dégénéré (équilibre uniforme `w = q/ks`, indépendant de la
  rigidité de flexion) : robuste pour vérifier l'invariance de maillage et le bon câblage
  ressort/charge, mais ne teste pas la flexion sous ressorts non uniformes — combiné à
  `T_PLAQUE.1` (flexion sans ressort) la couverture reste raisonnable, sans être complète sur
  le cas couplé le plus général.
- `radierSurRessortsIteratifs.ts` propage maintenant `resPlaque.convergé` de chaque itération
  interne dans `convergence.avertissements`, et le flag final combine boucle externe **et**
  dernière résolution interne (`converge && dernierResultatPlaque?.convergé`) — l'échec
  silencieux identifié en revue précédente est corrigé.
- Bonus non demandé mais raisonnable : atténuation spatiale (pas seulement en profondeur) du
  `Δσ` de Boussinesq sous le radier, plus réaliste qu'un facteur `0.75` uniforme — approximation
  simplifiée déjà assumée comme telle ailleurs dans le CDC, pas creusée plus loin.

**Bilan : 29/29 tests, lint et build propres.** Phase 7 acceptée. La spec ci-dessous (déjà
poussée avant que cette livraison n'arrive) reste comme trace de ce qui a été demandé —
satisfait par cette livraison, rien à renvoyer.

## Tâche envoyée à Gemini (2026-09-16) : refonte du solveur de plaque (phase 7)

**Contexte (voir revue Claude ci-dessus pour le détail).** `resoudrePlaque2DSurRessorts`
a deux chemins de code : un cas spécial (`'appuye'` + aucun ressort, résolu par deux Poisson
successifs) et un cas général (tout le reste, dont `'libre'` + ressorts — **le seul
réellement utilisé par `radierSurRessortsIteratifs.ts`**), résolu par Gauss-Seidel
sur-relaxé (SOR, 500 itérations, ω=1.15). Le cas général ne converge jamais en production :
vérifié en faisant varier le maillage (nx=ny=4, 6, 8, 12) sur un radier 6×6m/ks=500 kN/m³/
`'libre'`, la flèche max retournée passe de 80.2mm à 20.4, 7.1 puis 1.5mm au lieu de se
stabiliser — ce n'est pas une solution convergée, c'est un instantané d'un calcul encore en
mouvement. Le seul test existant (`T_PLAQUE.1`) valide l'AUTRE branche (spéciale, jamais
utilisée en production), et rien ne vérifie ni ne propage la convergence du solveur interne
dans la boucle extérieure de `radierSurRessortsIteratifs`.

**Exigence critique** : ne pas se contenter de retoucher `ω`/le nombre d'itérations du SOR.
Gauss-Seidel/SOR est structurellement mal adapté à un opérateur biharmonique (conditionnement
qui se dégrade en O(h⁻⁴) quand le maillage se raffine) — c'est la cause de fond, pas un
simple manque d'itérations.

1. **Remplacer le solveur par une résolution directe**, cohérente avec l'approche déjà
   retenue pour la poutre (`solveurPoutreRessorts.ts`, « factorisation directe » d'après le
   CDC §9.3). La matrice creuse est déjà assemblée par nœud (`A: Map<number, number>[]`,
   `B: number[]`) — remplacer uniquement l'étape de résolution : élimination de Gauss avec
   pivot partiel sur la matrice dense reconstruite depuis `A`/`B` est suffisant et le plus
   sûr à vérifier (pas besoin d'une solution bande optimisée pour l'instant ; les tailles de
   grille visées, quelques centaines de nœuds, restent largement gérables en dense d'après
   les tolérances de performance du CDC §3.3). Ne pas introduire de méthode itérative
   alternative (gradient conjugué, multigrille) sans en discuter avant — plus de risque
   d'introduire un nouveau bug de convergence du même genre.
2. **Simplifier à un seul chemin de code.** Supprimer le cas spécial « deux Poisson
   successifs » pour `'appuye'` sans ressort — avec une résolution directe, ce n'est plus
   nécessaire, et un seul chemin de code élimine le risque qu'un test valide une branche
   différente de celle utilisée en production (exactement ce qui s'est produit ici).
   `T_PLAQUE.1` doit continuer à passer sur ce chemin unique.
3. **Nouveau test de convergence par raffinement de maillage**, sur la configuration
   réellement utilisée (`'libre'` + ressorts de sol, comme dans `radierSurRessortsIteratifs`) :
   résoudre la même plaque avec deux résolutions de maillage différentes (ex. nx=ny=8 puis
   nx=ny=16) et vérifier que la flèche max obtenue diverge de moins de ~5 % entre les deux —
   c'est le test qui aurait dû exister et qui aurait attrapé ce bug. Sans lui, aucun garde-fou
   ne protège contre une régression future de ce type.
4. **Robustesse, pas de résultat faux-silencieux (CDC §10)** : avec une résolution directe,
   remplacer la notion de « convergé après N itérations » par une détection de singularité
   (pivot quasi nul pendant l'élimination, sur le modèle de ce que fait déjà
   `solveurPoutreRessorts.ts` pour la poutre) — mécanisme réel (radier insuffisamment
   supporté) plutôt qu'un flag de convergence qui n'a plus de sens avec un solveur direct.
5. **`radierSurRessortsIteratifs.ts`** : sa propre boucle extérieure (mise à jour de `ks`)
   reste inchangée dans son principe — juste s'assurer qu'elle propage un éventuel
   avertissement de singularité remonté par le solveur de plaque, au lieu de l'ignorer comme
   c'était le cas pour l'ancien flag `convergé`.
6. **Ne pas toucher** aux parties A (sensibilité) et B (stabilité/hydraulique) de la
   précédente livraison — déjà revues et acceptées, aucune régression attendue ni tolérée.

## Tâche envoyée à Gemini (2026-09-16) : saisie directe des profils d'essai pieux (§7.6.2.3)

**Décision (Claude, à la demande d'Henri « choisis au mieux »).** Ne pas implémenter de
table de corrélation CPT régionale (LCPC/Bustamante-Gianeselli, NF P94-262, DTU 13.2…) dans
le code : ça varie selon la pratique de l'ingénieur, et coder une table sans la faire vérifier
serait exactement le type de coefficient inventé que le CDC §13 interdit — ce que cette
revue a déjà reproché à plusieurs livraisons Gemini aujourd'hui. À la place : **saisie
directe de Rc;calc par profil d'essai**, sur le principe déjà retenu pour `kh` en paroi
phasée (CDC §8.4, « saisie directe en alternative »). L'ingénieur calcule déjà ces valeurs
avec sa propre méthode (logiciel dédié, tableur, table régionale) ; le rôle de l'app est
d'appliquer correctement la corrélation ξ3/ξ4 de la voie 2 (§7.6.2.3) — ce qu'elle sait déjà
faire (`T3.1` validé) une fois les vrais `Rc;calc` fournis.

1. **UI dans `OngletPieux.tsx`** : nouvelle section « Profils d'essai (Rc;calc) », sur le
   modèle des tableaux existants (ajout/suppression de lignes, comme les phases de
   `OngletParoiPhasee`). Chaque ligne : une valeur `Rc;calc` (kN) et un libellé libre
   (référence du sondage/essai). Ces valeurs alimentent directement le paramètre
   `profilsEssaisCalcules` déjà existant de `calculerCapacitePieu` — pas de nouvelle logique
   de calcul de corrélation à écrire, elle existe déjà et est testée (`T3.1`).
2. **Retirer la fabrication de 3 profils synthétiques.** Dans `capaciteAxiale.ts`, quand
   aucun profil n'est saisi : ne plus disperser artificiellement une seule estimation en 3
   (`rcTotal * 0.95/1.05/0.98`) — utiliser cette estimation comme **un seul** profil
   (`n=1`), avec `ξ3`/`ξ4` correspondants (plus défavorables, honnêtes). Ajouter un
   avertissement explicite (comme pour la voie pressiométrique du pieu transversal, déjà
   fait cette session) : « Estimation indicative depuis φ'/c'/cu des couches, pas un vrai
   profil d'essai — saisir les Rc;calc réels pour une valeur normative fiable. »
3. **Ne pas toucher** à la dérivation qb_k/qs_k elle-même (formules `capaciteAxiale.ts`
   lignes ~84-106) au-delà du point 2 — ce n'est pas le sujet de cette tâche, et rien n'a été
   décidé sur une méthode de dérivation automatique CPT/PMT pour l'instant.
4. **Test** : vérifier qu'avec 3 profils saisis manuellement, le résultat est identique à un
   appel direct de `calculerCapacitePieu(..., [profils])` (déjà couvert par `T3.1`/`T3.2` au
   niveau du moteur — ajouter seulement un test UI/wiring léger si pertinent, pas dupliquer
   la couverture normative).

## Prochaines étapes (selon plan)

1. **Groupe de pieux (§7.6)** : a priori clos après la revue précédente (Converse-Labarre
   vérifié à la main) — reconfirmer si un point spécifique est soulevé par Henri.
2. **Dérivation CPT/PMT automatique (§7.4)**, si un jour souhaitée en complément de la saisie
   directe ci-dessus — nécessiterait qu'Henri fournisse la méthode/table exacte de sa
   pratique (voir « Constat d'audit » plus haut). Pas urgent : la saisie directe couvre déjà
   le besoin normatif.

## Wiring restant (hors code de calcul)

- README.md, LICENSE — à écrire avant toute publication.
- Décision de visibilité : rester privé tant que la phase 4 n'est pas validée (outil à
  responsabilité réglementaire, cf. §13 du CDC). Repasser en public + GitHub Pages, à
  l'anonyme `henri421` comme le reste de la suite, une fois mûr.
- Une fois public : ajouter l'entrée dans `Structura/index.html` (hub WebAedificium).

**Correctif (2026-09-16, Claude) : accès PWA en sous-répertoire GitHub Pages.** `vite.config.ts`
et `index.html` utilisaient des chemins absolus (`/…`) pour tous les assets, le manifest
(`start_url`/`scope`/icônes) et le service worker — violation du CDC §3.3 (« Chemins relatifs
uniquement, pour permettre un hébergement sous sous-répertoire »), et incohérent avec les
autres suites (STM etc., déjà en `./`). Une fois déployé sous
`henri421.github.io/<repo>/`, ça aurait cassé le chargement des assets et l'installation PWA.
Corrigé : `base: './'` ajouté à `vite.config.ts`, manifest (`id`, `start_url`, `scope`,
`icons[].src`) et `index.html` (icônes, script d'entrée) passés en chemins relatifs. Vérifié
sur le build (`dist/index.html`, `dist/manifest.webmanifest`, `dist/sw.js`) : tous les
chemins sont désormais relatifs (`./assets/…`, `pwa-192x192.png` sans slash initial, etc.).
28/28 tests, lint et build inchangés (aucun impact sur le code de calcul).
