import { ConfigurationNormative, CoucheGeotechnique, Hydrogeologie, OuvrageSolRenforce } from '../../types/geotech';
import { CombinaisonStabilite } from '../../briques/stabiliteGenerale';
import { trouverCoucheACote } from '../../core/profilContraintes';
import { verifierPortanceRadierELU } from '../radier/portanceELU';
import { JEU_RESISTANCE } from './parametres';

/**
 * Stabilité externe : le massif renforcé est traité en mur poids de largeur L (par mètre).
 *   Poussée du sol retenu (Rankine, dos vertical, terre-plein horizontal, δ = 0) :
 *     P_sol = ½·Ka,b·γb·H²  (bras H/3),  P_q = Ka,b·q·H  (bras H/2)
 *   Glissement : H_d = γG·(P_sol + P_qG) + γQ·P_qQ ;  R_h,d = (W + qG·L)·tan δ_d / γR;h,
 *     tan δ_d = min(tan φ'r, tan φ'f) / γφ (contact sol-sol à la base, Q sur le massif ignorée)
 *   Excentricité (valeurs caractéristiques, Q sur le massif ignorée) : e ≤ L/6
 *   Portance : verifierPortanceRadierELU (EN 1997-1 annexe D, bande filante, B' = L − 2e) ;
 *     cas non drainé retenu seulement si la fondation a une c_u.
 */

const DEG = Math.PI / 180;

export interface ResultatExterne {
  combinaison: CombinaisonStabilite;
  jeuResistance: 'R1' | 'R2' | 'R3';
  Ka_b: number;
  phi_b_d: number;
  gamma_b: number;
  W: number; // kN/m, poids du massif
  P_sol: number; // kN/m caractéristiques
  P_qG: number;
  P_qQ: number;
  glissement: { H_d: number; V_stb: number; tanDelta_d: number; R_hd: number; taux: number };
  excentricite: { e: number; limite: number; taux: number };
  portance: {
    V_d: number;
    e_d: number;
    B_prime: number;
    R_vd: number; // drainé
    R_vd_nonDraine: number | null; // null si la fondation n'a pas de c_u
    taux: number;
  };
  tauxMax: number;
  conforme: boolean;
  avertissements: string[];
}

