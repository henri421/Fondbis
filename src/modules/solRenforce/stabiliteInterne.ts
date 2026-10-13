import { OuvrageSolRenforce } from '../../types/geotech';
import { CombinaisonStabilite } from '../../briques/stabiliteGenerale';
import { fetoileEffectifs } from './parametres';

/**
 * Stabilité interne d'un massif en sol renforcé (méthode cohérente gravitaire simplifiée).
 * Par lit i, à la profondeur z sous la tête :
 *   K(z)   = Ka·[K0/Ka + (Kz0/Ka − K0/Ka)·min(z, z0)/z0],  Ka de Rankine avec φ'r,d
 *   σv,d   = γG·(γr·z + qG) + γQ·qQ
 *   T_d    = K(z)·σv,d·Sv,i                                (kN/m de parement)
 *   P_d    = C·F*(z)·α·σv,res·B_c·Le / γR;a,  σv,res = γr·z + qG (sans Q, favorable)
 *   R_t,d  = acier : n·b·(e − 2·Δe)·fy / γR;t ;  géosynthétique : T_ult / (RF_fl·RF_end·RF_v) / γR;t
 * Ligne des tractions maximales : bilinéaire (0,6·h jusqu'à H/2 puis 0,3·H) pour les
 * armatures inextensibles, droite de Rankine à 45° + φ/2 pour les extensibles.
 */

const DEG = Math.PI / 180;

export interface LitArmature {
  index: number;
  hauteur: number; // m au-dessus de la base
  cote: number; // m
  z: number; // m sous la tête
  Sv: number; // m, hauteur d'influence
}

export interface ResultatLit extends LitArmature {
  K_sur_Ka: number;
  K: number;
  sigmaV_d: number; // kPa
  T_d: number; // kN/m
  longueurActive: number; // m
  longueurAncrage: number; // m, Le
  Fetoile: number;
  sigmaV_resistant: number; // kPa
  arrachementLineique_d: number; // kN/m par m de Le
  P_d: number; // kN/m
  R_d: number; // kN/m
  tauxArrachement: number;
  tauxRupture: number;
  taux: number;
}

export interface ResultatInterne {
  combinaison: CombinaisonStabilite;
  Ka: number;
  phi_d: number;
  lits: ResultatLit[];
  tauxMax: number;
  conforme: boolean;
  avertissements: string[];
}

export function positionsLits(o: OuvrageSolRenforce): LitArmature[] {
  const hauteurs: number[] = [];
  for (let h = o.premierLit; h <= o.hauteur - 0.05 && o.espacementSv > 0.05; h += o.espacementSv) {
    hauteurs.push(Number(h.toFixed(6)));
    if (hauteurs.length > 200) break;
  }
  return hauteurs.map((h, i) => {
    const bas = i === 0 ? 0 : (h + hauteurs[i - 1]) / 2;
    const haut = i === hauteurs.length - 1 ? o.hauteur : (h + hauteurs[i + 1]) / 2;
    return { index: i, hauteur: h, cote: o.coteBase + h, z: o.hauteur - h, Sv: haut - bas };
  });
}

/** Distance au parement de la ligne des tractions maximales, à la hauteur h au-dessus de la base. */
export function longueurActive(o: OuvrageSolRenforce, h: number, phiDeg: number): number {
  if (o.coefficients.ligne === 'rankine') return h * Math.tan((45 - phiDeg / 2) * DEG);
  return h <= o.hauteur / 2 ? 0.6 * h : 0.3 * o.hauteur;
}

/** Résistance de calcul à la rupture d'un lit, par mètre de parement (kN/m). */
export function resistanceRupture_d(o: OuvrageSolRenforce): number {
  const a = o.armature;
  const g = o.coefficients.gamma_R_rupture.v;
  if (a.type === 'geosynthetique') {
    return a.resistanceUltime_kNm / (a.RF_fluage * a.RF_endommagement * a.RF_vieillissement) / g;
  }
  const eCorr = Math.max(0, a.epaisseur_mm - 2 * a.perteEpaisseurParFace_mm.v);
  return (a.nbParMetre * a.largeur_mm * eCorr * a.fy_MPa) / 1000 / g;
}

