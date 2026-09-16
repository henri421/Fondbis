import { CoucheGeotechnique, Hydrogeologie, OuvrageRadier } from '../../types/geotech';
import {
  OptionsPlaque,
  resoudrePlaque2DSurRessorts,
  ResultatPlaqueSurRessorts,
} from '../../core/solveurPlaqueSurRessorts';
import { CLAUSES_EC7 } from '../../norme/metadataNorme';

export interface OptionsCalculRadierRessorts {
  nx?: number; // maillage X (défaut 10)
  ny?: number; // maillage Y (défaut 10)
  ksInitial_kNm3?: number; // Raideur initiale (défaut estimée du sol)
  moduleYoungBeton_kPa?: number; // Défaut 30e6 kPa (30 GPa)
  coefficientPoissonBeton?: number; // Défaut 0.2
  maxIterations?: number; // Défaut 20
  toleranceConvergence?: number; // Défaut 0.01 (1%)
  facteurRelaxation?: number; // Défaut 0.5
}

export interface IterationHistorique {
  numero: number;
  flecheMax_mm: number;
  tassementDiff_mm: number;
  ecartRelatifMax: number;
  pressionMax_kPa: number;
}

export interface ResultatRadierRessortsIteratifs {
  radier: {
    longueurL: number;
    largeurB: number;
    epaisseur: number;
    pressionMoyenneAppliquee: number; // kPa
  };
  sol: {
    ksInitialMoyen: number; // kN/m³
    ksFinalMoyen: number; // kN/m³
  };
  convergence: {
    convergé: boolean;
    nbIterations: number;
    ecartFinalRelatif: number;
    historique: IterationHistorique[];
  };
  champs: {
    noeuds: Array<{
      index: number;
      x: number;
      y: number;
      tassement_mm: number;
      pression_kPa: number;
      ks_kNm3: number;
      moment_Mxx_kNm_m: number;
      moment_Myy_kNm_m: number;
    }>;
    tassementMax_mm: number;
    tassementMin_mm: number;
    tassementMoyen_mm: number;
    tassementDifferentielMax_mm: number;
    distorsionAngulaireMax: number;
    pressionContactMax_kPa: number;
    pressionContactMin_kPa: number;
    momentMax_kNm_m: number;
  };
  exportStructuralJSON: string;
  clauseReference: string;
  statutNormatif: string;
}

/**
 * Boucle itérative Sol-Structure selon EN 1997-1 / CDC §6.6
 */
