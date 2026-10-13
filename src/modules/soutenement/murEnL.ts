import {
  ConfigurationNormative,
  CoucheGeotechnique,
  Hydrogeologie,
  OuvrageSoutenement,
} from '../../types/geotech';
import { calculerCoefficientsPousseeButee } from './pousseeButee';
import { trouverCoucheACote } from '../../core/profilContraintes';
import { CLAUSES_EC7 } from '../../norme/metadataNorme';

export interface ResultatMurEnL {
  hauteurTotale: number; // m
  largeurSemelleB: number; // m
  epaisseurVoile: number; // m
  debordAvant: number; // m (patin)
  talonArriere: number; // m
  
  // Coefficients
  Ka: number;
  Kp: number;
  
  // Forces agissantes (par mètre linéaire)
  poidsVoile: number; // kN/m
  poidsSemelle: number; // kN/m
  poidsSolTalon: number; // kN/m
  poidsTotalVertical: number; // kN/m (V_k)
  
  pousseeSolHorizontale: number; // kN/m (H_sol)
  brasLevierSol: number; // m au-dessus de la base
  pousseeSurchargeHorizontale: number; // kN/m (H_q)
  brasLevierSurcharge: number; // m
  pousseeTotaleH: number; // kN/m (H_k)
  
  // Moments par rapport à l'arête avant (point O de renversement)
  momentStabilisant_k: number; // kNm/m
  momentRenversant_k: number; // kNm/m
  
  // Vérification 1 : Renversement EQU
  equ: {
    M_dst_d: number; // kNm/m
    M_stb_d: number; // kNm/m
    taux: number;
    conforme: boolean;
  };
  
  // Vérification 2 : Glissement ELU (GEO)
  glissement: {
    H_d: number; // kN/m
    R_h_d: number; // kN/m
    taux: number;
    conforme: boolean;
  };
  
  // Vérification 3 : Portance de la semelle (GEO)
  portance: {
    V_d: number; // kN/m
    e_B: number; // m
    B_prime: number; // m
    decollementPartiel: boolean;
    q_appliquee_max: number; // kPa
    q_ult_Rd: number; // kPa
    taux: number;
    conforme: boolean;
  };
  
  tauxMaxGouvernant: number;
  verificationGlobaleConforme: boolean;
  clauseReference: string;
  statutNormatif: string;
}

/**
 * Calcul et vérifications complètes d'un mur de soutènement en L selon EN 1997-1:2004
 */
