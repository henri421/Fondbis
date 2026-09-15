import {
  ConfigurationNormative,
  CoucheGeotechnique,
  Hydrogeologie,
} from '../../types/geotech';
import { CLAUSES_EC7 } from '../../norme/metadataNorme';
import {
  resoudrePoutreSurRessorts,
  NoeudPoutre,
  RessortNodal,
  ChargeNodale,
  AppuiBloque,
  ResultatSolveurPoutre,
} from '../../core/solveurPoutreRessorts';
import { trouverCoucheACote } from '../../core/profilContraintes';

/**
 * Familles de courbes p-y supportées (EN 1997-1 §7.7)
 */
export type FamilleCourbePy = 'matlock' | 'reese' | 'pressiometrique' | 'automatique';

export interface ParametresPieuTransversal {
  // Géométrie du pieu
  diametre: number; // D [m]
  coteTete: number; // [m NGF]
  cotePointe: number; // [m NGF]
  moduleE_GPa?: number; // Module d'Young du matériau du pieu [GPa], défaut 30 GPa (béton)
  
  // Chargement en tête
  chargeH: number; // Effort horizontal en tête [kN] (Fx)
  momentM?: number; // Moment fléchissant en tête [kN.m] (Mz), défaut 0
  liaisonTete?: 'libre' | 'bloqueeEnRotation'; // Tête libre ou encastrée en rotation
  
  // Sol et environnement
  couches: CoucheGeotechnique[];
  hydrogeologie?: Hydrogeologie;
  configurationNormative?: ConfigurationNormative;
  
  // Loi p-y
  familleCourbe?: FamilleCourbePy;
  
  // Paramètres avancés de maillage et de résolution
  pasMaillage?: number; // Pas de discrétisation le long du fût [m], défaut 0.25 m
  maxIterations?: number; // Itérations max de raideur sécante, défaut 60
  toleranceConvergence?: number; // Tolérance relative sur les déplacements, défaut 1e-4
  omegaRelaxation?: number; // Facteur de sous-relaxation de la raideur sécante, défaut 0.5
}

export interface PointProfilTransversal {
  noeudIndex: number;
  cote: number; // [m NGF]
  profondeur: number; // z depuis la tête [m]
  ux: number; // Déplacement horizontal [m]
  ux_mm: number; // Déplacement horizontal [mm]
  rotation_mrad: number; // Rotation [mrad]
  moment: number; // Moment fléchissant M [kN.m]
  tranchant: number; // Effort tranchant V [kN]
  reactionSol_p: number; // Réaction du sol mobilisée p [kN/m]
  reactionUltime_pu: number; // Réaction ultime pu [kN/m]
  tauxMobilisation: number; // p / pu [0 à 1]
  raideurSecante_ksec: number; // Raideur sécante locale [kN/m²]
  familleAppliquee: string; // 'matlock' | 'reese' | 'pressiometrique'
}

export interface ResultatPieuTransversal {
  // Grandeurs de synthèse
  deplacementTete_mm: number; // Déplacement en tête [mm]
  rotationTete_mrad: number; // Rotation en tête [mrad]
  momentMaxAbsolu: number; // Moment maximal |M_max| [kN.m]
  coteMomentMax: number; // Cote NGF du moment maximal [m]
  profondeurMomentMax: number; // Profondeur du moment maximal [m]
  tranchantMaxAbsolu: number; // Effort tranchant maximal |V_max| [kN]
  coteTranchantMax: number; // Cote NGF du tranchant maximal [m]
  mobilisationMaxSol: number; // Taux de mobilisation max du sol [0 à 1]
  longueurElastique_m: number; // Longueur de transfert / longueur élastique l0 [m]
  
  // Profils verticaux
  profils: PointProfilTransversal[];
  
  // Résultats bruts du solveur matriciel
  resultatSolveur: ResultatSolveurPoutre;
  
  // Données de convergence
  convergence: {
    converge: boolean;
    iterations: number;
    residuFinal: number;
    avertissements: string[];
  };
  
  // Métadonnées normatives
  clauseReference: string;
  statutNormatif: string;
}

