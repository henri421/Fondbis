import {
  ConfigurationNormative,
  CoucheGeotechnique,
  Hydrogeologie,
  OuvrageRadier,
  ParametresCaracteristiquesSol,
} from '../../types/geotech';
import { calculerParametresDeCalcul } from '../../core/deriveesSol';
import { calculerProfilContraintes, trouverCoucheACote } from '../../core/profilContraintes';
import { CLAUSES_EC7 } from '../../norme/metadataNorme';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export interface ResultatPortanceELU {
  approche: string;
  combinaison: string;
  jeuActions: 'A1' | 'A2';
  jeuSol: 'M1' | 'M2';
  jeuResistance: 'R1' | 'R2' | 'R3';
  
  // Sollicitations de calcul
  V_d: number; // kN
  H_d: number; // kN
  M_d: number; // kNm
  
  // Géométrie effective
  e_B: number; // m
  e_L: number; // m
  decollementPartiel: boolean; // e_B > B/6
  decollementTotal: boolean; // e_B >= B/2
  B_prime: number; // m
  L_prime: number; // m
  A_prime: number; // m²
  
  // Facteurs de portance
  phi_d: number; // deg
  c_d: number; // kPa
  cu_d: number; // kPa
  Nq: number;
  Nc: number;
  Ngamma: number;
  sq: number;
  sc: number;
  sg: number;
  iq: number;
  ic: number;
  ig: number;
  
  // Contraintes de portance
  q_prime: number; // kPa
  q_total: number; // kPa
  gamma_prime: number; // kN/m³
  
  // Capacité portante brute et résistance nette
  q_ult_draine: number; // kPa
  R_k_draine: number; // kN
  R_d_draine: number; // kN
  tauxExploitationDraine: number; // V_d / R_d
  
  q_ult_nonDraine: number; // kPa
  R_k_nonDraine: number; // kN
  R_d_nonDraine: number; // kN
  tauxExploitationNonDraine: number;
  
  // Glissement ELU
  R_h_draine: number; // kN
  tauxGlissementDraine: number;
  R_h_nonDraine: number; // kN
  tauxGlissementNonDraine: number;
  glissementConforme04Vd: boolean; // H_d <= 0.4 V_d
  
  // Hydraulique UPL & HYD
  upl: {
    V_dst_d: number; // Sous-pression de l'eau
    G_stb_d: number; // Poids stabilisant de l'ouvrage
    conforme: boolean;
    taux: number;
  };
  
  conditionGouvernante: 'Draine' | 'NonDraine';
  tauxExploitationGouvernant: number;
  clauseReference: string;
  statutNormatif: string;
}

/**
 * Calcul de la portance et du glissement ELU selon EN 1997-1:2004 Annexe D
 */
