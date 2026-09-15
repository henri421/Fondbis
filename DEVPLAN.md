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
| 4 | Module C niveau 2 : phasage et coefficient de réaction | ⏳ Spec prête, revue §8.2 faite — à envoyer à Gemini |
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

## Tâche suivante : Phase 4 — paroi phasée

§8.2 est livrée et revue ci-dessus. C'est « le morceau de bravoure » du projet au sens du
CDC (§8.4) : à lire en entier avant de commencer, ne pas improviser sur les points signalés
« Exigence critique » ou « Simplification ».

Prête à copier telle quelle dans la session AI Studio.

---

**Contexte.** Suite de `src/core/solveurPoutreRessorts.ts` (validé, 13/13) et
`src/modules/soutenement/pressionLimiteParoi.ts` (§8.2, en principe livré juste avant). Objectif :
`src/modules/soutenement/paroiPhasee.ts`, le calcul de paroi flexible phasée du CDC §8.4 —
rideau ou paroi continue, pas encore les surcouches berlinoise/pieux sécants du §8.5 (hors
scope de cette tâche).

**Étape 0 — petite extension du solveur, préalable.** `RessortNodal` doit gagner un champ
optionnel `deplacementReference?: number` (défaut 0, comportement inchangé pour tout appelant
existant — ne casse aucun test T_SOLV). La loi du ressort devient
`F_lineaire = raideur * (u_val - (res.deplacementReference ?? 0))` partout où elle est
utilisée (élastique et bornes de plastification). Raison : un buton ou un tirant posé en
cours de phasage ne « voit » que le déplacement accumulé **après** sa pose, pas le
déplacement déjà présent au nœud au moment de son installation — sinon on lui invente une
précontrainte qui n'existe pas. Ajouter un test unitaire minimal de non-régression (un ressort
avec `deplacementReference = u0` doit donner une réaction nulle exactement quand `u_val = u0`,
peu importe u0).

**Modèle de données.** Étendre `OuvrageSoutenement` (déjà présent dans `types/geotech.ts`,
`type: 'paroiFlexible'`) avec une liste de phases :
```typescript
export interface AppuiPhase {
  id: string;
  cote: number;
  type: 'buton' | 'tirant';
  raideur: number;       // kN/m
  reactionMax?: number;  // kN, capacité de compression (buton) ou traction (tirant)
  reactionMin?: number;
  phaseActivation: number; // index de la phase où l'appui est posé
}

export interface PhaseParoi {
  numero: number;
  nom: string;
  coteFondFouille: number;       // évolue à chaque excavation
  hydrogeologieAmont?: Hydrogeologie; // si non fourni, hérite de la phase précédente
  hydrogeologieAval?: Hydrogeologie;
}
```
Le **maillage vertical est construit une seule fois, sur toute la hauteur de la paroi**, et
reste identique à toutes les phases (mêmes nœuds, même `noeudIndex`) — c'est ce qui permet de
chaîner `etatInitial` d'une phase à l'autre. Ne jamais reconstruire un maillage différent par
phase, même si le fond de fouille change : seules les bornes de pression (donc les ressorts)
changent, pas la géométrie du maillage.

**Convention d'orientation.** Nœuds `{x: 0, y: cote}` (paroi verticale selon l'axe global y),
ressorts de sol et appuis en direction `'x'` (flexion horizontale). Ne bloquer explicitement
aucun DDL en `'x'` ni `'rotation'` nulle part — la stabilité doit venir des ressorts de sol
eux-mêmes, comme une fondation élastique classique ; si `convergence.avertissements` signale
un mécanisme sur un DDL x ou rotation alors que des ressorts sont actifs, c'est une erreur de
modélisation à corriger, pas à contourner par un blocage artificiel. Bloquer uniquement la
direction `'y'` au nœud de base (convention : ce modèle ne représente pas l'équilibre vertical
propre de la paroi — poids propre et frottement vertical hors périmètre de cette tâche).

**Conversion pression → ressort par nœud, par phase.** Pour chaque nœud du maillage, à partir
de `calculerProfilPressionLimite` (§8.2) :
```
largeurTributaire = demi-somme des espacements de maillage adjacents [m]
raideur           = kh(couche) * largeurTributaire     // kh en kN/m³, saisie directe utilisateur par couche (voir remarque)
reactionMax        = Pp(z) * largeurTributaire           // kN/m
reactionMin        = -Pa(z) * largeurTributaire          // kN/m
```
**Simplification à assumer explicitement (à documenter dans le code)** : ceci combine les deux
faces en un seul ressort net par nœud (borné entre poussée limite amont et butée limite aval),
plutôt que deux ressorts indépendants « de chaque côté » comme le formule littéralement le
CDC §8.4. C'est l'approximation usuelle du calcul aux coefficients de réaction quand
l'essentiel de l'intérêt est la partie encastrée sous fouille ; à affiner plus tard si
l'ingénieur le demande. Ne pas présenter le résultat comme plus fin qu'il ne l'est.