export function verifierMurEnL(
  ouvrage: OuvrageSoutenement,
  couches: CoucheGeotechnique[],
  hydrogeologie: Hydrogeologie,
  config: ConfigurationNormative
): ResultatMurEnL {
  const H = ouvrage.hauteurTotale;
  const B = ouvrage.largeurSemelleB || Math.max(1.5, H * 0.55);
  const eVoile = ouvrage.epaisseurVoile || Math.max(0.3, H * 0.08);
  const debordAvant = ouvrage.debordAvant || Math.max(0.3, B * 0.25);
  const epaisseurSemelle = Math.max(0.35, eVoile * 1.1);
  const talonArriere = Math.max(0.1, B - debordAvant - eVoile);

  // Propriétés du sol de remblai amont
  const coucheAmont = trouverCoucheACote(couches, ouvrage.coteTete - H / 2) || couches[0];
  const gammaSolAmont = coucheAmont.poidsVolumiques.gammaHumide.v;
  const phiSolAmont = coucheAmont.resistanceDrainee.phiPrime.v;
  const deltaAmont = phiSolAmont * (ouvrage.frottementDeltaSurPhi || 0.667);

  // Coefficients de poussée
  const coeff = calculerCoefficientsPousseeButee(phiSolAmont, deltaAmont, ouvrage.inclinaisonTerrePlein || 0, 90);
  const Ka = coeff.Ka;
  const Kp = coeff.Kp;

  // Calcul des poids volumiques béton armé 25 kN/m³
  const gammaBeton = 25.0;

  // Poids des composants (par mètre linéaire)
  const hauteurVoileSeul = H - epaisseurSemelle;
  const poidsVoile = hauteurVoileSeul * eVoile * gammaBeton;
  const xVoile = debordAvant + eVoile / 2; // depuis arête avant

  const poidsSemelle = B * epaisseurSemelle * gammaBeton;
  const xSemelle = B / 2;

  const poidsSolTalon = talonArriere * hauteurVoileSeul * gammaSolAmont;
  const xSolTalon = debordAvant + eVoile + talonArriere / 2;

  const poidsTotalVertical = poidsVoile + poidsSemelle + poidsSolTalon;

  // Poussée des terres
  const pousseeSolHorizontale = 0.5 * gammaSolAmont * H * H * Ka;
  const brasLevierSol = H / 3;

  // Poussée de surcharge uniforme éventuelle
  const qSurch = ouvrage.surchargeQ || 0;
  const pousseeSurchargeHorizontale = qSurch * H * Ka;
  const brasLevierSurcharge = H / 2;

  const pousseeTotaleH = pousseeSolHorizontale + pousseeSurchargeHorizontale;

  // Moments caractéristiques par rapport à l'arête avant O
  const momentStabilisant_k = poidsVoile * xVoile + poidsSemelle * xSemelle + poidsSolTalon * xSolTalon;
  const momentRenversant_k =
    pousseeSolHorizontale * brasLevierSol + pousseeSurchargeHorizontale * brasLevierSurcharge;

  // Facteurs partiels
  const factA = config.facteursActions.A1;
  const factSol = config.facteursSol.M1;
  const factR = config.facteursResistance.R2;

  // 1. Renversement EQU
  // M_dst;d <= M_stb;d avec gamma_G_dst = 1.10 (ou 1.35) et gamma_G_stb = 0.90
  const M_dst_d =
    pousseeSolHorizontale * brasLevierSol * 1.35 + pousseeSurchargeHorizontale * brasLevierSurcharge * 1.50;
  const M_stb_d = momentStabilisant_k * 0.90;
  const tauxEQU = M_dst_d / Math.max(1, M_stb_d);

  // 2. Glissement ELU
  const H_d = pousseeSolHorizontale * factA.gamma_G_dst + pousseeSurchargeHorizontale * factA.gamma_Q_dst;
  const V_d = poidsTotalVertical * factA.gamma_G_dst;

  // Couche sous la semelle
  const coucheFondation = trouverCoucheACote(couches, ouvrage.coteTete - H - 0.2) || couches[0];
  const phiFondation_k = coucheFondation.resistanceDrainee.phiPrime.v;
  const deltaFondation_d = (phiFondation_k * (2 / 3) * Math.PI) / 180;
  const R_h_d = (V_d * Math.tan(deltaFondation_d)) / factR.gamma_Rh;
  const tauxGlissement = H_d / Math.max(1, R_h_d);

  // 3. Portance de la semelle (Module A réutilisé)
  const M_net_d = Math.max(0, momentStabilisant_k * factA.gamma_G_dst - momentRenversant_k * factA.gamma_G_dst);
  const x_resultante = V_d > 0 ? M_net_d / V_d : B / 2;
  const e_B = Math.abs(B / 2 - x_resultante);
  const decollementPartiel = e_B > B / 6;
  const B_prime = Math.max(0.2, B - 2 * e_B);

  // Capacité portante simplifiée de la semelle
  const phiSolFondRad = (phiFondation_k * Math.PI) / 180;
  const Nq = Math.exp(Math.PI * Math.tan(phiSolFondRad)) * Math.pow(Math.tan(Math.PI / 4 + phiSolFondRad / 2), 2);
  const Ngamma = 2 * (Nq - 1) * Math.tan(phiSolFondRad);
  const q_ult_Rd = (0.5 * coucheFondation.poidsVolumiques.gammaHumide.v * B_prime * Ngamma) / factR.gamma_Rv;
  const q_appliquee = V_d / B_prime;
  const tauxPortance = q_appliquee / Math.max(1, q_ult_Rd);

  const tauxMax = Math.max(tauxEQU, tauxGlissement, tauxPortance);

  return {
    hauteurTotale: H,
    largeurSemelleB: B,
    epaisseurVoile: eVoile,
    debordAvant,
    talonArriere: Number(talonArriere.toFixed(2)),
    Ka: Number(Ka.toFixed(4)),
    Kp: Number(Kp.toFixed(4)),
    poidsVoile: Number(poidsVoile.toFixed(1)),
    poidsSemelle: Number(poidsSemelle.toFixed(1)),
    poidsSolTalon: Number(poidsSolTalon.toFixed(1)),
    poidsTotalVertical: Number(poidsTotalVertical.toFixed(1)),
    pousseeSolHorizontale: Number(pousseeSolHorizontale.toFixed(1)),
    brasLevierSol: Number(brasLevierSol.toFixed(2)),
    pousseeSurchargeHorizontale: Number(pousseeSurchargeHorizontale.toFixed(1)),
    brasLevierSurcharge: Number(brasLevierSurcharge.toFixed(2)),
    pousseeTotaleH: Number(pousseeTotaleH.toFixed(1)),
    momentStabilisant_k: Number(momentStabilisant_k.toFixed(1)),
    momentRenversant_k: Number(momentRenversant_k.toFixed(1)),
    equ: {
      M_dst_d: Number(M_dst_d.toFixed(1)),
      M_stb_d: Number(M_stb_d.toFixed(1)),
      taux: Number(tauxEQU.toFixed(3)),
      conforme: tauxEQU <= 1.0,
    },
    glissement: {
      H_d: Number(H_d.toFixed(1)),
      R_h_d: Number(R_h_d.toFixed(1)),
      taux: Number(tauxGlissement.toFixed(3)),
      conforme: tauxGlissement <= 1.0,
    },
    portance: {
      V_d: Number(V_d.toFixed(1)),
      e_B: Number(e_B.toFixed(3)),
      B_prime: Number(B_prime.toFixed(2)),
      decollementPartiel,
      q_appliquee_max: Number(q_appliquee.toFixed(1)),
      q_ult_Rd: Number(q_ult_Rd.toFixed(1)),
      taux: Number(tauxPortance.toFixed(3)),
      conforme: tauxPortance <= 1.0,
    },
    tauxMaxGouvernant: Number(tauxMax.toFixed(3)),
    verificationGlobaleConforme: tauxMax <= 1.0,
    clauseReference: CLAUSES_EC7.glissement_superficielle.clause,
    statutNormatif: 'Normative',
  };
}

