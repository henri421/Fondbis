# Plan — talus chargé et sol renforcé (terre armée)

> **État au 13/10/2026 : étapes 1 et 2 réalisées** (59 tests d'acceptation au vert).
> Voir « Bilan » en fin de document pour les écarts au plan et les points ouverts.

Demande du 13/10/2026 : étape 1 (talus chargé) puis étape 2 (terre armée), tout dans le
navigateur (TypeScript). Le passage à Python est reporté à une discussion ultérieure.

## Constats de départ (revue du 13/10)

- `calculerBishopPourCercle` : vrai Bishop itératif, mais
  - poids de tranche avec γ humide **sous la nappe aussi** (au lieu de γ saturé) ;
  - c', φ' pris dans la couche à **mi-hauteur de tranche**, pas à la base (là où le
    cisaillement se mobilise) ; même γ pour toute la colonne, quelle que soit la couche ;
  - nappe caractéristique toujours, jamais la cote défavorable ELU ;
  - aucune surcharge.
- `calculerStabiliteBishop` : `facteursSecurite` reçu mais **ignoré** ; renvoie **F = 1,35
  par défaut** quand le cercle est invalide ; critère F ≥ 1,0 sur valeurs caractéristiques.
- `rechercherCercleCritique` : grille fixe à pas de 3 m sans raffinement ; repérage tête/pied
  fragile (`find` sur la cote exacte).
- `OngletStabilite` : le profil du talus n'est éditable nulle part (profil codé en dur si
  absent) ; pas de dessin du cercle.
- `verifierMurEnLELU` : `stabiliteGlobale` = **F 1,48 constant, « conforme »**, sans calcul.

## Choix de référentiel

- **Cadre** : EN 1997-1:2004 section 11 (stabilité générale) et 9 (soutènements), facteurs
  partiels pris dans la configuration normative du projet (DA1, DA2 ou DA3, modifiables).
- **Sol renforcé** : méthode cohérente gravitaire « simplifiée » publiée par la FHWA
  (FHWA-NHI-10-024, reprise par AASHTO LRFD §11.10) : K(z)/Ka, F*(z), ligne des tractions
  maximales, pertes par corrosion. La NF P 94-270 (France) suit la même méthode, mais son
  texte n'est pas disponible ici : ses coefficients ne sont pas recopiés de mémoire. Tous les
  coefficients de méthode sont **modifiables** et affichés avec leur source ; ceux qui ne
  viennent pas d'un texte lu portent le statut `defaut` et un avertissement.
- L'outil constate et ne prescrit pas : il affiche les taux, pas de dimensionnement auto.

## Étape 1 — Talus chargé

### Lot 1.1 — Noyau de Bishop généralisé (`src/briques/stabiliteGenerale.ts`)

Nouvelle fonction `analyserCercleBishop(entree)` qui renvoie un résultat détaillé ou un
cercle **invalide avec motif** (plus jamais de valeur inventée).

- Colonne de tranche intégrée couche par couche : γ humide au-dessus de la nappe, γ saturé
  en dessous ; c', φ' de la couche **à la base** de la tranche.
- Surcharges en bande `{xDebut, xFin, q (kPa), nature G|Q}` : force q·(recouvrement) ajoutée
  à la tranche (moment moteur et effort normal).
- Zones de matériau rectangulaires (prioritaires sur les couches) — sert à l'étape 2.
- Renforcements horizontaux (force résistante × bras de levier) — branchés à l'étape 2.
- Nappe : cote caractéristique (calcul caractéristique) ou défavorable ELU (ELU).
- `calculerBishopPourCercle` et `calculerStabiliteBishop` deviennent des enveloppes du noyau
  (T_STAB.2 et la sensibilité continuent de marcher).

### Lot 1.2 — Combinaisons EC7 section 11