/**
 * Calcul de la contrainte verticale effective sigma'v à une cote donnée
 */
function calculerSigmaVPrime(
  cote: number,
  coteTete: number,
  couches: CoucheGeotechnique[],
  hydrogeologie?: Hydrogeologie
): number {
  const coteNappe = hydrogeologie?.nappePrincipale.coteCaracteristique ?? -999;
  const gammaEau = hydrogeologie?.poidsVolumiqueEau ?? 9.81;

  let sigmaTotal = 0;
  let u = 0;

  // Intégration de la contrainte des couches au-dessus de la cote cible
  const couchesTriees = [...couches].sort((a, b) => b.coteToit - a.coteToit);
  let coteCourante = coteTete;

  for (const c of couchesTriees) {
    const hautCouche = Math.min(coteCourante, c.coteToit);
    const basCouche = Math.max(cote, c.coteToit - c.epaisseur);

    if (hautCouche > basCouche) {
      const dz = hautCouche - basCouche;
      // Poids volumique déjaugé ou humide selon nappe
      const zMoyen = (hautCouche + basCouche) / 2;
      const gamma = zMoyen < coteNappe ? c.poidsVolumiques.gammaSature.v : c.poidsVolumiques.gammaHumide.v;
      sigmaTotal += gamma * dz;
      coteCourante = basCouche;
    }
  }

  if (cote < coteNappe) {
    u = (coteNappe - cote) * gammaEau;
  }

  return Math.max(5.0, sigmaTotal - u); // Seuil minimal de 5 kPa pour éviter division par zéro en surface
}

/**
 * Loi p-y selon Matlock (1970) pour les argiles molles à moyennes
 * EN 1997-1 §7.7
 */
export function evaluerPyMatlock(
  y: number,
  z: number,
  D: number,
  cu: number,
  sigmaVPrime: number,
  gammaPrime: number = 10
): { p: number; pu: number; ksec: number; kini: number } {
  const absY = Math.abs(y);
  const signe = Math.sign(y) || 1;

  // Paramètres empiriques de Matlock
  const J = cu < 30 ? 0.5 : 0.25; // 0.5 pour argile molle, 0.25 pour moyenne
  let eps50 = 0.02;
  if (cu >= 100) eps50 = 0.005;
  else if (cu >= 50) eps50 = 0.007;
  else if (cu >= 25) eps50 = 0.01;

  // Résistance ultime pu
  // pu1 = (3 + sigma'v / cu + J * z / D) * cu * D
  const pu1 = (3.0 + sigmaVPrime / Math.max(1, cu) + (J * z) / Math.max(0.1, D)) * cu * D;
  const pu2 = 9.0 * cu * D;
  const pu = Math.min(pu1, pu2);

  // Déplacement à 50% de pu
  const y50 = 2.5 * eps50 * D;

  // Seuil élastique initial pour éviter raideur infinie en y -> 0
  const ySeuil = 0.005 * y50;
  // p(ySeuil) = 0.5 * pu * (ySeuil / y50)^(1/3)
  const pSeuil = 0.5 * pu * Math.pow(ySeuil / y50, 1.0 / 3.0);
  const kini = pSeuil / ySeuil;

  let p = 0;
  if (absY <= ySeuil) {
    p = kini * absY;
  } else if (absY <= 8.0 * y50) {
    p = 0.5 * pu * Math.pow(absY / y50, 1.0 / 3.0);
  } else {
    p = pu;
  }

  const ksec = absY > 1e-7 ? p / absY : kini;

  return {
    p: p * signe,
    pu,
    ksec,
    kini,
  };
}

/**
 * Loi p-y selon Reese et al. (1974) pour les sables
 * EN 1997-1 §7.7
 */