export function verifierMurEnLELU(
  ouvrage: OuvrageSoutenement,
  couches: CoucheGeotechnique[],
  hydrogeologie: Hydrogeologie,
  config: ConfigurationNormative
) {
  const res = verifierMurEnL(ouvrage, couches, hydrogeologie, config);

  return {
    ...res,
    pressions: {
      Ka: res.Ka,
      Pa_sol_k: res.pousseeSolHorizontale,
      Pa_q_k: res.pousseeSurchargeHorizontale,
      Pa_d: Number((res.pousseeTotaleH * 1.35).toFixed(1)),
    },
    basculementEQU: res.equ,
    glissement: {
      conforme: res.glissement.conforme,
      taux: res.glissement.taux,
      H_d: res.glissement.H_d,
      R_hd: res.glissement.R_h_d,
    },
    portance: {
      conforme: res.portance.conforme,
      taux: res.portance.taux,
      V_d: res.portance.V_d,
      R_vd: Number((res.portance.q_ult_Rd * res.portance.B_prime).toFixed(1)),
      B_prime: res.portance.B_prime,
    },
    // Non calculée ici (l'ancienne valeur F = 1,48 était fictive) : la stabilité générale
    // se vérifie dans l'onglet Stabilité, avec le profil réel et les surcharges.
    stabiliteGlobale: {
      calculee: false as const,
      methode: "Non calculée dans ce module : voir l'onglet Stabilité (Bishop, cercles critiques)",
    },
  };
}