**`kh` (coefficient de réaction horizontal).** Saisie directe par couche (kN/m³), en entrée du
modèle — **ne pas inventer de formule de dérivation depuis le module pressiométrique** : le
CDC le permet explicitement en alternative (§8.4) et interdit d'inventer des coefficients
(§13). La dérivation pressiométrique viendra dans une tâche séparée, une fois la formule
fournie par l'ingénieur.

**Boucle de phasage** (structure imposée par le CDC §8.4, à respecter à la lettre) :
```
U_precedent = undefined  // etatInitial pour la première phase
pour chaque phase, dans l'ordre :
    ressorts_sol = conversion ci-dessus, à partir du fond de fouille de CETTE phase
    appuis_actifs = AppuiPhase[] où phaseActivation <= numero de cette phase
    pour chaque appui nouvellement activé À CETTE PHASE (phaseActivation === numero) :
        deplacementReference = U_precedent.deplacements[noeudIndex correspondant].ux ?? 0
        (un appui déjà actif depuis une phase antérieure garde sa deplacementReference d'origine)
    resultat_phase = resoudrePoutreSurRessorts(
        maillage, E, I, A,
        [...ressorts_sol, ...appuis_actifs],
        charges, appuisBloques (base seulement),
        U_precedent  // état initial chaîné
    )
    stocker resultat_phase
    U_precedent = { deplacements: resultat_phase.deplacements, etatRessorts: ... }
```
**Exigence critique (CDC §8.4)** : ne jamais repartir de zéro à une phase donnée. Si un test
échoue à cause de ça, ce n'est pas un détail à corriger après coup — c'est la fonctionnalité
même de cette tâche.

**Tests d'acceptation** dans `src/validation/acceptanceTestsSoutenement.ts` (même fichier ou
nouveau, branché dans `scripts/runAcceptanceTests.ts`) :

- **T_PHASE.1 — Cohérence statique phase unique.** Une phase, pas d'appui, fond de fouille à
  une cote connue, sol homogène, pas de nappe. Comparer la résultante horizontale totale et le
  moment total à la base du maillage donnés par `resoudrePoutreSurRessorts` (somme des
  réactions) à l'intégration trapézoïdale directe du diagramme `Pa(z)`/`Pp(z)` de la brique
  §8.2 sur la même géométrie. Écart < 1 % (erreur de discrétisation seule). Ce test ne dépend
  d'aucune valeur inventée : il compare deux calculs du même code entre eux, pas à une
  référence externe.
- **T_PHASE.2 — Chaînage et buton installé en cours de phasage.** Phase 1 : excavation initiale
  sans buton, le nœud prévu pour le futur buton se déplace de `u1` (non nul, vérifier
  `u1 != 0` dans le test lui-même, sinon le test ne teste rien). Phase 2 : excavation
  supplémentaire + activation d'un buton à ce nœud. Vérifier que la réaction du buton en phase 2
  vaut `raideur * (u2 - u1)` et non `raideur * u2` (à `u1` près, résidu < 1e-6) — ceci
  échouerait si le chaînage d'état était cassé (repart de zéro) ou si `deplacementReference`
  n'était pas branché correctement.
- **T_PHASE.3 — Monotonie physique (garde-fou léger).** Sur une paroi en cantilever sans
  buton, vérifier que le moment fléchissant maximal augmente strictement entre deux phases
  d'excavation successives (plus creusé = plus sollicité) — pas une valeur exacte attendue,
  juste un sens de variation qui doit être respecté ; une régression qui inverserait ce sens
  serait un signal fort d'erreur de signe quelque part dans la chaîne.

**Ne pas dans cette tâche** : les surcouches berlinoise/paroi de pieux sécants (§8.5), l'onglet
UI (`OngletParoiPhasee.tsx` ou équivalent — viendra en tâche séparée une fois le moteur de
calcul revu et validé), la dérivation pressiométrique de `kh`.

---

## Prochaines étapes (selon plan)

Dans l'ordre, une tâche Gemini à la fois, chacune revue et testée avant la suivante :

1. **Phase 4 — paroi phasée** (spec complète ci-dessus, « Tâche suivante ») — §8.2 livrée et
   revue, prête à envoyer à Gemini. L'onglet UI est explicitement hors scope de cette tâche,
   à traiter séparément une fois le moteur de calcul revu.
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
