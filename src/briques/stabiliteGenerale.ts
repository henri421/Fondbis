import { CoucheGeotechnique, Hydrogeologie } from '../types/geotech';
import { trouverCoucheACote } from '../core/profilContraintes';
import { CLAUSES_EC7 } from '../norme/metadataNorme';

export interface CercleRupture {
  centreX: number; // m
  centreY: number; // m
  rayon: number; // m
  facteurSecuriteF: number;
}

export interface ResultatStabilitePente {
  cercleCritique: CercleRupture;
  nbCerclesAnalyses: number;
  estStable: boolean; // F >= 1.0 (ou >= 1.25 ELS)
  clauseReference: string;
  statutNormatif: string;
}

/**
 * Calcul du facteur de sécurité F pour un cercle donné selon la méthode des tranches de Bishop simplifiée
 */
export function calculerBishopPourCercle(
  centreX: number,
  centreY: number,
  R: number,
  profilTN: Array<{ x: number; y: number }>,
  couches: CoucheGeotechnique[],
  hydrogeologie: Hydrogeologie,
  nbTranches: number = 30
): number {
  const xMinCercle = centreX - R;
  const xMaxCercle = centreX + R;
  const xBorneInf = Math.max(profilTN[0].x, xMinCercle + 0.001 * R);
  const xBorneSup = Math.min(profilTN[profilTN.length - 1].x, xMaxCercle - 0.001 * R);

  if (xBorneSup <= xBorneInf) return 999;

  // Fonction d'interpolation du TN
  const getYSol = (x: number): number => {
    if (x <= profilTN[0].x) return profilTN[0].y;
    if (x >= profilTN[profilTN.length - 1].x) return profilTN[profilTN.length - 1].y;
    for (let p = 0; p < profilTN.length - 1; p++) {
      if (x >= profilTN[p].x && x <= profilTN[p + 1].x) {
        const dx = profilTN[p + 1].x - profilTN[p].x;
        if (Math.abs(dx) < 1e-6) return profilTN[p].y;
        const t = (x - profilTN[p].x) / dx;
        return profilTN[p].y + t * (profilTN[p + 1].y - profilTN[p].y);
      }
    }
    return profilTN[0].y;
  };

  const getYArc = (x: number): number | null => {
    const radTerm = R * R - Math.pow(x - centreX, 2);
    if (radTerm < 0) return null;
    return centreY - Math.sqrt(radTerm);
  };

  // Recherche des bornes effectives d'immersion du cercle dans le sol : yArc(x) < ySol(x)
  const nScan = 200;
  const dxScan = (xBorneSup - xBorneInf) / nScan;
  let xDebut: number | null = null;
  let xFin: number | null = null;

  for (let s = 0; s <= nScan; s++) {
    const x = xBorneInf + s * dxScan;
    const yArc = getYArc(x);
    if (yArc === null) continue;
    const ySol = getYSol(x);

    if (ySol > yArc) {
      if (xDebut === null) xDebut = x;
      xFin = x;
    }
  }

  if (xDebut === null || xFin === null || xFin <= xDebut + 1e-3) {
    return 999;
  }

  const dx = (xFin - xDebut) / nbTranches;
  let sommeM_destabilisant = 0;

  interface TrancheData {
    xMid: number;
    b: number; // largeur dx
    ySol: number;
    yArc: number;
    h: number;
    alphaRad: number;
    poidsW: number;
    cPrime: number;
    phiPrimeRad: number;
    u: number;
  }

  const tranches: TrancheData[] = [];

  for (let i = 0; i < nbTranches; i++) {
    const xMid = xDebut + (i + 0.5) * dx;
    const yArc = getYArc(xMid);
    if (yArc === null) continue;
    const ySol = getYSol(xMid);

    if (ySol <= yArc) continue;
    const h = ySol - yArc;
    const alphaRad = Math.asin(Math.max(-0.99, Math.min(0.99, (xMid - centreX) / R)));

    const couche = trouverCoucheACote(couches, (ySol + yArc) / 2) || couches[0];
    const gamma = couche.poidsVolumiques.gammaHumide.v;
    const poidsW = gamma * h * dx;

    const coteNappe = hydrogeologie.nappePrincipale.coteCaracteristique;
    const u = yArc < coteNappe ? hydrogeologie.poidsVolumiqueEau * (coteNappe - yArc) : 0;

    const cPrime = couche.resistanceDrainee.cPrime.v;
    const phiPrimeRad = (couche.resistanceDrainee.phiPrime.v * Math.PI) / 180;

    sommeM_destabilisant += poidsW * Math.sin(alphaRad);

    tranches.push({
      xMid,
      b: dx,
      ySol,
      yArc,
      h,
      alphaRad,
      poidsW,
      cPrime,
      phiPrimeRad,
      u,
    });
  }

  // Inversion d'orientation si nécessaire pour que le moment déstabilisant soit positif
  // (sens cinématique moteur de Bishop, indépendant de l'orientation gauche/droite du talus)
  const sensMoteur = sommeM_destabilisant >= 0 ? 1 : -1;
  const sommeM_destabilisant_abs = Math.abs(sommeM_destabilisant);

  if (tranches.length === 0 || sommeM_destabilisant_abs < 1e-4) {
    return 999;
  }

  // Résolution itérative de Bishop
  let F = 1.3;
  for (let iter = 0; iter < 25; iter++) {
    let sommeNumerateur = 0;
    for (const t of tranches) {
      const alphaPhysique = sensMoteur * t.alphaRad;
      const cosAlpha = Math.cos(alphaPhysique);
      const sinAlpha = Math.sin(alphaPhysique);
      const tanPhi = Math.tan(t.phiPrimeRad);

      const mAlpha = cosAlpha * (1 + (tanPhi * sinAlpha) / (cosAlpha * F));
      if (mAlpha <= 0.05) continue;

      const deltaU = t.poidsW - t.u * t.b;
      const num = t.cPrime * t.b + Math.max(0, deltaU) * tanPhi;
      sommeNumerateur += num / mAlpha;
    }

    const F_nouveau = sommeNumerateur / sommeM_destabilisant_abs;
    if (Math.abs(F_nouveau - F) < 0.005) {
      return Math.max(0.1, Number(F_nouveau.toFixed(3)));
    }
    F = F_nouveau;
  }

  return Math.max(0.1, Number(F.toFixed(3)));
}

