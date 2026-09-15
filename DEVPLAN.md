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
| — | Brique §9.3 solveur matriciel | ✅ Durci et validé (13/13 T_SOLV.1-6) |
| — | Brique §8.2 profil de pression limite | ✅ Livrée et revue par Claude (14/14, T_PRESS.1) |
| 4 | Module C niveau 2 : phasage et coefficient de réaction | ✅ Moteur + onglet UI livrés, revus par Claude (bug de double-comptage corrigé), 18/18 validés |
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

## Prochaines étapes (selon plan)

Dans l'ordre, une tâche Gemini à la fois, chacune revue et testée avant la suivante :

1. **Phase 5 — Module B transversal** (`src/modules/pieux/comportementTransversal.ts`) :
   courbes p-y (Matlock argiles molles, Reese sables), même solveur, convergence Newton sur raideur sécante.
2. **Groupe de pieux (§7.6)**, complément de la phase 3 restée ouverte : coefficient
   d'efficacité, rupture en bloc, tassement de groupe.
3. **Sensibilité paramétrique (§12.1)** : peut être traitée à tout moment en parallèle,
   indépendante du solveur — dérivée numérique sur les paramètres de sol principaux, affichage
   de la dispersion à côté de chaque résultat.
4. **Phase 6, finalisation** : recherche automatique du cercle critique (grille de centres/
   rayons + raffinement local, déjà en partie présente) et écoulement/réseau simplifié,
   confrontés aux cas de référence publiés (§12.6 — liste à obtenir de l'ingénieur).
5. **Phase 7** : radier sur ressorts itératifs (§6.6, boucle décrite dans le CDC, réutilise le
   solveur de plaque à mutualiser avec la brique matricielle), export vers les modules
   structuraux (format d'échange à définir avec Aedificium/Structura).

## Wiring restant (hors code de calcul)

- README.md, LICENSE — à écrire avant toute publication.
- Décision de visibilité : rester privé tant que la phase 4 n'est pas validée (outil à
  responsabilité réglementaire, cf. §13 du CDC). Repasser en public + GitHub Pages, à
  l'anonyme `henri421` comme le reste de la suite, une fois mûr.
- Une fois public : ajouter l'entrée dans `Structura/index.html` (hub WebAedificium).
