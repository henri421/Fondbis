import { CoucheGeotechnique, Hydrogeologie, OuvrageRadier } from '../../types/geotech';
import { calculerProfilContraintes, trouverCoucheACote } from '../../core/profilContraintes';
import { CLAUSES_EC7 } from '../../norme/metadataNorme';

export interface DetailSousCoucheTassement {
  index: number;
  coteHaut: number;
  coteBas: number;
  epaisseur: number; // m
  coucheNom: string;
  sigma_v0_prime: number; // kPa (contrainte initiale effective)
  delta_sigma_v: number; // kPa (surcontrainte au centre)
  delta_sigma_v_coin: number; // kPa (surcontrainte au coin)
  sigma_p_prime: number; // kPa (pression de préconsolidation)
  regime: 'surconsolide' | 'normalement_consolide' | 'franchissement';
  tassementCentre_mm: number;
  tassementCoin_mm: number;
}

export interface ResultatTassementELS {
  pressionAppliquee_q: number; // kPa
  tassementCentreTotal_mm: number;
  tassementCoinTotal_mm: number;
  tassementMoyen_mm: number;
  tassementDifferentiel_mm: number;
  distorsionAngulaire: number; // rad (ex: 1/750)
  distorsionRatio: string; // "1 / 750"
  critereAdmissibleRespecte: boolean; // ex: < 1/500
  detailsSousCouches: DetailSousCoucheTassement[];
  clauseReference: string;
  statutNormatif: string;
}

/**
 * Facteur d'influence de Steinbrenner pour la diffusion d'une charge rectangulaire uniforme
 * à l'angle d'un rectangle de dimensions b x l à la profondeur z
 */
export function facteurSteinbrennerAngle(b: number, l: number, z: number): number {
  if (z <= 1e-4) return 0.25; // À la surface à l'angle
  const m = b / z;
  const n = l / z;
  const m2 = m * m;
  const n2 = n * n;
  const mn = m * n;
  const r2 = m2 + n2 + 1;
  const r = Math.sqrt(r2);

  const term1 = (2 * mn * r) / (r2 + m2 * n2);
  const term2 = (m2 + n2 + 2) / (r2);
  const term3 = Math.atan2(2 * mn * r, r2 - m2 * n2);
  const valAtan = term3 < 0 ? term3 + Math.PI : term3;

  const I = (1 / (4 * Math.PI)) * (term1 * term2 + valAtan);
  return Math.max(0, Math.min(0.25, I));
}

/**
 * Surcontrainte verticale Delta sigma_v sous le centre d'un rectangle B x L
 * Par superposition des 4 quadrants (B/2 x L/2)
 */
export function surcontrainteCentre(q: number, B: number, L: number, z: number): number {
  if (z <= 1e-4) return q;
  const I_quadrant = facteurSteinbrennerAngle(B / 2, L / 2, z);
  return q * 4 * I_quadrant;
}

/**
 * Surcontrainte verticale Delta sigma_v sous le coin d'un rectangle B x L
 */
export function surcontrainteCoin(q: number, B: number, L: number, z: number): number {
  if (z <= 1e-4) return 0.25 * q;
  const I_coin = facteurSteinbrennerAngle(B, L, z);
  return q * I_coin;
}

/**
 * Calcule le tassement d'une sous-couche selon les trois régimes de consolidation (Section 6.5)
 * Test T1.3 validé directement
 */
export function calculerTassementSousCoucheOedométrique(
  H_i: number,
  sigma_v0: number,
  delta_sigma: number,
  Cc: number,
  Cs: number,
  e0: number,
  sigma_p: number
): { s_mm: number; regime: 'surconsolide' | 'normalement_consolide' | 'franchissement' } {
  if (H_i <= 0 || sigma_v0 <= 0 || delta_sigma <= 0) {
    return { s_mm: 0, regime: 'surconsolide' };
  }

  const sigma_finale = sigma_v0 + delta_sigma;
  const coeffC = Cc / (1 + e0);
  const coeffS = Cs / (1 + e0);

  let s_m = 0;
  let regime: 'surconsolide' | 'normalement_consolide' | 'franchissement' = 'surconsolide';

  if (sigma_finale <= sigma_p) {
    // Cas 1 : Surconsolidé (recompression seule)
    regime = 'surconsolide';
    s_m = H_i * coeffS * Math.log10(sigma_finale / sigma_v0);
  } else if (sigma_v0 >= sigma_p) {
    // Cas 2 : Normalement consolidé (compression vierge)
    regime = 'normalement_consolide';
    s_m = H_i * coeffC * Math.log10(sigma_finale / sigma_v0);
  } else {
    // Cas 3 : Franchissement de la pression de préconsolidation
    regime = 'franchissement';
    const s_recomp = H_i * coeffS * Math.log10(sigma_p / sigma_v0);
    const s_vierge = H_i * coeffC * Math.log10(sigma_finale / sigma_p);
    s_m = s_recomp + s_vierge;
  }

  return { s_mm: Math.max(0, s_m * 1000), regime };
}

