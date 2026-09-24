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
| 3 | Module B : pieu axial isolé puis groupe | ✅ Isolé + groupe + saisie directe des profils d'essai (T3.1-T3.3), repli n=1 honnête si rien n'est saisi |
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

**Mise en œuvre (2026-09-17) :**
- **Moteur (`capaciteAxiale.ts`)** :
  - Suppression de la dispersion synthétique en 3 profils artificiels (`rcTotal * 0.95/1.05/0.98`).
  - Utilisation directe des profils réels (`ouvrage.profilsEssais` ou argument direct `profilsEssaisCalcules`).
  - Repli en profil unique ($n=1$, $\xi_3=\xi_4=1.40$) lorsque aucun profil n'est renseigné, avec transmission de l'avertissement normatif explicite :
    *« Estimation indicative depuis φ'/c'/cu des couches, pas un vrai profil d'essai — saisir les Rc;calc réels pour une valeur normative fiable. »*
  - Propagation des champs `avertissements` et `estProfilSynthetique` dans `ResultatCapacitePieu` et `ResultatVerificationPieuAxial`.
- **Interface (`OngletPieux.tsx`)** :
  - Ajout d'une section dédiée interactive **« 2. Profils d'Essai (Rc;calc) — Voie 2 (Clause 7.6.2.3) »**.
  - Tableau dynamique avec ajout / modification / suppression de lignes (`reference`, `rcCalc` en kN).
  - Bandeau d'avertissement visible en cas de repli indicatif $n=1$, et barre de corrélation instantanée ($n$, moyenne, minimum, $\xi_3$, $\xi_4$, branche gouvernante).
  - Badge « Repli n=1 » sur la carte de corrélation si aucun profil réel n'est saisi.
- **Validation (`acceptanceTests.ts`)** :
  - Ajout du test `T3.3` validant l'identité parfaite entre profils saisis manuellement et appel moteur, ainsi que la stricte conformité du repli unitaire $n=1$ ($\xi=1.40$) avec son avertissement.
  - **Bilan : 30 / 30 tests d'acceptation validés (100%)**, `lint` et `build` impeccables.

## Revue Claude (2026-09-17) — acceptée

Conforme à la spec : `T3.3` teste bien les deux chemins (saisie directe, identique au cas
connu de `T3.1` ; repli n=1 avec ξ3=ξ4=1.40 et avertissement). `verifierPieuAxial` et
`ResultatVerificationPieuAxial` propagent correctement `avertissements`/`estProfilSynthetique`
jusqu'à l'UI. Rien à corriger sur le nouveau code.

**Bonus incident trouvé et corrigé par Gemini, à noter** : `OngletStabilite.tsx` lisait
`modele.configurationNormative.facteursPartielsSol.M1.gamma_phi` — un champ qui n'a jamais
existé sur `ConfigurationNormative` (le vrai nom est `facteursSol`). `tsc --noEmit` n'a
jamais signalé cette erreur dans mes propres relectures de ce fichier (raison non identifiée,
pas creusée) et `npm run test:acceptance` ne rend jamais l'UI donc ne pouvait de toute façon
pas l'attraper. Corrigé au passage (accès sécurisé `?.` + repli à 1.0). **Rappel pour moi :**
la suite CLI ne couvre que le calcul, pas le rendu — un composant peut planter à l'écran sans
qu'aucun test ne le voie. À garder en tête, ouvrir l'app dans un navigateur de temps en temps
serait plus sûr que de se fier uniquement à `npm run test:acceptance` + `tsc`.

## Bug sérieux trouvé en ouvrant l'app dans un navigateur (2026-09-17, Claude)

Jusqu'ici toutes mes revues passaient par `npm run test:acceptance` (CLI, ne rend jamais
l'UI) — je n'avais pas encore ouvert l'app dans un vrai navigateur cette session. Fait pour
préparer une proposition d'amélioration graphique, et ça a immédiatement révélé un bug de
fond sur l'onglet Paroi Phasée du projet d'exemple : la tuile **« Déplacement max »**
affichait **1 652 277 739 750 mm** (1,65 milliard de mètres). Pas un défaut d'affichage — la
valeur vient bien du moteur de calcul.

**Cause 1 — corrigée : géométrie par défaut de l'onglet déconnectée du projet.**
`OngletParoiPhasee.tsx` utilisait des cotes absolues codées en dur (`coteTete=100`,
`coteBase=88`, phases à 97/94/92) quand aucune paroi n'est encore enregistrée sur le projet
— alors que la stratigraphie réelle du projet d'exemple est à ~225-245 m NGF. Conséquence en
cascade : `calculerProfilContraintes` n'accumule aucune contrainte verticale pour des cotes
qui ne recoupent aucune couche réelle (`sigma_v` reste à 0), tandis que la pression
interstitielle continue d'être calculée à partir de la nappe réelle (~244 m) appliquée à ces
cotes fictives (~88-100 m) — soit ~150 m de colonne d'eau fictive. Résultat :
`sigma'_v` fortement négative, donc `Pa=Pp=0` partout (bornées à `max(0,…)`), donc des
ressorts de sol à capacité nulle (`reactionMax=reactionMin=0`), donc une paroi sans aucune
retenue latérale réelle — un mécanisme numérique qui converge vers une valeur arbitraire
énorme au lieu d'être détecté comme instable.

Corrigé (`OngletParoiPhasee.tsx`) : `coteTete`/`coteBase`/phases par défaut dérivés de
`modele.referentiel.coteTerrainNaturel` au lieu de constantes absolues. Vérifié en relançant
l'app dans un navigateur (Playwright) : Phase 1 et 2 du projet d'exemple passent de valeurs
absurdes à des résultats physiquement sensés (`u_max=1.4mm`, `butée mobilisée=92%` puis
`100%`). 30/30 tests, lint et build inchangés (ce chemin de code n'était testé par aucun
test CLI, géométrie/stratigraphie toujours alignées dans les fixtures de test — c'est
justement pour ça que ce bug n'avait jamais été vu).

**Cause 2 — pas corrigée, plus profonde : le solveur ne détecte pas l'insuffisance de
capacité passive.** Même avec la géométrie corrigée, la **Phase 3** du projet d'exemple
(fiche restante ≈ 4 m après excavation à -8 m, buton modeste 500 kN/m de capacité) reproduit
exactement le même symptôme : `Déplacement max = 1 652 277 739 750 mm`,
`Mobilisation butée = 100 % — « Attention : plastification limite ! »` déjà affiché, mais la
valeur de déplacement elle-même reste une énormité silencieuse à côté de cet avertissement.
Cas cette fois **physiquement réel** : la fiche est réellement insuffisante pour cette
profondeur d'excavation avec ce buton — mais au lieu de signaler clairement l'instabilité
(comme `T_SOLV.5` sait le faire pour un DDL singulier dans le solveur de poutre 1D isolé), le
solveur élastoplastique de `resoudrePoutreSurRessorts` (Newton sur raideur sécante) converge
numériquement vers une solution qui satisfait son critère relatif tout en étant physiquement
absurde. Exactement le résultat faux-silencieux que le CDC §10 interdit — et potentiellement
dangereux si un ingénieur pressé ne remarque que le chiffre de moment (plausible en
apparence, 319.7 kNm/m) sans regarder le déplacement.

**Non corrigé maintenant** — touche au cœur du solveur non linéaire partagé (paroi phasée
ET pieu transversal l'utilisent), pas une correction ponctuelle. Tâche de suivi ci-dessous.

## Tâche à envoyer à Gemini (priorité haute) : détection d'insuffisance de capacité passive

**Contexte** : voir « Bug sérieux trouvé en ouvrant l'app dans un navigateur » ci-dessus,
Cause 2. Reproductible avec le projet d'exemple, onglet Paroi Phasée, Phase 3 (excavation à
-8m, fiche restante ~4m, buton 500 kN/m) : `deplacementMaxAbsolu` explose à ~1.65e9 m alors
que `mobilisationButeeMax=1.0` (butée entièrement plastifiée) — le système est en limite de
capacité (voire mécanisme), mais `convergence.convergé=true` sans aucun avertissement.

1. **Localiser dans `solveurPoutreRessorts.ts`** (`resoudrePoutreSurRessorts`) pourquoi le
   critère de convergence peut être satisfait alors que le déplacement diverge. Hypothèse à
   vérifier en premier : une fois tous les ressorts plastifiés (raideur tangente nulle sur le
   DDL concerné), le système peut devenir numériquement quasi singulier sans franchir le
   seuil de détection existant (`< 1e-13`, cf. `T_SOLV.5`) — un seuil relatif à l'échelle du
   problème (pas seulement absolu) serait probablement plus robuste.
2. **Ne pas se contenter d'abaisser le seuil au hasard.** Ajouter un garde-fou explicite et
   testable : si le déplacement d'un nœud dépasse un multiple raisonnable de la longueur
   élastique / des dimensions du problème (ex. > 1 m sur un ouvrage de quelques mètres) alors
   que `mobilisationButeeMax` approche 1.0, considérer le système comme non convergé
   (`convergé=false`) et émettre un avertissement explicite (« Capacité passive insuffisante
   / mécanisme potentiel — fiche ou appuis à revoir »), plutôt que de renvoyer une valeur
   numérique sans le signaler.
3. **Test de non-régression** : reproduire exactement le cas Phase 3 ci-dessus (ou un cas
   réduit équivalent) et vérifier que le résultat est maintenant soit un déplacement
   physiquement borné, soit un échec de convergence explicitement signalé — jamais un nombre
   à 10+ chiffres silencieux. Vérifier aussi que ça ne casse aucun des tests `T_SOLV.*` /
   `T_PHASE.*` / `T_PIEU_LAT.*` existants (le solveur est partagé avec le pieu transversal).
4. **Champ de recherche, pas de précipitation** : c'est le cœur numérique partagé par deux
   modules déjà validés (paroi phasée, pieu transversal) — préférer un correctif ciblé et
   testé à une réécriture large.

## Spec — Surcouche Berlinoise (§8.5) (2026-09-21, Claude)

**Contexte.** Les deux niveaux d'analyse existants (mur en L rigide, paroi flexible phasée
générique) sont validés, mais le CDC §8.5 exige en plus des vérifications propres à chaque
type d'ouvrage flexible. Aucune des deux surcouches (berlinoise, pieux sécants) n'existe
encore. Cette spec couvre **la berlinoise seulement** — pieux sécants reste à spécifier
séparément, plus tard.

**Décisions prises avec Henri avant cette spec :**
- Le bug non corrigé du solveur (Cause 2, section ci-dessus — convergence silencieuse vers un
  déplacement absurde quand la butée est à 100% mobilisée) n'est **pas** corrigé en préalable.
  Traité en parallèle : un garde-fou explicite est ajouté, mais uniquement dans le nouveau
  code de la surcouche (jamais dans `solveurPoutreRessorts.ts` partagé avec le pieu
  transversal), en attendant la correction définitive déjà spécifiée plus haut.
- Les 3 vérifications du §8.5 (répartition profilé/blindage + voûte, stabilité provisoire,
  fiche réduite) sont livrées ensemble — elles partagent les mêmes données d'entrée.