- `caracteristique` : F classique, comparé à une cible saisie (1,5 par défaut, choix).
- **DA1** : combinaison 1 (A1+M1+R1) et combinaison 2 (A2+M2+R1), la plus défavorable gouverne.
- **DA2** : A1+M1+R2, facteurs d'actions appliqués aux **effets** (moment moteur), F ≥ γR;e.
- **DA3** : A2+M2+R3.
- `γR;e` (tableau A.14) ajouté à `facteursResistance` (R1 1,0 ; R2 1,1 ; R3 1,0), champ
  optionnel pour ne pas casser les projets enregistrés.
- Surcharge variable sur une tranche où elle est stabilisante (α < 0) : ignorée
  (γQ;stb = 0) ; permanente stabilisante : γG;stb.
- Taux = γR;e / F_d (≤ 1 : conforme).

### Lot 1.3 — Recherche du cercle critique

- Grille de centres déduite de l'emprise du profil (pas de tête/pied par cote exacte),
  rayons balayés jusqu'au substratum du modèle, puis **raffinement local** (pas divisé par 2
  jusqu'à 0,1 m). Cercles invalides écartés.
- Recherche faite **par combinaison** (le cercle critique ELU n'est pas forcément celui du
  calcul caractéristique, surtout avec une surcharge).

### Lot 1.4 — Onglet Stabilité

- Éditeur du profil du talus (tableau de points) et des surcharges ; persistance dans
  `ModeleTerrain.profilTerrainNaturel` et `ModeleTerrain.surchargesTalus` (optionnel).
- Coupe SVG : couches, nappe, profil, surcharges, cercle et tranches.
- Résultats par combinaison, combinaison gouvernante, tableau des tranches.

### Lot 1.5 — Mur en L

- Retirer le F = 1,48 fictif : statut « non calculé ici, voir l'onglet Stabilité ».

### Lot 1.6 — Tests (valeurs calculées indépendamment)

- T_STAB.3 : sol purement cohérent (φ = 0), terrain horizontal, bande q d'un seul côté du
  centre : F = c·R²·2θ / (q·a²/2) exact.
- T_STAB.4 : γ saturé sous la nappe (poids de tranche contrôlé à la main).
- T_STAB.5 : DA2 avec G seul : F_d = F_k / γG.
- T_STAB.6 : surcharge variable côté stabilisant sans effet.
- T_STAB.7 : la recherche retrouve le minimum d'un talus sableux sec (≈ tan φ / tan β).
- T_STAB.8 : cercle hors du sol → invalide (plus de 1,35).

## Étape 2 — Sol renforcé (terre armée)

### Lot 2.1 — Modèle (`src/types/geotech.ts`)

`OuvrageSolRenforce` (dans `ouvrages.solsRenforces`, optionnel) : cote de base, hauteur H,
longueur d'armature L, encastrement D, x du parement, remblai renforcé (γ, φ'), surcharges
G et Q en tête, lits (premier lit, espacement Sv), armature :

- **feuillard acier** (terre armée) ou **grille acier** : largeur, épaisseur nominale, fy,
  nombre par mètre de parement, perte d'épaisseur par face (corrosion, saisie) ;
- **géosynthétique** : résistance ultime par mètre, facteurs de réduction (fluage,
  endommagement, vieillissement), coefficient de forme α ;
- coefficients de méthode (K(0)/Ka, K(z0)/Ka, z0, F*0, F*(z0)) avec source et statut.

### Lot 2.2 — Stabilité interne (`src/modules/solRenforce/stabiliteInterne.ts`)

Par lit : σv = γr·z + q, K(z), T_max = K·σv·Sv (par mètre), ligne des tractions maximales
(bilinéaire 0,3 H pour inextensible, Rankine 45° + φ/2 pour extensible), longueur
d'adhérence Le, résistance à l'arrachement (F*·α·σv·Le·C), résistance à la rupture (section
réduite par la corrosion, ou T_ult / ΠRF), facteurs partiels de la configuration, taux.

### Lot 2.3 — Stabilité externe (`stabiliteExterne.ts`)

Le massif renforcé traité en mur poids de largeur L : poussée du sol retenu (Ka de
`pousseeButee`), glissement sur la base, excentricité (e ≤ L/6 sur sol), portance sur
B' = L − 2e par `verifierPortanceRadierELU` (bande filante, réutilisée).