/**
 * Calcul complet du tassement ELS selon EN 1997-1:2004 Annexe F
 */
export function calculerTassementRadierELS(
  ouvrage: OuvrageRadier,
  coteTerrainNaturel: number,
  couches: CoucheGeotechnique[],
  hydrogeologie: Hydrogeologie,
  options?: {
    profondeurInfluenceMax?: number; // m sous la base (par défaut 3 * B)
    pasSousCouche?: number; // 0.25 m
  }
): ResultatTassementELS {
  const { actions, coteBase, largeurB, longueurL } = ouvrage;
  const surface = largeurB * longueurL;
  // Charge ELS quasi-permanente : V_G + 0.3 * V_Q (ou V_G + V_Q caractéristique)
  const V_ELS = actions.V_G + actions.V_Q;
  const q_ELS = Math.max(1, V_ELS / surface);

  const profMax = options?.profondeurInfluenceMax || Math.max(5, 3 * largeurB);
  const dz = options?.pasSousCouche || 0.25;

  const profilELS = calculerProfilContraintes(coteTerrainNaturel, couches, hydrogeologie, [coteBase], 'ELS');

  const details: DetailSousCoucheTassement[] = [];
  let sCentreTotal_mm = 0;
  let sCoinTotal_mm = 0;

  let zRelatif = 0;
  let index = 0;

  while (zRelatif < profMax) {
    const epaisseur = Math.min(dz, profMax - zRelatif);
    const zMilieu = zRelatif + epaisseur / 2;
    const coteAbsolueMilieu = coteBase - zMilieu;

    const couche = trouverCoucheACote(couches, coteAbsolueMilieu);
    if (couche) {
      const ptContrainte = profilELS.calculerA(coteAbsolueMilieu);
      const sigma_v0 = Math.max(1, ptContrainte.sigma_vPrime);

      // Surcontraintes de Boussinesq
      const dSigmaCentre = surcontrainteCentre(q_ELS, largeurB, longueurL, zMilieu);
      const dSigmaCoin = surcontrainteCoin(q_ELS, largeurB, longueurL, zMilieu);

      const Cc = couche.deformation.Cc.v;
      const Cs = couche.deformation.Cs.v;
      const e0 = couche.deformation.e0.v;
      const sigma_p = couche.deformation.sigmaPrecons.v || sigma_v0 * 1.5;

      const resCentre = calculerTassementSousCoucheOedométrique(epaisseur, sigma_v0, dSigmaCentre, Cc, Cs, e0, sigma_p);
      const resCoin = calculerTassementSousCoucheOedométrique(epaisseur, sigma_v0, dSigmaCoin, Cc, Cs, e0, sigma_p);

      sCentreTotal_mm += resCentre.s_mm;
      sCoinTotal_mm += resCoin.s_mm;

      details.push({
        index: index++,
        coteHaut: Number((coteBase - zRelatif).toFixed(2)),
        coteBas: Number((coteBase - zRelatif - epaisseur).toFixed(2)),
        epaisseur: Number(epaisseur.toFixed(2)),
        coucheNom: couche.nom,
        sigma_v0_prime: Number(sigma_v0.toFixed(1)),
        delta_sigma_v: Number(dSigmaCentre.toFixed(1)),
        delta_sigma_v_coin: Number(dSigmaCoin.toFixed(1)),
        sigma_p_prime: Number(sigma_p.toFixed(1)),
        regime: resCentre.regime,
        tassementCentre_mm: Number(resCentre.s_mm.toFixed(2)),
        tassementCoin_mm: Number(resCoin.s_mm.toFixed(2)),
      });
    }

    zRelatif += epaisseur;
  }

  const sMoyen_mm = (sCentreTotal_mm + sCoinTotal_mm) / 2;
  const sDiff_mm = Math.abs(sCentreTotal_mm - sCoinTotal_mm);
  const distanceDemiDiagonale = Math.hypot(largeurB / 2, longueurL / 2);
  const distorsion = distanceDemiDiagonale > 0 ? (sDiff_mm / 1000) / distanceDemiDiagonale : 0;
  const ratioDenom = distorsion > 0 ? Math.round(1 / distorsion) : 10000;
  const distorsionRatio = `1 / ${ratioDenom}`;
  const critereAdmissibleRespecte = distorsion <= 1 / 500; // Limite classique EN 1997-1 Annexe H

  return {
    pressionAppliquee_q: Number(q_ELS.toFixed(1)),
    tassementCentreTotal_mm: Number(sCentreTotal_mm.toFixed(1)),
    tassementCoinTotal_mm: Number(sCoinTotal_mm.toFixed(1)),
    tassementMoyen_mm: Number(sMoyen_mm.toFixed(1)),
    tassementDifferentiel_mm: Number(sDiff_mm.toFixed(1)),
    distorsionAngulaire: Number(distorsion.toFixed(6)),
    distorsionRatio,
    critereAdmissibleRespecte,
    detailsSousCouches: details,
    clauseReference: CLAUSES_EC7.tassement_superficielle.clause,
    statutNormatif: CLAUSES_EC7.tassement_superficielle.statut,
  };
}

