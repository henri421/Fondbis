# Application de calcul géotechnique
## Cahier des charges technique à destination du développeur

Version 1.0. Document de spécification. Destiné à un développeur sans formation géotechnique préalable : chaque formule est donnée explicitement avec ses unités, sa clause de référence et son statut normatif.

Rédigé pour un maître d'ouvrage ingénieur qui assurera la validation technique. Le développeur implémente, l'ingénieur valide.

## 1. Objet et périmètre

### 1.1 Objet

Application web autonome permettant de saisir une stratigraphie de sol avec ses caractéristiques, puis d'effectuer trois familles de vérifications à partir de ce même modèle de terrain :

1. **Fondation superficielle** de type radier ou semelle, portance et tassement.
2. **Fondation profonde** de type pieu isolé ou groupe de pieux, capacité axiale et comportement transversal.
3. **Ouvrage de soutènement** de type mur en L, rideau de pieux sécants, paroi berlinoise.

Chaque famille est vérifiée à l'état limite ultime (résistance) **et** à l'état limite de service (déformation). Ces deux chaînes sont distinctes et ne partagent pas les mêmes valeurs de paramètres. Ce point est structurant, voir section 5.4.

### 1.2 Contraintes imposées

L'application est une **PWA** (Progressive Web App) : elle fonctionne hors ligne, s'installe sur mobile et sur ordinateur, et ne transmet aucune donnée à un serveur. Les données de sol sont des données de projet identifiables ; elles doivent rester sur l'appareil de l'utilisateur. Aucun appel réseau à des fins de calcul n'est autorisé.

Pas de macro VBA, pas de dépendance à un serveur de calcul, pas de compte utilisateur.

### 1.3 Hors périmètre de la version 1

Éléments finis en milieu continu, calcul dynamique et sismique (EN 1998-5), amélioration de sol, congélation, injection, tunnels, murs en sol renforcé, ancrages précontraints (le tirant est modélisé comme un appui élastique, pas dimensionné).

## 2. Cadre normatif retenu

### 2.1 Génération de norme

**Première génération** : EN 1997-1:2004, incluant le corrigendum de février 2009 et l'amendement A1:2013. Toutes les références de clause de ce document renvoient à cette version.

La deuxième génération est publiée (EN 1997-1:2024 règles générales, EN 1997-2:2024 propriétés du terrain, EN 1997-3:2025 ouvrages géotechniques) avec une période de coexistence jusqu'en 2028 selon les calendriers nationaux annoncés. Elle redistribue complètement la matière et modifie la numérotation des clauses ainsi que le schéma de vérification.

**Conséquence pour le développeur** : ne jamais coder un numéro de clause ni un facteur partiel en dur dans une fonction de calcul. Les clauses sont des chaînes de caractères stockées dans un fichier de métadonnées, les facteurs sont des nombres stockés dans un fichier de configuration. La migration vers la deuxième génération devra être un remplacement de fichiers, pas une réécriture.

### 2.2 Annexe nationale

L'application démarre avec les **valeurs recommandées** de l'annexe A de EN 1997-1:2004, sans annexe nationale. Une annexe luxembourgeoise (ILNAS) sera ajoutée ultérieurement, potentiellement suivie d'une annexe belge (NBN ANB).

**Exigence d'interface** : tant qu'aucune annexe nationale n'est chargée, un bandeau permanent, non masquable, affiche le texte suivant en tête de chaque écran de résultat et sur chaque note de calcul exportée :

> Jeu de facteurs partiels : valeurs recommandées EN 1997-1:2004 annexe A. Aucune annexe nationale chargée. Ces valeurs sont des paramètres déterminés au niveau national et peuvent être modifiées par l'annexe nationale applicable au projet. Vérification à la charge de l'ingénieur.

### 2.3 Statut des méthodes

L'Eurocode 7 est une norme de principes, pas de recettes. Plusieurs méthodes de calcul figurent en **annexe informative**, ce qui signifie qu'une annexe nationale peut les remplacer. L'application doit afficher ce statut à côté de chaque résultat.

| Méthode | Clause | Statut |
|-|-|-|
| Portance fondation superficielle | Annexe D | Informative |
| Tassement fondation superficielle | Annexe F | Informative |
| Coefficients de poussée et butée | Annexe C | Informative |
| Facteurs partiels | Annexe A | Normative, mais valeurs = NDP |
| Coefficients de corrélation pieux | Annexe A tableaux A.9 à A.11 | Normative, valeurs = NDP |

## 3. Architecture applicative

### 3.1 Principe fondateur

**Une seule application, un seul modèle de terrain, trois modules consommateurs.**

Les trois modules ne diffèrent pas par la façon de lire le sol. Ils diffèrent par le mécanisme de rupture mobilisé et par la cinématique imposée. Le modèle de terrain est saisi une fois et alimente les trois. Toute architecture obligeant à ressaisir la stratigraphie par module est à rejeter.

### 3.2 Découpage en couches logicielles

```
┌─────────────────────────────────────────────┐
│  Interface (onglets, coupe, formulaires)    │
├─────────────────────────────────────────────┤
│  Modules :  Radier  │  Pieux  │ Soutènement │
├─────────────────────────────────────────────┤
│  Briques transversales :                    │
│  poussée/butée · tassement · stabilité      │
│  générale · hydraulique · solveur matriciel │
├─────────────────────────────────────────────┤
│  Noyau : modèle de terrain, profil d'état,  │
│  valeurs caractéristiques, valeurs de calcul│
├─────────────────────────────────────────────┤
│  Configuration normative (fichier chargé)   │
├─────────────────────────────────────────────┤
│  Persistance : IndexedDB + export/import    │
└─────────────────────────────────────────────┘
```

Règle de dépendance : une couche ne peut appeler que la couche immédiatement inférieure. Un module ne calcule jamais lui-même un profil de contrainte, il le demande au noyau.