### Lot 2.4 — Stabilité générale et mixte

Bishop du lot 1.1 avec la zone renforcée comme zone de matériau et chaque lit coupé par le
cercle comme force résistante : T = min(rupture, arrachement de la longueur au-delà du
cercle). Recherche du cercle critique par combinaison (cercles traversant le massif et
cercles passant dessous).

### Lot 2.5 — Onglet « Sol renforcé »

Formulaire, coupe SVG (massif, lits, ligne des tractions max, cercle critique), tableau par
lit, synthèse externe/interne/générale, section dans la note de calcul.

### Lot 2.6 — Tests

T_MSE.1 K(z) et T_max d'un lit, T_MSE.2 section corrodée et rupture, T_MSE.3 arrachement,
T_MSE.4 stabilité externe (glissement, excentricité) calculée à la main, T_MSE.5 Bishop avec
renforcement : écart de moment résistant = Σ T·bras exactement.

## Hors périmètre (déclaré dans l'interface)

Sismique, parement et attaches, talus en tête du massif (β ≠ 0), murs dos à dos, nappe
dans le massif renforcé, surfaces non circulaires, éléments finis (évoqué, reporté).

## Questions pour l'utilisateur (sans blocage)

- Q1 : si tu as la NF P 94-270, me la fournir pour remplacer les coefficients FHWA par les
  siens (K(z), F*, γ partiels propres aux armatures, épaisseurs sacrificielles).
- Q2 : approche de calcul visée pour la stabilité générale (en France, DA3 ; en Belgique,
  DA1) ; l'outil suit celle de la configuration du projet (DA2 par défaut aujourd'hui).

## Méthode

Commits par lot sur `main`, tests d'acceptation au vert à chaque lot (banc local :
`_banc-local/hooks-tsx.mjs`), push en fin d'étape (la CI ne fait que vérifier, la publication
Pages reste manuelle).

## Bilan (13/10/2026)

Réalisé selon le plan, avec ces écarts et constats :

- **Sens du glissement** : avec `sens = +1` la masse tourne en sens horaire et part vers les
  x décroissants. Un premier branchement des renforcements l'avait inversé (et le test
  T_MSE.6 avait été écrit sur la même erreur) ; corrigé, T_MSE.6b vérifie qu'un lit comprimé
  ne reprend rien.
- **Cercles tronqués** : un cercle dont le centre est sous le terrain à l'aplomb d'une
  extrémité est maintenant rejeté (la masse était fermée par une verticale fictive).
- **Renforcements dans Bishop** : ils réduisent le moment moteur (F porte sur la seule
  résistance du sol) au lieu de s'ajouter au moment résistant, pour ne pas diviser une
  seconde fois leur résistance de calcul par γR;e.
- **Stabilité générale du massif** : seuls les cercles passant sous le pied du parement sont
  retenus (ceux qui recoupent le parement relèvent de la stabilité interne).
- **Eau** : le module de portance ignore l'eau libre ; pour le massif, la nappe est plafonnée
  au terrain devant le parement et la limite est signalée (T_MSE.8).
- **Note de calcul** : les badges « CONFORME EC7 » étaient écrits en dur pour le radier, le
  pieu et le mur en L ; ils sont désormais calculés (sur le projet d'exemple, pieu 140 % et
  mur en L 149 % : non conformes). Section « Ouvrage 4 : sol renforcé » ajoutée.
- Banc local : `_banc-local/hooks-tsx.mjs` (tests), `serveur-react.mjs` (aperçu React sans
  npm), typecheck avec stubs React et `strict` aligné sur TS 5.

Points ouverts :

- Q1 et Q2 ci-dessus (NF P 94-270, approche de calcul visée).
- Le projet d'exemple est non conforme en sol renforcé (portance non drainée de l'argile,
  arrachement des lits hauts avec γR;a = 1,35 indicatif) : c'est le résultat du calcul, pas
  un défaut, mais l'exemple pourrait être réglé pour être démonstratif.
- Éléments finis (réduction c-φ) et passage à Python : reportés, à rediscuter.