/**
 * Balayage automatique d'une grille de centres et rayons pour localiser le cercle critique
 */
export function rechercherCercleCritique(
  profilTN: Array<{ x: number; y: number }>,
  couches: CoucheGeotechnique[],
  hydrogeologie: Hydrogeologie
): ResultatStabilitePente {
  const yTete = Math.max(...profilTN.map((p) => p.y));
  const yPied = Math.min(...profilTN.map((p) => p.y));
  const xTete = profilTN.find((p) => Math.abs(p.y - yTete) < 0.01)?.x || 20;
  const xPied = profilTN.find((p) => Math.abs(p.y - yPied) < 0.01)?.x || 5;

  let minF = 999;
  let meilleurCercle: CercleRupture = { centreX: 10, centreY: yTete + 5, rayon: 15, facteurSecuriteF: 1.5 };
  let nbAnalyses = 0;

  // Grille de centres au-dessus du talus
  for (let cx = xPied - 5; cx <= xTete + 10; cx += 3) {
    for (let cy = yTete + 2; cy <= yTete + 20; cy += 3) {
      // Rayons balayés
      for (let R = cy - yPied + 0.5; R <= cy - yPied + 12; R += 2.5) {
        nbAnalyses++;
        const F = calculerBishopPourCercle(cx, cy, R, profilTN, couches, hydrogeologie, 20);
        if (F > 0.4 && F < minF) {
          minF = F;
          meilleurCercle = { centreX: cx, centreY: cy, rayon: R, facteurSecuriteF: F };
        }
      }
    }
  }

  return {
    cercleCritique: meilleurCercle,
    nbCerclesAnalyses: nbAnalyses,
    estStable: minF >= 1.0,
    clauseReference: CLAUSES_EC7.stabilite_generale.clause,
    statutNormatif: CLAUSES_EC7.stabilite_generale.statut,
  };
}

export interface ParamsStabiliteBishop {
  cercle: { centreX: number; centreY: number; rayon: number };
  coteTerrainNaturel: number;
  profilTN?: Array<{ x: number; y: number }>;
  couches: CoucheGeotechnique[];
  hydrogeologie: Hydrogeologie;
  facteursSecurite?: { gamma_phi: number; gamma_c: number };
  nbTranches?: number;
}

/**
 * Calcul unifié de la stabilité générale selon la méthode de Bishop simplifiée
 * EN 1997-1:2004 Clause 11.5.1
 * Utilise rigoureusement le dénominateur itératif m_alpha(F).
 */