export function calculerRadierSurRessortsIteratifs(
  ouvrage: OuvrageRadier,
  couches: CoucheGeotechnique[],
  hydrogeologie: Hydrogeologie,
  options?: OptionsCalculRadierRessorts
): ResultatRadierRessortsIteratifs {
  const { longueurL, largeurB, epaisseur, actions } = ouvrage;
  const nx = options?.nx || 8;
  const ny = options?.ny || 8;
  const maxIter = options?.maxIterations || 15;
  const tol = options?.toleranceConvergence || 0.01; // 1%
  const relaxation = options?.facteurRelaxation || 0.5;

  const surfaceTotale = longueurL * largeurB;
  const chargeTotaleVerticale = actions.V_G + actions.V_Q;
  const qMoyenApplique = chargeTotaleVerticale / surfaceTotale;

  // Estimation du ks initial depuis la première couche ou valeur par défaut
  let ks0 = options?.ksInitial_kNm3;
  if (!ks0 || ks0 <= 0) {
    const premiereCouche = couches[0];
    if (premiereCouche?.deformation?.Echargement?.v) {
      // Formule approchée : ks ~ E / (alpha * B)
      ks0 = Math.max(5000, (premiereCouche.deformation.Echargement.v * 1000) / (0.5 * largeurB));
    } else {
      ks0 = 25000; // kN/m³ typique pour sol meuble compact
    }
  }

  const nTotal = (nx + 1) * (ny + 1);
  let ksVecteur = new Array(nTotal).fill(ks0);
  const qNodal = new Array(nTotal).fill(qMoyenApplique);

  const optionsPlaque: OptionsPlaque = {
    longueurX: longueurL,
    largeurY: largeurB,
    epaisseur,
    E: options?.moduleYoungBeton_kPa || 30e6,
    nu: options?.coefficientPoissonBeton || 0.2,
    nx,
    ny,
    conditionsBords: 'libre',
  };

  let dernierResultatPlaque: ResultatPlaqueSurRessorts | null = null;
  let tassementsPrec: number[] = new Array(nTotal).fill(0);
  const historique: IterationHistorique[] = [];
  let converge = false;
  let ecartFinal = 1.0;

  for (let it = 1; it <= maxIter; it++) {
    // 1. Résolution de la plaque sur le champ de raideurs ks
    const resPlaque = resoudrePlaque2DSurRessorts(optionsPlaque, qNodal, ksVecteur);
    dernierResultatPlaque = resPlaque;

    // 2. Calcul des tassements par colonne de sol sous chaque nœud
    const tassementsNouveaux: number[] = [];
    for (let i = 0; i < nTotal; i++) {
      const p = resPlaque.pressions_sol[i];

      // Calcul œdométrique local sous la pression locale p
      let s_noeud = 0;
      let sigma_v0 = 10; // contrainte géostatique moyenne sous radier

      for (const couche of couches) {
        const H = Math.min(couche.epaisseur, 2 * largeurB);
        const Cc = couche.deformation?.Cc?.v ?? 0.1;
        const Cs = couche.deformation?.Cs?.v ?? 0.02;
        const e0 = couche.deformation?.e0?.v ?? 0.7;
        const sigP = couche.deformation?.sigmaPrecons?.v ?? 100;

        // Atténuation de Boussinesq simplifiée en profondeur
        const deltaSig = p * 0.75;
        if (deltaSig > 0.1) {
          if (sigma_v0 + deltaSig <= sigP) {
            s_noeud += (Cs / (1 + e0)) * H * Math.log10((sigma_v0 + deltaSig) / sigma_v0);
          } else if (sigma_v0 < sigP) {
            s_noeud += (Cs / (1 + e0)) * H * Math.log10(sigP / sigma_v0) +
                       (Cc / (1 + e0)) * H * Math.log10((sigma_v0 + deltaSig) / sigP);
          } else {
            s_noeud += (Cc / (1 + e0)) * H * Math.log10((sigma_v0 + deltaSig) / sigma_v0);
          }
        }
        sigma_v0 += couche.poidsVolumiques.gammaHumide.v * H;
      }

      tassementsNouveaux.push(Math.max(1e-4, s_noeud));
    }

    // 3. Test de convergence
    const sMax = Math.max(...tassementsNouveaux);
    let ecartMax = 0;
    if (it > 1 && sMax > 1e-6) {
      for (let i = 0; i < nTotal; i++) {
        const ecart = Math.abs(tassementsNouveaux[i] - tassementsPrec[i]) / sMax;
        if (ecart > ecartMax) ecartMax = ecart;
      }
    } else {
      ecartMax = 1.0;
    }

    historique.push({
      numero: it,
      flecheMax_mm: Number((sMax * 1000).toFixed(2)),
      tassementDiff_mm: Number(((sMax - Math.min(...tassementsNouveaux)) * 1000).toFixed(2)),
      ecartRelatifMax: Number((ecartMax * 100).toFixed(2)),
      pressionMax_kPa: Number(resPlaque.pressionMax.toFixed(1)),
    });

    ecartFinal = ecartMax;
    if (it > 1 && ecartMax < tol) {
      converge = true;
      break;
    }

    // 4. Actualisation des ressorts avec sous-relaxation ks = (1-rel)*ks + rel*(p/s)
    const ksSuivant: number[] = [];
    for (let i = 0; i < nTotal; i++) {
      const p = Math.max(1.0, resPlaque.pressions_sol[i]);
      const s = tassementsNouveaux[i];
      const ksCalcule = p / s;
      const ksActualise = (1 - relaxation) * ksVecteur[i] + relaxation * ksCalcule;
      // Bornes physiques de sécurité
      ksSuivant.push(Math.max(1000, Math.min(200000, ksActualise)));
    }

    ksVecteur = ksSuivant;
    tassementsPrec = tassementsNouveaux;
  }

  const resFinale = dernierResultatPlaque!;
  const tassements_mm = resFinale.deplacements_w.map((w) => Number((w * 1000).toFixed(2)));
  const sMax_mm = Math.max(...tassements_mm);
  const sMin_mm = Math.min(...tassements_mm);
  const sDiff_mm = sMax_mm - sMin_mm;
  const sMoy_mm = Number((tassements_mm.reduce((a, b) => a + b, 0) / tassements_mm.length).toFixed(2));
  const distorsionMax = sDiff_mm / (Math.min(longueurL, largeurB) * 1000);

  const noeudsDetailles = resFinale.noeuds.map((nd, idx) => ({
    index: nd.index,
    x: nd.x,
    y: nd.y,
    tassement_mm: tassements_mm[idx],
    pression_kPa: Number(resFinale.pressions_sol[idx].toFixed(1)),
    ks_kNm3: Number(ksVecteur[idx].toFixed(0)),
    moment_Mxx_kNm_m: Number(resFinale.moments_Mxx[idx].toFixed(1)),
    moment_Myy_kNm_m: Number(resFinale.moments_Myy[idx].toFixed(1)),
  }));

  // Structure d'export standardisée vers les modules structuraux (format d'échange)
  const exportStructural = {
    metadata: {
      type: 'radier_sur_ressorts_iteratifs',
      date: new Date().toISOString(),
      longueurL,
      largeurB,
      epaisseur,
      chargeTotale_kN: chargeTotaleVerticale,
    },
    maillage: {
      nx,
      ny,
      nbNoeuds: nTotal,
      dx: longueurL / nx,
      dy: largeurB / ny,
    },
    resultatsNodaux: noeudsDetailles,
  };

  return {
    radier: {
      longueurL,
      largeurB,
      epaisseur,
      pressionMoyenneAppliquee: Number(qMoyenApplique.toFixed(1)),
    },
    sol: {
      ksInitialMoyen: Number(ks0.toFixed(0)),
      ksFinalMoyen: Number((ksVecteur.reduce((a, b) => a + b, 0) / ksVecteur.length).toFixed(0)),
    },
    convergence: {
      convergé: converge,
      nbIterations: historique.length,
      ecartFinalRelatif: Number((ecartFinal * 100).toFixed(2)),
      historique,
    },
    champs: {
      noeuds: noeudsDetailles,
      tassementMax_mm: sMax_mm,
      tassementMin_mm: sMin_mm,
      tassementMoyen_mm: sMoy_mm,
      tassementDifferentielMax_mm: Number(sDiff_mm.toFixed(2)),
      distorsionAngulaireMax: Number(distorsionMax.toFixed(5)),
      pressionContactMax_kPa: Number(resFinale.pressionMax.toFixed(1)),
      pressionContactMin_kPa: Number(resFinale.pressionMin.toFixed(1)),
      momentMax_kNm_m: Number(Math.max(...resFinale.moments_Mxx.map(Math.abs)).toFixed(1)),
    },
    exportStructuralJSON: JSON.stringify(exportStructural, null, 2),
    clauseReference: CLAUSES_EC7.tassement_superficielle.clause,
    statutNormatif: CLAUSES_EC7.tassement_superficielle.statut,
  };
}