export function evaluerPyReese(
  y: number,
  z: number,
  D: number,
  phiDeg: number,
  sigmaVPrime: number,
  gammaPrime: number = 10
): { p: number; pu: number; ksec: number; kini: number } {
  const absY = Math.abs(y);
  const signe = Math.sign(y) || 1;

  const phiRad = (phiDeg * Math.PI) / 180.0;
  const alpha = phiRad / 2.0;
  const beta = Math.PI / 4.0 + phiRad / 2.0;
  const K0 = 0.4;
  const Ka = Math.pow(Math.tan(Math.PI / 4.0 - phiRad / 2.0), 2);
  const Kp = Math.pow(Math.tan(Math.PI / 4.0 + phiRad / 2.0), 2);

  // Coefficients sans dimension de Reese
  const denom = Math.tan(beta - phiRad);
  const C1 =
    (K0 * Math.tan(phiRad) * Math.sin(beta)) / (Math.max(1e-4, denom) * Math.cos(alpha)) +
    (Math.tan(beta) * Math.tan(alpha)) / Math.max(1e-4, denom) +
    K0 * Math.tan(beta) * (Math.tan(phiRad) * Math.sin(beta) - Math.tan(alpha));

  const C2 = Math.tan(beta) / Math.max(1e-4, denom) - Ka;
  const C3 = Ka * (Math.pow(Kp, 4) - 1.0) + K0 * Math.pow(Kp, 2) * Math.tan(phiRad);

  // Résistance ultime de surface (coin) et en profondeur (écoulement)
  const pus = sigmaVPrime * (C1 * z + C2 * D);
  const pud = C3 * D * sigmaVPrime;
  const As = Math.max(0.88, 3.0 - 0.8 * (z / Math.max(0.1, D)));
  const pu = As * Math.min(pus, pud);

  // Module de réaction initiale nh (kN/m³)
  // nh typique : 5 000 (lâche) à 25 000 (dense)
  const nh = Math.max(4000, 200 * Math.pow(Math.max(1, phiDeg - 20), 1.5));
  const kini = nh * Math.max(z, 0.1 * D);

  // Forme de Reese régularisée (hyperbolique standardisée garantissant p'(0) = kini et asymptote pu)
  // Formule universelle de Reese & O'Neill : p(y) = pu * tanh(kini * y / pu)
  const arg = (kini * absY) / Math.max(1, pu);
  const p = pu * Math.tanh(arg);
  const ksec = absY > 1e-7 ? p / absY : kini;

  return {
    p: p * signe,
    pu,
    ksec,
    kini,
  };
}

/**
 * Approche pressiométrique alternative (Ménard / NF P 94-262 Annexe M)
 * EN 1997-1 §7.7
 */
export function evaluerPyPressiometrique(
  y: number,
  z: number,
  D: number,
  EM: number,
  plStar: number,
  alphaRheo: number = 0.5
): { p: number; pu: number; ksec: number; kini: number } {
  const absY = Math.abs(y);
  const signe = Math.sign(y) || 1;

  // Réduction de réaction et pression limite en surface (effet de coin)
  const kR = z < 2.0 * D ? Math.min(1.0, (1.0 + z / Math.max(0.1, D)) / 3.0) : 1.0;
  const pu = Math.max(10, kR * plStar * D);

  // Raideur pressiométrique ks (kN/m³) selon formule de Ménard
  const D0 = 0.6; // diamètre de référence [m]
  const terme1 = (2.0 / (9.0 * Math.max(100, EM))) * Math.pow((2.65 * D) / D0, alphaRheo);
  const terme2 = (alphaRheo * D) / (6.0 * Math.max(100, EM));
  const ks = 1.0 / Math.max(1e-6, terme1 + terme2); // [kN/m³]

  const kini = ks * D; // [kN/m²]
  const arg = (kini * absY) / Math.max(1, pu);
  const p = pu * Math.tanh(arg);
  const ksec = absY > 1e-7 ? p / absY : kini;

  return {
    p: p * signe,
    pu,
    ksec,
    kini,
  };
}

/**
 * Évaluation unifiée de la loi p-y selon la famille demandée et la lithologie
 */