### 3.3 Technologie

Application monopage. Le langage est libre (TypeScript recommandé pour le typage du modèle de données). Contraintes :

- Fonctionnement intégral hors ligne après premier chargement, via service worker avec cache versionné.
- Nom de cache incrémenté à chaque déploiement, suppression des anciens caches à l'activation. Prévoir que l'utilisateur doit recharger deux fois après mise à jour, et l'indiquer dans la notice.
- Chemins relatifs uniquement, pour permettre un hébergement sous sous-répertoire (GitHub Pages).
- Aucune bibliothèque nécessitant un appel réseau à l'exécution.
- Le calcul matriciel est écrit en interne ou via une bibliothèque embarquée. Pas de WebAssembly requis : les tailles de problème (200 à 400 degrés de liberté) sont résolues en quelques millisecondes en JavaScript natif.

### 3.4 Persistance

`localStorage` est insuffisant : les profils pénétrométriques bruts dépassent rapidement le quota. Utiliser **IndexedDB** pour la bibliothèque de projets.

Le mécanisme de sauvegarde de référence reste l'**export d'un fichier de projet unique au format JSON**, avec import correspondant. Ce fichier est le format d'échange documenté défini en section 4. Il doit être versionné (champ `schemaVersion`) et l'import doit refuser proprement une version inconnue plutôt que de planter.

### 3.5 Contrainte d'affichage

Une coupe de sol se lit verticalement, ce qui est hostile à un écran de téléphone en mode portrait. Concevoir l'interface autour du dessin de coupe. Prévoir le mode paysage et le pincement pour zoomer. La saisie tabulaire des couches doit rester utilisable en portrait.

## 4. Schéma de données du modèle de terrain

Format JSON. Ce schéma est le contrat entre le noyau et tous les modules. Il doit être figé avant le développement des modules.

### 4.1 Structure générale

```json
{
  "schemaVersion": "1.0",
  "projet": { ... },
  "referentiel": { ... },
  "hydrogeologie": { ... },
  "couches": [ ... ],
  "campagnes": [ ... ],
  "configurationNormative": { ... },
  "ouvrages": { "radiers": [], "pieux": [], "soutenements": [] }
}
```

### 4.2 Référentiel

Convention de cotation : **altitude croissante vers le haut, en mètres**. Toutes les positions verticales internes sont des cotes absolues, jamais des profondeurs relatives. Raison : une excavation déplace la surface, et un repère relatif devient ambigu entre les phases.

```json
"referentiel": {
  "systeme": "NGL",              // chaîne libre, ex. NGL, TAW, local
  "coteTerrainNaturel": 245.30,  // m
  "coteReferenceProjet": 245.00  // m, niveau 0.00 du projet
}
```

### 4.3 Hydrogéologie

```json
"hydrogeologie": {
  "nappePrincipale": {
    "coteCaracteristique": 242.50,   // m, pour l'ELS
    "coteDefavorableELU": 244.00,    // m, pour l'ELU
    "regime": "hydrostatique"        // ou "gradientVertical"
  },
  "gradientVertical": null,           // si régime non hydrostatique : i [-]
  "nappesSecondaires": [
    {
      "type": "suspendue",            // ou "captive"
      "coucheId": "C2",
      "cotePiezometrique": 243.80
    }
  ],
  "poidsVolumiqueEau": 9.81           // kN/m³, paramétrable
}
```

**Point critique.** Les deux cotes, caractéristique et défavorable, sont distinctes et obligatoires. La valeur de calcul du niveau d'eau doit représenter la situation la plus défavorable physiquement plausible (EN 1997-1:2004 clause 2.4.6.1). Une erreur sur ce point est l'une des causes les plus fréquentes de sous-dimensionnement, devant toute erreur de formule. L'interface doit rendre la saisie des deux valeurs obligatoire, sans valeur par défaut égalisant les deux.

### 4.4 Couches

Chaque couche est un objet. Les couches sont ordonnées de haut en bas et doivent être jointives : le noyau vérifie et refuse tout recouvrement ou toute lacune.

```json
{
  "id": "C2",
  "nom": "Argile limoneuse ferme",
  "coteToit": 243.10,
  "epaisseur": 4.20,
  "nature": "argile",        // sable, limon, argile, tourbe, roche, remblai
  "couleurAffichage": "#8a6d3b",

  "poidsVolumiques": {
    "gammaHumide": { "v": 19.0, "u": "kN/m3", "statut": "correle", "source": "..." },
    "gammaSature":  { "v": 20.5, "u": "kN/m3", "statut": "correle", "source": "..." }
  },

  "resistanceDrainee": {
    "phiPrime":      { "v": 26.0, "u": "deg",  "statut": "correle",  "source": "..." },
    "phiCritique":   { "v": 24.0, "u": "deg",  "statut": "choix",    "source": "..." },
    "cPrime":        { "v": 5.0,  "u": "kPa",  "statut": "choix",    "source": "..." },
    "psiDilatance":  { "v": 0.0,  "u": "deg",  "statut": "choix",    "source": "..." },
    "deltaInterface":{ "v": 24.0, "u": "deg",  "statut": "derive",   "source": "..." }
  },

  "resistanceNonDrainee": {
    "cuTete":     { "v": 65.0, "u": "kPa",     "statut": "mesure", "source": "..." },
    "gradientCu": { "v": 2.5,  "u": "kPa/m",   "statut": "mesure", "source": "..." }
  },

  "deformation": {
    "Echargement":  { "v": 12.0,  "u": "MPa", "statut": "correle", "source": "..." },
    "EdechargeRech":{ "v": 36.0,  "u": "MPa", "statut": "correle", "source": "..." },
    "nu":           { "v": 0.30,  "u": "-",   "statut": "choix",   "source": "..." },
    "Eoed":         { "v": 16.0,  "u": "MPa", "statut": "correle", "source": "..." },
    "Cc":           { "v": 0.22,  "u": "-",   "statut": "mesure",  "source": "..." },
    "Cs":           { "v": 0.04,  "u": "-",   "statut": "mesure",  "source": "..." },
    "e0":           { "v": 0.78,  "u": "-",   "statut": "mesure",  "source": "..." },
    "sigmaPrecons": { "v": 180.0, "u": "kPa", "statut": "mesure",  "source": "..." },
    "OCR":          { "v": null,  "u": "-",   "statut": "derive",  "source": "..." },
    "Calpha":       { "v": 0.004, "u": "-",   "statut": "choix",   "source": "..." },
    "cv":           { "v": 2.5e-7,"u": "m2/s","statut": "mesure",  "source": "..." },
    "k":            { "v": 1e-9,  "u": "m/s", "statut": "correle", "source": "..." }
  }
}
```

