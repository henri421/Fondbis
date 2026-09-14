import {
  ConfigurationNormative,
  CoucheGeotechnique,
  Hydrogeologie,
  ParametresCaracteristiquesSol,
} from '../../types/geotech';
import { calculerParametresDeCalcul } from '../../core/deriveesSol';
import { calculerProfilContraintes, trouverCoucheACote } from '../../core/profilContraintes';
import { construireMaillageVertical } from '../../core/maillage';
import { calculerCoefficientsPousseeButee } from './pousseeButee';

export interface PointPressionLimite {
  cote: number; // m NGF/local
  Pa: number; // kPa, borne active côté amont (traction coupée à 0)
  Pp: number; // kPa, borne passive côté aval (0 au-dessus du fond de fouille)
  pressionEauDifferentielle: number; // kPa, u_amont - u_aval
  sigma_vPrime_amont?: number; // kPa, contrainte effective verticale amont
  sigma_vPrime_aval?: number; // kPa, contrainte effective verticale aval
  u_amont?: number; // kPa, pression interstitielle amont
  u_aval?: number; // kPa, pression interstitielle aval
  Ka?: number; // - coefficient de poussée
  Kp?: number; // - coefficient de butée
  coucheId?: string; // identifiant de la couche géotechnique active
}

export interface OptionsPressionLimite {
  jeuSolForce?: 'M1' | 'M2';
  inclinaisonTerrePleinAmontDeg?: number; // beta (défaut 0°)
  inclinaisonParementDeg?: number; // theta (défaut 90° = vertical)
  angleFrottementInterfaceSolEcran?: boolean; // si true, utilise delta_d, sinon delta=0 (Rankine)
  surchargeQ_amont?: number; // kPa, surcharge uniforme éventuelle en tête amont
}

/**
 * Génère un maillage vertical adapté pour une paroi de soutènement,
 * intégrant la cote de tête (TN amont), le fond de fouille (TN aval), la base de l'écran,
 * les interfaces de couches et les nappes.
 */
export function genererMaillageParoi(
  coteTerrainAmont: number,
  coteFondFouille: number,
  coteBaseParoi: number,
  couches: CoucheGeotechnique[],
  hydrogeologieAmont: Hydrogeologie,
  cotesSingulieres: number[] = [],
  pasStandard: number = 0.25
): number[] {
  const cotesClefs = [
    coteTerrainAmont,
    coteFondFouille,
    coteBaseParoi,
    ...cotesSingulieres,
  ];

  return construireMaillageVertical({
    coteTerrainNaturel: Math.max(coteTerrainAmont, coteFondFouille),
    couches,
    hydrogeologie: hydrogeologieAmont,
    cotesSingulieres: cotesClefs,
    pasStandard,
  });
}

/**
 * Calcule le profil des pressions limites (active Pa et passive Pp) le long d'un écran
 * de soutènement selon EN 1997-1:2004 §8.2.
 *
 * Évalue indépendamment la colonne de sol amont (terrain naturel) et aval (fond de fouille)
 * ainsi que la pression d'eau différentielle.
 *
 * Formules par nœud :
 *   Pa(z) = max(0, Ka * (sigma'_v,amont(z) + q) - 2 * c'_d * sqrt(Ka))
 *   Pp(z) = max(0, Kp * sigma'_v,aval(z) + 2 * c'_d * sqrt(Kp))  [Pp = 0 au-dessus du fond de fouille]
 *   pressionEauDifferentielle(z) = u_amont(z) - u_aval(z)
 */
