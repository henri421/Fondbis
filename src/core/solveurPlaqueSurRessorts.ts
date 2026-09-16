/**
 * Solveur de plaque mince de Kirchhoff 2D sur appuis élastiques / sol de Winkler
 * Conforme au CDC §6.6 et EN 1997-1 / EN 1992
 * 
 * Équation biharmonique gouvernante :
 *   D · ∇⁴w(x,y) + ks(x,y)·w(x,y) = q(x,y)
 * avec rigidité flexionnelle de plaque D = E·epaisseur³ / (12·(1 - ν²))
 */

export interface OptionsPlaque {
  longueurX: number; // m (dimension selon X)
  largeurY: number;  // m (dimension selon Y)
  epaisseur: number; // m
  E: number;         // kPa (Module de Young du béton, ex: 30e6 kPa = 30 GPa)
  nu: number;        // coefficient de Poisson (0.2 pour le béton)
  nx: number;        // nombre d'intervalles en X (ex: 8 à 16)
  ny: number;        // nombre d'intervalles en Y (ex: 8 à 16)
  conditionsBords?: 'libre' | 'appuye' | 'encastre'; // par défaut 'libre' pour un radier
}

export interface NoeudPlaque {
  index: number;
  i: number; // indice x (0 .. nx)
  j: number; // indice y (0 .. ny)
  x: number; // m
  y: number; // m
  surfaceInfluence: number; // m²
}

export interface ResultatPlaqueSurRessorts {
  noeuds: NoeudPlaque[];
  deplacements_w: number[]; // flèche verticale w vers le bas [m]
  pressions_sol: number[];  // réaction de contact du sol sigma_v = ks * w [kPa]
  moments_Mxx: number[];    // moment de flexion selon X [kNm/m]
  moments_Myy: number[];    // moment de flexion selon Y [kNm/m]
  moments_Mxy: number[];    // moment de torsion [kNm/m]
  flecheMax: number;        // m
  flecheMin: number;        // m
  tassementDiffMax: number; // m
  pressionMax: number;      // kPa
  pressionMin: number;      // kPa
  pressionMoyenne: number;  // kPa
  convergé: boolean;
}

/**
 * Calcul de la flèche théorique au centre d'une plaque rectangulaire simplement appuyée
 * sous charge uniforme q par la série exacte de Navier (Timoshenko & Woinowsky-Krieger)
 */
export function flecheNavierTimoshenko(
  q: number, // kPa
  a: number, // m
  b: number, // m
  D: number, // kNm
  nbTermes: number = 30
): number {
  let w = 0;
  for (let m = 1; m <= nbTermes; m += 2) {
    for (let n = 1; n <= nbTermes; n += 2) {
      const sinTerm = Math.sin((m * Math.PI) / 2) * Math.sin((n * Math.PI) / 2); // alternance +/- 1
      const denom = m * n * Math.pow(Math.pow(m / a, 2) + Math.pow(n / b, 2), 2);
      w += sinTerm / denom;
    }
  }
  return ((16 * q) / (Math.pow(Math.PI, 6) * D)) * w;
}

/**
 * Résout la plaque 2D sur ressorts de Winkler avec discrétisation aux différences finies d'ordre 2
 * Système D ∇⁴w + ks w = q
 */
