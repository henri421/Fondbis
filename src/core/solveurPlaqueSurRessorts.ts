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
  avertissements?: string[];
}

/**
 * Résolution directe d'un système linéaire K · w = F par élimination de Gauss
 * avec pivot partiel et détection de degrés de liberté singuliers / mécanismes.
 */
function resoudreSystemeLineaireDirect(
  K: number[][],
  F: number[]
): { solution: number[]; ddlSinguliers: number[]; success: boolean } {
  const n = F.length;
  // Matrice augmentée [K | F]
  const M: number[][] = Array.from({ length: n }, (_, i) => {
    const row = new Array(n + 1);
    for (let j = 0; j < n; j++) row[j] = K[i][j];
    row[n] = F[i];
    return row;
  });

  const ddlSinguliers: number[] = [];

  for (let p = 0; p < n; p++) {
    let maxRow = p;
    let maxVal = Math.abs(M[p][p]);
    for (let r = p + 1; r < n; r++) {
      const val = Math.abs(M[r][p]);
      if (val > maxVal) {
        maxVal = val;
        maxRow = r;
      }
    }

    if (maxVal < 1e-13) {
      ddlSinguliers.push(p);
      continue;
    }

    if (maxRow !== p) {
      const temp = M[p];
      M[p] = M[maxRow];
      M[maxRow] = temp;
    }

    const pivot = M[p][p];
    for (let r = p + 1; r < n; r++) {
      const factor = M[r][p] / pivot;
      if (Math.abs(factor) > 1e-15) {
        M[r][p] = 0;
        for (let c = p + 1; c <= n; c++) {
          M[r][c] -= factor * M[p][c];
        }
      }
    }
  }

  // Remontée triangulaire
  const sol = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let sum = M[r][n];
    for (let c = r + 1; c < n; c++) {
      sum -= M[r][c] * sol[c];
    }
    const diag = M[r][r];
    if (Math.abs(diag) > 1e-13) {
      sol[r] = sum / diag;
    } else {
      sol[r] = 0;
    }
  }

  return {
    solution: sol,
    ddlSinguliers,
    success: ddlSinguliers.length === 0,
  };
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
 * Résout la plaque 2D sur ressorts de Winkler avec discrétisation variationnelle directe
 * Système D ∇⁴w + ks w = q
 * 
 * Avantages de la formulation variationnelle directe :
 * 1. Matrice de raideur symétrique et définie positive sous ressorts de sol ks > 0.
 * 2. Conditions aux limites de bords libres et coins libres naturellement vérifiées (sans nœuds fantômes instables).
 * 3. Résolution directe par pivot partiel de Gauss, garantissant l'invariance et la convergence stable
 *    quel que soit le raffinement du maillage (nx, ny = 4, 6, 8, 12, 16...).
 */