export function evaluerReactionSolPy(
  famille: FamilleCourbePy,
  couche: CoucheGeotechnique,
  y: number,
  z: number,
  D: number,
  sigmaVPrime: number
): { p: number; pu: number; ksec: number; kini: number; familleUtilisee: string } {
  let typeCalcul = famille;

  if (typeCalcul === 'automatique') {
    if (couche.nature === 'sable') {
      typeCalcul = 'reese';
    } else if (couche.nature === 'argile' || couche.nature === 'limon') {
      typeCalcul = 'matlock';
    } else if (couche.nature === 'roche') {
      typeCalcul = 'pressiometrique';
    } else {
      typeCalcul = 'reese';
    }
  }

  if (typeCalcul === 'matlock') {
    const cu = couche.resistanceNonDrainee?.cuTete?.v ?? 40.0;
    const res = evaluerPyMatlock(y, z, D, cu, sigmaVPrime);
    return { ...res, familleUtilisee: 'matlock' };
  }

  if (typeCalcul === 'pressiometrique') {
    // Si la couche dispose d'un module d'Young en MPa, on l'utilise pour dériver EM en kPa
    const eChargementKPa = (couche.deformation?.Echargement?.v ?? 20) * 1000;
    const EM = couche.nature === 'roche' ? 500000 : eChargementKPa;
    const plStar = couche.nature === 'roche' ? 3000 : Math.max(200, EM / 12.0);
    const res = evaluerPyPressiometrique(y, z, D, EM, plStar);
    return { ...res, familleUtilisee: 'pressiometrique' };
  }

  // Par défaut : Reese
  const phi = couche.resistanceDrainee?.phiPrime?.v ?? 30.0;
  const res = evaluerPyReese(y, z, D, phi, sigmaVPrime);
  return { ...res, familleUtilisee: 'reese' };
}

/**
 * Calcul complet du comportement transversal d'un pieu sous charge en tête
 * Conforme EN 1997-1:2004 §7.7 et §9.3
 */