export interface PointCourbeTassementCharge {
  pression_kPa: number;
  chargeTotale_kN: number;
  tassementCentre_mm: number;
  tassementCoin_mm: number;
  tassementMoyen_mm: number;
  tassementDifferentiel_mm: number;
  ratioChargeELS: number;
}

/**
 * Génère la courbe de tassement théorique (centre, coin, moyen) en fonction de la charge
 * appliquée (pression q en kPa et charge totale V en kN), de 0 à facteurMaxCharge * q_ELS.
 * Intègre la non-linéarité œdométrique (zones surconsolidée, franchissement de sigma'_p et normalement consolidée).
 */
export function calculerCourbeTassementCharge(
  ouvrage: OuvrageRadier,
  coteTerrainNaturel: number,
  couches: CoucheGeotechnique[],
  hydrogeologie: Hydrogeologie,
  options?: {
    nbPoints?: number;
    facteurMaxCharge?: number;
  }
): PointCourbeTassementCharge[] {
  const { actions, coteBase, largeurB, longueurL } = ouvrage;
  const surface = largeurB * longueurL;
  const V_ELS = Math.max(10, actions.V_G + actions.V_Q);
  const q_ELS = Math.max(1, V_ELS / surface);

  const nbPoints = options?.nbPoints || 21;
  const facteurMax = options?.facteurMaxCharge || 2.0;

  const profMax = Math.max(5, 3 * largeurB);
  const dz = 0.25;

  const profilELS = calculerProfilContraintes(coteTerrainNaturel, couches, hydrogeologie, [coteBase], 'ELS');

  interface InfoSousCouche {
    epaisseur: number;
    sigma_v0: number;
    zMilieu: number;
    Cc: number;
    Cs: number;
    e0: number;
    sigma_p: number;
  }

  const sousCouches: InfoSousCouche[] = [];
  let zRelatif = 0;
  while (zRelatif < profMax) {
    const epaisseur = Math.min(dz, profMax - zRelatif);
    const zMilieu = zRelatif + epaisseur / 2;
    const coteAbsolueMilieu = coteBase - zMilieu;
    const couche = trouverCoucheACote(couches, coteAbsolueMilieu);
    if (couche) {
      const pt = profilELS.calculerA(coteAbsolueMilieu);
      const sigma_v0 = Math.max(1, pt.sigma_vPrime);
      sousCouches.push({
        epaisseur,
        sigma_v0,
        zMilieu,
        Cc: couche.deformation.Cc.v,
        Cs: couche.deformation.Cs.v,
        e0: couche.deformation.e0.v,
        sigma_p: couche.deformation.sigmaPrecons.v || sigma_v0 * 1.5,
      });
    }
    zRelatif += epaisseur;
  }

  const qValuesSet = new Set<number>();
  for (let i = 0; i < nbPoints; i++) {
    const q = (i / (nbPoints - 1)) * (q_ELS * facteurMax);
    qValuesSet.add(Number(q.toFixed(2)));
  }
  qValuesSet.add(Number(q_ELS.toFixed(2)));
  const qValues = Array.from(qValuesSet).sort((a, b) => a - b);

  const points: PointCourbeTassementCharge[] = [];

  for (const q of qValues) {
    let sCentre = 0;
    let sCoin = 0;

    if (q > 1e-3) {
      for (const sc of sousCouches) {
        const dSigmaCentre = surcontrainteCentre(q, largeurB, longueurL, sc.zMilieu);
        const dSigmaCoin = surcontrainteCoin(q, largeurB, longueurL, sc.zMilieu);

        const resC = calculerTassementSousCoucheOedométrique(
          sc.epaisseur,
          sc.sigma_v0,
          dSigmaCentre,
          sc.Cc,
          sc.Cs,
          sc.e0,
          sc.sigma_p
        );
        const resCoin = calculerTassementSousCoucheOedométrique(
          sc.epaisseur,
          sc.sigma_v0,
          dSigmaCoin,
          sc.Cc,
          sc.Cs,
          sc.e0,
          sc.sigma_p
        );

        sCentre += resC.s_mm;
        sCoin += resCoin.s_mm;
      }
    }

    const sMoyen = (sCentre + sCoin) / 2;
    const sDiff = Math.abs(sCentre - sCoin);
    const chargeTotale = q * surface;

    points.push({
      pression_kPa: Number(q.toFixed(1)),
      chargeTotale_kN: Number(chargeTotale.toFixed(0)),
      tassementCentre_mm: Number(sCentre.toFixed(2)),
      tassementCoin_mm: Number(sCoin.toFixed(2)),
      tassementMoyen_mm: Number(sMoyen.toFixed(2)),
      tassementDifferentiel_mm: Number(sDiff.toFixed(2)),
      ratioChargeELS: Number((q / q_ELS).toFixed(2)),
    });
  }

  return points;
}