**Le triplet valeur / statut / source est obligatoire pour chaque grandeur.** Ce n'est pas un raffinement optionnel : c'est ce qui permet à la note de calcul d'indiquer d'où vient chaque chiffre, et c'est la fonctionnalité qui distingue l'application d'un tableur.

Valeurs autorisées du champ `statut` :

- `mesure` : issue directement d'un essai de laboratoire ou in situ.
- `correle` : dérivée d'un essai par une corrélation, dont le nom figure dans `source`.
- `derive` : calculée à partir d'autres champs du même objet (exemple : OCR depuis sigmaPrecons).
- `choix` : valeur retenue par l'ingénieur sans support de mesure directe.
- `defaut` : valeur proposée par l'application et non modifiée par l'utilisateur. À afficher en couleur d'alerte.

Note sur `deltaInterface` : angle de frottement à l'interface sol-structure. Valeur par défaut proposée selon EN 1997-1:2004 clause 6.5.3 : égale à `phiCritique` pour du béton coulé en place contre le sol, et deux tiers de `phiCritique` pour une surface préfabriquée lisse. L'application propose, l'utilisateur confirme.

### 4.5 Campagnes d'essais

Les profils bruts sont stockés séparément des couches et rattachés à un sondage localisé.

```json
{
  "id": "CPT-03",
  "type": "CPT",                  // CPT, CPTu, SPT, DPSH, PMT
  "x": 0.0, "y": 0.0,             // m, repère local de chantier
  "coteTete": 245.10,
  "profil": [
    { "z": 0.02, "qc": 1.8, "fs": 0.021, "u2": 0.0 }
  ]
}
```

Unités : `z` en m (profondeur sous la tête de sondage), `qc` en MPa, `fs` en MPa, `u2` en kPa. Pour un SPT : champ `N` et `N60`. Pour un PMT : `plNette` en MPa et `EM` en MPa.

Import depuis fichier CSV ou texte à colonnes, avec un assistant de correspondance des colonnes et de détection du séparateur décimal (virgule française attendue).

### 4.6 Fonction de dérivation

Le lien entre un profil brut et les paramètres d'une couche passe par une **fonction de dérivation explicite, éditable et jamais silencieuse**.

Interface attendue : l'utilisateur sélectionne une plage de profondeur sur le profil affiché, choisit une corrélation dans une liste, et l'application propose une valeur assortie de sa dispersion. L'utilisateur accepte, modifie, ou rejette. La corrélation retenue est écrite dans le champ `source`.

Les corrélations elles-mêmes sont stockées dans un fichier de références séparé, avec leur référence bibliographique et leur domaine de validité. Elles ne sont pas codées en dur. La liste initiale des corrélations sera fournie par l'ingénieur ; le développeur implémente le mécanisme, pas le contenu.

### 4.7 Configuration normative

Fichier interchangeable, aucune formule, uniquement des nombres nommés.

```json
"configurationNormative": {
  "identifiant": "EC7-2004-valeurs-recommandees",
  "libelle": "EN 1997-1:2004, annexe A, valeurs recommandées",
  "annexeNationale": null,
  "approcheCalcul": "DA2",        // DA1, DA2, DA3
  "facteursActions": { "A1": {...}, "A2": {...} },
  "facteursSol":     { "M1": {...}, "M2": {...} },
  "facteursResistance": { "R1": {...}, "R2": {...}, "R3": {...}, "R4": {...} },
  "coefficientsCorrelationPieux": { "xi3": {...}, "xi4": {...} }
}
```

Le développeur encode les tableaux A.1 à A.14 de EN 1997-1:2004 à partir du texte de la norme fourni par l'ingénieur. Les valeurs ci-dessous sont indiquées comme cadrage de développement et **doivent être recoupées sur le texte avant livraison** :

Actions, tableau A.3 : jeu A1, permanent défavorable 1.35, variable défavorable 1.50 ; jeu A2, permanent défavorable 1.00, variable défavorable 1.30. Actions favorables : 1.00 dans les deux jeux, variable favorable 0.

Propriétés du terrain, tableau A.4 : jeu M1, tous facteurs à 1.00 ; jeu M2, facteur sur **la tangente** de l'angle de frottement effectif 1.25, sur la cohésion effective 1.25, sur la cohésion non drainée 1.40, sur la résistance à la compression simple 1.40, sur le poids volumique 1.00.

**Attention, erreur d'implémentation classique** : le facteur porte sur `tan(phi')`, pas sur `phi'`. La valeur de calcul s'obtient par `phi'_d = arctan( tan(phi'_k) / gamma_phi )`.

Résistances fondations superficielles, tableau A.5 : R1 portance 1.00 et glissement 1.00 ; R2 portance 1.40 et glissement 1.10 ; R3 portance 1.00 et glissement 1.00.

Combinaisons d'approche, clause 2.4.7.3.4 :