export function calculerPieuTransversal(
  params: ParametresPieuTransversal
): ResultatPieuTransversal {
  const {
    diametre,
    coteTete,
    cotePointe,
    moduleE_GPa = 30.0,
    chargeH,
    momentM = 0,
    liaisonTete = 'libre',
    couches,
    hydrogeologie,
    familleCourbe = 'automatique',
    pasMaillage = 0.25,
    maxIterations = 60,
    toleranceConvergence = 1e-4,
    omegaRelaxation = 0.5,
  } = params;

  const L_totale = Math.max(0.5, coteTete - cotePointe);
  const D = diametre;

  // Caractéristiques géométriques et mécaniques de la section circulaire pleine
  const E = moduleE_GPa * 1e6; // [kPa]
  const I = (Math.PI * Math.pow(D, 4)) / 64.0; // [m4]
  const A = (Math.PI * Math.pow(D, 2)) / 4.0; // [m2]
  const EI = E * I; // [kN.m2]
  const EA = E * A; // [kN]

  // Discrétisation verticale
  const nbElements = Math.max(10, Math.ceil(L_totale / pasMaillage));
  const dzReel = L_totale / nbElements;
  const nbNoeuds = nbElements + 1;

  const noeuds: NoeudPoutre[] = [];
  const cotes: number[] = [];
  const profondeurs: number[] = [];

  for (let i = 0; i < nbNoeuds; i++) {
    const coteN = coteTete - i * dzReel;
    noeuds.push({ x: 0, y: coteN });
    cotes.push(coteN);
    profondeurs.push(i * dzReel);
  }

  // Largeurs tributaires pour chaque nœud
  const largeursTributaires: number[] = [];
  for (let i = 0; i < nbNoeuds; i++) {
    if (i === 0 || i === nbNoeuds - 1) {
      largeursTributaires.push(dzReel / 2.0);
    } else {
      largeursTributaires.push(dzReel);
    }
  }

  // Conditions aux limites rigides :
  // - La pointe est bloquée verticalement (uy = 0) pour éliminer le mode rigide axial
  const appuisBloques: AppuiBloque[] = [{ noeudIndex: nbNoeuds - 1, direction: 'y' }];

  // - Si la tête est encastrée en rotation
  if (liaisonTete === 'bloqueeEnRotation') {
    appuisBloques.push({ noeudIndex: 0, direction: 'rotation' });
  }

  // Charges appliquées en tête (nœud 0)
  const charges: ChargeNodale[] = [
    {
      noeudIndex: 0,
      Fx: chargeH,
      Mz: momentM,
    },
  ];

  // Calcul des contraintes verticales effectives initiales
  const sigmasVPrime = cotes.map((c) =>
    calculerSigmaVPrime(c, coteTete, couches, hydrogeologie)
  );

  // Identification des couches associées à chaque nœud
  const couchesNoeuds = cotes.map((c) => trouverCoucheACote(couches, c));

  // Initialisation des raideurs initiales des ressorts p-y
  const raideursInitiales: number[] = [];
  for (let i = 0; i < nbNoeuds; i++) {
    const couche = couchesNoeuds[i];
    const z = profondeurs[i];
    const sigVp = sigmasVPrime[i];

    if (!couche) {
      raideursInitiales.push(1000 * largeursTributaires[i]);
      continue;
    }

    const pyIni = evaluerReactionSolPy(
      familleCourbe,
      couche,
      0.001, // petit déplacement test
      z,
      D,
      sigVp
    );
    raideursInitiales.push(pyIni.kini * largeursTributaires[i]);
  }

  // Boucle de Newton sur la raideur sécante
  let raideursCourantes = [...raideursInitiales];
  let deplacementsCourants: number[] = new Array(nbNoeuds).fill(0);
  let dernierResultatSolveur: ResultatSolveurPoutre | null = null;
  let converge = false;
  let iterations = 0;
  let residuFinal = 1.0;
  const avertissements: string[] = [];

  for (let iter = 1; iter <= maxIterations; iter++) {
    iterations = iter;

    // Définition des ressorts nodaux sécants
    const ressorts: RessortNodal[] = [];
    for (let i = 0; i < nbNoeuds; i++) {
      ressorts.push({
        noeudIndex: i,
        direction: 'x',
        raideur: Math.max(10.0, raideursCourantes[i]),
      });
    }

    // Résolution de la poutre
    dernierResultatSolveur = resoudrePoutreSurRessorts(
      noeuds,
      E,
      I,
      A,
      ressorts,
      charges,
      appuisBloques,
      undefined,
      { maxIterations: 1 } // résolution linéaire exacte pour ces raideurs
    );

    const nouveauxDeplacements = dernierResultatSolveur.deplacements.map((d) => d.ux);

    // Calcul de l'écart relatif sur les déplacements
    let maxDiff = 0;
    let maxNorme = 0;
    for (let i = 0; i < nbNoeuds; i++) {
      const diff = Math.abs(nouveauxDeplacements[i] - deplacementsCourants[i]);
      if (diff > maxDiff) maxDiff = diff;
      if (Math.abs(nouveauxDeplacements[i]) > maxNorme) {
        maxNorme = Math.abs(nouveauxDeplacements[i]);
      }
    }

    residuFinal = maxNorme > 1e-6 ? maxDiff / maxNorme : maxDiff;

    // Mise à jour des raideurs sécantes pour la prochaine itération
    const nouvellesRaideurs: number[] = [];
    for (let i = 0; i < nbNoeuds; i++) {
      const couche = couchesNoeuds[i];
      const z = profondeurs[i];
      const sigVp = sigmasVPrime[i];
      const ux_i = nouveauxDeplacements[i];
      const Lt = largeursTributaires[i];

      if (!couche) {
        nouvellesRaideurs.push(raideursCourantes[i]);
        continue;
      }

      const evalPy = evaluerReactionSolPy(
        familleCourbe,
        couche,
        ux_i,
        z,
        D,
        sigVp
      );

      const kSecNodale = evalPy.ksec * Lt;
      // Sous-relaxation de la raideur sécante pour assurer une convergence stable et robuste
      const kRelaxee = (1.0 - omegaRelaxation) * raideursCourantes[i] + omegaRelaxation * kSecNodale;
      nouvellesRaideurs.push(kRelaxee);
    }

    deplacementsCourants = nouveauxDeplacements;
    raideursCourantes = nouvellesRaideurs;

    if (residuFinal < toleranceConvergence && iter >= 2) {
      converge = true;
      break;
    }
  }

  if (!converge) {
    avertissements.push(
      `Non-convergence stricte après ${maxIterations} itérations (résidu=${residuFinal.toExponential(2)}).`
    );
  }

  if (!dernierResultatSolveur) {
    throw new Error('Échec du solveur matriciel de pieu transversal.');
  }

  // Post-traitement et génération des profils
  const profils: PointProfilTransversal[] = [];
  let momentMaxAbsolu = 0;
  let coteMomentMax = coteTete;
  let profMomentMax = 0;
  let tranchantMaxAbsolu = 0;
  let coteTranchantMax = coteTete;
  let mobilisationMaxSol = 0;

  for (let i = 0; i < nbNoeuds; i++) {
    const coteN = cotes[i];
    const zN = profondeurs[i];
    const uxN = dernierResultatSolveur.deplacements[i]?.ux ?? 0;
    const rzN = dernierResultatSolveur.deplacements[i]?.rz ?? 0;
    const MN = dernierResultatSolveur.effortsInternes[i]?.M ?? 0;
    const VN = dernierResultatSolveur.effortsInternes[i]?.V ?? 0;

    const couche = couchesNoeuds[i];
    const sigVp = sigmasVPrime[i];

    let pMobilise = 0;
    let pUltime = 1.0;
    let ksecLocal = 0;
    let familleAppliquee = 'reese';

    if (couche) {
      const evalPy = evaluerReactionSolPy(
        familleCourbe,
        couche,
        uxN,
        zN,
        D,
        sigVp
      );
      pMobilise = evalPy.p;
      pUltime = evalPy.pu;
      ksecLocal = evalPy.ksec;
      familleAppliquee = evalPy.familleUtilisee;
    }

    const tauxMob = Math.min(1.0, Math.abs(pMobilise) / Math.max(1e-3, pUltime));
    if (tauxMob > mobilisationMaxSol) {
      mobilisationMaxSol = tauxMob;
    }

    if (Math.abs(MN) > momentMaxAbsolu) {
      momentMaxAbsolu = Math.abs(MN);
      coteMomentMax = coteN;
      profMomentMax = zN;
    }

    if (Math.abs(VN) > tranchantMaxAbsolu) {
      tranchantMaxAbsolu = Math.abs(VN);
      coteTranchantMax = coteN;
    }

    profils.push({
      noeudIndex: i,
      cote: coteN,
      profondeur: zN,
      ux: uxN,
      ux_mm: uxN * 1000.0,
      rotation_mrad: rzN * 1000.0,
      moment: MN,
      tranchant: VN,
      reactionSol_p: pMobilise,
      reactionUltime_pu: pUltime,
      tauxMobilisation: tauxMob,
      raideurSecante_ksec: ksecLocal,
      familleAppliquee,
    });
  }

  // Longueur élastique / longueur de transfert l0
  // l0 = (4 * E * I / (ks_moyen * D))^(1/4)
  const ksecMoyen =
    profils.reduce((acc, p) => acc + p.raideurSecante_ksec, 0) / Math.max(1, profils.length);
  const longueurElastique_m = Math.pow((4.0 * EI) / Math.max(1.0, ksecMoyen * D), 0.25);

  const deplacementTete_mm = (dernierResultatSolveur.deplacements[0]?.ux ?? 0) * 1000.0;
  const rotationTete_mrad = (dernierResultatSolveur.deplacements[0]?.rz ?? 0) * 1000.0;

  return {
    deplacementTete_mm,
    rotationTete_mrad,
    momentMaxAbsolu,
    coteMomentMax,
    profondeurMomentMax: profMomentMax,
    tranchantMaxAbsolu,
    coteTranchantMax,
    mobilisationMaxSol,
    longueurElastique_m,
    profils,
    resultatSolveur: dernierResultatSolveur,
    convergence: {
      converge,
      iterations,
      residuFinal,
      avertissements,
    },
    clauseReference: CLAUSES_EC7.effet_transversal_pieu.clause,
    statutNormatif: CLAUSES_EC7.effet_transversal_pieu.statut,
  };
}