- Pas de méthode de référence disponible pour l'effet de voûte du sol entre profilés :
  hypothèse conservatrice retenue (le profilé reprend 100% de l'effort sur sa largeur
  tributaire, aucune réduction liée à la voûte), explicitement marquée `voûteNonPriseEnCompte:
  true` dans le résultat — à remplacer si Henri fournit une méthode sourcée plus tard, sur le
  principe déjà retenu pour `kh` (saisie/paramétrage direct plutôt qu'un coefficient inventé).
- « Stabilité du blindage non soutenu en phase provisoire » couvre les deux sens du terme :
  (a) tenue géotechnique à court terme du front de fouille excavé avant la pose du madrier,
  (b) tenue structurelle du madrier une fois posé, sous la pression active de la passe.
- Modèle de données : sous-type sur `OuvrageSoutenement` (pas un nouveau type d'ouvrage à
  part). UI intégrée dans `OngletParoiPhasee.tsx` (pas de nouvel onglet séparé).

**1. Types (`src/types/geotech.ts`)**
Ajouter sur `OuvrageSoutenement` :
```ts
sousType?: 'continue' | 'berlinoise' | 'pieuxSecants';
parametresBerlinoise?: {
  entraxeProfiles: number;   // m
  profile: { I: number; W: number; largeur: number }; // m⁴, m³, m — propriétés PROPRES
    // du profilé isolé, à ne pas confondre avec l'EI/m lissé déjà utilisé par le solveur
    // Niveau 2 (ParametresParoiPhasee.I est un moment quadratique PAR MÈTRE LINÉAIRE).
  blindage: {
    hauteurPasse: number;         // m, hauteur d'excavation avant pose d'un madrier
    epaisseur: number;            // m
    contrainteAdmissible: number; // kPa
  };
};
```
Champs optionnels : aucun impact sur les ouvrages existants (mur en L, paroi continue),
aucune migration de `schemaVersion` nécessaire.

**2. Moteur (`src/modules/soutenement/berlinoise.ts`, nouveau fichier)**
Module de post-traitement pur, consomme `ResultatCalculParoiPhasee` déjà produit par
`calculerParoiPhasee` — ne le recalcule pas, ne modifie ni `paroiPhasee.ts` ni
`solveurPoutreRessorts.ts`. Quatre fonctions exportées :

- `calculerRepartitionProfileBlindage(resultat, parametresBerlinoise)` : pour chaque phase et
  chaque nœud, `momentProfile = momentParM × entraxeProfiles` (conservateur, sans voûte) ;
  moment de flexion demandé sur le blindage = pression locale (issue de
  `calculerProfilPressionLimite`, déjà validée) × `entraxeProfiles² / 8` (poutre simplement
  appuyée entre deux profilés).
- `verifierStabiliteFrontNonSoutenu(couches, cote, hauteurPasse)` : hauteur critique non
  soutenue à court terme `Hc = 4·cu/γ` (coupe verticale en sol cohérent, formule classique),
  comparée à `hauteurPasse`, avec facteur de sécurité explicite.
- `verifierResistanceBlindagePose(pressionActive, entraxeProfiles, blindage)` : moment de
  flexion demandé (poutre simplement appuyée) vs moment résistant
  (`contrainteAdmissible × epaisseur² / 6` par mètre de largeur de madrier).
- `verifierFicheProfileReduite(resultat, parametresBerlinoise, couches, configurationNormative)` :
  reprise de la butée disponible sur la largeur **propre du profilé** (`profile.largeur`) au
  lieu de la largeur tributaire pleine utilisée par le solveur Niveau 2, comparée à la
  demande sous le fond de fouille. **Garde-fou local** : si le déplacement issu du solveur
  dépasse un seuil déraisonnable (retenu : `max(1 m, 10 × hauteurTotale/100)`) alors que
  `mobilisationButeeMax` de la phase concernée est ≥ 0.999, la fonction retourne un
  avertissement explicite (« résultat potentiellement non convergé — capacité passive
  possiblement insuffisante, voir tâche solveur en attente ») au lieu de propager le chiffre
  brut du solveur. Ce garde-fou est documenté comme provisoire dans le code (commentaire
  renvoyant à la tâche solveur ci-dessus), pas comme une correction définitive.
- `calculerSurcoucheBerlinoise(resultat, parametresBerlinoise, couches, configurationNormative)` :
  orchestrateur combinant les trois vérifications sur toutes les phases, retourne
  `ResultatSurcoucheBerlinoise` (une entrée par phase).

**3. Tests d'acceptation (`src/validation/acceptanceTestsSoutenement.ts`)**
- `T_BERL.1` : répartition profilé/blindage — cas à la main, moment linéaire connu × entraxe,
  vérifie l'absence de réduction de voûte (résultat conservateur attendu).
- `T_BERL.2` : stabilité du front non soutenu — un cas stable (`hauteurPasse < Hc`) et un cas
  instable (`hauteurPasse > Hc`) avec `cu`/`γ` connus.
- `T_BERL.3` : résistance du blindage posé — un cas conforme, un cas non conforme (moment
  demandé > moment résistant).
- `T_BERL.4` : fiche réduite — un cas normal (garde-fou non déclenché) et une reprise du cas
  Phase 3 du projet d'exemple (section « Bug sérieux trouvé... » ci-dessus) vérifiant que le
  garde-fou se déclenche bien et retourne l'avertissement explicite plutôt qu'un déplacement
  à 10+ chiffres.

**4. UI (`src/components/soutenement/OngletParoiPhasee.tsx`)**
Quand `ouvrage.sousType === 'berlinoise'` : section de saisie additionnelle (entraxe, section
profilé I/W/largeur, blindage épaisseur/contrainte admissible/hauteur de passe) sous les
champs de géométrie de paroi existants, et un tableau de résultats par phase (moment profilé,
vérif front non soutenu, vérif blindage posé, vérif fiche réduite) avec badge visible si le
garde-fou de fiche réduite s'est déclenché sur une phase. Réutilise le sélecteur de phase déjà
en place, n'introduit pas de nouvelle navigation.

**5. Ne pas toucher**
`solveurPoutreRessorts.ts`, `paroiPhasee.ts`, `pousseeButee.ts`, `murEnL.ts`, et les tests
`T_SOLV.*`/`T_PHASE.*`/`T_PIEU_LAT.*` existants — aucune régression attendue ni tolérée sur
ces briques déjà validées.


### Plan d'implémentation — Surcouche Berlinoise

> Exécution : inline, dans cette session (pas de dispatch multi-agents — périmètre
> suffisamment contenu et déjà entièrement spécifié ci-dessus). TDD : chaque fonction est
> testée isolément avec des fixtures numériques choisies à la main, sans dépendre d'un run
> complet du solveur phasé (déjà couvert par `T_SOLV.*`/`T_PHASE.*` — pas dupliqué ici).

**Fichiers touchés :**
- Créer `src/modules/soutenement/berlinoise.ts` (moteur, 4 fonctions + orchestrateur)
- Modifier `src/types/geotech.ts` (ajout `sousType`, `parametresBerlinoise` sur `OuvrageSoutenement`)
- Modifier `src/validation/acceptanceTestsSoutenement.ts` (tests `T_BERL.1` à `T_BERL.4`)
- Modifier `src/components/soutenement/OngletParoiPhasee.tsx` (UI : saisie + résultats)

#### Tâche 1 : Types

**Fichiers :** Modifier `src/types/geotech.ts:217-237` (`interface OuvrageSoutenement`)

- [x] **Étape 1.** Ajouter les champs suivants à `OuvrageSoutenement`, juste après `EA?: number;` (ligne 236) :
```ts
  // Extension : surcouche Berlinoise (§8.5)
  sousType?: 'continue' | 'berlinoise' | 'pieuxSecants';
  parametresBerlinoise?: {
    entraxeProfiles: number; // m
    profile: { I: number; W: number; largeur: number }; // m⁴, m³, m — profilé isolé
    blindage: {
      hauteurPasse: number;         // m
      epaisseur: number;            // m
      contrainteAdmissible: number; // kPa
    };
  };
```
- [x] **Étape 2.** Vérifier la compilation : `npx tsc --noEmit`. Attendu : aucune erreur (champs optionnels, aucun site d'appel existant cassé).
- [x] **Étape 3.** Commit :
```bash
git add src/types/geotech.ts
git commit -m "feat(soutenement): types pour la surcouche Berlinoise (§8.5)"
```

#### Tâche 2 : Répartition profilé/blindage

**Fichiers :** Créer `src/modules/soutenement/berlinoise.ts` ; Test dans `src/validation/acceptanceTestsSoutenement.ts`

- [x] **Étape 1.** Créer `src/modules/soutenement/berlinoise.ts` avec l'en-tête et la première fonction :
```ts
/**
 * Surcouche Berlinoise (EN 1997-1 §8.5) — post-traitement des résultats de
 * `calculerParoiPhasee` (Niveau 2). Ne recalcule rien du moteur partagé.
 */
import {
  ConfigurationNormative,
  CoucheGeotechnique,
  PhaseParoi,
} from '../../types/geotech';
import { ResultatCalculParoiPhasee } from './paroiPhasee';
import { trouverCoucheACote } from '../../core/profilContraintes';

export interface ParametresProfileBerlinoise {
  entraxeProfiles: number; // m
  profile: { I: number; W: number; largeur: number }; // m⁴, m³, m
  blindage: { hauteurPasse: number; epaisseur: number; contrainteAdmissible: number };
}

export interface ResultatRepartitionProfileBlindage {
  momentProfile: number; // kN.m, moment demandé sur UN profilé isolé
  voûteNonPriseEnCompte: true;
}

/**
 * Convertit le moment global "par mètre linéaire lissé" (sortie du solveur Niveau 2) en
 * moment discret sur un profilé, en supposant qu'il reprend 100% de l'effort sur sa largeur
 * tributaire (entraxe) — hypothèse conservatrice, pas de méthode de voûte sourcée disponible
 * (cf. DEVPLAN, spec ci-dessus).
 */
export function calculerRepartitionProfileBlindage(
  momentGlobalMaxParM: number, // kN.m/m — resultatPhase.momentMaxAbsolu
  entraxeProfiles: number
): ResultatRepartitionProfileBlindage {
  return {
    momentProfile: momentGlobalMaxParM * entraxeProfiles,
    voûteNonPriseEnCompte: true,
  };
}
```
- [x] **Étape 2.** Vérifier que ça compile : `npx tsc --noEmit`. Attendu : aucune erreur.
- [x] **Étape 3.** Ajouter le test `T_BERL.1` dans `src/validation/acceptanceTestsSoutenement.ts`. D'abord l'import en haut du fichier (à côté des imports existants) :
```ts
import {
  calculerRepartitionProfileBlindage,
} from '../modules/soutenement/berlinoise';
```
Puis, juste avant le `return resultats;` final du fichier, ajouter :
```ts
  // --------------------------------------------------------------------------
  // T_BERL.1 — Répartition profilé/blindage, sans voûte (§8.5)
  // --------------------------------------------------------------------------
  {
    const momentGlobalMaxParM = 150.0; // kNm/m, valeur de référence arbitraire
    const entraxe = 1.2; // m

    const rep = calculerRepartitionProfileBlindage(momentGlobalMaxParM, entraxe);
    const momentProfileAttendu = 180.0; // 150 * 1.2, calcul à la main

    const ecart = Math.abs(rep.momentProfile - momentProfileAttendu);
    const succes = ecart < 1e-6 && rep.voûteNonPriseEnCompte === true;

    resultats.push({
      id: 'T_BERL.1',
      nom: 'Répartition profilé/blindage sans réduction de voûte',
      phase: 'Surcouche §8.5',
      description:
        'Conversion du moment global lissé (150 kNm/m) en moment sur un profilé isolé à entraxe 1.2 m, sans aucune réduction liée à un effet de voûte (hypothèse conservatrice).',
      valeurAttendue: `momentProfile = ${momentProfileAttendu.toFixed(2)} kNm, voûteNonPriseEnCompte = true`,
      valeurObtenue: `momentProfile = ${rep.momentProfile.toFixed(2)} kNm, voûteNonPriseEnCompte = ${rep.voûteNonPriseEnCompte}`,
      tolerance: 'Exact (calcul déterministe)',
      ecartAbsolu: ecart,
      ecartPourcentage: 0,
      succes,
      message: succes
        ? 'Répartition profilé/blindage conforme, hypothèse conservatrice bien signalée'
        : 'Écart sur le moment redistribué au profilé',
    });
  }

```
- [x] **Étape 4.** Lancer la suite : `npm run test:acceptance`. Attendu : `T_BERL.1` en SUCCÈS, tous les autres tests toujours à 100%.
- [x] **Étape 5.** Commit :
```bash
git add src/modules/soutenement/berlinoise.ts src/validation/acceptanceTestsSoutenement.ts
git commit -m "feat(soutenement): répartition profilé/blindage Berlinoise (T_BERL.1)"
```

#### Tâche 3 : Stabilité du front non soutenu

**Fichiers :** Modifier `src/modules/soutenement/berlinoise.ts` ; Test dans `acceptanceTestsSoutenement.ts`

- [x] **Étape 1.** Ajouter dans `berlinoise.ts` :
```ts
export interface ResultatStabiliteFrontNonSoutenu {
  hauteurCritique: number; // m, Hc = 4.cu,d / gamma
  facteurSecurite: number; // Hc / hauteurPasse
  stable: boolean;
}

/**
 * Stabilité à court terme d'une coupe verticale non soutenue en sol cohérent
 * (Hc = 4.cu/gamma, formule classique de hauteur critique non soutenue).
 */
export function verifierStabiliteFrontNonSoutenu(
  cu_k: number, // kPa
  gamma_cu: number, // facteur partiel (facteursSol.M2.gamma_cu)
  gammaHumide: number, // kN/m³
  hauteurPasse: number // m
): ResultatStabiliteFrontNonSoutenu {
  const cu_d = cu_k / gamma_cu;
  const hauteurCritique = (4 * cu_d) / gammaHumide;
  const facteurSecurite = hauteurCritique / hauteurPasse;
  return { hauteurCritique, facteurSecurite, stable: facteurSecurite >= 1.0 };
}
```
- [x] **Étape 2.** `npx tsc --noEmit` — attendu : aucune erreur.
- [x] **Étape 3.** Ajouter `T_BERL.2` (avant `return resultats;`), import `verifierStabiliteFrontNonSoutenu` ajouté à l'import existant de l'étape précédente :
```ts
  // --------------------------------------------------------------------------
  // T_BERL.2 — Stabilité du front non soutenu, cas stable et instable (§8.5)
  // --------------------------------------------------------------------------
  {
    const cu_k = 40.0; // kPa
    const gamma_cu = 1.40; // M2 par défaut (CONFIG_NORMATIVE_DEFAUT)
    const gammaHumide = 18.0; // kN/m³
    const hauteurCritiqueAttendue = (4 * (cu_k / gamma_cu)) / gammaHumide; // 6.3492 m

    const casStable = verifierStabiliteFrontNonSoutenu(cu_k, gamma_cu, gammaHumide, 1.5);
    const casInstable = verifierStabiliteFrontNonSoutenu(cu_k, gamma_cu, gammaHumide, 8.0);

    const ecartHc = Math.abs(casStable.hauteurCritique - hauteurCritiqueAttendue);
    const succes =
      ecartHc < 1e-3 &&
      casStable.stable === true &&
      casStable.facteurSecurite > 1.0 &&
      casInstable.stable === false &&
      casInstable.facteurSecurite < 1.0;

    resultats.push({
      id: 'T_BERL.2',
      nom: 'Stabilité du front non soutenu (Hc = 4.cu/gamma)',
      phase: 'Surcouche §8.5',
      description:
        'cu_k=40 kPa, gamma_cu=1.40 (M2), gamma=18 kN/m³ -> Hc=6.35 m. Passe de 1.5 m stable, passe de 8.0 m instable.',
      valeurAttendue: `Hc = ${hauteurCritiqueAttendue.toFixed(2)} m ; stable(1.5m)=true ; stable(8.0m)=false`,
      valeurObtenue: `Hc = ${casStable.hauteurCritique.toFixed(2)} m ; FS(1.5m)=${casStable.facteurSecurite.toFixed(2)} (stable=${casStable.stable}) ; FS(8.0m)=${casInstable.facteurSecurite.toFixed(2)} (stable=${casInstable.stable})`,
      tolerance: '1e-3 m sur Hc, comparaisons strictes sur stable',
      ecartAbsolu: ecartHc,
      ecartPourcentage: 0,
      succes,
      message: succes
        ? 'Hauteur critique correcte, cas stable et instable correctement distingués'
        : 'Écart sur Hc ou mauvaise classification stable/instable',
    });
  }

```
- [x] **Étape 4.** `npm run test:acceptance` — attendu : `T_BERL.1`, `T_BERL.2` en SUCCÈS, 100% partout.
- [x] **Étape 5.** Commit :
```bash
git add src/modules/soutenement/berlinoise.ts src/validation/acceptanceTestsSoutenement.ts
git commit -m "feat(soutenement): stabilité du front non soutenu Berlinoise (T_BERL.2)"
```

#### Tâche 4 : Résistance du blindage posé

**Fichiers :** Modifier `src/modules/soutenement/berlinoise.ts` ; Test dans `acceptanceTestsSoutenement.ts`

- [x] **Étape 1.** Ajouter dans `berlinoise.ts` :
```ts
export interface ResultatResistanceBlindage {
  momentDemande: number; // kN.m/m
  momentResistant: number; // kN.m/m
  conforme: boolean;
}

/**
 * Flexion du madrier une fois posé, poutre simplement appuyée entre deux profilés
 * (portée = entraxe), sous la pression active Pa au niveau considéré.
 */
export function verifierResistanceBlindagePose(
  pressionActive: number, // kPa
  entraxeProfiles: number, // m
  epaisseurBlindage: number, // m
  contrainteAdmissible: number // kPa
): ResultatResistanceBlindage {
  const momentDemande = (pressionActive * entraxeProfiles ** 2) / 8;
  const momentResistant = (contrainteAdmissible * epaisseurBlindage ** 2) / 6;
  return { momentDemande, momentResistant, conforme: momentResistant >= momentDemande };
}
```
- [x] **Étape 2.** `npx tsc --noEmit` — attendu : aucune erreur.
- [x] **Étape 3.** Ajouter `T_BERL.3`, import `verifierResistanceBlindagePose` ajouté :
```ts
  // --------------------------------------------------------------------------
  // T_BERL.3 — Résistance du blindage posé, cas conforme et non conforme (§8.5)
  // --------------------------------------------------------------------------
  {
    const pressionActive = 30.0; // kPa
    const entraxe = 1.2; // m
    const epaisseur = 0.05; // m
    const momentDemandeAttendu = (30.0 * 1.2 ** 2) / 8; // 5.4 kNm/m

    const casConforme = verifierResistanceBlindagePose(pressionActive, entraxe, epaisseur, 15000);
    const casNonConforme = verifierResistanceBlindagePose(pressionActive, entraxe, epaisseur, 8000);

    const ecart = Math.abs(casConforme.momentDemande - momentDemandeAttendu);
    const succes =
      ecart < 1e-6 &&
      casConforme.conforme === true &&
      casNonConforme.conforme === false &&
      casConforme.momentDemande === casNonConforme.momentDemande;

    resultats.push({
      id: 'T_BERL.3',
      nom: 'Résistance en flexion du blindage posé',
      phase: 'Surcouche §8.5',
      description:
        'Pa=30 kPa, entraxe=1.2 m, epaisseur=5 cm -> moment demandé 5.4 kNm/m. Contrainte admissible 15 MPa -> conforme, 8 MPa -> non conforme.',
      valeurAttendue: `momentDemande = ${momentDemandeAttendu.toFixed(2)} kNm/m ; conforme(15MPa)=true ; conforme(8MPa)=false`,
      valeurObtenue: `momentDemande = ${casConforme.momentDemande.toFixed(2)} kNm/m ; conforme(15MPa)=${casConforme.conforme} (resistant=${casConforme.momentResistant.toFixed(2)}) ; conforme(8MPa)=${casNonConforme.conforme} (resistant=${casNonConforme.momentResistant.toFixed(2)})`,
      tolerance: 'Exact sur le moment demandé, strict sur conforme',
      ecartAbsolu: ecart,
      ecartPourcentage: 0,
      succes,
      message: succes
        ? 'Moment demandé correct, classification conforme/non conforme correcte selon la contrainte admissible'
        : 'Écart sur le moment demandé ou mauvaise classification',
    });
  }

```
- [x] **Étape 4.** `npm run test:acceptance` — attendu : `T_BERL.1`-`T_BERL.3` en SUCCÈS, 100% partout.
- [x] **Étape 5.** Commit :
```bash
git add src/modules/soutenement/berlinoise.ts src/validation/acceptanceTestsSoutenement.ts
git commit -m "feat(soutenement): résistance du blindage posé Berlinoise (T_BERL.3)"
```

#### Tâche 5 : Fiche réduite + garde-fou local

**Fichiers :** Modifier `src/modules/soutenement/berlinoise.ts` ; Test dans `acceptanceTestsSoutenement.ts`

- [x] **Étape 1.** Ajouter dans `berlinoise.ts` :
```ts
export interface NoeudFicheBerlinoise {
  cote: number;
  demandeMobiliseeParM: number; // kN/m — |reaction ressort x| au nœud (résultat smeared du solveur)
  Pp: number; // kPa — borne passive pleine largeur à ce nœud
  largeurTributaire: number; // m — hauteur d'influence verticale du nœud
}

export interface ResultatFicheReduite {
  demandeMax: number; // kN — pire cas sur un profilé isolé
  capaciteReduiteMax: number; // kN — butée dispo sur la largeur propre du profilé, même nœud
  conforme: boolean;
  gardeFouDeclenche: boolean;
  avertissement?: string;
}

/**
 * Vérifie la fiche sur la largeur PROPRE du profilé (pas la largeur tributaire pleine
 * qu'utilise le solveur Niveau 2 smeared) : sous le fond de fouille, un profilé isolé ne
 * peut mobiliser la butée que sur sa propre largeur physique, pas sur toute la largeur
 * qu'occuperait un écran continu.
 *
 * Garde-fou local provisoire (PAS une correction du solveur partagé — cf. DEVPLAN, tâche
 * "Correction définitive du solveur (Cause 2)" toujours en attente) : si le déplacement de
 * la phase est déraisonnable ET que la butée globale est mobilisée à ~100%, on ne fait pas
 * confiance au résultat brut du solveur et on force un avertissement explicite.
 */
export function verifierFicheProfileReduite(
  noeudsSousFiche: NoeudFicheBerlinoise[],
  entraxeProfiles: number,
  largeurProfile: number,
  deplacementMaxPhase: number, // m
  mobilisationButeeMaxPhase: number, // [0..1]
  hauteurTotaleOuvrage: number // m
): ResultatFicheReduite {
  let demandeMax = 0;
  let capaciteReduiteMax = 0;
  let pireRatio = 0;

  for (const n of noeudsSousFiche) {
    const demandeNode = n.demandeMobiliseeParM * entraxeProfiles; // kN
    const capaciteNode = n.Pp * largeurProfile * n.largeurTributaire; // kN
    const ratio = capaciteNode > 1e-6 ? demandeNode / capaciteNode : demandeNode > 1e-6 ? Infinity : 0;
    if (ratio > pireRatio) {
      pireRatio = ratio;
      demandeMax = demandeNode;
      capaciteReduiteMax = capaciteNode;
    }
  }

  const conformeBrut = pireRatio <= 1.0;

  const seuilDeplacementDeraisonnable = Math.max(1.0, hauteurTotaleOuvrage / 10);
  const gardeFouDeclenche =
    deplacementMaxPhase > seuilDeplacementDeraisonnable && mobilisationButeeMaxPhase >= 0.999;

  return {
    demandeMax,
    capaciteReduiteMax,
    conforme: gardeFouDeclenche ? false : conformeBrut,
    gardeFouDeclenche,
    avertissement: gardeFouDeclenche
      ? `Résultat potentiellement non convergé (déplacement=${(deplacementMaxPhase * 1000).toFixed(0)} mm, butée mobilisée à 100%) — capacité passive possiblement insuffisante sur la largeur réduite du profilé. Voir DEVPLAN, tâche "Correction définitive du solveur (Cause 2)". Vérifier manuellement avant tout usage.`
      : undefined,
  };
}
```
- [x] **Étape 2.** `npx tsc --noEmit` — attendu : aucune erreur.
- [x] **Étape 3.** Ajouter `T_BERL.4`, import `verifierFicheProfileReduite` ajouté :
```ts
  // --------------------------------------------------------------------------
  // T_BERL.4 — Fiche réduite : conforme, non conforme, garde-fou déclenché (§8.5)
  // --------------------------------------------------------------------------
  {
    const entraxe = 1.2; // m
    const largeurProfile = 0.3; // m

    // Cas A : conforme (Pp élevé -> capacité réduite suffisante)
    const noeudsConforme = [
      { cote: 90.0, demandeMobiliseeParM: 50.0, Pp: 800.0, largeurTributaire: 0.5 },
    ];
    const casConforme = verifierFicheProfileReduite(
      noeudsConforme, entraxe, largeurProfile, 0.01, 0.6, 10.0
    );

    // Cas B : non conforme, mais garde-fou NON déclenché (déplacement raisonnable)
    const noeudsNonConforme = [
      { cote: 90.0, demandeMobiliseeParM: 50.0, Pp: 200.0, largeurTributaire: 0.5 },
    ];
    const casNonConforme = verifierFicheProfileReduite(
      noeudsNonConforme, entraxe, largeurProfile, 0.01, 0.85, 10.0
    );

    // Cas C : garde-fou déclenché (déplacement déraisonnable + butée à 100%, comme le bug
    // réel documenté au DEVPLAN — Phase 3 du projet d'exemple)
    const casGardeFou = verifierFicheProfileReduite(
      noeudsConforme, entraxe, largeurProfile, 50.0, 1.0, 10.0
    );

    const succes =
      casConforme.conforme === true &&
      casConforme.gardeFouDeclenche === false &&
      casNonConforme.conforme === false &&
      casNonConforme.gardeFouDeclenche === false &&
      casGardeFou.gardeFouDeclenche === true &&
      casGardeFou.conforme === false &&
      typeof casGardeFou.avertissement === 'string' &&
      casGardeFou.avertissement.length > 0;

    resultats.push({
      id: 'T_BERL.4',
      nom: 'Fiche réduite sur largeur propre du profilé + garde-fou local',
      phase: 'Surcouche §8.5',
      description:
        'Cas A (Pp=800 kPa) conforme sans garde-fou ; Cas B (Pp=200 kPa) non conforme sans garde-fou ; Cas C (déplacement=50m, butée=100%) garde-fou déclenché avec avertissement explicite.',
      valeurAttendue: 'conforme=true/false/false, garde-fou=false/false/true, avertissement non vide en C',
      valeurObtenue: `A: conforme=${casConforme.conforme}, garde-fou=${casConforme.gardeFouDeclenche} | B: conforme=${casNonConforme.conforme}, garde-fou=${casNonConforme.gardeFouDeclenche} | C: conforme=${casGardeFou.conforme}, garde-fou=${casGardeFou.gardeFouDeclenche}`,
      tolerance: 'Comparaisons strictes (booléens)',
      ecartAbsolu: 0,
      ecartPourcentage: 0,
      succes,
      message: succes
        ? 'Fiche réduite correctement évaluée sur les 3 cas, garde-fou local opérationnel et non silencieux'
        : 'Classification incorrecte sur au moins un des 3 cas (conforme / garde-fou / avertissement)',
    });
  }

```
- [x] **Étape 4.** `npm run test:acceptance` — attendu : `T_BERL.1`-`T_BERL.4` en SUCCÈS, 100% partout (34/34 au total, en partant de 30/30 constatés dans le DEVPLAN).
- [x] **Étape 5.** Commit :
```bash
git add src/modules/soutenement/berlinoise.ts src/validation/acceptanceTestsSoutenement.ts
git commit -m "feat(soutenement): fiche réduite + garde-fou local Berlinoise (T_BERL.4)"
```

#### Tâche 6 : Orchestrateur

**Fichiers :** Modifier `src/modules/soutenement/berlinoise.ts`

Pas de nouveau test normatif dédié : pure composition des 4 fonctions déjà testées
individuellement (cf. décision de la spec, point 4 — "pas dupliquer la couverture normative").

- [x] **Étape 1.** Ajouter dans `berlinoise.ts` :
```ts
export interface ResultatSurcoucheBerlinoisePhase {
  phase: PhaseParoi;
  repartition: ResultatRepartitionProfileBlindage;
  stabiliteFront: ResultatStabiliteFrontNonSoutenu;
  resistanceBlindage: ResultatResistanceBlindage;
  ficheReduite: ResultatFicheReduite;
}

/**
 * Orchestrateur : calcule les 4 vérifications §8.5 pour chaque phase à partir des résultats
 * déjà produits par calculerParoiPhasee (Niveau 2). Ne recalcule jamais le moteur partagé.
 */
export function calculerSurcoucheBerlinoise(
  resultat: ResultatCalculParoiPhasee,
  parametres: ParametresProfileBerlinoise,
  couches: CoucheGeotechnique[],
  configurationNormative: ConfigurationNormative,
  hauteurTotaleOuvrage: number
): ResultatSurcoucheBerlinoisePhase[] {
  return resultat.phases.map((resultatPhase) => {
    const repartition = calculerRepartitionProfileBlindage(
      resultatPhase.momentMaxAbsolu,
      parametres.entraxeProfiles
    );

    const coteFondFouille = resultatPhase.phase.coteFondFouille;
    const coucheFront = trouverCoucheACote(couches, coteFondFouille - 0.1) || couches[0];
    const stabiliteFront = verifierStabiliteFrontNonSoutenu(
      coucheFront.resistanceNonDrainee.cuTete.v,
      configurationNormative.facteursSol.M2.gamma_cu,
      coucheFront.poidsVolumiques.gammaHumide.v,
      parametres.blindage.hauteurPasse
    );

    const ptFront = resultatPhase.profilPressionLimite
      .filter((p) => p.cote <= coteFondFouille + 1e-4)
      .sort((a, b) => b.cote - a.cote)[0];
    const resistanceBlindage = verifierResistanceBlindagePose(
      ptFront?.Pa ?? 0,
      parametres.entraxeProfiles,
      parametres.blindage.epaisseur,
      parametres.blindage.contrainteAdmissible
    );

    const noeudsSousFiche: NoeudFicheBerlinoise[] = [];
    for (let i = 0; i < resultat.cotes.length; i++) {
      const cote = resultat.cotes[i];
      if (cote > coteFondFouille - 1e-4) continue;
      const pt = resultatPhase.profilPressionLimite.find((p) => Math.abs(p.cote - cote) < 1e-3);
      const reactionRessort = resultatPhase.resultatSolveur.reactionsRessorts.find(
        (r) => r.noeudIndex === i && r.direction === 'x'
      );
      noeudsSousFiche.push({
        cote,
        demandeMobiliseeParM: Math.abs(reactionRessort?.reaction ?? 0),
        Pp: pt?.Pp ?? 0,
        largeurTributaire: resultat.largeursTributaires[i],
      });
    }
    const ficheReduite = verifierFicheProfileReduite(
      noeudsSousFiche,
      parametres.entraxeProfiles,
      parametres.profile.largeur,
      resultatPhase.deplacementMaxAbsolu,
      resultatPhase.mobilisationButeeMax,
      hauteurTotaleOuvrage
    );

    return { phase: resultatPhase.phase, repartition, stabiliteFront, resistanceBlindage, ficheReduite };
  });
}
```
- [x] **Étape 2.** `npx tsc --noEmit` — attendu : aucune erreur.
- [x] **Étape 3.** `npm run test:acceptance` — attendu : toujours `T_BERL.1`-`T_BERL.4` en SUCCÈS, 100% partout (l'orchestrateur n'est pas testé isolément, mais ne doit rien casser).
- [x] **Étape 4.** Commit :
```bash
git add src/modules/soutenement/berlinoise.ts
git commit -m "feat(soutenement): orchestrateur de la surcouche Berlinoise"
```

#### Tâche 7 : UI (`OngletParoiPhasee.tsx`)

**Fichiers :** Modifier `src/components/soutenement/OngletParoiPhasee.tsx`

- [x] **Étape 1.** Imports. Ajouter à l'import existant de `../../modules/soutenement/paroiPhasee` rien de nouveau ; ajouter un nouvel import juste en dessous (après la ligne 14 `} from '../../modules/soutenement/paroiPhasee';`) :
```ts
import {
  calculerSurcoucheBerlinoise,
  ParametresProfileBerlinoise,
  ResultatSurcoucheBerlinoisePhase,
} from '../../modules/soutenement/berlinoise';
```
- [x] **Étape 2.** État. Juste après la déclaration de `epaisseur`/`setEpaisseur` (ligne 61-63), ajouter :
```ts
  const [sousType, setSousType] = useState<'continue' | 'berlinoise'>(
    soutenementExistant?.sousType === 'berlinoise' ? 'berlinoise' : 'continue'
  );
  const [entraxeProfiles, setEntraxeProfiles] = useState<number>(
    soutenementExistant?.parametresBerlinoise?.entraxeProfiles ?? 1.2
  );
  const [profileI, setProfileI] = useState<number>(
    soutenementExistant?.parametresBerlinoise?.profile.I ?? 0.0003
  ); // m⁴, ex HEB 300 ~ 2.5e-4 m⁴
  const [profileW, setProfileW] = useState<number>(
    soutenementExistant?.parametresBerlinoise?.profile.W ?? 0.0017
  ); // m³
  const [profileLargeur, setProfileLargeur] = useState<number>(
    soutenementExistant?.parametresBerlinoise?.profile.largeur ?? 0.3
  ); // m
  const [blindageHauteurPasse, setBlindageHauteurPasse] = useState<number>(
    soutenementExistant?.parametresBerlinoise?.blindage.hauteurPasse ?? 1.0
  ); // m
  const [blindageEpaisseur, setBlindageEpaisseur] = useState<number>(
    soutenementExistant?.parametresBerlinoise?.blindage.epaisseur ?? 0.05
  ); // m
  const [blindageContrainteAdm, setBlindageContrainteAdm] = useState<number>(
    soutenementExistant?.parametresBerlinoise?.blindage.contrainteAdmissible ?? 10000
  ); // kPa
```
- [x] **Étape 3.** Calcul de rigidité smeared. La paroi Berlinoise n'est pas une dalle béton continue : `E_kPa`/`I_m4`/`A_m2` (lignes 132-134) doivent, en mode `berlinoise`, être dérivés du profilé isolé réparti sur l'entraxe, pas de `epaisseur`. Remplacer les lignes 131-134 :
```ts
  // Inertie et section calculées par mètre linéaire
  const E_kPa = moduleE_GPa * 1e6; // kPa
  const I_m4 = (1.0 * Math.pow(epaisseur, 3)) / 12; // m4/m
  const A_m2 = 1.0 * epaisseur; // m2/m
```
par :
```ts
  // Inertie et section calculées par mètre linéaire.
  // Berlinoise : rigidité "lissée" = rigidité du profilé isolé répartie sur son entraxe
  // (le solveur Niveau 2 travaille par mètre linéaire de paroi, pas par profilé).
  const E_kPa = sousType === 'berlinoise' ? 210.0e6 : moduleE_GPa * 1e6; // 210 GPa acier
  const I_m4 = sousType === 'berlinoise' ? profileI / entraxeProfiles : (1.0 * Math.pow(epaisseur, 3)) / 12;
  const A_m2 = sousType === 'berlinoise' ? profileLargeur / entraxeProfiles : 1.0 * epaisseur;
```
- [x] **Étape 4.** Ajouter `entraxeProfiles`, `profileI` aux dépendances du `useMemo` de `resultatCalcul` (lignes 159-172) — insérer après `A_m2,` :
```ts
    A_m2,
    sousType,
    entraxeProfiles,
```
- [x] **Étape 5.** Calcul de la surcouche. Juste après le bloc `verifRenard` (après la ligne `}, [phaseCourante, coteBase, modele.hydrogeologie, modele.couches]);`), ajouter :
```ts

  // Surcouche Berlinoise (§8.5) : répartition profilé/blindage, stabilité front non soutenu,
  // résistance blindage posé, fiche réduite + garde-fou local (cf. DEVPLAN)
  const surcoucheBerlinoise: ResultatSurcoucheBerlinoisePhase[] | null = useMemo(() => {
    if (sousType !== 'berlinoise' || !resultatCalcul) return null;
    const parametres: ParametresProfileBerlinoise = {
      entraxeProfiles,
      profile: { I: profileI, W: profileW, largeur: profileLargeur },
      blindage: {
        hauteurPasse: blindageHauteurPasse,
        epaisseur: blindageEpaisseur,
        contrainteAdmissible: blindageContrainteAdm,
      },
    };
    try {
      return calculerSurcoucheBerlinoise(
        resultatCalcul,
        parametres,
        modele.couches,
        modele.configurationNormative,
        coteTete - coteBase
      );
    } catch (e) {
      console.error('Erreur lors du calcul de la surcouche Berlinoise :', e);
      return null;
    }
  }, [
    sousType,
    resultatCalcul,
    entraxeProfiles,
    profileI,
    profileW,
    profileLargeur,
    blindageHauteurPasse,
    blindageEpaisseur,
    blindageContrainteAdm,
    modele.couches,
    modele.configurationNormative,
    coteTete,
    coteBase,
  ]);

  const phaseBerlinoiseCourante: ResultatSurcoucheBerlinoisePhase | null =
    surcoucheBerlinoise && surcoucheBerlinoise.length > 0
      ? surcoucheBerlinoise[phaseIndexEffectif] ?? null
      : null;
```
- [x] **Étape 6.** `npx tsc --noEmit` — attendu : aucune erreur.
- [x] **Étape 7.** Sélecteur de sous-type. Dans le panneau "1. Propriétés de la Paroi" (juste après le titre `<h3>`, ligne 686, avant le premier `<div>` de saisie de cote tête), insérer :
```tsx
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setSousType('continue')}
              className={`px-2.5 py-1 rounded-md transition ${
                sousType === 'continue'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Paroi continue
            </button>
            <button
              type="button"
              onClick={() => setSousType('berlinoise')}
              className={`px-2.5 py-1 rounded-md transition ${
                sousType === 'berlinoise'
                  ? 'bg-white text-amber-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Berlinoise
            </button>
          </div>
```
- [x] **Étape 8.** Champs de saisie Berlinoise. Juste après le `</div>` qui ferme le bloc "Épaisseur/Module E" (ligne 735, avant le `<div className="p-2.5 bg-slate-50...">` récapitulatif ligne 737), insérer, conditionné :
```tsx
          {sousType === 'berlinoise' && (
            <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-lg space-y-2">
              <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                Profilés & Blindage
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 mb-1">Entraxe profilés (m)</label>
                  <input
                    type="number" step="0.1" min="0.5" max="4.0"
                    value={entraxeProfiles}
                    onChange={(e) => setEntraxeProfiles(parseFloat(e.target.value) || 1.2)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Largeur profilé (m)</label>
                  <input
                    type="number" step="0.05" min="0.1" max="1.0"
                    value={profileLargeur}
                    onChange={(e) => setProfileLargeur(parseFloat(e.target.value) || 0.3)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">I profilé (m⁴)</label>
                  <input
                    type="number" step="0.00001" min="0.00001"
                    value={profileI}
                    onChange={(e) => setProfileI(parseFloat(e.target.value) || 0.0003)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">W profilé (m³)</label>
                  <input
                    type="number" step="0.0001" min="0.0001"
                    value={profileW}
                    onChange={(e) => setProfileW(parseFloat(e.target.value) || 0.0017)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Hauteur passe (m)</label>
                  <input
                    type="number" step="0.1" min="0.2" max="3.0"
                    value={blindageHauteurPasse}
                    onChange={(e) => setBlindageHauteurPasse(parseFloat(e.target.value) || 1.0)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Épais. blindage (m)</label>
                  <input
                    type="number" step="0.01" min="0.02" max="0.2"
                    value={blindageEpaisseur}
                    onChange={(e) => setBlindageEpaisseur(parseFloat(e.target.value) || 0.05)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-bold bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-500 mb-1">Contrainte admissible blindage (kPa)</label>
                  <input
                    type="number" step="500" min="1000"
                    value={blindageContrainteAdm}
                    onChange={(e) => setBlindageContrainteAdm(parseFloat(e.target.value) || 10000)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-bold bg-white"
                  />
                </div>
              </div>
            </div>
          )}
```
- [x] **Étape 9.** Carte de résultats. Dans la grille de métriques (`{resultatCalcul && phaseCourante && (` ligne 386), juste avant la fermeture `</div>` qui suit le bloc `verifRenard` (ligne 500-501), ajouter :
```tsx
          {/* Surcouche Berlinoise (§8.5) */}
          {phaseBerlinoiseCourante && (
            <div
              className={`p-3 border rounded-xl shadow-xs ${
                phaseBerlinoiseCourante.ficheReduite.gardeFouDeclenche
                  ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                  : phaseBerlinoiseCourante.ficheReduite.conforme &&
                    phaseBerlinoiseCourante.stabiliteFront.stable &&
                    phaseBerlinoiseCourante.resistanceBlindage.conforme
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/70 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Surcouche Berlinoise
                </span>
                {phaseBerlinoiseCourante.ficheReduite.gardeFouDeclenche ? (
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-black">
                  {phaseBerlinoiseCourante.repartition.momentProfile.toFixed(1)}
                </span>
                <span className="text-xs font-semibold">kNm / profilé</span>
              </div>
              <div className="mt-1 text-[10px] font-medium space-y-0.5">
                <div>
                  Front non soutenu : FS = {phaseBerlinoiseCourante.stabiliteFront.facteurSecurite.toFixed(2)}
                  {phaseBerlinoiseCourante.stabiliteFront.stable ? ' OK' : ' Risque'}
                </div>
                <div>
                  Blindage posé : {phaseBerlinoiseCourante.resistanceBlindage.conforme ? 'OK' : 'Non conforme'}
                  {' '}({phaseBerlinoiseCourante.resistanceBlindage.momentDemande.toFixed(1)} / {phaseBerlinoiseCourante.resistanceBlindage.momentResistant.toFixed(1)} kNm/m)
                </div>
                <div>
                  Fiche réduite : {phaseBerlinoiseCourante.ficheReduite.conforme ? 'OK' : 'Non conforme'}
                </div>
                {phaseBerlinoiseCourante.ficheReduite.avertissement && (
                  <div className="text-rose-700 font-bold">
                    ⚠ {phaseBerlinoiseCourante.ficheReduite.avertissement}
                  </div>
                )}
                <div className="italic opacity-70">
                  Répartition sans effet de voûte — hypothèse conservatrice, à affiner.
                </div>
              </div>
            </div>
          )}
```
- [x] **Étape 10.** `npx tsc --noEmit` — attendu : aucune erreur.
- [x] **Étape 11.** `npm run build` — attendu : build sans erreur.
- [x] **Étape 12.** `npm run test:acceptance` — attendu : toujours 34/34 (aucun test ne touche l'UI, non-régression attendue).
- [x] **Étape 13.** Vérification manuelle dans un navigateur (`npm run dev`) : ouvrir l'onglet Paroi Phasée, basculer sur "Berlinoise", vérifier que les champs supplémentaires apparaissent, que la carte de résultats s'affiche et se met à jour avec les entrées, et que la répartition profilé/blindage est cohérente avec le moment global affiché par ailleurs (`momentProfile ≈ momentMax × entraxe`). Confirmer qu'aucune régression visuelle n'apparaît en mode "Paroi continue" (comportement identique à avant).
  **Fait le 2026-09-21 (Claude)**, réseau du sandbox redevenu disponible pour installer
  Chromium (`npx playwright install chromium` a réussi cette fois). Vérifié sur le projet
  d'exemple (Module C, Niveau 2, Phase 1) : bascule "Paroi continue ⇄ Berlinoise" fonctionne,
  panneau "Profilés & Blindage" apparaît avec les valeurs par défaut attendues (entraxe
  1.2 m, largeur 0.3 m, I=0.0003 m⁴, W=0.0017 m³, passe 1 m, blindage 5 cm/10000 kPa),
  récap "Inertie I : 0.00025 m⁴/m" = 0.0003/1.2 exact. Carte "Surcouche Berlinoise" affiche
  `momentProfile = 23.0 kNm/profilé`, à comparer à `M_MAX = 19.2 kNm/m × entraxe 1.2 m =
  23.04` — cohérent. Front non soutenu FS=9.77 OK, blindage posé OK (2.6/4.2 kNm/m), fiche
  réduite correctement signalée "Non conforme" (cohérent avec Mobilisation butée = 100% sur
  cette phase), disclaimer "hypothèse conservatrice, à affiner" affiché. Bascule retour vers
  "Paroi continue" sans régression (revérifié sur capture avant bascule). Aucune erreur
  console. Réserve 1 de la revue ci-dessus : **levée**.
- [x] **Étape 14.** Commit :
```bash
git add src/components/soutenement/OngletParoiPhasee.tsx
git commit -m "feat(soutenement): UI de la surcouche Berlinoise dans l'onglet Paroi Phasée"
```

#### Tâche 8 : Revue (audit)

- [x] Relire `berlinoise.ts` en entier contre la spec (§8.5 CDC + décisions actées) : les 3
      vérifications sont-elles bien présentes, l'hypothèse "pas de voûte" est-elle bien
      signalée partout où elle s'applique, le garde-fou est-il bien local (pas de
      modification de `solveurPoutreRessorts.ts`) ?
- [x] Relire les 4 tests `T_BERL.*` : les fixtures sont-elles vraiment indépendantes d'un run
      du solveur complet (donc rapides et non fragiles) ? Les cas limites (garde-fou,
      non-conforme) sont-ils couverts sans ambiguïté ?
- [x] Vérifier qu'aucun des fichiers listés en "Ne pas toucher" dans la spec n'a été modifié :
      `git diff main -- src/core/solveurPoutreRessorts.ts src/modules/soutenement/paroiPhasee.ts src/modules/soutenement/pousseeButee.ts src/modules/soutenement/murEnL.ts` doit être vide.
- [x] Documenter la revue dans `DEVPLAN.md` (nouvelle section `## Revue — Surcouche Berlinoise
      (2026-09-21)`), avec le même niveau de rigueur que les revues précédentes du fichier
      (accepter tel quel, ou lister les corrections nécessaires).


## Revue — Surcouche Berlinoise (2026-09-21, Claude) — acceptée avec réserves

Implémentation faite en inline dans la même session que la spec/le plan (commits `b39e2db`
à `c3b8322`), en suivant les 7 tâches du plan une à une (TDD, commit après chaque tâche).
`npm run test:acceptance` passe à **34/34 (100%)** (30/30 avant + `T_BERL.1`-`T_BERL.4`),
`tsc --noEmit` et `npm run build` propres.

**Conformité à la spec, vérifiée point par point :**
- Les 3 vérifications du §8.5 sont bien présentes et testées séparément : répartition
  profilé/blindage (`T_BERL.1`), stabilité du front non soutenu + résistance du blindage posé
  (`T_BERL.2`, `T_BERL.3`), fiche réduite (`T_BERL.4`).
- L'hypothèse "pas de réduction de voûte" est bien portée par le type (`voûteNonPriseEnCompte:
  true`, littéral, pas juste un commentaire) et rappelée dans l'UI ("hypothèse conservatrice, à
  affiner").
- Le garde-fou de `verifierFicheProfileReduite` est bien local à `berlinoise.ts` : `git diff`
  du commit initial jusqu'à HEAD confirme que `solveurPoutreRessorts.ts`, `paroiPhasee.ts`,
  `pousseeButee.ts` et `murEnL.ts` sont strictement inchangés — seuls les 5 fichiers prévus par
  le plan ont bougé (`DEVPLAN.md`, `types/geotech.ts`, `berlinoise.ts`,
  `acceptanceTestsSoutenement.ts`, `OngletParoiPhasee.tsx`).
- Recalcul à la main des 4 tests (formules Hc=4cu/γ, moment poutre simplement appuyée,
  répartition par entraxe, les 3 cas de `T_BERL.4`) : tous les résultats attendus recoupent
  exactement ce que la suite rapporte comme SUCCÈS.

**Réserve 1 — vérification visuelle non faite.** L'étape 13 du plan (ouvrir l'app dans un
navigateur, basculer sur Berlinoise, vérifier visuellement) n'a pas pu être réalisée : ce
sandbox n'a ni navigateur système ni accès réseau pour télécharger un binaire Chromium
(`npx playwright install` échoue en timeout réseau). À la place : `tsc --noEmit` propre,
`npm run build` propre (donc JSX et hooks syntaxiquement valides — un `vite build` échoue sur
des balises JSX déséquilibrées ou un import cassé), et relecture manuelle du diff complet de
`OngletParoiPhasee.tsx` (ordre des hooks non conditionnel — `useMemo` de `surcoucheBerlinoise`
appelé sans condition avant tout early-return JSX ; accolades/parenthèses JSX équilibrées).
C'est une évidence raisonnable mais **pas** une preuve visuelle. **Recommandation : Henri
vérifie une fois dans son navigateur habituel** (`npm run dev`, onglet Paroi Phasée, bascule
Berlinoise) avant de considérer la tâche 7 définitivement close — même logique que la revue du
2026-09-17 qui avait trouvé le bug de géométrie par défaut uniquement en ouvrant un vrai
navigateur, jamais via la suite CLI.

**Réserve 2 — pas de persistance.** `sousType` et `parametresBerlinoise` ne sont pas
réinjectés dans `modele.ouvrages.soutenements` via `onUpdateSoutenement` (cette prop existe
sur `OngletParoiPhasee` mais n'est appelée nulle part dans tout le composant, y compris pour
les champs déjà existants comme `epaisseur` ou `moduleE_GPa` — comportement préexistant, pas
introduit par cette tâche). Changer d'onglet ou recharger le projet perd donc la saisie
Berlinoise, exactement comme elle perd déjà la géométrie de paroi phasée standard aujourd'hui.
Pas corrigé ici : hors périmètre de la spec, et corriger ce point isolément pour la seule
Berlinoise créerait une incohérence avec le reste de l'onglet plutôt que de la résoudre.

**Non revu ici (hors périmètre)** : la surcouche pieux sécants (§8.5, pas encore spécifiée) et
la correction définitive du solveur (Cause 2, tâche toujours en attente — le garde-fou ajouté
ici est un palliatif local, documenté comme tel dans le code et dans le message du commit
`a45e033`).

**Verdict : accepté**, sous réserve de la vérification visuelle (Réserve 1) par Henri à
l'occasion de la prochaine ouverture de l'app.

**Addendum (2026-09-21, plus tard le même jour, Claude) : Réserve 1 levée.** Le réseau du
sandbox a fini par permettre l'installation de Chromium ; vérification faite en navigateur,
voir Étape 13 cochée dans le plan ci-dessus pour le détail. **Réserve 2 reste ouverte**
(pas de persistance, comportement préexistant hors périmètre). La mention "Cause 2 toujours
en attente" ci-dessus est également obsolète depuis le merge suivant.

## Merge avec la correction upstream du solveur (Cause 2) (2026-09-21, Claude)

Au moment de pousser la revue ci-dessus, `git push` a été rejeté : une autre session (très
probablement Gemini, sur la tâche "Correction définitive du solveur (Cause 2)" déjà
spécifiée plus haut) avait entre-temps poussé `82ce1e6` — filtrage des étiquettes dans les
schémas + **correction du solveur** : seuil de pivot relatif à l'échelle de la matrice
(`solveurPoutreRessorts.ts`), détection explicite de mécanisme/rupture passive (déplacement
borné, `convergence.convergé=false`, avertissement explicite au lieu d'un nombre à 10+
chiffres silencieux), et propagation dans `calculerParoiPhasee` (nouveau test `T_PHASE.4`).

Merge fait avec `git merge origin/main` : conflit texte-à-texte uniquement dans
`acceptanceTestsSoutenement.ts` (insertions concurrentes au même endroit du fichier —
`T_PHASE.4` d'un côté, `T_BERL.1-4` de l'autre), résolu en gardant les deux blocs de tests
intacts. `OngletParoiPhasee.tsx` (touché par les deux côtés — filtrage d'étiquettes vs UI
Berlinoise) a fusionné automatiquement sans conflit, zones non chevauchantes.

**Correction du garde-fou local en conséquence** : maintenant que
`resultatSolveur.convergence.convergé` est un signal fiable, `verifierFicheProfileReduite`
dans `berlinoise.ts` s'appuie directement dessus (`gardeFouDeclenche = !solveurConverge`) au
lieu de sa propre heuristique déplacement/mobilisation-butée — signature simplifiée (retrait
de `mobilisationButeeMaxPhase` et `hauteurTotaleOuvrage`, devenus inutiles), `T_BERL.4` mis à
jour en conséquence. La tâche "Correction définitive du solveur (Cause 2)" ci-dessous est
donc désormais **résolue**, pas seulement contournée localement.

**Vérifié après merge** : `tsc --noEmit` propre, `npm run build` propre,
`npm run test:acceptance` à **35/35 (100%)** (34 + `T_PHASE.4`).

## Spec + Plan — Persistance de l'onglet Paroi Phasée (Réserve 2) (2026-09-21, Claude)

**Contexte.** Réserve 2 de la revue Berlinoise : `sousType`/`parametresBerlinoise` (et en
réalité TOUT l'état de `OngletParoiPhasee.tsx` — cote tête/base, épaisseur, module E, état
ELS/ELU, phases, appuis, kh par couche) ne sont que de l'état React local, jamais réinjectés
dans `modele.ouvrages.soutenements`. Changer d'onglet ou recharger le projet perd toute la
saisie. Henri : « il faut de la persistance c'est important ».

**Découverte en creusant (avant d'écrire cette spec) : un second problème latent.**
`handleUpdateSoutenement` (`App.tsx`) remplace tout le tableau `soutenements` par `[mur]` —
un seul ouvrage persistable à la fois. Aujourd'hui inoffensif car seul l'onglet Mur en L
appelle `onUpdateSoutenement`. Si on ajoute la sauvegarde de la Paroi Phasée sans corriger
ça, éditer l'un écrase l'autre. Pire : `ModalNoteDeCalcul.tsx` (la Note de Calcul imprimable)
lit `soutenements[0]` et lui applique directement `verifierMurEnLELU` — si une entrée
`paroiFlexible` finit à l'index 0, la note imprimée calculerait n'importe quoi sur le mauvais
type d'ouvrage. Décidé avec Henri : corriger aussi ce point (upsert par type).

**Décisions :**
- Upsert par `type` dans `handleUpdateSoutenement`, pas un remplacement total du tableau.
- Les 3 lecteurs qui supposaient `soutenements[0]` unique (`App.tsx`, `OngletContraintes.tsx`,
  `ModalNoteDeCalcul.tsx`) sont corrigés pour préférer explicitement `type === 'murEnL'`,
  comme le fait déjà `OngletSoutenement.tsx`.
- Un seul `useEffect` de synchronisation dans `OngletParoiPhasee.tsx` (pas de refonte vers le
  pattern "tout contrôlé depuis les props" du reste de l'app) : risque de régression minimal
  sur un fichier de 1900 lignes déjà validé, écrit dans le modèle à chaque changement d'état
  local pertinent.
- **Piège d'implémentation à respecter** : le tableau de dépendances de ce `useEffect` NE DOIT
  PAS inclure `modele`, `soutenementExistant`, ni `onUpdateSoutenement` — `handleUpdateSoutenement`
  n'est pas mémoïsée (`useCallback`) côté `App.tsx`, donc chaque sauvegarde re-render App avec
  une nouvelle référence de fonction ; l'inclure dans les deps bouclerait à l'infini (save →
  re-render → nouvelle réf → save → ...). Seul l'état local (saisies utilisateur) doit
  déclencher l'effet.

### 1. Types (`src/types/geotech.ts`)
Ajouter à `OuvrageSoutenement`, à côté de `parametresBerlinoise` :
```ts
coteBase?: number;               // m — cote base/fiche de l'écran (paroi phasée uniquement)
moduleE_GPa?: number;            // GPa — module d'Young (paroi continue)
etatCalcul?: 'ELS' | 'ELU';
khParCouche?: Record<string, number>; // kN/m³, clé = CoucheGeotechnique.id
```
Champs optionnels, rétrocompatibles.

### 2. `App.tsx` — upsert par type
Remplacer :
```ts
const handleUpdateSoutenement = (mur: OuvrageSoutenement) => {
  handleUpdateModele({
    ...modele,
    ouvrages: { ...modele.ouvrages, soutenements: [mur] },
  });
};
```
par :
```ts
const handleUpdateSoutenement = (ouvrage: OuvrageSoutenement) => {
  const autres = modele.ouvrages.soutenements.filter((s) => s.type !== ouvrage.type);
  handleUpdateModele({
    ...modele,
    ouvrages: { ...modele.ouvrages, soutenements: [...autres, ouvrage] },
  });
};
```
Et dans `getOuvrageActifPourCoupe` (ligne ~119), remplacer `modele.ouvrages.soutenements[0]`
par `modele.ouvrages.soutenements.find((s) => s.type === 'murEnL') ?? modele.ouvrages.soutenements[0]`.

### 3. `OngletContraintes.tsx` — même correction
```ts
const soutenementPourCoupe =
  modele.ouvrages.soutenements.find((s) => s.type === 'murEnL') ?? modele.ouvrages.soutenements[0];
if (soutenementPourCoupe) {
  cotesSingulieres.push(soutenementPourCoupe.coteFondFouille);
}
```

### 4. `ModalNoteDeCalcul.tsx` — même correction (le point le plus important, note imprimable)
```ts
const mur = modele.ouvrages.soutenements.find((s) => s.type === 'murEnL');
```
(retirer `?? modele.ouvrages.soutenements[0]` ici précisément : si aucun mur en L n'existe,
`mur` doit être `undefined` — pas substitué silencieusement par une entrée paroi phasée
inadaptée à `verifierMurEnLELU`.)

### 5. `OngletParoiPhasee.tsx` — useEffect de synchronisation
- Import `useEffect` ajouté à la ligne 1.
- Initialiseur de `coteBase` (ligne 84-88) : préférer `soutenementExistant?.coteBase` si
  présent, repli sur l'ancienne heuristique (`coteFondFouille - 6.0`) pour les entrées
  anciennes qui n'ont que `coteFondFouille` (créées avant ce correctif) :
```ts
const [coteBase, setCoteBase] = useState<number>(
  soutenementExistant?.coteBase ??
    (soutenementExistant?.coteFondFouille
      ? soutenementExistant.coteFondFouille - 6.0
      : coteTNReelle - 12.0)
);
```
- Initialiseurs de `moduleE_GPa` et `etatCalcul` (lignes 116-117) : lire depuis
  `soutenementExistant` :
```ts
const [moduleE_GPa, setModuleE_GPa] = useState<number>(soutenementExistant?.moduleE_GPa ?? 30.0);
const [etatCalcul, setEtatCalcul] = useState<'ELS' | 'ELU'>(soutenementExistant?.etatCalcul ?? 'ELS');
```
- Initialiseur de `khParCouche` (ligne 203-218) : si `soutenementExistant?.khParCouche` existe
  et couvre toutes les couches actuelles, l'utiliser ; sinon repli sur l'heuristique par
  nature de sol déjà en place (ne pas casser un projet dont les couches ont changé depuis).
- Nouveau `useEffect`, juste après `phaseBerlinoiseCourante` (après la ligne actuelle
  `: null;` qui suit sa déclaration) :
```ts
  // Synchronisation vers le modèle persisté (IndexedDB via App.tsx). Ne PAS ajouter modele,
  // soutenementExistant ou onUpdateSoutenement aux dépendances : onUpdateSoutenement n'est
  // pas mémoïsée côté App.tsx, une nouvelle référence est créée à chaque sauvegarde, ce qui
  // boucleraite à l'infini si elle déclenchait elle-même cet effet.
  useEffect(() => {
    if (!onUpdateSoutenement) return;
    const ouvrage: OuvrageSoutenement = {
      id: soutenementExistant?.id ?? 'PAROI-01',
      nom: soutenementExistant?.nom ?? 'Paroi phasée',
      type: 'paroiFlexible',
      hauteurTotale: coteTete - coteBase,
      coteTete,
      coteFondFouille: phases[phases.length - 1]?.coteFondFouille ?? coteTete,
      coteBase,
      epaisseurVoile: epaisseur,
      surchargeQ: soutenementExistant?.surchargeQ ?? 0,
      inclinaisonTerrePlein: soutenementExistant?.inclinaisonTerrePlein ?? 0,
      frottementDeltaSurPhi: soutenementExistant?.frottementDeltaSurPhi ?? 0.667,
      butons: [],
      phases,
      appuisPhases: appuis,
      EI: E_kPa * I_m4,
      EA: E_kPa * A_m2,
      moduleE_GPa,
      etatCalcul,
      khParCouche,
      sousType,
      parametresBerlinoise:
        sousType === 'berlinoise'
          ? {
              entraxeProfiles,
              profile: { I: profileI, W: profileW, largeur: profileLargeur },
              blindage: {
                hauteurPasse: blindageHauteurPasse,
                epaisseur: blindageEpaisseur,
                contrainteAdmissible: blindageContrainteAdm,
              },
            }
          : undefined,
    };
    onUpdateSoutenement(ouvrage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- voir commentaire ci-dessus
  }, [
    coteTete, coteBase, epaisseur, moduleE_GPa, etatCalcul, phases, appuis, khParCouche,
    sousType, entraxeProfiles, profileI, profileW, profileLargeur,
    blindageHauteurPasse, blindageEpaisseur, blindageContrainteAdm, E_kPa, I_m4, A_m2,
  ]);
```

### 6. Vérifications — toutes faites (2026-09-21, Claude)
- `npx tsc --noEmit` propre (après `npm install` pour récupérer `recharts`, ajouté par un
  autre commit concurrent entre-temps — sans rapport avec cette tâche).
- `npm run test:acceptance` : **35/35** inchangé (rien ici ne touche le moteur de calcul).
- `npm run build` propre.
- **Vérification manuelle en navigateur**, script Playwright : sur le projet d'exemple,
  Largeur semelle B (Mur en L) → `3.33`, Cote Tête (Paroi Phasée) → `250.5`, bascule
  Berlinoise, Entraxe profilés → `1.77`. Aucune erreur console (notamment aucune erreur React
  "Maximum update depth exceeded" — confirme l'absence de boucle infinie malgré le piège de
  dépendances documenté au point 5). `Exporter JSON` puis lecture du fichier : **2 entrées**
  dans `soutenements` (`murEnL` avec `largeurSemelleB=3.33`, `paroiFlexible` avec
  `sousType=berlinoise`, `coteTete=250.5`, `entraxeProfiles=1.77`) — l'upsert par type
  fonctionne, aucun écrasement croisé. Rechargement complet de la page (`page.reload()`) :
  les trois valeurs de test sont toujours affichées dans les champs correspondants, y
  compris le sous-type Berlinoise restauré (le panneau "Profilés & Blindage" réapparaît).

**Réserve 2 de la revue Berlinoise : levée.**


## Spec + Plan — Surcouche Paroi de Pieux Sécants (§8.5) (2026-09-22, Claude)

**Contexte.** Dernière surcouche §8.5 documentée par le CDC : la Berlinoise est close, la
surcouche « Mur en L » est explicitement hors périmètre (renvoyée aux modules structuraux du
maître d'ouvrage, §8.5). Décidé avec Henri : se limiter à la paroi de pieux sécants, pas
d'extension du CDC à d'autres types d'ouvrages non documentés (palplanches, paroi moulée…).

**Citation CDC §8.5** : « vérification du recouvrement en fonction du diamètre, de l'entraxe
et de la tolérance de verticalité. Le recouvrement décroît avec la profondeur du fait de la
dérive des forages, ce qui conditionne l'étanchéité et la continuité mécanique. Calcul de
l'inertie équivalente de la section composite pieux primaires et secondaires. »

**Décisions :**
- Tolérance de verticalité : **saisie directe** par l'ingénieur (déviation sans unité, ex.
  0.01 = 1% = dérive de 1 cm par mètre de profondeur — valeur d'exécution réelle du forage),
  même principe déjà retenu pour `kh` (paroi phasée) et `Rc;calc` (pieux) : pas de coefficient
  normatif inventé.
- Recouvrement minimal requis (seuil d'étanchéité) : **saisie directe** aussi — c'est une
  exigence projet-spécifique (cahier des charges d'étanchéité), pas une valeur normative
  universelle.
- Inertie composite : calcul géométrique de premier principe (théorème de Huygens/axes
  parallèles) par **superposition des sections circulaires pleines** primaire + secondaire,
  **sans soustraire la lentille de recouvrement** — approximation documentée et signalée
  (`approximationSuperposition: true`), dans le même esprit que l'absence de réduction de
  voûte pour la Berlinoise. Pas d'invention de méthode plus fine sans référence fournie.
- Architecture : même principe que la Berlinoise — module séparé de post-traitement,
  `pieuxSecants.ts`, ne touchant ni `solveurPoutreRessorts.ts` ni `paroiPhasee.ts`.
- Rigidité smeared (E/I/A du Niveau 2) : le matériau est du **béton** comme la paroi continue
  (pas de l'acier comme la Berlinoise) — réutilise le champ `moduleE_GPa` déjà existant dans
  `OngletParoiPhasee.tsx`, seuls `I`/`A` diffèrent (composite au lieu de dalle pleine).
- Persistance : intégrée dès l'écriture, dans le même `useEffect` de synchronisation déjà en
  place (Réserve 2 de la revue Berlinoise, résolue le 2026-09-21) — pas de dette technique
  ajoutée.

### 1. Types (`src/types/geotech.ts`)
Ajouter sur `OuvrageSoutenement`, à côté de `parametresBerlinoise` (le champ `sousType`
inclut déjà `'pieuxSecants'` depuis la spec Berlinoise — juste le sous-objet à ajouter) :
```ts
parametresPieuxSecants?: {
  diametrePrimaire: number;        // m
  diametreSecondaire: number;      // m
  entraxe: number;                 // m, axe à axe pieu primaire ↔ secondaire adjacent
  deviationVerticaliteMax: number; // sans unité (pente), ex 0.01 = 1% — saisie directe
  recouvrementMinimalRequis: number; // m — seuil d'étanchéité/continuité, saisie directe
};
```

### 2. Moteur (`src/modules/soutenement/pieuxSecants.ts`, nouveau fichier)

**Fonction 1 — recouvrement.**
```ts
export interface ParametresRecouvrementPieuxSecants {
  diametrePrimaire: number;        // m
  diametreSecondaire: number;      // m
  entraxe: number;                 // m
  deviationVerticaliteMax: number; // sans unité (pente)
  recouvrementMinimalRequis: number; // m
}

export interface ResultatRecouvrementPieuxSecants {
  recouvrementSurface: number;       // m, recouvrement nominal en tête (z=0)
  recouvrementProfondeurMax: number; // m, recouvrement au point le plus défavorable (pied)
  conforme: boolean;
  continuiteMecaniqueRompue: boolean; // true si recouvrementProfondeurMax <= 0
}

/**
 * Recouvrement géométrique entre deux cercles de diamètres Dp/Ds séparés par l'entraxe e :
 * (Dp+Ds)/2 - e (somme des rayons moins la distance entre centres). La dérive de forage
 * (déviation de verticalité, saisie directe) écarte les deux axes avec la profondeur — pire
 * cas retenu : les deux forages dérivent en sens opposés, dérive cumulée = 2 × déviation × z.
 */
export function verifierRecouvrementPieuxSecants(
  parametres: ParametresRecouvrementPieuxSecants,
  profondeurMax: number // m, hauteur totale des pieux (coteTete - coteBase)
): ResultatRecouvrementPieuxSecants {
  const rayonsCumules = (parametres.diametrePrimaire + parametres.diametreSecondaire) / 2;
  const deriveMax = 2 * parametres.deviationVerticaliteMax * profondeurMax;
  const entraxeEffectifMax = parametres.entraxe + deriveMax;

  const recouvrementSurface = rayonsCumules - parametres.entraxe;
  const recouvrementProfondeurMax = rayonsCumules - entraxeEffectifMax;
  const continuiteMecaniqueRompue = recouvrementProfondeurMax <= 0;
  const conforme =
    !continuiteMecaniqueRompue && recouvrementProfondeurMax >= parametres.recouvrementMinimalRequis;

  return { recouvrementSurface, recouvrementProfondeurMax, conforme, continuiteMecaniqueRompue };
}
```

**Fonction 2 — inertie composite.**
```ts
export interface ParametresCompositePieuxSecants {
  diametrePrimaire: number; // m
  diametreSecondaire: number; // m
  entraxe: number; // m
}

export interface ResultatInertieCompositePieuxSecants {
  I_m4ParM: number; // m⁴/m — pour ParametresParoiPhasee.I (Niveau 2)
  A_m2ParM: number; // m²/m — pour ParametresParoiPhasee.A
  approximationSuperposition: true;
}

/**
 * Inertie équivalente de la section composite (théorème des axes parallèles), motif
 * répétitif = un pieu primaire + un pieu secondaire adjacent, par superposition des deux
 * sections circulaires PLEINES sans soustraire leur lentille de recouvrement commune —
 * approximation documentée (voûte non traitée non plus pour la Berlinoise, même principe :
 * pas de méthode de référence disponible pour une section composite exacte).
 */
export function calculerInertieCompositePieuxSecants(
  parametres: ParametresCompositePieuxSecants
): ResultatInertieCompositePieuxSecants {
  const { diametrePrimaire: Dp, diametreSecondaire: Ds, entraxe } = parametres;
  const Ap = (Math.PI * Dp * Dp) / 4;
  const As = (Math.PI * Ds * Ds) / 4;
  const Ip = (Math.PI * Dp ** 4) / 64;
  const Is = (Math.PI * Ds ** 4) / 64;

  // Centre de gravité du motif (primaire en x=0, secondaire en x=entraxe)
  const centreGravite = (Ap * 0 + As * entraxe) / (Ap + As);
  const dp = centreGravite;
  const ds = entraxe - centreGravite;

  const I_total = Ip + Ap * dp ** 2 + (Is + As * ds ** 2);
  const A_total = Ap + As;

  return {
    I_m4ParM: I_total / entraxe,
    A_m2ParM: A_total / entraxe,
    approximationSuperposition: true,
  };
}
```

### 3. Tests d'acceptation (`src/validation/acceptanceTestsSoutenement.ts`)
- `T_PSEC.1` — recouvrement, 3 sous-cas calculés à la main : Dp=Ds=0.8 m, entraxe=0.65 m,
  profondeurMax=10 m. (a) déviation=0.005 → recouvrementSurface=0.15 m,
  recouvrementProfondeurMax=0.05 m, seuil=0.03 m → conforme. (b) même géométrie, seuil=0.08 m
  → non conforme (recouvrement insuffisant mais continuité pas rompue). (c) déviation=0.02 →
  recouvrementProfondeurMax=-0.25 m → continuité mécanique rompue, non conforme quel que soit
  le seuil.
- `T_PSEC.2` — inertie composite, cas symétrique Dp=Ds=0.8 m, entraxe=0.65 m (centre de
  gravité exactement à l'entraxe/2 par symétrie) : valeur analytique calculée à la main dans
  le test à partir de la même formule que le moteur, pour vérifier la non-régression de
  l'implémentation plutôt que sa dérivation (cf. remarque §5 ci-dessous sur les tests
  d'inertie).

### 4. Intégration UI (`OngletParoiPhasee.tsx`)
- Élargir le type local `sousType` de `'continue' | 'berlinoise'` à
  `'continue' | 'berlinoise' | 'pieuxSecants'`, 3ᵉ bouton dans le sélecteur existant.
- Nouveaux champs d'état : `diametrePrimaire`, `diametreSecondaire`, `entraxePieux` (nom
  distinct de `entraxeProfiles` Berlinoise, même s'ils ne coexistent jamais dans l'UI, pour
  éviter toute confusion de code), `deviationVerticaliteMax`, `recouvrementMinimalRequis`.
- Branche `E_kPa`/`I_m4`/`A_m2` (déjà conditionnelle sur `sousType==='berlinoise'`) : ajouter
  la branche `pieuxSecants` — `E_kPa = moduleE_GPa * 1e6` (comme `continue`, béton),
  `I_m4`/`A_m2` = sortie de `calculerInertieCompositePieuxSecants`.
- Nouveau `useMemo` `surcouchePieuxSecants` (miroir de `surcoucheBerlinoise`), calcule
  `verifierRecouvrementPieuxSecants` à partir de `coteTete - coteBase` comme `profondeurMax`.
- Panneau de saisie conditionnel (miroir du panneau Berlinoise) + carte de résultats (miroir
  de la carte Berlinoise, badge rouge si `continuiteMecaniqueRompue`).
- `useEffect` de synchronisation existant (persistance) : ajouter `parametresPieuxSecants`
  dans l'objet `OuvrageSoutenement` construit quand `sousType==='pieuxSecants'`, et les
  nouveaux champs d'état à son tableau de dépendances.

### 5. Remarque sur la couverture de test de l'inertie composite
Contrairement à `T_BERL.1`-`T_BERL.4` (dont les valeurs attendues sont dérivées indépendamment
de la formule testée — ex. Hc=4cu/γ, poutre simplement appuyée), l'inertie composite n'a pas
de solution de référence externe alternative simple à calculer à la main autrement qu'en
répliquant la même formule des axes parallèles. `T_PSEC.2` est donc un test de
**non-régression** (fige le résultat numérique une fois vérifié une fois à la main lors de
l'implémentation), pas une preuve d'exactitude indépendante comme les autres tests de cette
suite — limite à documenter explicitement dans la description du test lui-même.

### 6. Vérifications — toutes faites (2026-09-22, Claude)
- `npx tsc --noEmit` propre, `npm run test:acceptance` **37/37** (35 + `T_PSEC.1` +
  `T_PSEC.2`), `npm run build` propre.
- **Vérification manuelle en navigateur**, script Playwright, sur le projet d'exemple (paroi
  de 12 m, cote tête 245.3 / base 233.3) : bascule vers Pieux Sécants, valeurs par défaut
  (Dp=Ds=0.8 m, entraxe=0.65 m, déviation=1%, seuil=0.05 m). Carte de résultats : recouvrement
  en tête = 150 mm (= (0.8+0.8)/2 - 0.65, exact), recouvrement au pied = **-90 mm** (=
  0.8 - (0.65 + 2×0.01×12), exact) → **continuité mécanique rompue**, badge rouge affiché —
  un résultat réaliste et non anodin sur la géométrie par défaut du projet d'exemple, pas un
  cas de test artificiel qui ne se déclencherait jamais en pratique. Modifié diamètre
  primaire → 0.9 m et entraxe → 0.7 m, `Exporter JSON` (2 entrées `soutenements` confirmées,
  `parametresPieuxSecants` avec les valeurs modifiées), rechargement complet de la page :
  sous-type et valeurs restaurés. Aucune erreur console.

**Revue (2026-09-22, Claude) : acceptée, aucune réserve.** Relu `pieuxSecants.ts` contre la
spec : les deux fonctions sont pures, sans dépendance au solveur partagé, la saisie directe
de la tolérance de verticalité et du recouvrement minimal est bien respectée (aucune valeur
codée en dur pour ces deux paramètres projet-spécifiques), et l'approximation de
superposition pour l'inertie composite est explicitement signalée dans le type
(`approximationSuperposition: true`) et rappelée dans l'UI. `git diff` du début de cette
tâche à HEAD confirme qu'aucun fichier du cœur partagé n'a été touché. La surcouche §8.5 du
CDC est maintenant **complète** : Berlinoise et Pieux Sécants implémentées et vérifiées, Mur
en L restant hors périmètre comme prévu par le CDC lui-même.


## Refonte UI/UX — rattachement à l'identité WebAedificium (2026-09-22, Claude)

Henri : « je veux juste une uniformité entre page et également avec les autres app de
webaedificium... quelque chose de sobre et simple mais fonctionnel ». Voir `DESIGN.md` pour
le détail (jetons repris tels quels de `Structura/DESIGN.md`, aucune extension nécessaire
pour les concepts propres à Fondation après audit).

**Phase 1 posée (fondation + preuve), en attente de validation avant de dérouler :**
- `src/index.css` : `:root` (jetons) + `@theme` (pont Tailwind v4) — `:root` copiable tel
  quel dans un autre dépôt de la suite, `@theme` n'est qu'un miroir.
- `src/components/ui/` : 4 primitives (`Card`, `Verdict`, `Bouton`, `Champ`).
- Châssis (`App.tsx`, `BandeauNormatif.tsx`) migré : fond, en-tête, barre d'onglets — plus de
  dégradé, plus de bouton « primaire » coloré, plus d'icônes teintées au hasard par onglet.
- Preuve sur `OngletValidation.tsx` (zéro moteur normatif, zéro risque calcul).
- Vérifié : `tsc`, `npm run test:acceptance` (37/37, inchangé — aucun fichier de calcul
  touché), `npm run build`, capture d'écran navigateur avant/après.

**Reste (après validation d'Henri)** : les 13 autres fichiers, dont les deux gros chantiers
`OngletParoiPhasee.tsx` (2145 lignes) et `CoupeDeSolCanvas.tsx` (993 lignes, une douzaine de
hex codés en dur dans les fonctions de dessin SVG) — chacun sur son propre commit/revue,
jamais mélangés à du code de calcul.

**Déroulé sur le reste (2026-09-22/23, Claude) : terminé, les 16 fichiers sont migrés.**

Ordre suivi : `OfflineIndicator`/`PWAInstallButton`/`ErrorBoundary` (petits, châssis) →
`OngletStabilite`/`OngletContraintes` → `ModalNoteDeCalcul` → `OngletSoutenement` (Mur en L)
→ `GraphiqueCourbeTassement` (chrome seulement, palette catégorielle validée conservée) →
`VuePieuTransversal` → `OngletRadier` → `OngletPieux` → `OngletSol` → `CoupeDeSolCanvas` →
`OngletParoiPhasee` (dernier, le plus gros) → balayage final `App.tsx` (toast + pied de page
oubliés dans la première passe). Un commit dédié par fichier, `tsc`/`test:acceptance`/`build`
vérifiés après chacun, jamais mélangé à du code de calcul.

**Décisions transversales prises en cours de route, non anticipées dans `DESIGN.md` :**
- **ELS/ELU** traités comme une distinction neutre partout (pas de bleu/rose par état) : les
  deux chaînes ont la même importance, coder l'une en couleur et l'autre non revenait à
  suggérer que l'une est secondaire.
- **Catégories/badges informatifs** (loi p-y appliquée, régime de consolidation, type
  buton/tirant, statut de traçabilité) neutralisés — ce ne sont pas des verdicts, un code
  couleur par catégorie n'ajoutait aucune information.
- **Graphiques à séries superposées** (courbe de tassement, Pa/Pp) : palette catégorielle
  validée avec le skill dataviz et conservée — légitimement distincte du châssis. **Graphiques
  à colonnes séparées non superposées** (déformée/moment/tranchant dans `OngletParoiPhasee`) :
  neutralisés, aucune séparation catégorielle n'était nécessaire puisque rien n'est superposé.
- **Poussée Pa / Butée Pp** → `--traction`/`--compression` (même axe sémantique que la suite :
  « déstabilisant / résistant »). **Frottement négatif** (pieux) → `--alerte` (action
  permanente défavorable réelle). **Terrain Naturel / cotes de repère** → `--neutre`.

**Incidents trouvés et corrigés en migrant (pas des régressions introduites par la refonte,
des bugs préexistants révélés en touchant le code) :**
- `OngletSoutenement.tsx` : le libellé de conclusion des 4 vérifications du mur en L
  (« Glissement excessif », etc.) était toujours affiché en vert, sa couleur étant codée en
  dur indépendamment de l'état réel `conforme`. Corrigé en passant par le composant `Verdict`
  partagé, dont la couleur suit l'état — vérifié en navigateur après coup (capture d'écran).
- `OngletRadier.tsx` : la carte de vérification UPL (soulèvement) utilisait du bleu « sky »
  au lieu du vert/rouge des deux autres cartes ELU quand conforme — un 4ᵉ état de fait qui
  n'existe pas dans le système à 3 états de la suite. Alignée sur `ok`/`refus`.
- Un bug de substitution automatique (regex sans limite de mot dans le script Python utilisé
  pour `OngletParoiPhasee.tsx`) avait tronqué `bg-rose-500` en `bg-refus-fond0` etc. dans la
  config des étiquettes — détecté par une recherche exhaustive de jetons suivis d'un chiffre
  parasite avant de committer, corrigé, confirmé absent du reste du fichier.

**Vérifié à la fin** : `tsc --noEmit`, `npm run test:acceptance` (37/37, inchangé — aucun
fichier de calcul touché de toute la refonte), `npm run build`, et un passage complet en
navigateur sur tous les onglets (Radier, Pieux + comportement transversal, Soutènement dans
ses 3 sous-modes + Mur en L, Stabilité, Sol, Contraintes, Recette Normative, Note de Calcul
imprimable) sans aucune erreur console.

## Prochaines étapes (selon plan)

1. **Surcouche Berlinoise (§8.5)** — **close** : implémentée, testée (35/35), revue, vérifiée
   en navigateur, persistance de tout l'onglet Paroi Phasée (Réserve 2) corrigée
   (2026-09-21). Plus aucune réserve ouverte.
2. **Surcouche Pieux Sécants (§8.5)** — **close** : implémentée, testée (37/37 au total),
   revue, vérifiée en navigateur avec persistance (2026-09-22). **Les 3 surcouches §8.5 du
   CDC sont maintenant traitées** (Mur en L hors périmètre par le CDC lui-même).
3. ~~**Correction définitive du solveur (Cause 2)**~~ — **résolue** par `82ce1e6` (upstream)
   + merge ci-dessus. Le garde-fou local de la surcouche Berlinoise s'appuie maintenant sur
   ce signal plutôt que de le dupliquer.
4. **Groupe de pieux (§7.6)** : a priori clos après la revue précédente (Converse-Labarre
   vérifié à la main) — reconfirmer si un point spécifique est soulevé par Henri.
5. **Dérivation CPT/PMT automatique (§7.4)**, si un jour souhaitée en complément de la saisie
   directe ci-dessus — nécessiterait qu'Henri fournisse la méthode/table exacte de sa
   pratique (voir « Constat d'audit » plus haut). Pas urgent : la saisie directe couvre déjà
   le besoin normatif.

## Wiring restant (hors code de calcul)

- [x] README.md, LICENSE — rédigés (README : périmètre, commandes, documentation ; LICENSE MIT).
- [ ] Décision de visibilité : rester privé tant que la phase 4 n'est pas validée (outil à
  responsabilité réglementaire, cf. §13 du CDC). Repasser en public + GitHub Pages, à
  l'anonyme `henri421` comme le reste de la suite, une fois mûr.
- [ ] Une fois public : ajouter l'entrée dans `Structura/index.html` (hub WebAedificium).

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

## Audit des derniers push AI Studio (2026-09-24, Claude)

- **`e7c1756` avait cassé `npm ci`** : 2ᵉ « remove unused recharts » (après `e19d2c2`), alors
  que recharts est utilisé par `GraphiqueCourbeTassement.tsx`. Le lock régénéré n'avait plus
  aucun champ `resolved`. Lock de `42f114a` restauré, `npm ci` vérifié sur un worktree propre.
  **Garde pour Gemini : ne pas toucher `package.json`/`package-lock.json` sans demande.**
- Restes du scaffold retirés : `MAJOR_CAPABILITY_SERVER_SIDE_GEMINI_API` (`metadata.json`),
  `.env.example` (`GEMINI_API_KEY`, `APP_URL`) — rien ne les utilisait.
- Workflow Pages : le job `deploy` ne tourne plus qu'en `workflow_dispatch` (dépôt privé,
  Pages non activé). Un push sur `main` exécute seulement lint + tests + build.
- `tassementELS.ts` (courbe charge-tassement de `4f0fe3d`, jamais revue) : formules conformes
  au CDC §6.5, point ELS de la courbe identique au calcul principal sur le projet exemple
  (q = 104,2 kPa, 39,2 / 14,2 mm). Plancher `Math.max(10, …)` retiré de la courbe (divergeait
  du calcul principal), commentaires « quasi-permanente » et « Annexe F » corrigés.
- **Question ouverte (à trancher par Henri, le CDC §6.5 est muet)** : le tassement utilise la
  pression **brute** V/A, sans déduire le poids du sol excavé. Sur le projet exemple (base à
  3,3 m), c'est nettement conservatif : distorsion 1/432, donc « non conforme » face à 1/500.
  Pression nette `q − σ'v0(base)` ou brute : à fixer dans la spec avant toute modification.
- Mineur, laissé en l'état : seuil « Admissible 50 mm » par défaut du graphique (prop non
  alimentée par l'onglet), à rendre saisissable si besoin.