| Approche | Combinaison | Actions | Sol | Résistance |
|-|-|-|-|-|
| DA1 | C1 | A1 | M1 | R1 |
| DA1 | C2 | A2 | M2 | R1 |
| DA1 | C2 pieux et ancrages | A2 | M1 | R4 |
| DA2 | unique | A1 | M1 | R2 |
| DA3 | unique | A1 sur actions de structure, A2 sur actions géotechniques | M2 | R3 |

L'application calcule et affiche **toutes les combinaisons pertinentes de l'approche active**, en signalant laquelle gouverne. Elle ne présente jamais un résultat unique sans indiquer la combinaison dont il provient.

## 5. Noyau de calcul

### 5.1 Maillage vertical

Le noyau construit un maillage vertical raffiné automatiquement aux points singuliers : chaque interface de couche, chaque niveau de nappe, chaque cote d'ouvrage (base de fondation, pointe de pieu, fond de fouille, niveau de buton). Pas de maillage par défaut : 0.10 m, paramétrable.

### 5.2 Profil d'état

Pour chaque nœud du maillage, le noyau calcule et met à disposition :

- Contrainte totale verticale `sigma_v` [kPa], par intégration descendante du poids volumique, humide au-dessus de la nappe et saturé en dessous.
- Pression interstitielle `u` [kPa], hydrostatique par défaut : `u = gamma_w * (cote_nappe - cote)`, nulle au-dessus de la nappe.
- Contrainte effective verticale `sigma_v' = sigma_v - u` [kPa].

Deux profils sont calculés et conservés en parallèle : un profil ELS avec `coteCaracteristique`, un profil ELU avec `coteDefavorableELU`.

### 5.3 Passage aux valeurs caractéristiques

EN 1997-1:2004 clause 2.4.5.2 : la valeur caractéristique est une **estimation prudente de la valeur gouvernant l'état limite considéré**, et non une moyenne arithmétique.

L'application matérialise ce choix comme une étape explicite, avec au minimum trois modes proposés à l'utilisateur pour chaque paramètre dérivé d'une population de mesures : moyenne, moyenne minorée d'un écart-type, fractile à 5 %. Le mode retenu est enregistré dans le champ `source`.

Le choix dépend du volume de sol mobilisé par le mécanisme de rupture : un mécanisme moyennant un grand volume justifie la moyenne, un mécanisme localisé appelle un fractile bas. L'application affiche cette nuance en aide contextuelle mais ne décide pas à la place de l'utilisateur.

### 5.4 Deux chaînes parallèles, ELU et ELS

**Exigence d'architecture centrale.** Chaque module possède deux chaînes de calcul distinctes alimentées par le même modèle de terrain :

- **Chaîne ELU** : valeurs de calcul obtenues en appliquant les facteurs partiels du jeu M actif aux valeurs caractéristiques de résistance, et les facteurs du jeu A aux actions. Produit un taux d'exploitation.
- **Chaîne ELS** : valeurs caractéristiques, facteurs partiels tous égaux à 1.00 (clause 2.4.8), combinaisons caractéristique, fréquente et quasi permanente selon EN 1990. Produit un déplacement, une rotation, une distorsion.

Le typage doit rendre impossible le mélange des deux. Un tassement calculé avec un angle de frottement minoré par 1.25 n'a aucun sens physique, et c'est une erreur que produisent régulièrement les tableurs mal construits. Recommandation : deux types distincts `ParametresCaracteristiques` et `ParametresDeCalcul`, non interchangeables, avec une fonction de conversion unique et explicite.

## 6. Module A : fondations superficielles et radier

### 6.1 Données d'entrée de l'ouvrage

Géométrie : longueur L, largeur B, cote de la base, épaisseur. Pour un radier, contour polygonal autorisé en phase ultérieure ; rectangle en phase 1.

Actions en base : effort vertical V, efforts horizontaux Hx et Hy, moments Mx et My, chacun décomposé en permanent et variable, favorable et défavorable.

Contexte : présence d'un dallage, d'un sous-sol, cote du terrain fini de part et d'autre.

### 6.2 ELU de portance

Base normative : EN 1997-1:2004 clause 6.5.2, méthode de l'annexe D, **informative**.

**Excentrement et surface effective** (annexe D) :

```
e_B = M_L / V        e_L = M_B / V
B' = B - 2*e_B       L' = L - 2*e_L       A' = B' * L'
```

Le rapport `B'/L'` est recalculé sur les dimensions effectives et c'est lui qui entre dans les facteurs de forme. Vérifier et signaler si `e_B > B/6` (décollement partiel) et refuser le calcul si `e_B >= B/2`.

L'excentrement est fortement non linéaire dans son effet : un radier de bâtiment reçoit toujours un moment, et c'est le premier poste d'erreur du module.

**Condition drainée** :

```
R / A' = c' * Nc * bc * sc * ic
       + q' * Nq * bq * sq * iq
       + 0.5 * gamma' * B' * Ngamma * bg * sg * ig
```

Facteurs de portance :

```
Nq     = exp(pi * tan(phi')) * tan²(45° + phi'/2)
Nc     = (Nq - 1) * cot(phi')
Ngamma = 2 * (Nq - 1) * tan(phi')
```

Facteurs de forme (semelle rectangulaire) :

```
sq = 1 + (B'/L') * sin(phi')
sg = 1 - 0.3 * (B'/L')
sc = (sq * Nq - 1) / (Nq - 1)
```

Facteurs d'inclinaison de la charge :

```
m  = (2 + B'/L') / (1 + B'/L')     si H agit selon B'
iq = [1 - H / (V + A'*c'*cot(phi'))]^m
ig = [1 - H / (V + A'*c'*cot(phi'))]^(m+1)
ic = iq - (1 - iq) / (Nc * tan(phi'))
```

`q'` est la contrainte effective verticale de surcharge au niveau de la base de la fondation, côté le plus défavorable. `gamma'` est le poids volumique effectif sous la base.

**Condition non drainée** :