/** Largeur frottante par mètre de parement (m/m). */
export function largeurContact(o: OuvrageSolRenforce): number {
  const a = o.armature;
  return a.type === 'geosynthetique' ? a.tauxCouverture : (a.nbParMetre * a.largeur_mm) / 1000;
}

/** Coefficients K/Ka et F* à la profondeur z. */
export function coefficientsA(o: OuvrageSolRenforce, z: number): { K_sur_Ka: number; Fetoile: number } {
  const c = o.coefficients;
  const t = Math.min(Math.max(z, 0), c.z0.v) / c.z0.v;
  const { F0, Fz0 } = fetoileEffectifs(o);
  return {
    K_sur_Ka: c.K0_sur_Ka.v + (c.Kz0_sur_Ka.v - c.K0_sur_Ka.v) * t,
    Fetoile: F0 + (Fz0 - F0) * t,
  };
}

/** Résistance à l'arrachement de calcul par mètre de longueur ancrée, à la profondeur z. */
export function arrachementLineique_d(o: OuvrageSolRenforce, z: number): number {
  const c = o.coefficients;
  const sigma = o.remblai.gamma * z + o.surchargeG;
  return (c.C.v * coefficientsA(o, z).Fetoile * c.alpha.v * sigma * largeurContact(o)) / c.gamma_R_arrachement.v;
}

export function verifierStabiliteInterne(o: OuvrageSolRenforce, comb: CombinaisonStabilite): ResultatInterne {
  const phi_d = Math.atan(Math.tan(o.remblai.phiPrime * DEG) / comb.gamma_phi) / DEG;
  const s = Math.sin(phi_d * DEG);
  const Ka = (1 - s) / (1 + s);
  const R_d = resistanceRupture_d(o);
  const avertissements: string[] = [];

  const lits: ResultatLit[] = positionsLits(o).map((lit) => {
    const { K_sur_Ka, Fetoile } = coefficientsA(o, lit.z);
    const K = K_sur_Ka * Ka;
    const sigmaV_d = comb.gamma_G * (o.remblai.gamma * lit.z + o.surchargeG) + comb.gamma_Q * o.surchargeQ;
    const T_d = K * sigmaV_d * lit.Sv;
    const La = longueurActive(o, lit.hauteur, o.remblai.phiPrime);
    const Le = Math.max(0, o.longueurArmatures - La);
    const lineique = arrachementLineique_d(o, lit.z);
    const P_d = lineique * Le;
    const tauxArrachement = P_d > 0 ? T_d / P_d : Infinity;
    const tauxRupture = R_d > 0 ? T_d / R_d : Infinity;
    return {
      ...lit,
      K_sur_Ka,
      K,
      sigmaV_d,
      T_d,
      longueurActive: La,
      longueurAncrage: Le,
      Fetoile,
      sigmaV_resistant: o.remblai.gamma * lit.z + o.surchargeG,
      arrachementLineique_d: lineique,
      P_d,
      R_d,
      tauxArrachement,
      tauxRupture,
      taux: Math.max(tauxArrachement, tauxRupture),
    };
  });

  if (lits.length === 0) avertissements.push('Aucun lit d’armatures : vérifier le premier lit et l’espacement.');
  if (lits.some((l) => l.longueurAncrage < 1.0)) {
    avertissements.push("Longueur d'ancrage Le < 1 m sur au moins un lit (minimum usuel de la méthode FHWA : 0,9 m).");
  }
  if (o.longueurArmatures < 0.7 * o.hauteur) {
    avertissements.push('L < 0,7·H : en dessous de la longueur minimale usuelle des armatures.');
  }
  if (o.armature.type !== 'geosynthetique' && o.armature.epaisseur_mm - 2 * o.armature.perteEpaisseurParFace_mm.v <= 0) {
    avertissements.push("Épaisseur d'acier entièrement consommée par la corrosion : résistance à la rupture nulle.");
  }

  const tauxMax = lits.reduce((m, l) => Math.max(m, l.taux), 0);
  return {
    combinaison: comb,
    Ka,
    phi_d,
    lits,
    tauxMax,
    conforme: lits.length > 0 && tauxMax <= 1 + 1e-9,
    avertissements,
  };
}
