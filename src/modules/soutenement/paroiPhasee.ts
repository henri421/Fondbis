import {
  AppuiPhase,
  ConfigurationNormative,
  CoucheGeotechnique,
  Hydrogeologie,
  PhaseParoi,
} from '../../types/geotech';
import {
  AppuiBloque,
  ChargeNodale,
  EtatInitialSolveur,
  NoeudPoutre,
  resoudrePoutreSurRessorts,
  RessortNodal,
  ResultatSolveurPoutre,
} from '../../core/solveurPoutreRessorts';
import {
  calculerProfilPressionLimite,
  genererMaillageParoi,
  PointPressionLimite,
} from './pressionLimiteParoi';
import { trouverCoucheACote } from '../../core/profilContraintes';

/**
 * Paramètres d'entrée pour le calcul d'une paroi flexible phasée (EN 1997-1 §8.4)
 */
export interface ParametresParoiPhasee {
  nom?: string;
  coteTete: number; // m NGF / local
  coteBase: number; // m NGF / local (fiche inférieure)
  E: number; // kPa, module d'Young du matériau de l'écran (ex: 30e6 kPa = 30 GPa pour béton)
  I: number; // m⁴/m, moment quadratique par mètre linéaire d'écran
  A: number; // m²/m, aire de la section par mètre linéaire d'écran
  couches: CoucheGeotechnique[];
  hydrogeologie: Hydrogeologie;
  configurationNormative: ConfigurationNormative;
  etat: 'ELS' | 'ELU';
  phases: PhaseParoi[];
  appuis: AppuiPhase[];
  khParCouche: Record<string, number> | number; // kN/m³, raideur de réaction horizontale du sol par couche
  pasMaillage?: number; // m, pas vertical par défaut (0.25 m recommandé)
}

/**
 * Résultats détaillés pour une phase de calcul donnée
 */
export interface ResultatPhaseParoi {
  phase: PhaseParoi;
  resultatSolveur: ResultatSolveurPoutre;
  profilPressionLimite: PointPressionLimite[];
  reactionsAppuis: Array<{
    appuiId: string;
    cote: number;
    type: 'buton' | 'tirant';
    reaction: number; // kN/m (+ = réaction exercée par l'appui sur l'écran)
    deplacementReference: number; // m, déplacement présent au nœud lors de l'activation
    deplacementFinal: number; // m, déplacement total au nœud à la fin de cette phase
  }>;
  mobilisationButeeMax: number; // Ratio max de butée mobilisée le long de la fiche [0..1]
  momentMaxAbsolu: number; // kN.m/m
  tranchantMaxAbsolu: number; // kN/m
  deplacementMaxAbsolu: number; // m
}

/**
 * Résultat global du calcul multi-phases
 */
export interface ResultatCalculParoiPhasee {
  noeuds: NoeudPoutre[];
  cotes: number[]; // Cotes ordonnées de bas en haut (m)
  largeursTributaires: number[]; // Largeur d'influence de chaque nœud (m)
  phases: ResultatPhaseParoi[];
  enveloppe: {
    momentMaxPositif: number; // kN.m/m
    momentMaxNegatif: number; // kN.m/m
    tranchantMax: number; // kN/m
    deplacementMax: number; // m
  };
}

/**
 * Recherche le nœud le plus proche d'une cote donnée
 */