```
R / A' = (pi + 2) * cu * bc * sc * ic + q
sc = 1 + 0.2 * (B'/L')
ic = 0.5 * (1 + sqrt(1 - H / (A' * cu)))
```

`q` est ici la contrainte **totale** de surcharge, pas effective. Ne pas confondre : c'est une source d'erreur fréquente.

Les deux conditions sont calculées et affichées séparément. Pour un sol argileux, les deux sont pertinentes et la plus défavorable gouverne, l'une représentant le court terme et l'autre le long terme.

Vérification : `V_d <= R_d = R_k / gamma_R;v`

### 6.3 ELU de glissement

Clause 6.5.3.

```
Drainé     : R_d = V'_d * tan(delta_d)
Non drainé : R_d = A_c * cu_d
```

avec en complément la limitation `H_d <= 0.4 * V_d` en condition non drainée (clause 6.5.3(12)), et l'exclusion de toute adhérence entre sol et fondation si une décompression ou un retrait est possible.

### 6.4 ELU hydrauliques

Section 10. Souvent oubliés, souvent dimensionnants dès qu'un sous-sol se trouve sous nappe.

- **UPL**, soulèvement global par sous-pression, clause 10.2 : `V_dst;d <= G_stb;d + R_d`.
- **HYD**, soulèvement hydraulique et renard, clause 10.3 : `u_dst;d <= sigma_stb;d`, ou de façon équivalente en termes de gradient.

Ces vérifications utilisent des facteurs partiels spécifiques (tableaux A.15 à A.17) et doivent être présentées séparément des vérifications GEO.

### 6.5 ELS de tassement

Découpage en sous-couches suivant le maillage du noyau.

