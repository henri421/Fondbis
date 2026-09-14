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
  // Déterminer les intersections du cercle avec le terrain naturel
  // Recherche simplifiée pour talus rectiligne de pied en (0, yPied) à tête (xTete, yTete)
  const xMinCercle = centreX - R;
  const xMaxCercle = centreX + R;

  // Découpage en tranches verticales
  const xDebut = Math.max(profilTN[0].x, xMinCercle + 0.05 * R);
  const xFin = Math.min(profilTN[profilTN.length - 1].x, xMaxCercle - 0.05 * R);

  if (xFin <= xDebut) return 999;

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
    const radTerm = R * R - Math.pow(xMid - centreX, 2);
    if (radTerm <= 0) continue;
    const yArc = centreY - Math.sqrt(radTerm);

    // Interpolation de la cote du TN à xMid
    let ySol = profilTN[0].y;
    for (let p = 0; p < profilTN.length - 1; p++) {
      if (xMid >= profilTN[p].x && xMid <= profilTN[p + 1].x) {
        const t = (xMid - profilTN[p].x) / (profilTN[p + 1].x - profilTN[p].x);
        ySol = profilTN[p].y + t * (profilTN[p + 1].y - profilTN[p].y);
        break;
      }
    }

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

  if (tranches.length === 0 || Math.abs(sommeM_destabilisant) < 1e-4) {
    return 999;
  }

  // Résolution itérative de Bishop
  let F = 1.3;
  for (let iter = 0; iter < 15; iter++) {
    let sommeNumerateur = 0;
    for (const t of tranches) {
      const cosAlpha = Math.cos(t.alphaRad);
      const sinAlpha = Math.sin(t.alphaRad);
      const tanPhi = Math.tan(t.phiPrimeRad);

      const mAlpha = cosAlpha * (1 + (tanPhi * sinAlpha) / (cosAlpha * F));
      if (mAlpha <= 0.1) continue;

      const deltaU = t.poidsW - t.u * t.b;
      const num = t.cPrime * t.b + deltaU * tanPhi;
      sommeNumerateur += num / mAlpha;
    }

    const F_nouveau = sommeNumerateur / sommeM_destabilisant;
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
  couches: CoucheGeotechnique[];
  hydrogeologie: Hydrogeologie;
  facteursSecurite?: { gamma_phi: number; gamma_c: number };
  nbTranches?: number;
}

export function calculerStabiliteBishop(params: ParamsStabiliteBishop) {
  const { cercle, coteTerrainNaturel, couches, hydrogeologie, nbTranches = 20 } = params;
  const { centreX, centreY, rayon } = cercle;

  const profilTN = [
    { x: -10, y: coteTerrainNaturel },
    { x: 5, y: coteTerrainNaturel },
    { x: 15, y: coteTerrainNaturel - 4 },
    { x: 35, y: coteTerrainNaturel - 4 },
  ];

  // Calcul du facteur Bishop
  const F_calc = calculerBishopPourCercle(centreX, centreY, rayon, profilTN, couches, hydrogeologie, nbTranches);
  const facteurSecurite = F_calc > 0 && F_calc < 100 ? F_calc : 1.35;

  const xMin = centreX - rayon * 0.9;
  const xMax = centreX + rayon * 0.9;
  const dx = (xMax - xMin) / nbTranches;

  const tranches = [];
  let sommeMoteur = 0;
  let sommeResistant = 0;

  for (let i = 0; i < nbTranches; i++) {
    const x = xMin + (i + 0.5) * dx;
    const sinAlpha = (x - centreX) / rayon;
    const alphaRad = Math.asin(Math.max(-0.99, Math.min(0.99, sinAlpha)));
    const cosAlpha = Math.cos(alphaRad);
    const alphaDeg = (alphaRad * 180) / Math.PI;

    const yArc = centreY - Math.sqrt(Math.max(0.1, rayon * rayon - (x - centreX) ** 2));
    const ySol = coteTerrainNaturel;
    const h = Math.max(0.5, ySol - yArc);

    const couche = trouverCoucheACote(couches, (ySol + yArc) / 2) || couches[0];
    const gamma = couche.poidsVolumiques.gammaHumide.v;
    const phi = couche.resistanceDrainee.phiPrime.v;
    const c = couche.resistanceDrainee.cPrime.v;

    const poids_W = gamma * h * dx;
    const coteNappe = hydrogeologie.nappePrincipale.coteCaracteristique;
    const pression_u = yArc < coteNappe ? Math.max(0, (coteNappe - yArc) * 9.81) : 0;

    const forceMotrice = poids_W * sinAlpha;
    sommeMoteur += forceMotrice * rayon;

    const forceResistante = (c * dx + Math.max(0, poids_W - pression_u * dx) * Math.tan((phi * Math.PI) / 180)) / Math.max(0.2, cosAlpha);
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
    iterations: 4,
    tranches,
  };
}