function trouverIndexNoeudLePlusProche(cote: number, noeuds: NoeudPoutre[]): number {
  let minDist = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < noeuds.length; i++) {
    const d = Math.abs(noeuds[i].y - cote);
    if (d < minDist) {
      minDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * Moteur de calcul de paroi flexible phasée (EN 1997-1 §8.4)
 *
 * Implémente le chaînage strict des états de déplacement et d'efforts entre phases
 * successives d'excavation et d'installation d'appuis (butons / tirants).
 *
 * Simplification documentée :
 *   Sous le fond de fouille, les deux faces du sol sont condensées en un ressort net par nœud,
 *   avec :
 *     raideur = kh(couche) * largeurTributaire
 *     reactionMax = Pp(z) * largeurTributaire (butée limite aval)
 *     reactionMin = -Pa(z) * largeurTributaire (poussée limite amont)
 *   La poussée motrice active Pa(z) (et la pression différentielle d'eau u_diff(z))
 *   est appliquée comme charge nodale motrice horizontale vers la fouille (+x).
 */
export function calculerParoiPhasee(
  params: ParametresParoiPhasee
): ResultatCalculParoiPhasee {
  const {
    coteTete,
    coteBase,
    E,
    I,
    A,
    couches,
    hydrogeologie,
    configurationNormative,
    etat,
    phases,
    appuis,
    khParCouche,
    pasMaillage = 0.25,
  } = params;

  if (phases.length === 0) {
    throw new Error('Le calcul de paroi phasée nécessite au moins une phase.');
  }

  // 1. Construction du maillage vertical unique sur toute la hauteur de la paroi
  // Ce maillage reste STRICTEMENT identique à toutes les phases pour garantir
  // l'intégrité du chaînage d'état (mêmes nœuds, mêmes indices).
  const cotesSingulieres = [
    coteTete,
    coteBase,
    ...phases.map((p) => p.coteFondFouille),
    ...appuis.map((a) => a.cote),
  ];

  const cotesBrutes = genererMaillageParoi(
    coteTete,
    phases[0].coteFondFouille,
    coteBase,
    couches,
    hydrogeologie,
    cotesSingulieres,
    pasMaillage
  );

  // Filtrer pour rester rigoureusement sur l'intervalle [coteBase, coteTete]
  const cotesFiltrees = cotesBrutes.filter(
    (z) => z >= Math.min(coteBase, coteTete) - 1e-4 && z <= Math.max(coteBase, coteTete) + 1e-4
  );

  // Tri par cotes croissantes (du pied vers la tête)
  const cotesCroissantes = [...new Set(cotesFiltrees.map((z) => Number(z.toFixed(3))))].sort(
    (a, b) => a - b
  );

  const nbNoeuds = cotesCroissantes.length;
  if (nbNoeuds < 2) {
    throw new Error('Le maillage vertical de la paroi doit comporter au moins 2 nœuds.');
  }

  const noeuds: NoeudPoutre[] = cotesCroissantes.map((c) => ({ x: 0, y: c }));

  // Calcul des largeurs tributaires pour chaque nœud
  const largeursTributaires: number[] = [];
  for (let i = 0; i < nbNoeuds; i++) {
    if (i === 0) {
      largeursTributaires.push((noeuds[1].y - noeuds[0].y) / 2);
    } else if (i === nbNoeuds - 1) {
      largeursTributaires.push((noeuds[nbNoeuds - 1].y - noeuds[nbNoeuds - 2].y) / 2);
    } else {
      largeursTributaires.push((noeuds[i + 1].y - noeuds[i - 1].y) / 2);
    }
  }

  // Association statique de chaque appui à son nœud du maillage
  const appuiNoeudIndexMap = new Map<string, number>();
  for (const app of appuis) {
    const idx = trouverIndexNoeudLePlusProche(app.cote, noeuds);
    appuiNoeudIndexMap.set(app.id, idx);
  }

  // Convention d'orientation CDC §8.4 :
  // Nœud de base (indice 0) bloqué uniquement en vertical 'y'
  // Aucun DDL bloqué en 'x' ou 'rotation' : la stabilité transversale provient
  // exclusivement des ressorts de sol et des appuis éventuels.
  const appuisBloques: AppuiBloque[] = [{ noeudIndex: 0, direction: 'y' }];

  // Suivi des déplacements de référence des appuis (mémorisés lors de leur phase d'activation)
  const deplacementReferenceParAppui = new Map<string, number>();

  // État initial chaîné entre phases
  let U_precedent: EtatInitialSolveur | undefined = undefined;

  const resultatsPhases: ResultatPhaseParoi[] = [];

  // Enveloppes globales des sollicitations
  let envMomentMaxPos = -Infinity;
  let envMomentMaxNeg = Infinity;
  let envTranchantMax = 0;
  let envDeplacementMax = 0;

  // 2. Boucle de phasage
  for (const phase of phases) {
    const coteFond = phase.coteFondFouille;
    const hydroAmont = phase.hydrogeologieAmont ?? hydrogeologie;
    const hydroAval = phase.hydrogeologieAval ?? hydrogeologie;
    const surchargeQ = phase.surchargeQ_amont ?? 0;

    // Calcul du profil de pression limite le long de l'écran pour cette phase
    const profilPression = calculerProfilPressionLimite(
      coteTete,
      coteFond,
      couches,
      hydroAmont,
      hydroAval,
      cotesCroissantes,
      configurationNormative,
      etat,
      { surchargeQ_amont: surchargeQ }
    );

    // Mappage rapide cote -> point de pression limite
    const profilMap = new Map<number, PointPressionLimite>();
    for (const pt of profilPression) {
      profilMap.set(Number(pt.cote.toFixed(3)), pt);
    }

    // A. Construction des charges appliquées et des ressorts de sol
    const chargesAppliquees: ChargeNodale[] = [];
    const ressortsSol: RessortNodal[] = [];

    for (let i = 0; i < nbNoeuds; i++) {
      const cote = noeuds[i].y;
      const pt = profilMap.get(Number(cote.toFixed(3))) ?? profilPression[i];
      const lt = largeursTributaires[i];

      // Pression d'eau différentielle amont - aval
      const uDiff = pt?.pressionEauDifferentielle ?? 0;
      const Pa = pt?.Pa ?? 0;
      const Pp = pt?.Pp ?? 0;

      // Charge motrice horizontale vers la fouille (+x).
      // La pression d'eau différentielle n'est pas bornée par le ressort de sol (celui-ci ne
      // borne que la part effective Pa/Pp, cf. spec) : elle s'applique donc en charge nodale à
      // TOUS les nœuds, au-dessus comme en dessous du fond de fouille.
      // La part active du sol Pa(z), en revanche, n'est appliquée en charge qu'AU-DESSUS du
      // fond de fouille, là où aucun ressort n'existe (sol excavé côté aval). En dessous, le
      // ressort net borné [-Pa, +Pp] (cf. spec, "un seul ressort net par nœud") représente déjà
      // à lui seul toute l'interaction sol des deux faces à partir d'un état initial équilibré :
      // ajouter Pa en charge à ces nœuds reviendrait à la compter deux fois (une fois comme
      // charge fixe, une fois comme borne inférieure du ressort), ce qui empêche tout retour de
      // fiche (bascule/point de rotation) et surestime sensiblement moment et flèche.
      const chargeMotriceX = (cote > coteFond + 1e-4 ? Pa * lt : 0) + uDiff * lt;
      chargesAppliquees.push({
        noeudIndex: i,
        Fx: chargeMotriceX,
      });

      // Ressort de sol sous le fond de fouille (dans la fiche)
      // Au-dessus du fond de fouille, le sol est excavé (raideur = 0, pas de ressort)
      if (cote <= coteFond + 1e-4) {
        const couche = trouverCoucheACote(couches, cote);
        const kh =
          typeof khParCouche === 'number'
            ? khParCouche
            : couche
            ? khParCouche[couche.id] ?? 20000
            : 20000;

        ressortsSol.push({
          noeudIndex: i,
          direction: 'x',
          raideur: kh * lt,
          reactionMax: Pp * lt,
          reactionMin: -Pa * lt,
        });
      }
    }

    // B. Appuis actifs pour cette phase
    const appuisActifs = appuis.filter((a) => a.phaseActivation <= phase.numero);
    const ressortsAppuis: RessortNodal[] = [];
    const infosAppuisPhase: ResultatPhaseParoi['reactionsAppuis'] = [];

    for (const app of appuisActifs) {
      const noeudIdx = appuiNoeudIndexMap.get(app.id)!;

      // Si l'appui est activé pour la première fois à cette phase,
      // on enregistre le déplacement déjà présent au nœud comme déplacement de référence u0
      if (!deplacementReferenceParAppui.has(app.id)) {
        const u0 =
          U_precedent?.deplacements?.find((d) => d.noeudIndex === noeudIdx)?.ux ?? 0;
        deplacementReferenceParAppui.set(app.id, u0);
      }

      const uRef = deplacementReferenceParAppui.get(app.id)!;

      ressortsAppuis.push({
        noeudIndex: noeudIdx,
        direction: 'x',
        raideur: app.raideur,
        reactionMax: app.reactionMax,
        reactionMin: app.reactionMin,
        deplacementReference: uRef,
      });
    }

    // C. Résolution par éléments finis avec chaînage d'état
    const tousRessorts = [...ressortsSol, ...ressortsAppuis];

    const resultatSolveur = resoudrePoutreSurRessorts(
      noeuds,
      E,
      I,
      A,
      tousRessorts,
      chargesAppliquees,
      appuisBloques,
      U_precedent
    );

    // Extraction des réactions effectives des appuis
    for (let aIdx = 0; aIdx < appuisActifs.length; aIdx++) {
      const app = appuisActifs[aIdx];
      const rNodal = ressortsAppuis[aIdx];
      const reactSolveur =
        resultatSolveur.reactionsRessorts.find(
          (r) =>
            r.noeudIndex === rNodal.noeudIndex &&
            r.direction === 'x' &&
            resultatSolveur.reactionsRessorts.indexOf(r) >= ressortsSol.length + aIdx
        )?.reaction ?? 0;

      const uFinal = resultatSolveur.deplacements[rNodal.noeudIndex]?.ux ?? 0;

      infosAppuisPhase.push({
        appuiId: app.id,
        cote: app.cote,
        type: app.type,
        reaction: reactSolveur,
        deplacementReference: rNodal.deplacementReference ?? 0,
        deplacementFinal: uFinal,
      });
    }

    // Calcul du taux maximal de butée mobilisée dans le sol
    let maxMobilisationButee = 0;
    for (let rIdx = 0; rIdx < ressortsSol.length; rIdx++) {
      const rInfo = resultatSolveur.reactionsRessorts[rIdx];
      if (rInfo?.tauxMobilisation !== undefined) {
        if (rInfo.tauxMobilisation > maxMobilisationButee) {
          maxMobilisationButee = rInfo.tauxMobilisation;
        }
      }
    }

    // Maxima de la phase
    const maxM = Math.max(...resultatSolveur.effortsInternes.map((e) => Math.abs(e.M)));
    const maxV = Math.max(...resultatSolveur.effortsInternes.map((e) => Math.abs(e.V)));
    const maxU = Math.max(...resultatSolveur.deplacements.map((d) => Math.abs(d.ux)));

    // Mise à jour de l'enveloppe globale
    for (const eff of resultatSolveur.effortsInternes) {
      if (eff.M > envMomentMaxPos) envMomentMaxPos = eff.M;
      if (eff.M < envMomentMaxNeg) envMomentMaxNeg = eff.M;
      if (Math.abs(eff.V) > envTranchantMax) envTranchantMax = Math.abs(eff.V);
    }
    if (maxU > envDeplacementMax) envDeplacementMax = maxU;

    if (!resultatSolveur.convergence.convergé) {
      const msgMecanisme = 'Capacité passive insuffisante / mécanisme potentiel — fiche ou appuis à revoir';
      if (!resultatSolveur.convergence.avertissements.some((av) => av.includes('Capacité passive insuffisante'))) {
        resultatSolveur.convergence.avertissements.push(msgMecanisme);
      }
    }

    resultatsPhases.push({
      phase,
      resultatSolveur,
      profilPressionLimite: profilPression,
      reactionsAppuis: infosAppuisPhase,
      mobilisationButeeMax: maxMobilisationButee,
      momentMaxAbsolu: maxM,
      tranchantMaxAbsolu: maxV,
      deplacementMaxAbsolu: maxU,
    });

    // D. Chaînage pour la phase suivante : mise à jour de U_precedent
    // Exigence critique CDC §8.4 : ne jamais repartir de zéro à une phase donnée.
    // Si la phase n'a pas convergé (rupture ou mécanisme), conserver le dernier état convergé stable.
    if (resultatSolveur.convergence.convergé) {
      U_precedent = {
        deplacements: resultatSolveur.deplacements,
      };
    }
  }

  return {
    noeuds,
    cotes: cotesCroissantes,
    largeursTributaires,
    phases: resultatsPhases,
    enveloppe: {
      momentMaxPositif: envMomentMaxPos === -Infinity ? 0 : envMomentMaxPos,
      momentMaxNegatif: envMomentMaxNeg === Infinity ? 0 : envMomentMaxNeg,
      tranchantMax: envTranchantMax,
      deplacementMax: envDeplacementMax,
    },
  };
}