**Diffusion des contraintes** : incrément de contrainte verticale `Delta_sigma_v(z)` sous le centre et sous les angles de la fondation, par la solution de Boussinesq intégrée sur une surface rectangulaire chargée (solution de Steinbrenner pour l'angle, superposition pour les autres points).

**Tassement immédiat** (composante élastique), annexe F, informative.

**Tassement de consolidation**, par sous-couche, en distinguant recompression et compression vierge :

```
sigma'_finale = sigma'_v0 + Delta_sigma_v

si sigma'_finale <= sigma'_p  (surconsolidé, recompression seule) :
    s_i = H_i * Cs/(1+e0) * log10(sigma'_finale / sigma'_v0)

si sigma'_v0 >= sigma'_p  (normalement consolidé) :
    s_i = H_i * Cc/(1+e0) * log10(sigma'_finale / sigma'_v0)

sinon (franchissement de la pression de préconsolidation) :
    s_i = H_i * Cs/(1+e0) * log10(sigma'_p / sigma'_v0)
        + H_i * Cc/(1+e0) * log10(sigma'_finale / sigma'_p)
```

Le troisième cas est celui que les tableurs oublient le plus souvent.

**Fluage secondaire** :

```
s_alpha = H_i * Calpha/(1+e0) * log10(t / t_100)
```

**Sorties obligatoires** : tassement total, tassement différentiel entre deux points désignés, distorsion angulaire. Ce sont les tassements différentiels qui endommagent la structure, pas le tassement absolu. L'affichage doit refléter cette hiérarchie.

### 6.6 Extension phase 7 : radier sur ressorts itératifs

Un radier n'est pas un objet géotechnique isolé : c'est une dalle sur appui élastique. Le coefficient de réaction ne doit pas être choisi au jugé mais obtenu par itération :

1. Estimer un coefficient de réaction initial `ks`.
2. Résoudre la dalle sur ressorts, obtenir la distribution de pression sous la fondation.
3. Recalculer le tassement en chaque point par la méthode géotechnique de 6.5, appliquée à cette distribution de pression.
4. Mettre à jour `ks = pression / tassement` localement.
5. Itérer jusqu'à convergence sur le champ de tassement, critère relatif 1 %.

Cette boucle est ce qu'un tableur ne sait pas faire, et c'est la valeur ajoutée principale du module. Elle suppose un solveur de plaque, à mutualiser avec la brique matricielle.

## 7. Module B : fondations profondes

### 7.1 Trois voies de détermination de la capacité axiale

L'Eurocode 7 traite différemment trois voies (section 7.6) :

1. Essai de chargement statique, coefficients `xi1` et `xi2`, tableau A.9.
2. Méthodes fondées sur les résultats d'essais de terrain, clause 7.6.2.3, coefficients `xi3` et `xi4`, tableau A.10.
3. Essais dynamiques, coefficients `xi5` et `xi6`, tableau A.11.

La voie 2 est la voie normale de la pratique courante et constitue la cible de la phase 3.

### 7.2 Coefficients de corrélation, clause 7.6.2.3

Particularité de l'Eurocode 7 souvent mal comprise, que l'application doit rendre limpide :

```
Rc;k = min { (Rc;calc)_moyenne / xi3 ; (Rc;calc)_minimale / xi4 }
```

où la moyenne et le minimum portent sur les valeurs calculées à partir de **n profils d'essai indépendants**, et où `xi3` et `xi4` décroissent avec n. Plus la reconnaissance est dense, plus la capacité retenue est élevée : le code récompense l'investigation.

L'application affiche les deux branches et indique laquelle gouverne.

Valeurs du tableau A.10 à recouper sur le texte de la norme avant livraison. Ordre de grandeur pour cadrage du développement : pour n = 1, environ 1.40 pour les deux ; pour n = 3, environ 1.33 et 1.23 ; pour n = 5, environ 1.29 et 1.15 ; pour n = 10, environ 1.25 et 1.08.

### 7.3 Résistance de calcul

```
Rc;d = Rb;k / gamma_b + Rs;k / gamma_s
```

avec des facteurs distincts selon le mode d'exécution (battu, foré, à la tarière continue) et le jeu R actif. Tableaux A.6, A.7, A.8.

### 7.4 Méthode de dérivation depuis le pénétromètre statique

**Ce contenu sera fourni par l'ingénieur.** La méthode de référence en pratique régionale dérive la résistance de pointe unitaire et le frottement latéral unitaire à partir du profil de résistance de cône, avec des facteurs de type de pointe, d'effet d'échelle, de mode d'exécution et de catégorie de sol.

Le développeur implémente le **mécanisme** : une fonction de dérivation paramétrée, lisant ses coefficients dans un fichier de tables externe, avec traçabilité de chaque coefficient appliqué. Il n'invente aucun coefficient. Une erreur d'un dixième sur l'un de ces facteurs déplace la charge portante de plusieurs dizaines de pour cent.

### 7.5 Frottement négatif

**Point conceptuel à ne pas escamoter** : le frottement négatif n'est pas une résistance en moins, c'est une **action en plus**. Il s'ajoute au côté sollicitation de l'inéquation de vérification et reçoit un facteur partiel d'action, pas un facteur de résistance.

Entrées : cote du plan neutre ou calcul de celui-ci, tassement du sol environnant, contrainte de cisaillement mobilisée le long du fût au-dessus du plan neutre.

### 7.6 Groupe de pieux

Coefficient d'efficacité, vérification de rupture en bloc (le groupe et le sol entre pieux se comportant comme une fondation massive équivalente), tassement du groupe supérieur au tassement du pieu isolé.

### 7.7 Comportement transversal, phase 5

Modèle : poutre sur appuis élastiques non linéaires. Le pieu est discrétisé en éléments de poutre, le sol est représenté par des ressorts non linéaires dont la loi effort-déplacement est une courbe de réaction.

Familles de courbes à implémenter : formulation de Matlock pour les argiles molles, formulation de Reese pour les sables, approche pressiométrique en alternative.

Résolution : itération de Newton sur la raideur sécante des ressorts, jusqu'à convergence sur le champ de déplacement. Typiquement 20 à 50 éléments, donc 100 degrés de liberté, convergence en quelques dizaines d'itérations. Temps de calcul négligeable dans un navigateur.

Sorties : déplacement en tête, moment fléchissant maximal et sa cote, effort tranchant, réaction mobilisée sur la hauteur.

## 8. Module C : ouvrages de soutènement

### 8.1 Principe organisateur

**Les types d'ouvrage ne diffèrent pas par les formules de poussée. Ils diffèrent par leur rigidité et par leur histoire de construction.**

- Le **mur en L** est rigide. Il se vérifie par équilibre limite global sur un bloc, avec le sol reposant sur la semelle participant au poids stabilisant. Une seule phase suffit.
- La **paroi de pieux sécants** et la **berlinoise** sont flexibles. Leur sollicitation dépend de l'ordre des phases d'excavation, de la pose des butons ou tirants, et de la déformation déjà accumulée. Un calcul en une seule phase donne des moments faux.

Cette distinction structure le module : une couche commune de poussée et butée, deux niveaux d'analyse, des surcouches par type d'ouvrage.

### 8.2 Couche commune : poussée, butée, eau, surcharges

Base : EN 1997-1:2004 section 9 et annexe C (informative).

Coefficients de poussée et de butée, formulations de Rankine et de Coulomb, avec prise en compte du frottement sol-paroi `delta` et de l'inclinaison du terre-plein et du parement. Coefficient des terres au repos `K0` pour les ouvrages non déplaçables.

```
Rankine, delta = 0, terre-plein horizontal :
Ka = (1 - sin(phi')) / (1 + sin(phi'))
Kp = (1 + sin(phi')) / (1 - sin(phi'))
```

Le cas général avec `delta` non nul doit utiliser les formulations de Coulomb ou les tables de l'annexe C. Attention : la formule de Coulomb pour la butée surestime fortement `Kp` quand `delta` est grand ; prévoir la limitation ou la formulation par surfaces de rupture courbes, et signaler le cas à l'utilisateur.

Pression d'eau de part et d'autre, différentielle, avec possibilité de régime d'écoulement autour du pied de la paroi.

Surcharges : uniforme, en bande, linéaire. Diffusion selon Boussinesq pour les charges locales.

### 8.3 Niveau d'analyse 1 : équilibre limite

Suffisant pour le prédimensionnement et pour le mur en L.

Pour le mur en L, quatre vérifications :
1. Glissement sur la base (clause 6.5.3).
2. Portance de la semelle (clause 6.5.2, module A réutilisé).
3. Renversement, état limite EQU.
4. Stabilité générale (clause 11, brique transversale).

Pour un rideau, détermination de la fiche par équilibre des moments, avec appui simple en tête ou encastrement en pied, et méthode de Blum pour la réaction de contrebutée avec majoration forfaitaire de la fiche.

### 8.4 Niveau d'analyse 2 : coefficient de réaction et phasage

Standard professionnel réel des parois flexibles. C'est le morceau de bravoure du projet.

Modèle : la paroi est une poutre verticale. Le sol est représenté de chaque côté par des ressorts élastoplastiques dont la réaction est bornée par la poussée limite d'un côté et la butée limite de l'autre. Les butons et tirants sont des appuis élastiques ponctuels, activés à une phase donnée.

Algorithme de phasage :

```
pour chaque phase :
    appliquer les modifications de géométrie (excavation, remblai)
    activer ou désactiver les appuis (butons, tirants)
    modifier les niveaux d'eau
    résoudre l'équilibre non linéaire par Newton, en partant
      de l'état de déplacement de la phase précédente
    stocker l'état complet (déplacements, réactions, moments)
```

**Exigence critique** : l'état initial de chaque phase est l'état final de la phase précédente, y compris les déplacements accumulés et l'état de plastification des ressorts. Une implémentation qui repart de zéro à chaque phase est fausse.

Détermination du coefficient de réaction horizontal : formulations classiques dérivées du module pressiométrique, à paramétrer. Prévoir la saisie directe en alternative.

Sorties par phase : déformée, moment fléchissant, effort tranchant, effort dans chaque appui, pression mobilisée de chaque côté, taux de mobilisation de la butée.

### 8.5 Surcouches par type d'ouvrage

**Berlinoise** : répartition des efforts entre profilés verticaux et blindage horizontal, avec effet de voûte du sol entre montants. Vérification de la stabilité du blindage non soutenu en phase provisoire, entre l'excavation et la pose. Vérification de la fiche du profilé sur sa largeur d'influence réduite sous le fond de fouille.

**Paroi de pieux sécants** : vérification du recouvrement en fonction du diamètre, de l'entraxe et de la tolérance de verticalité. Le recouvrement décroît avec la profondeur du fait de la dérive des forages, ce qui conditionne l'étanchéité et la continuité mécanique. Calcul de l'inertie équivalente de la section composite pieux primaires et secondaires.

**Mur en L** : dimensionnement béton armé du voile et de la semelle. Cette partie est renvoyée aux modules structuraux existants du maître d'ouvrage ; prévoir une sortie des sollicitations dans un format d'échange.

## 9. Briques transversales

### 9.1 Stabilité générale

Méthode des tranches, formulation de Bishop simplifiée, surfaces de rupture circulaires. Recherche automatique du cercle critique par balayage d'une grille de centres et de rayons, avec raffinement local autour du minimum.

Indispensable pour un soutènement en pente et pour une fondation en tête de talus. Section 11 de EN 1997-1:2004.

Performance : plusieurs milliers de cercles découpés en 50 tranches restent sous la seconde en JavaScript. Prévoir une barre de progression au-delà de 2000 cercles.

### 9.2 Écoulement et gradient hydraulique

Vérification du gradient hydraulique critique en fond de fouille, gouvernant le renard. Réseau d'écoulement simplifié autour du pied de la paroi, ou saisie directe de la perte de charge.

### 9.3 Solveur matriciel

Élément de poutre plan à six degrés de liberté, assemblage en matrice bande, factorisation directe. Support des appuis élastiques et des non-linéarités de ressort par itération de Newton avec raideur sécante.

Cette brique sert le pieu transversal, la paroi phasée et le radier sur ressorts. Elle doit être écrite une seule fois, testée indépendamment, et documentée.

### 9.4 Traçabilité

Moteur attachant à chaque grandeur calculée son origine, ses entrées, la formule appliquée et sa clause de référence. Permet de générer une note de calcul dans laquelle chaque chiffre est justifiable.

Format de sortie : HTML imprimable et export PDF côté client. Pas de génération serveur.

## 10. Exigences transversales d'interface

Cellules d'entrée visuellement distinctes des valeurs calculées. Aucune valeur codée en dur dans une formule si elle peut être référencée depuis les entrées : toute modification d'entrée recalcule l'ensemble.

Chaque ligne de résultat porte son unité, la formule symbolique et une note explicative accessible.

Affichage systématique, à côté de chaque résultat : la combinaison qui gouverne, le statut normatif de la méthode, et le taux d'exploitation.

Annulation et rétablissement sur toutes les opérations destructives, en particulier tout générateur automatique. Aucune fonction ne doit pouvoir écraser un modèle sans retour possible.

## 11. Phasage et livrables

| Phase | Contenu | Livrable utilisable seul |
|-|-|-|
| 0 | Noyau : saisie stratigraphie, coupe, nappe, profil de contraintes, import CPT, config normative | Outil de profil de contraintes |
| 1 | Module A : radier, portance ELU, glissement, tassement ELS | Vérification de fondation superficielle |
| 2 | Module C niveau 1 : mur en L | Vérification de mur poids |
| 3 | Module B : pieu axial isolé puis groupe | Capacité portante de pieu |
| 4 | Module C niveau 2 : phasage et coefficient de réaction, parois flexibles | Calcul de paroi |
| 5 | Module B transversal : courbes de réaction | Pieu sous charge horizontale |
| 6 | Briques : stabilité générale, hydraulique | Stabilité de talus |
| 7 | Couplages : radier sur ressorts itératifs, export vers modules structuraux | Chaîne complète |

Chaque phase est livrée avec ses tests d'acceptation passés et sa notice à jour. Aucune phase ne démarre avant validation de la précédente par l'ingénieur.

## 12. Plan de validation

### 12.1 Principe

La vérification interne ne suffit pas. Chaque module se valide contre un calcul manuel indépendant et, quand c'est possible, contre une seconde méthode. Les écarts entre méthodes sont **affichés**, jamais masqués.

Ajouter une analyse de sensibilité paramétrique par dérivée numérique sur les paramètres principaux. La dispersion des paramètres de sol domine largement la finesse du modèle : afficher un résultat à trois chiffres significatifs sans indicateur de sensibilité serait trompeur.

### 12.2 Tests d'acceptation de la phase 0

**T0.1 Profil de contraintes.** Terrain naturel à la cote 100.00. Couche 1 de 0 à 3 m de profondeur, `gammaHumide` 18.0, `gammaSature` 20.0. Nappe à 2 m de profondeur. Attendu à 5 m de profondeur, en supposant la couche 1 prolongée :

```
sigma_v  = 18.0 * 2 + 20.0 * 3      = 96.00 kPa
u        = 9.81 * 3                 = 29.43 kPa
sigma_v' = 96.00 - 29.43            = 66.57 kPa
```

Tolérance 0.01 kPa.

**T0.2 Facteur partiel sur l'angle de frottement.** `phi'_k = 30.0°`, `gamma_phi = 1.25`.

```
tan(30°) = 0.577350
0.577350 / 1.25 = 0.461880
phi'_d = arctan(0.461880) = 24.79°
```

Attendu 24.79°. Un résultat de 24.00° signale l'erreur d'implémentation classique (facteur appliqué à l'angle et non à sa tangente) : le test doit échouer explicitement dans ce cas.

### 12.3 Tests d'acceptation de la phase 1

**T1.1 Portance drainée, semelle filante, charge centrée verticale.** Données : `phi'` 30.0°, `c'` 0, `gamma` 18.0 kN/m³, profondeur d'encastrement D = 1.00 m, largeur B = 2.00 m, semelle filante (L très grand), pas de nappe, charge verticale centrée.

Calcul manuel, valeurs caractéristiques (jeu M1) :

```
Nq     = exp(pi * tan30°) * tan²(60°) = exp(1.81380) * 3.00000
       = 6.13375 * 3.00000 = 18.4013
Ngamma = 2 * (18.4013 - 1) * tan30° = 2 * 17.4013 * 0.577350 = 20.0938
q'     = 18.0 * 1.00 = 18.00 kPa
s = i = b = 1 (semelle filante, charge centrée verticale, base horizontale)

R/A' = 18.00 * 18.4013 + 0.5 * 18.0 * 2.00 * 20.0938
     = 331.22 + 361.69
     = 692.9 kPa
```

Attendu 692.9 kPa, tolérance 0.5 kPa.

**T1.2 Portance drainée, valeurs de calcul jeu M2.** Mêmes données, `gamma_phi = 1.25` donc `phi'_d = 24.79°`.

```
tan(24.79°) = 0.461880
Nq     = exp(pi * 0.461880) * (1 + sin24.79°)/(1 - sin24.79°)
       = exp(1.45104) * (1.41937 / 0.58063)
       = 4.26760 * 2.44453 = 10.4323
Ngamma = 2 * (10.4323 - 1) * 0.461880 = 8.7134
R/A'   = 18.00 * 10.4323 + 0.5 * 18.0 * 2.00 * 8.7134
       = 187.78 + 156.84
       = 344.6 kPa
```

Attendu 344.6 kPa, tolérance 0.5 kPa. Ce test vérifie en outre que le rapport entre T1.1 et T1.2 vaut environ 2.01 : minorer l'angle de frottement de 25 % divise la portance par deux. Le développeur doit considérer ce facteur 2 comme un indicateur de bonne implémentation, et non comme une anomalie.

**T1.3 Tassement œdométrique, franchissement de la pression de préconsolidation absent.** Couche de 2.00 m, `Cc` 0.20, `e0` 0.80, `sigma'_v0` 100.0 kPa, `Delta_sigma` 50.0 kPa, sol normalement consolidé.

```
s = 2.00 * 0.20/(1 + 0.80) * log10(150.0/100.0)
  = 2.00 * 0.111111 * 0.176091
  = 0.03913 m = 39.1 mm
```

Attendu 39.1 mm, tolérance 0.1 mm.

### 12.4 Tests d'acceptation de la phase 2

**T2.1 Poussée de Rankine.** Mur de hauteur 5.00 m, sol `phi'` 30.0°, `gamma` 18.0 kN/m³, pas de nappe, pas de surcharge, terre-plein horizontal, `delta` = 0.

```
Ka = (1 - 0.5)/(1 + 0.5) = 0.33333
Pa = 0.5 * 18.0 * 5.00² * 0.33333 = 75.0 kN/m
Point d'application : 5.00/3 = 1.667 m au-dessus de la base
```

Attendu 75.0 kN/m et 1.667 m, tolérances 0.1 kN/m et 0.005 m.

### 12.5 Tests d'acceptation de la phase 3

**T3.1 Coefficients de corrélation.** Trois profils d'essai, valeurs calculées de résistance en compression 950, 1100 et 950 kN.

```
moyenne = 1000.0 kN
minimum = 950.0 kN
xi3 = 1.33, xi4 = 1.23   (n = 3, à recouper sur le tableau A.10)

Rc;k = min( 1000.0/1.33 ; 950.0/1.23 )
     = min( 751.9 ; 772.4 )
     = 751.9 kN
```

Attendu 751.9 kN, et l'application doit afficher que c'est la branche moyenne qui gouverne. Ce test vérifie que les deux branches sont bien calculées et comparées, et non qu'une seule est implémentée.

### 12.6 Tests des phases 4 à 7

Les phases non linéaires se valident contre des exemples publiés et contre des essais de chargement documentés, et non contre un calcul manuel. La liste des cas de référence sera fournie par l'ingénieur au démarrage de chaque phase. Le développeur prévoit dès la phase 0 un mécanisme de jeu de tests enregistrés, exécutable d'un clic, avec rapport d'écarts.

## 13. Réserves et responsabilités

L'application est une **aide au calcul**. Elle ne remplace ni une reconnaissance de sol, ni le jugement d'un ingénieur géotechnicien. La responsabilité du dimensionnement reste entière entre les mains de l'ingénieur du projet.

Le modèle de terrain saisi engage davantage que le calcul lui-même. Une stratigraphie mal interprétée produira un résultat faux qu'aucune rigueur de programmation ne rattrapera. L'interface doit refléter cette hiérarchie : la saisie du sol mérite plus de soin d'ergonomie que l'affichage des résultats.

Points à confirmer par l'ingénieur avant ou pendant le développement, listés ici pour mémoire :

1. Valeurs exactes des tableaux A.1 à A.17 de EN 1997-1:2004, à fournir depuis le texte de la norme.
2. Approche de calcul par défaut, dans l'attente de l'annexe luxembourgeoise ILNAS.
3. Tables et coefficients de la méthode de dérivation de la capacité des pieux depuis le pénétromètre statique.
4. Liste des corrélations autorisées pour la dérivation des paramètres de couche, avec leurs références bibliographiques et leurs domaines de validité.
5. Liste des cas de référence publiés pour la validation des phases 4 à 7.

Aucun de ces éléments ne doit être inventé ou reconstitué de mémoire par le développeur.