export function verifierStabiliteExterne(
  o: OuvrageSolRenforce,
  comb: CombinaisonStabilite,
  couches: CoucheGeotechnique[],
  hydrogeologie: Hydrogeologie,
  config: ConfigurationNormative
): ResultatExterne {
  const H = o.hauteur;
  const L = o.longueurArmatures;
  const jeuR = JEU_RESISTANCE[comb.id];

  // Sol retenu, pris à mi-hauteur derrière le massif
  const retenu = trouverCoucheACote(couches, o.coteBase + H / 2) ?? couches[0];
  const fondation = trouverCoucheACote(couches, o.coteBase - 0.1) ?? couches[couches.length - 1];
  const gamma_b = retenu.poidsVolumiques.gammaHumide.v;
  const phi_b_d = Math.atan(Math.tan(retenu.resistanceDrainee.phiPrime.v * DEG) / comb.gamma_phi) / DEG;
  const s = Math.sin(phi_b_d * DEG);
  const Ka_b = (1 - s) / (1 + s);
  const sk = Math.sin(retenu.resistanceDrainee.phiPrime.v * DEG);
  const Ka_bk = (1 - sk) / (1 + sk);

  const W = o.remblai.gamma * H * L;
  const P_sol = 0.5 * Ka_b * gamma_b * H * H;
  const P_qG = Ka_b * o.surchargeG * H;
  const P_qQ = Ka_b * o.surchargeQ * H;

  // Glissement
  const H_d = comb.gamma_G * (P_sol + P_qG) + comb.gamma_Q * P_qQ;
  const V_stb = W + o.surchargeG * L;
  const tanDelta_d =
    Math.min(Math.tan(o.remblai.phiPrime * DEG), Math.tan(fondation.resistanceDrainee.phiPrime.v * DEG)) / comb.gamma_phi;
  const gamma_Rh = config.facteursResistance[jeuR].gamma_Rh;
  const R_hd = (V_stb * tanDelta_d) / gamma_Rh;

  // Excentricité, valeurs caractéristiques (critère de l'outil : e ≤ L/6)
  const P_solk = 0.5 * Ka_bk * gamma_b * H * H;
  const P_qk = Ka_bk * (o.surchargeG + o.surchargeQ) * H;
  const M_stb = V_stb * (L / 2);
  const M_dst = P_solk * (H / 3) + P_qk * (H / 2);
  const e = L / 2 - (M_stb - M_dst) / V_stb;

  // Portance (annexe D), réutilisation du module radier en bande filante. Le module ne connaît
  // pas l'eau libre : la nappe est plafonnée au terrain devant le parement (fouille épuisée).
  const avertissements: string[] = [];
  const devant = o.coteBase + o.encastrement;
  const nappe = hydrogeologie.nappePrincipale;
  if (Math.max(nappe.coteDefavorableELU, nappe.coteCaracteristique) > o.coteBase) {
    avertissements.push(
      'Nappe au-dessus de la base du massif : sous-pressions, poussée de l’eau et réduction du poids non prises en compte dans la stabilité externe (hors périmètre) ; portance calculée avec la nappe plafonnée au terrain devant le parement.'
    );
  }
  const hydroPortance: Hydrogeologie = {
    ...hydrogeologie,
    nappePrincipale: {
      ...nappe,
      coteDefavorableELU: Math.min(nappe.coteDefavorableELU, devant),
      coteCaracteristique: Math.min(nappe.coteCaracteristique, devant),
    },
  };
  const portance = verifierPortanceRadierELU(
    {
      id: o.id,
      nom: o.nom,
      longueurL: 1,
      largeurB: L,
      coteBase: o.coteBase,
      epaisseur: 0,
      actions: {
        V_G: W + o.surchargeG * L,
        V_Q: o.surchargeQ * L,
        H_G: P_sol + P_qG,
        H_Q: P_qQ,
        M_G: P_sol * (H / 3) + P_qG * (H / 2),
        M_Q: P_qQ * (H / 2),
      },
      coteTerrainFini: o.coteBase + o.encastrement,
    },
    devant,
    couches,
    hydroPortance,
    config,
    {
      forceBandeFilante: true,
      combinaisonForcee: {
        jeuActions: comb.mode === 'actions' ? 'A2' : 'A1',
        jeuSol: comb.gamma_phi > 1 ? 'M2' : 'M1',
        jeuResistance: jeuR,
      },
    }
  );

  const glissement = { H_d, V_stb, tanDelta_d, R_hd, taux: H_d / Math.max(1e-9, R_hd) };
  const excentricite = { e, limite: L / 6, taux: Math.max(0, e) / (L / 6) };
  const portanceRes = {
    V_d: portance.V_d,
    e_d: portance.e_B,
    B_prime: portance.B_prime,
    R_vd: portance.R_d_draine,
    R_vd_nonDraine: fondation.resistanceNonDrainee.cuTete.v > 0 ? portance.R_d_nonDraine : null,
    // Le cas non drainé n'a de sens que si la fondation a une cohésion non drainée
    taux: fondation.resistanceNonDrainee.cuTete.v > 0 ? portance.tauxExploitationGouvernant : portance.tauxExploitationDraine,
  };
  const tauxMax = Math.max(glissement.taux, excentricite.taux, portanceRes.taux);
  return {
    combinaison: comb,
    jeuResistance: jeuR,
    Ka_b,
    phi_b_d,
    gamma_b,
    W,
    P_sol,
    P_qG,
    P_qQ,
    glissement,
    excentricite,
    portance: portanceRes,
    tauxMax,
    conforme: tauxMax <= 1 + 1e-9,
    avertissements,
  };
}