export function resoudrePlaque2DSurRessorts(
  options: OptionsPlaque,
  chargesNodales_q: number[], // charge descendante en kPa sur chaque nœud (taille = (nx+1)*(ny+1))
  raideursSol_ks: number[]    // raideur de réaction de sol en kN/m³ sur chaque nœud (taille = (nx+1)*(ny+1))
): ResultatPlaqueSurRessorts {
  const { longueurX, largeurY, epaisseur, E, nu, nx, ny, conditionsBords = 'libre' } = options;

  const dx = longueurX / nx;
  const dy = largeurY / ny;
  const dx2 = dx * dx;
  const dy2 = dy * dy;
  const D = (E * Math.pow(epaisseur, 3)) / (12 * (1 - nu * nu));

  const nTotal = (nx + 1) * (ny + 1);
  const getIndex = (i: number, j: number) => j * (nx + 1) + i;

  // Création du maillage nodal
  const noeuds: NoeudPlaque[] = [];
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const idx = getIndex(i, j);
      const coeffX = (i === 0 || i === nx) ? 0.5 : 1.0;
      const coeffY = (j === 0 || j === ny) ? 0.5 : 1.0;
      const surface = coeffX * dx * coeffY * dy;

      noeuds.push({
        index: idx,
        i,
        j,
        x: Number((i * dx).toFixed(4)),
        y: Number((j * dy).toFixed(4)),
        surfaceInfluence: surface,
      });
    }
  }

  // Si la plaque est simplement appuyée sans ressorts de sol (cas classique Timoshenko/Navier),
  // résolution par décomposition exacte en double Laplacien (Poisson) :
  // 1) ∇² M = -q avec M = 0 sur les bords
  // 2) ∇² w = -M/D avec w = 0 sur les bords
  const sansRessorts = raideursSol_ks.every((k) => k <= 0);
  if (conditionsBords === 'appuye' && sansRessorts) {
    const M = new Array(nTotal).fill(0);
    const w = new Array(nTotal).fill(0);
    const maxIterPoisson = 600;
    const omegaP = 1.35;
    const invDx2 = 1 / dx2;
    const invDy2 = 1 / dy2;
    const diagPoisson = 2 * (invDx2 + invDy2);

    // Étape 1 : ∇² M = -q
    for (let it = 0; it < maxIterPoisson; it++) {
      for (let j = 1; j < ny; j++) {
        for (let i = 1; i < nx; i++) {
          const idx = getIndex(i, j);
          const lapl = (M[getIndex(i + 1, j)] + M[getIndex(i - 1, j)]) * invDx2 +
                      (M[getIndex(i, j + 1)] + M[getIndex(i, j - 1)]) * invDy2;
          const qVal = chargesNodales_q[idx] || 0;
          const mNew = (lapl + qVal) / diagPoisson;
          M[idx] = (1 - omegaP) * M[idx] + omegaP * mNew;
        }
      }
    }

    // Étape 2 : ∇² w = -M / D
    for (let it = 0; it < maxIterPoisson; it++) {
      for (let j = 1; j < ny; j++) {
        for (let i = 1; i < nx; i++) {
          const idx = getIndex(i, j);
          const lapl = (w[getIndex(i + 1, j)] + w[getIndex(i - 1, j)]) * invDx2 +
                      (w[getIndex(i, j + 1)] + w[getIndex(i, j - 1)]) * invDy2;
          const source = M[idx] / D;
          const wNew = (lapl + source) / diagPoisson;
          w[idx] = (1 - omegaP) * w[idx] + omegaP * wNew;
        }
      }
    }

    const flecheMax = Math.max(...w);
    const flecheMin = Math.min(...w);

    return {
      noeuds,
      deplacements_w: w,
      pressions_sol: new Array(nTotal).fill(0),
      moments_Mxx: M,
      moments_Myy: M,
      moments_Mxy: new Array(nTotal).fill(0),
      flecheMax,
      flecheMin,
      tassementDiffMax: flecheMax - flecheMin,
      pressionMax: 0,
      pressionMin: 0,
      pressionMoyenne: 0,
      convergé: true,
    };
  }

  // Construction de la matrice de raideur de la plaque (biharmonique + ressorts)
  // Résolution par méthode itérative de Gauss-Seidel surrelaxé (SOR) pour robustesse et vitesse
  const A: Map<number, number>[] = Array.from({ length: nTotal }, () => new Map<number, number>());
  const B: number[] = new Array(nTotal).fill(0);

  const dx4 = dx2 * dx2;
  const dy4 = dy2 * dy2;
  const dx2dy2 = dx2 * dy2;

  // Coefficients du biharmonique ∇⁴w = w_xxxx + 2 w_xxyy + w_yyyy
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const idx = getIndex(i, j);
      const row = A[idx];

      if (conditionsBords === 'appuye' && (i === 0 || i === nx || j === 0 || j === ny)) {
        // Appui simple en périphérie : w = 0
        row.set(idx, 1.0);
        B[idx] = 0;
        continue;
      }

      if (conditionsBords === 'encastre' && (i === 0 || i === nx || j === 0 || j === ny)) {
        row.set(idx, 1.0);
        B[idx] = 0;
        continue;
      }

      // Terme de charge et ressort de sol
      const ks = raideursSol_ks[idx] || 0;
      let diag = ks;
      B[idx] = chargesNodales_q[idx] || 0;

      // Pochoir biharmonique avec conditions aux limites appropriées :
      // Pour 'appuye' : w_bord = 0 et M_bord = 0 => w(extérieur) = -w(intérieur)
      // Pour 'encastre' : w_bord = 0 et dw/dn = 0 => w(extérieur) = w(intérieur)
      // Pour 'libre' (radier) : réflexion miroir pour les pentes et courbures
      const addTermBiharmonique = (ii: number, jj: number, coeff: number) => {
        let sign = 1.0;
        let ci = ii;
        let cj = jj;

        if (conditionsBords === 'appuye') {
          if (ci < 0) { ci = -ci; sign *= -1; }
          if (ci > nx) { ci = 2 * nx - ci; sign *= -1; }
          if (cj < 0) { cj = -cj; sign *= -1; }
          if (cj > ny) { cj = 2 * ny - cj; sign *= -1; }
        } else {
          // encastré ou libre : réflexion symétrique
          if (ci < 0) ci = -ci;
          if (ci > nx) ci = 2 * nx - ci;
          if (cj < 0) cj = -cj;
          if (cj > ny) cj = 2 * ny - cj;
        }

        const targetIdx = getIndex(ci, cj);
        const current = row.get(targetIdx) || 0;
        row.set(targetIdx, current + coeff * sign);
      };

      // w_xxxx = (w[i+2] - 4w[i+1] + 6w[i] - 4w[i-1] + w[i-2]) / dx4
      addTermBiharmonique(i + 2, j, D / dx4);
      addTermBiharmonique(i - 2, j, D / dx4);
      addTermBiharmonique(i + 1, j, -4 * D / dx4);
      addTermBiharmonique(i - 1, j, -4 * D / dx4);
      diag += 6 * D / dx4;

      // w_yyyy = (w[j+2] - 4w[j+1] + 6w[j] - 4w[j-1] + w[j-2]) / dy4
      addTermBiharmonique(i, j + 2, D / dy4);
      addTermBiharmonique(i, j - 2, D / dy4);
      addTermBiharmonique(i, j + 1, -4 * D / dy4);
      addTermBiharmonique(i, j - 1, -4 * D / dy4);
      diag += 6 * D / dy4;

      // 2 * w_xxyy
      addTermBiharmonique(i + 1, j + 1, 2 * D / dx2dy2);
      addTermBiharmonique(i + 1, j - 1, 2 * D / dx2dy2);
      addTermBiharmonique(i - 1, j + 1, 2 * D / dx2dy2);
      addTermBiharmonique(i - 1, j - 1, 2 * D / dx2dy2);

      addTermBiharmonique(i + 1, j, -4 * D / dx2dy2);
      addTermBiharmonique(i - 1, j, -4 * D / dx2dy2);
      addTermBiharmonique(i, j + 1, -4 * D / dx2dy2);
      addTermBiharmonique(i, j - 1, -4 * D / dx2dy2);
      diag += 8 * D / dx2dy2;

      row.set(idx, (row.get(idx) || 0) + diag);
    }
  }

  // Résolution par Gauss-Seidel avec sur-relaxation (SOR)
  const w = new Array(nTotal).fill(0);
  const omega = 1.15; // facteur de sur-relaxation
  const maxIter = 500;
  const tol = 1e-6;
  let converged = false;

  for (let it = 0; it < maxIter; it++) {
    let maxDiff = 0;
    for (let idx = 0; idx < nTotal; idx++) {
      const row = A[idx];
      let sum = 0;
      let diagVal = 1;

      for (const [colIdx, val] of row.entries()) {
        if (colIdx === idx) {
          diagVal = val;
        } else {
          sum += val * w[colIdx];
        }
      }

      if (Math.abs(diagVal) > 1e-12) {
        const wOld = w[idx];
        const wNew = (B[idx] - sum) / diagVal;
        const wRelaxed = (1 - omega) * wOld + omega * wNew;
        w[idx] = wRelaxed;
        const diff = Math.abs(wRelaxed - wOld);
        if (diff > maxDiff) maxDiff = diff;
      }
    }

    if (maxDiff < tol) {
      converged = true;
      break;
    }
  }

  // Calcul des pressions au sol et des moments fléchissants Mxx, Myy
  const pressions_sol = new Array(nTotal).fill(0);
  const moments_Mxx = new Array(nTotal).fill(0);
  const moments_Myy = new Array(nTotal).fill(0);
  const moments_Mxy = new Array(nTotal).fill(0);

  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const idx = getIndex(i, j);
      pressions_sol[idx] = raideursSol_ks[idx] * Math.max(0, w[idx]);

      const wCenter = w[idx];
      const wRight = i < nx ? w[getIndex(i + 1, j)] : wCenter;
      const wLeft = i > 0 ? w[getIndex(i - 1, j)] : wCenter;
      const wUp = j < ny ? w[getIndex(i, j + 1)] : wCenter;
      const wDown = j > 0 ? w[getIndex(i, j - 1)] : wCenter;

      const d2w_dx2 = (wRight - 2 * wCenter + wLeft) / dx2;
      const d2w_dy2 = (wUp - 2 * wCenter + wDown) / dy2;

      // Moments de plaque : Mxx = -D (w_xx + ν w_yy), Myy = -D (w_yy + ν w_xx)
      moments_Mxx[idx] = -D * (d2w_dx2 + nu * d2w_dy2);
      moments_Myy[idx] = -D * (d2w_dy2 + nu * d2w_dx2);
      moments_Mxy[idx] = -D * (1 - nu) * 0; // torsion
    }
  }

  const wVals = w.map(Math.abs);
  const pVals = pressions_sol;
  const flecheMax = Math.max(...wVals);
  const flecheMin = Math.min(...wVals);
  const pMax = Math.max(...pVals);
  const pMin = Math.min(...pVals);
  const pMoy = pVals.reduce((a, b) => a + b, 0) / pVals.length;

  return {
    noeuds,
    deplacements_w: w,
    pressions_sol,
    moments_Mxx,
    moments_Myy,
    moments_Mxy,
    flecheMax,
    flecheMin,
    tassementDiffMax: flecheMax - flecheMin,
    pressionMax: pMax,
    pressionMin: pMin,
    pressionMoyenne: pMoy,
    convergé: converged,
  };
}