export function calculerProfilPressionLimite(
  coteTerrainAmont: number,
  coteFondFouille: number,
  couches: CoucheGeotechnique[],
  hydrogeologieAmont: Hydrogeologie,
  hydrogeologieAval: Hydrogeologie,
  maillage: number[],
  configurationNormative: ConfigurationNormative,
  etat: 'ELS' | 'ELU',
  options?: OptionsPressionLimite
): PointPressionLimite[] {
  if (couches.length === 0) {
    return [];
  }

  // Si le maillage fourni est vide, générer une discrétisation par défaut
  let cotesTriees: number[];
  if (maillage && maillage.length > 0) {
    cotesTriees = [...new Set(maillage)].sort((a, b) => b - a);
  } else {
    cotesTriees = genererMaillageParoi(
      coteTerrainAmont,
      coteFondFouille,
      coteFondFouille - 5.0,
      couches,
      hydrogeologieAmont
    );
  }

  // Calcul indépendant des profils de contraintes amont et aval
  const profilAmont = calculerProfilContraintes(
    coteTerrainAmont,
    couches,
    hydrogeologieAmont,
    cotesTriees,
    etat
  );

  const profilAval = calculerProfilContraintes(
    coteFondFouille,
    couches,
    hydrogeologieAval,
    cotesTriees,
    etat
  );

  // Détermination du jeu de facteurs de sol (M1 ou M2) selon ELS/ELU et approche de calcul
  const jeuSol: 'M1' | 'M2' =
    options?.jeuSolForce ??
    (etat === 'ELS'
      ? 'M1'
      : configurationNormative.approcheCalcul === 'DA3'
      ? 'M2'
      : 'M1');

  const beta = options?.inclinaisonTerrePleinAmontDeg ?? 0;
  const theta = options?.inclinaisonParementDeg ?? 90;
  const surchargeQ = options?.surchargeQ_amont ?? 0;

  const profilPression: PointPressionLimite[] = [];

  for (const cote of cotesTriees) {
    const ptAmont = profilAmont.calculerA(cote);
    const ptAval = profilAval.calculerA(cote);
    const couche = trouverCoucheACote(couches, cote);

    if (!couche) {
      continue;
    }

    // Caractéristiques du sol pour la couche active
    const solK: ParametresCaracteristiquesSol = {
      phiPrime_k: couche.resistanceDrainee.phiPrime.v,
      cPrime_k: couche.resistanceDrainee.cPrime.v,
      cu_k: couche.resistanceNonDrainee.cuTete.v,
      gammaHumide_k: couche.poidsVolumiques.gammaHumide.v,
      gammaSature_k: couche.poidsVolumiques.gammaSature.v,
      delta_k: options?.angleFrottementInterfaceSolEcran
        ? (couche.resistanceDrainee.deltaInterface.v ?? 0)
        : 0,
    };

    const solD = calculerParametresDeCalcul(solK, jeuSol, configurationNormative);
    const phi_d = solD.phiPrime_d;
    const cPrime_d = solD.cPrime_d;
    const delta_d = options?.angleFrottementInterfaceSolEcran ? solD.delta_d : 0;

    // Coefficients de poussée et butée
    const coeffs = calculerCoefficientsPousseeButee(phi_d, delta_d, beta, theta);
    const Ka = coeffs.Ka;
    const Kp = coeffs.Kp;

    const sigma_vPrime_amont = ptAmont.sigma_vPrime;
    const sigma_vPrime_aval = ptAval.sigma_vPrime;
    const u_amont = ptAmont.u;
    const u_aval = ptAval.u;

    // Pression active Pa côté amont
    // Au-dessus du terrain amont, pas de terrain retenu
    let Pa = 0;
    if (cote <= coteTerrainAmont + 1e-4) {
      const Pa_brut = Ka * (sigma_vPrime_amont + surchargeQ) - 2 * cPrime_d * Math.sqrt(Ka);
      Pa = Math.max(0, Pa_brut);
    }

    // Pression passive Pp côté aval
    // Au-dessus du fond de fouille, le terrain est excavé (Pp = 0)
    let Pp = 0;
    if (cote <= coteFondFouille + 1e-4) {
      const Pp_brut = Kp * sigma_vPrime_aval + 2 * cPrime_d * Math.sqrt(Kp);
      Pp = Math.max(0, Pp_brut);
    }

    // Pression différentielle de l'eau (u_amont - u_aval)
    const pressionEauDiff = Number((u_amont - u_aval).toFixed(4));

    profilPression.push({
      cote: Number(cote.toFixed(3)),
      Pa: Number(Pa.toFixed(4)),
      Pp: Number(Pp.toFixed(4)),
      pressionEauDifferentielle: pressionEauDiff,
      sigma_vPrime_amont: Number(sigma_vPrime_amont.toFixed(4)),
      sigma_vPrime_aval: Number(sigma_vPrime_aval.toFixed(4)),
      u_amont: Number(u_amont.toFixed(4)),
      u_aval: Number(u_aval.toFixed(4)),
      Ka,
      Kp,
      coucheId: couche.id,
    });
  }

  return profilPression;
}