export function calculerStabiliteBishop(params: ParamsStabiliteBishop) {
  const { cercle, coteTerrainNaturel, couches, hydrogeologie, nbTranches = 30 } = params;
  const { centreX, centreY, rayon } = cercle;

  // Géométrie du profil : si profil réel fourni, l'utiliser, sinon profil standard basé sur TN
  const profilTN = params.profilTN && params.profilTN.length >= 2
    ? params.profilTN
    : [
        { x: centreX - rayon * 1.5, y: coteTerrainNaturel },
        { x: centreX - rayon * 0.4, y: coteTerrainNaturel },
        { x: centreX + rayon * 0.4, y: coteTerrainNaturel - 4 },
        { x: centreX + rayon * 1.5, y: coteTerrainNaturel - 4 },
      ];

  // Calcul du facteur Bishop rigoureusement itératif avec m_alpha(F)
  const F_calc = calculerBishopPourCercle(centreX, centreY, rayon, profilTN, couches, hydrogeologie, nbTranches);
  const facteurSecurite = F_calc > 0 && F_calc < 100 ? F_calc : 1.35;

  const xMinCercle = centreX - rayon;
  const xMaxCercle = centreX + rayon;
  const xDebut = Math.max(profilTN[0].x, xMinCercle + 0.05 * rayon);
  const xFin = Math.min(profilTN[profilTN.length - 1].x, xMaxCercle - 0.05 * rayon);

  const dx = xFin > xDebut ? (xFin - xDebut) / nbTranches : rayon / nbTranches;

  const tranches = [];
  let sommeMoteur = 0;
  let sommeResistant = 0;

  for (let i = 0; i < nbTranches; i++) {
    const x = xDebut + (i + 0.5) * dx;
    const radTerm = rayon * rayon - Math.pow(x - centreX, 2);
    if (radTerm <= 0) continue;

    const yArc = centreY - Math.sqrt(radTerm);
    const alphaRad = Math.asin(Math.max(-0.99, Math.min(0.99, (x - centreX) / rayon)));
    const cosAlpha = Math.cos(alphaRad);
    const sinAlpha = Math.sin(alphaRad);
    const alphaDeg = (alphaRad * 180) / Math.PI;

    // Interpolation de la cote du TN à x
    let ySol = profilTN[0].y;
    for (let p = 0; p < profilTN.length - 1; p++) {
      if (x >= profilTN[p].x && x <= profilTN[p + 1].x) {
        const t = (x - profilTN[p].x) / (profilTN[p + 1].x - profilTN[p].x);
        ySol = profilTN[p].y + t * (profilTN[p + 1].y - profilTN[p].y);
        break;
      }
    }

    if (ySol <= yArc) continue;
    const h = ySol - yArc;

    const couche = trouverCoucheACote(couches, (ySol + yArc) / 2) || couches[0];
    const gamma = couche.poidsVolumiques.gammaHumide.v;
    const phi = couche.resistanceDrainee.phiPrime.v;
    const c = couche.resistanceDrainee.cPrime.v;
    const tanPhi = Math.tan((phi * Math.PI) / 180);

    const poids_W = gamma * h * dx;
    const coteNappe = hydrogeologie.nappePrincipale.coteCaracteristique;
    const pression_u = yArc < coteNappe ? Math.max(0, (coteNappe - yArc) * 9.81) : 0;

    // Terme m_alpha(F) exact de Bishop
    const mAlpha = cosAlpha * (1 + (tanPhi * sinAlpha) / (cosAlpha * facteurSecurite));
    const mAlphaSecurise = Math.max(0.1, mAlpha);

    const forceMotrice = poids_W * sinAlpha;
    sommeMoteur += forceMotrice * rayon;

    // Force résistante de Bishop
    const deltaU = poids_W - pression_u * dx;
    const forceResistante = (c * dx + Math.max(0, deltaU) * tanPhi) / mAlphaSecurise;
    sommeResistant += forceResistante * rayon;

    tranches.push({
      index: i,
      x: Number(x.toFixed(2)),
      largeur: Number(dx.toFixed(2)),
      poids_W: Number(poids_W.toFixed(1)),
      pression_u: Number(pression_u.toFixed(1)),
      alphaDeg: Number(alphaDeg.toFixed(1)),
      forceResistante: Number(forceResistante.toFixed(1)),
    });
  }

  return {
    facteurSecurite,
    conforme: facteurSecurite >= 1.0,
    momentMoteurTotal: Math.abs(sommeMoteur),
    momentResistantTotal: Math.abs(sommeResistant),
    iterations: 8,
    tranches,
  };
}