export function verifierPortanceRadierELU(
  ouvrage: OuvrageRadier,
  coteTerrainNaturel: number,
  couches: CoucheGeotechnique[],
  hydrogeologie: Hydrogeologie,
  config: ConfigurationNormative,
  options?: {
    forceBandeFilante?: boolean; // Pour les tests normalisés T1.1 et T1.2
    combinaisonForcee?: { jeuActions: 'A1' | 'A2'; jeuSol: 'M1' | 'M2'; jeuResistance: 'R1' | 'R2' | 'R3' };
  }
): ResultatPortanceELU {
  const { actions, coteBase, largeurB, longueurL } = ouvrage;

  // Détermination de la combinaison selon l'approche de calcul (DA1, DA2, DA3)
  const jeuActions = options?.combinaisonForcee?.jeuActions || (config.approcheCalcul === 'DA1' ? 'A1' : 'A1');
  const jeuSol = options?.combinaisonForcee?.jeuSol || (config.approcheCalcul === 'DA3' ? 'M2' : 'M1');
  const jeuResistance = options?.combinaisonForcee?.jeuResistance || (config.approcheCalcul === 'DA2' ? 'R2' : 'R1');

  const factActions = config.facteursActions[jeuActions];
  const gamma_Rv = config.facteursResistance[jeuResistance].gamma_Rv;
  const gamma_Rh = config.facteursResistance[jeuResistance].gamma_Rh;

  // Sollicitations de calcul
  const V_d = Math.max(1, actions.V_G * factActions.gamma_G_dst + actions.V_Q * factActions.gamma_Q_dst);
  const H_d = Math.hypot(
    actions.H_G * factActions.gamma_G_dst + actions.H_Q * factActions.gamma_Q_dst,
    0
  );
  const M_d = Math.abs(actions.M_G * factActions.gamma_G_dst + actions.M_Q * factActions.gamma_Q_dst);

  // Excentricités et surface effective
  const e_B = V_d > 0 ? M_d / V_d : 0;
  const e_L = 0; // Moment en B considéré prioritairement
  const decollementPartiel = e_B > largeurB / 6;
  const decollementTotal = e_B >= largeurB / 2;

  const B_prime = Math.max(0.1, largeurB - 2 * e_B);
  const L_prime = options?.forceBandeFilante ? 1e6 : Math.max(0.1, longueurL - 2 * e_L);
  const A_prime = options?.forceBandeFilante ? B_prime * 1.0 : B_prime * L_prime;

  // Caractéristiques du sol d'assise sous la semelle
  const coucheAssise = trouverCoucheACote(couches, coteBase - 0.1) || couches[0];
  const solK: ParametresCaracteristiquesSol = {
    phiPrime_k: coucheAssise.resistanceDrainee.phiPrime.v,
    cPrime_k: coucheAssise.resistanceDrainee.cPrime.v,
    cu_k: coucheAssise.resistanceNonDrainee.cuTete.v,
    gammaHumide_k: coucheAssise.poidsVolumiques.gammaHumide.v,
    gammaSature_k: coucheAssise.poidsVolumiques.gammaSature.v,
    delta_k: coucheAssise.resistanceDrainee.deltaInterface.v,
  };

  const solD = calculerParametresDeCalcul(solK, jeuSol, config);
  const phi_d = solD.phiPrime_d;
  const c_d = solD.cPrime_d;
  const cu_d = solD.cu_d;

  // Calcul du profil de contraintes ELU au niveau de la base
  const profilELU = calculerProfilContraintes(coteTerrainNaturel, couches, hydrogeologie, [coteBase], 'ELU');
  const ptBase = profilELU.calculerA(coteBase);
  const q_prime = ptBase.sigma_vPrime;
  const q_total = ptBase.sigma_v;

  // Poids volumique effectif sous la base
  const coteNappeELU = hydrogeologie.nappePrincipale.coteDefavorableELU;
  let gamma_prime = coucheAssise.poidsVolumiques.gammaHumide.v;
  if (coteNappeELU >= coteBase) {
    gamma_prime = coucheAssise.poidsVolumiques.gammaSature.v - hydrogeologie.poidsVolumiqueEau;
  } else if (coteNappeELU > coteBase - B_prime) {
    // Nappe intermédiaire dans la zone d'influence B'
    const dW = coteBase - coteNappeELU;
    const gammaSatSub = coucheAssise.poidsVolumiques.gammaSature.v - hydrogeologie.poidsVolumiqueEau;
    gamma_prime = (dW * coucheAssise.poidsVolumiques.gammaHumide.v + (B_prime - dW) * gammaSatSub) / B_prime;
  }

  // Facteurs de portance Nq, Nc, Ngamma (Annexe D)
  const phiRad = phi_d * DEG2RAD;
  let Nq = 1.0;
  let Nc = Math.PI + 2;
  let Ngamma = 0;

  if (phi_d > 0.05) {
    Nq = Math.exp(Math.PI * Math.tan(phiRad)) * Math.pow(Math.tan(Math.PI / 4 + phiRad / 2), 2);
    Nc = (Nq - 1) / Math.tan(phiRad);
    Ngamma = 2 * (Nq - 1) * Math.tan(phiRad);
  }

  // Facteurs de forme sq, sg, sc
  const rapportBL = options?.forceBandeFilante ? 0 : Math.min(1.0, B_prime / L_prime);
  const sq = 1 + rapportBL * Math.sin(phiRad);
  const sg = Math.max(0.1, 1 - 0.3 * rapportBL);
  const sc = phi_d > 0.05 ? (sq * Nq - 1) / (Nq - 1) : 1 + 0.2 * rapportBL;

  // Facteurs d'inclinaison iq, ig, ic
  let iq = 1.0;
  let ig = 1.0;
  let ic = 1.0;
  if (H_d > 0 && V_d > 0) {
    const m = (2 + rapportBL) / (1 + rapportBL);
    const denom = V_d + A_prime * (c_d > 0 && phi_d > 0 ? c_d / Math.tan(phiRad) : 0);
    const baseI = Math.max(0, 1 - H_d / Math.max(1, denom));
    iq = Math.pow(baseI, m);
    ig = Math.pow(baseI, m + 1);
    ic = phi_d > 0.05 ? iq - (1 - iq) / (Nc * Math.tan(phiRad)) : 1.0;
  }

  // Capacité portante drainée
  // R / A' = c' * Nc * sc * ic + q' * Nq * sq * iq + 0.5 * gamma' * B' * Ngamma * sg * ig
  const termeCohesion = c_d * Nc * sc * ic;
  const termeSurcharge = q_prime * Nq * sq * iq;
  const termeSol = 0.5 * gamma_prime * B_prime * Ngamma * sg * ig;
  const q_ult_draine = termeCohesion + termeSurcharge + termeSol;

  const R_k_draine = q_ult_draine * A_prime;
  const R_d_draine = R_k_draine / gamma_Rv;
  const tauxExploitationDraine = V_d / Math.max(0.1, R_d_draine);

  // Condition non drainée (court terme)
  // R / A' = (pi + 2) * cu * sc * ic + q
  const sc_nd = 1 + 0.2 * rapportBL;
  let ic_nd = 1.0;
  if (H_d > 0 && cu_d > 0) {
    const radTerm = Math.max(0, 1 - H_d / Math.max(1, A_prime * cu_d));
    ic_nd = 0.5 * (1 + Math.sqrt(radTerm));
  }
  const q_ult_nonDraine = (Math.PI + 2) * cu_d * sc_nd * ic_nd + q_total;
  const R_k_nonDraine = q_ult_nonDraine * A_prime;
  const R_d_nonDraine = R_k_nonDraine / gamma_Rv;
  const tauxExploitationNonDraine = V_d / Math.max(0.1, R_d_nonDraine);

  // Condition gouvernante
  const conditionGouvernante = tauxExploitationDraine >= tauxExploitationNonDraine ? 'Draine' : 'NonDraine';
  const tauxExploitationGouvernant = Math.max(tauxExploitationDraine, tauxExploitationNonDraine);

  // Glissement ELU (6.5.3)
  const deltaRad = solD.delta_d * DEG2RAD;
  const R_h_draine = (V_d * Math.tan(deltaRad)) / gamma_Rh;
  const tauxGlissementDraine = H_d / Math.max(0.1, R_h_draine);

  const R_h_nonDraine = (A_prime * cu_d) / gamma_Rh;
  const tauxGlissementNonDraine = H_d / Math.max(0.1, R_h_nonDraine);
  const glissementConforme04Vd = H_d <= 0.4 * V_d;

  // Vérification Hydraulique UPL (soulèvement global sous radier)
  // V_dst;d = sous-pression u sous la base * A
  const uBaseELU = ptBase.u;
  const surfaceBrute = largeurB * longueurL;
  const V_dst_d = uBaseELU * surfaceBrute;
  // Poids propre dalle radier estimé à épaisseur * 25 kN/m³ (béton armé) + action permanente favorable V_G
  const poidsDalle = surfaceBrute * (ouvrage.epaisseur || 0.4) * 25;
  const G_stb_d = (poidsDalle + actions.V_G) * config.facteursActions.A1.gamma_G_stb;
  const tauxUPL = V_dst_d / Math.max(1, G_stb_d);

  return {
    approche: config.approcheCalcul,
    combinaison: `${jeuActions} + ${jeuSol} + ${jeuResistance}`,
    jeuActions,
    jeuSol,
    jeuResistance,
    V_d: Number(V_d.toFixed(2)),
    H_d: Number(H_d.toFixed(2)),
    M_d: Number(M_d.toFixed(2)),
    e_B: Number(e_B.toFixed(3)),
    e_L: Number(e_L.toFixed(3)),
    decollementPartiel,
    decollementTotal,
    B_prime: Number(B_prime.toFixed(3)),
    L_prime: Number(L_prime.toFixed(3)),
    A_prime: Number(A_prime.toFixed(3)),
    phi_d: Number(phi_d.toFixed(2)),
    c_d: Number(c_d.toFixed(2)),
    cu_d: Number(cu_d.toFixed(2)),
    Nq: Number(Nq.toFixed(4)),
    Nc: Number(Nc.toFixed(4)),
    Ngamma: Number(Ngamma.toFixed(4)),
    sq: Number(sq.toFixed(4)),
    sc: Number(sc.toFixed(4)),
    sg: Number(sg.toFixed(4)),
    iq: Number(iq.toFixed(4)),
    ic: Number(ic.toFixed(4)),
    ig: Number(ig.toFixed(4)),
    q_prime: Number(q_prime.toFixed(2)),
    q_total: Number(q_total.toFixed(2)),
    gamma_prime: Number(gamma_prime.toFixed(2)),
    q_ult_draine: Number(q_ult_draine.toFixed(1)),
    R_k_draine: Number(R_k_draine.toFixed(1)),
    R_d_draine: Number(R_d_draine.toFixed(1)),
    tauxExploitationDraine: Number(tauxExploitationDraine.toFixed(3)),
    q_ult_nonDraine: Number(q_ult_nonDraine.toFixed(1)),
    R_k_nonDraine: Number(R_k_nonDraine.toFixed(1)),
    R_d_nonDraine: Number(R_d_nonDraine.toFixed(1)),
    tauxExploitationNonDraine: Number(tauxExploitationNonDraine.toFixed(3)),
    R_h_draine: Number(R_h_draine.toFixed(1)),
    tauxGlissementDraine: Number(tauxGlissementDraine.toFixed(3)),
    R_h_nonDraine: Number(R_h_nonDraine.toFixed(1)),
    tauxGlissementNonDraine: Number(tauxGlissementNonDraine.toFixed(3)),
    glissementConforme04Vd,
    upl: {
      V_dst_d: Number(V_dst_d.toFixed(1)),
      G_stb_d: Number(G_stb_d.toFixed(1)),
      conforme: V_dst_d <= G_stb_d,
      taux: Number(tauxUPL.toFixed(3)),
    },
    conditionGouvernante,
    tauxExploitationGouvernant: Number(tauxExploitationGouvernant.toFixed(3)),
    clauseReference: CLAUSES_EC7.portance_superficielle.clause,
    statutNormatif: CLAUSES_EC7.portance_superficielle.statut,
  };
}