export function resoudrePlaque2DSurRessorts(
  options: OptionsPlaque,
  chargesNodales_q: number[], // charge descendante en kPa sur chaque nœud (taille = (nx+1)*(ny+1))
  raideursSol_ks: number[]    // raideur de réaction de sol en kN/m³ sur chaque nœud (taille = (nx+1)*(ny+1))
): ResultatPlaqueSurRessorts {
  const { longueurX, largeurY, epaisseur, E, nu, nx, ny, conditionsBords = 'libre' } = options;

  const dx = longueurX / nx;
  const dy = largeurY / ny;
  const D = (E * Math.pow(epaisseur, 3)) / (12 * (1 - nu * nu));

  const nTotal = (nx + 1) * (ny + 1);
  const getIndex = (i: number, j: number) => j * (nx + 1) + i;

  // Création du maillage nodal et surfaces d'influence
  const noeuds: NoeudPlaque[] = [];
  const surfacesNodales = new Array<number>(nTotal).fill(0);
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const idx = getIndex(i, j);
      const coeffX = (i === 0 || i === nx) ? 0.5 : 1.0;
      const coeffY = (j === 0 || j === ny) ? 0.5 : 1.0;
      const surface = coeffX * dx * coeffY * dy;
      surfacesNodales[idx] = surface;

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

  // Assemblage global de la matrice de raideur K et du vecteur force F
  const K: number[][] = Array.from({ length: nTotal }, () => new Array<number>(nTotal).fill(0));
  const F: number[] = new Array<number>(nTotal).fill(0);

  // 1. Vecteur charges nodales et raideurs de sol élastique
  for (let idx = 0; idx < nTotal; idx++) {
    const A_node = surfacesNodales[idx];
    F[idx] = (chargesNodales_q[idx] || 0) * A_node;
    const ks = raideursSol_ks[idx] || 0;
    if (ks > 0) {
      K[idx][idx] += ks * A_node;
    }
  }

  // 2. Énergie de flexion de plaque : D · (κ_xx² + κ_yy² + 2ν · κ_xx · κ_yy)
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const idx = getIndex(i, j);
      const A_node = surfacesNodales[idx];

      const hasKxx = (i >= 1 && i <= nx - 1);
      const hasKyy = (j >= 1 && j <= ny - 1);

      if (hasKxx && hasKyy) {
        const cxx = [
          { idx: getIndex(i - 1, j), c: 1 / (dx * dx) },
          { idx: getIndex(i, j), c: -2 / (dx * dx) },
          { idx: getIndex(i + 1, j), c: 1 / (dx * dx) },
        ];
        const cyy = [
          { idx: getIndex(i, j - 1), c: 1 / (dy * dy) },
          { idx: getIndex(i, j), c: -2 / (dy * dy) },
          { idx: getIndex(i, j + 1), c: 1 / (dy * dy) },
        ];

        for (const t1 of cxx) {
          for (const t2 of cxx) K[t1.idx][t2.idx] += D * A_node * t1.c * t2.c;
        }
        for (const t1 of cyy) {
          for (const t2 of cyy) K[t1.idx][t2.idx] += D * A_node * t1.c * t2.c;
        }
        for (const t1 of cxx) {
          for (const t2 of cyy) {
            K[t1.idx][t2.idx] += D * A_node * nu * t1.c * t2.c;
            K[t2.idx][t1.idx] += D * A_node * nu * t1.c * t2.c;
          }
        }
      } else if (hasKxx) {
        const cxx = [
          { idx: getIndex(i - 1, j), c: 1 / (dx * dx) },
          { idx: getIndex(i, j), c: -2 / (dx * dx) },
          { idx: getIndex(i + 1, j), c: 1 / (dx * dx) },
        ];
        for (const t1 of cxx) {
          for (const t2 of cxx) K[t1.idx][t2.idx] += D * A_node * t1.c * t2.c;
        }
      } else if (hasKyy) {
        const cyy = [
          { idx: getIndex(i, j - 1), c: 1 / (dy * dy) },
          { idx: getIndex(i, j), c: -2 / (dy * dy) },
          { idx: getIndex(i, j + 1), c: 1 / (dy * dy) },
        ];
        for (const t1 of cyy) {
          for (const t2 of cyy) K[t1.idx][t2.idx] += D * A_node * t1.c * t2.c;
        }
      }
    }
  }

  // 3. Énergie de torsion de plaque : 2(1 - ν) · D · κ_xy² intégrée sur chaque cellule
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const A_cell = dx * dy;
      const coeff = 2 * (1 - nu) * D * A_cell;
      const terms = [
        { idx: getIndex(i, j), c: 1 / (dx * dy) },
        { idx: getIndex(i + 1, j), c: -1 / (dx * dy) },
        { idx: getIndex(i, j + 1), c: -1 / (dx * dy) },
        { idx: getIndex(i + 1, j + 1), c: 1 / (dx * dy) },
      ];
      for (const t1 of terms) {
        for (const t2 of terms) K[t1.idx][t2.idx] += coeff * t1.c * t2.c;
      }
    }
  }

  // 4. Conditions aux limites cinématiques
  if (conditionsBords === 'appuye' || conditionsBords === 'encastre') {
    for (let j = 0; j <= ny; j++) {
      for (let i = 0; i <= nx; i++) {
        if (i === 0 || i === nx || j === 0 || j === ny) {
          const idx = getIndex(i, j);
          for (let c = 0; c < nTotal; c++) {
            K[idx][c] = 0;
            K[c][idx] = 0;
          }
          K[idx][idx] = 1.0;
          F[idx] = 0.0;
        }
      }
    }
  }
  // Remarque : pour 'libre', les conditions de bords libres (M_n = 0, V_n = 0)
  // sont les conditions aux limites naturelles résultant de la minimisation de l'énergie.

  // 5. Résolution directe par pivot de Gauss
  const { solution: w, ddlSinguliers, success } = resoudreSystemeLineaireDirect(K, F);

  // 6. Post-traitement : pressions de sol et moments fléchissants Mxx, Myy, Mxy
  const pressions_sol = new Array<number>(nTotal).fill(0);
  const moments_Mxx = new Array<number>(nTotal).fill(0);
  const moments_Myy = new Array<number>(nTotal).fill(0);
  const moments_Mxy = new Array<number>(nTotal).fill(0);

  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const idx = getIndex(i, j);
      pressions_sol[idx] = (raideursSol_ks[idx] || 0) * Math.max(0, w[idx]);

      const wCenter = w[idx];
      const hasKxx = (i >= 1 && i <= nx - 1);
      const hasKyy = (j >= 1 && j <= ny - 1);

      const d2w_dx2 = hasKxx
        ? (w[getIndex(i + 1, j)] - 2 * wCenter + w[getIndex(i - 1, j)]) / (dx * dx)
        : 0;
      const d2w_dy2 = hasKyy
        ? (w[getIndex(i, j + 1)] - 2 * wCenter + w[getIndex(i, j - 1)]) / (dy * dy)
        : 0;

      moments_Mxx[idx] = -D * (d2w_dx2 + nu * d2w_dy2);
      moments_Myy[idx] = -D * (d2w_dy2 + nu * d2w_dx2);

      if (i < nx && j < ny) {
        const d2w_dxdy = (w[getIndex(i + 1, j + 1)] - w[getIndex(i, j + 1)] - w[getIndex(i + 1, j)] + wCenter) / (dx * dy);
        moments_Mxy[idx] = -D * (1 - nu) * d2w_dxdy;
      }
    }
  }

  const wVals = w.map(Math.abs);
  const pVals = pressions_sol;
  const flecheMax = Math.max(...wVals);
  const flecheMin = Math.min(...wVals);
  const pMax = Math.max(...pVals);
  const pMin = Math.min(...pVals);
  const pMoy = pVals.reduce((a, b) => a + b, 0) / pVals.length;

  const avertissements: string[] = [];
  if (!success) {
    avertissements.push(`Le solveur de plaque présente des singularités sur ${ddlSinguliers.length} degrés de liberté (mécanisme ou sol non portant).`);
  }

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
    convergé: success,
    avertissements,
  };
}
