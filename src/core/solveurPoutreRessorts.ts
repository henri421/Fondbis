import { CLAUSES_EC7 } from '../norme/metadataNorme';

/**
 * Solveur d'éléments finis 2D pour poutre sur appuis élastoplastiques
 * Modèle Euler-Bernoulli (axial, transversal, flexion)
 * Conforme EN 1997-1:2004 Section 9.3 et Annexe C
 */

export interface NoeudPoutre {
  x: number; // position horizontale [m]
  y: number; // position verticale / altimétrique [m]
}

export interface RessortNodal {
  noeudIndex: number;
  raideur: number; // kN/m ou kN.m/rad selon la direction
  direction: 'x' | 'y' | 'rotation';
  reactionMax?: number; // plafond positif [kN ou kN.m], absent = illimité
  reactionMin?: number; // plafond négatif [kN ou kN.m], absent = illimité
}

export interface ChargeNodale {
  noeudIndex: number;
  Fx?: number; // charge ponctuelle selon X global [kN]
  Fy?: number; // charge ponctuelle selon Y global [kN]
  Mz?: number; // moment ponctuel dans le plan [kN.m]
}

export interface AppuiBloque {
  noeudIndex: number;
  direction: 'x' | 'y' | 'rotation';
}

export interface EtatInitialSolveur {
  deplacements?: Array<{
    noeudIndex: number;
    ux: number;
    uy: number;
    rz: number;
  }>;
  etatRessorts?: Array<{
    noeudIndex: number;
    direction: string;
    plastifie: boolean;
    reaction: number;
  }>;
}

export interface ResultatSolveurPoutre {
  deplacements: Array<{
    noeudIndex: number;
    ux: number; // déplacement horizontal global [m]
    uy: number; // déplacement vertical global [m]
    rz: number; // rotation dans le plan [rad]
  }>;
  reactionsRessorts: Array<{
    noeudIndex: number;
    direction: 'x' | 'y' | 'rotation';
    reaction: number; // réaction exercée par le ressort [kN ou kN.m]
    plastifie: boolean;
    tauxMobilisation?: number;
  }>;
  reactionsAppuis: Array<{
    noeudIndex: number;
    direction: 'x' | 'y' | 'rotation';
    reaction: number; // réaction de blocage rigide [kN ou kN.m]
  }>;
  effortsInternes: Array<{
    noeudIndex: number;
    N: number; // effort normal [kN] (+ = traction, - = compression)
    V: number; // effort tranchant [kN]
    M: number; // moment fléchissant [kN.m]
  }>;
  convergence: {
    convergé: boolean;
    iterations: number;
    residuFinal: number;
    message?: string;
  };
  equilibreGlobal: {
    sommeChargesAppliqueesY: number;
    sommeReactionsY: number;
    residuVertical: number;
  };
  clauseReference: string;
  statutNormatif: string;
}

/**
 * Résout le système linéaire K * U = F par élimination de Gauss avec pivot partiel
 */
function resoudreSystemeLineaire(A: number[][], b: number[]): number[] {
  const n = b.length;
  // Copie de travail
  const M: number[][] = A.map((row) => [...row]);
  const x: number[] = [...b];

  for (let p = 0; p < n; p++) {
    // Recherche du pivot maximal
    let maxRow = p;
    let maxVal = Math.abs(M[p][p]);
    for (let r = p + 1; r < n; r++) {
      if (Math.abs(M[r][p]) > maxVal) {
        maxVal = Math.abs(M[r][p]);
        maxRow = r;
      }
    }

    if (maxVal < 1e-13) {
      // Système singulier ou quasi-singulier : régularisation légère
      M[p][p] = 1.0;
      x[p] = 0.0;
      continue;
    }

    // Échange de lignes
    if (maxRow !== p) {
      const tempRow = M[p];
      M[p] = M[maxRow];
      M[maxRow] = tempRow;
      const tempB = x[p];
      x[p] = x[maxRow];
      x[maxRow] = tempB;
    }

    // Élimination des lignes sous-jacentes
    for (let r = p + 1; r < n; r++) {
      const factor = M[r][p] / M[p][p];
      x[r] -= factor * x[p];
      for (let c = p; c < n; c++) {
        M[r][c] -= factor * M[p][c];
      }
    }
  }

  // Remontée
  const sol = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = x[i];
    for (let j = i + 1; j < n; j++) {
      sum -= M[i][j] * sol[j];
    }
    sol[i] = Math.abs(M[i][i]) > 1e-14 ? sum / M[i][i] : 0.0;
  }

  return sol;
}

/**
 * Construction de la matrice de rigidité élémentaire d'une poutre plane 2D (Euler-Bernoulli)
 */
function matriceElementairePoutre(
  E: number,
  I: number,
  A: number,
  dx: number,
  dy: number
): { kGlobal: number[][]; L: number; c: number; s: number } {
  const L = Math.hypot(dx, dy);
  if (L < 1e-6) {
    throw new Error(`Longueur d'élément nulle entre nœuds distants de dx=${dx}, dy=${dy}`);
  }

  const c = dx / L; // cos(alpha)
  const s = dy / L; // sin(alpha)

  const L2 = L * L;
  const L3 = L2 * L;

  const k11 = (E * A) / L;
  const k22 = (12 * E * I) / L3;
  const k23 = (6 * E * I) / L2;
  const k33 = (4 * E * I) / L;
  const k36 = (2 * E * I) / L;

  // Matrice locale 6x6
  const kLoc: number[][] = [
    [k11, 0, 0, -k11, 0, 0],
    [0, k22, k23, 0, -k22, k23],
    [0, k23, k33, 0, -k23, k36],
    [-k11, 0, 0, k11, 0, 0],
    [0, -k22, -k23, 0, k22, -k23],
    [0, k23, k36, 0, -k23, k33],
  ];

  // Matrice de transformation T (6x6)
  const T: number[][] = [
    [c, s, 0, 0, 0, 0],
    [-s, c, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0],
    [0, 0, 0, c, s, 0],
    [0, 0, 0, -s, c, 0],
    [0, 0, 0, 0, 0, 1],
  ];

  // K_global_elem = T^T * kLoc * T
  const kGlobal: number[][] = Array.from({ length: 6 }, () => new Array(6).fill(0));

  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      let val = 0;
      for (let m = 0; m < 6; m++) {
        for (let p = 0; p < 6; p++) {
          val += T[m][i] * kLoc[m][p] * T[p][j];
        }
      }
      kGlobal[i][j] = val;
    }
  }

  return { kGlobal, L, c, s };
}

/**
 * Fonction principale : Résout une poutre plane sur appuis élastoplastiques
 *
 * @param noeuds Liste ordonnée des nœuds le long de la poutre
 * @param E Module de Young du matériau [kPa]
 * @param I Moment d'inertie de flexion [m⁴]
 * @param A Section transversale [m²]
 * @param ressorts Appuis élastoplastiques ponctuels
 * @param chargesAppliquees Charges et moments nodaux appliqués
 * @param appuisBloques Conditions aux limites rigides (encastrements, appuis simples)
 * @param etatInitial État préalable pour calculs phasés (optionnel)
 */
export function resoudrePoutreSurRessorts(
  noeuds: NoeudPoutre[],
  E: number,
  I: number,
  A: number,
  ressorts: RessortNodal[],
  chargesAppliquees: ChargeNodale[],
  appuisBloques: AppuiBloque[],
  etatInitial?: EtatInitialSolveur
): ResultatSolveurPoutre {
  const nbNoeuds = noeuds.length;
  if (nbNoeuds < 2) {
    throw new Error('Une poutre doit comporter au moins 2 nœuds.');
  }

  const nbDDL = nbNoeuds * 3;

  // Calcul et mise en cache des matrices élémentaires
  interface ElementPoutre {
    n1: number;
    n2: number;
    kGlobal: number[][];
    L: number;
    c: number;
    s: number;
  }

  const elements: ElementPoutre[] = [];
  for (let i = 0; i < nbNoeuds - 1; i++) {
    const dx = noeuds[i + 1].x - noeuds[i].x;
    const dy = noeuds[i + 1].y - noeuds[i].y;
    const { kGlobal, L, c, s } = matriceElementairePoutre(E, I, A, dx, dy);
    elements.push({ n1: i, n2: i + 1, kGlobal, L, c, s });
  }

  // Assemblage de la matrice de rigidité de la poutre K_poutre
  const K_poutre: number[][] = Array.from({ length: nbDDL }, () => new Array(nbDDL).fill(0));

  for (const elem of elements) {
    const ddlMap = [
      elem.n1 * 3,
      elem.n1 * 3 + 1,
      elem.n1 * 3 + 2,
      elem.n2 * 3,
      elem.n2 * 3 + 1,
      elem.n2 * 3 + 2,
    ];

    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        K_poutre[ddlMap[r]][ddlMap[c]] += elem.kGlobal[r][c];
      }
    }
  }

  // Vecteur des charges appliquées F_ext
  const F_ext = new Array<number>(nbDDL).fill(0);
  for (const ch of chargesAppliquees) {
    const base = ch.noeudIndex * 3;
    if (ch.Fx !== undefined) F_ext[base] += ch.Fx;
    if (ch.Fy !== undefined) F_ext[base + 1] += ch.Fy;
    if (ch.Mz !== undefined) F_ext[base + 2] += ch.Mz;
  }

  // Indexation des DDL bloqués
  const ddlBloquesSet = new Set<number>();
  for (const app of appuisBloques) {
    const dOffset = app.direction === 'x' ? 0 : app.direction === 'y' ? 1 : 2;
    ddlBloquesSet.add(app.noeudIndex * 3 + dOffset);
  }

  // État initial de déplacement
  let U_courant = new Array<number>(nbDDL).fill(0);
  if (etatInitial?.deplacements) {
    for (const dep of etatInitial.deplacements) {
      if (dep.noeudIndex < nbNoeuds) {
        U_courant[dep.noeudIndex * 3] = dep.ux;
        U_courant[dep.noeudIndex * 3 + 1] = dep.uy;
        U_courant[dep.noeudIndex * 3 + 2] = dep.rz;
      }
    }
  }

  // Boucle de résolution non linéaire (Newton / raideur sécante élastoplastique)
  const MAX_ITER = 100;
  const TOL_CONV = 1e-4;

  let converge = false;
  let iter = 0;
  let residuFinal = 1.0;

  // Statut de plastification pour chaque ressort
  interface StatutRessort {
    plastifie: boolean;
    reaction: number;
    ddlIndex: number;
  }

  let statutsRessorts: StatutRessort[] = ressorts.map((res) => {
    const dOffset = res.direction === 'x' ? 0 : res.direction === 'y' ? 1 : 2;
    return {
      plastifie: false,
      reaction: 0,
      ddlIndex: res.noeudIndex * 3 + dOffset,
    };
  });

  while (iter < MAX_ITER && !converge) {
    iter++;

    // Construction de la matrice K et du vecteur second membre F pour l'itération courante
    const K_iter: number[][] = K_poutre.map((row) => [...row]);
    const F_iter: number[] = [...F_ext];

    // Prise en compte des ressorts
    for (let rIdx = 0; rIdx < ressorts.length; rIdx++) {
      const res = ressorts[rIdx];
      const ddl = statutsRessorts[rIdx].ddlIndex;
      const u_val = U_courant[ddl];

      const F_lineaire = res.raideur * u_val;
      let F_cap = F_lineaire;
      let estPlastifie = false;

      if (res.reactionMax !== undefined && F_lineaire > res.reactionMax) {
        F_cap = res.reactionMax;
        estPlastifie = true;
      } else if (res.reactionMin !== undefined && F_lineaire < res.reactionMin) {
        F_cap = res.reactionMin;
        estPlastifie = true;
      }

      statutsRessorts[rIdx].plastifie = estPlastifie;
      statutsRessorts[rIdx].reaction = F_cap;

      if (!estPlastifie) {
        // Domaine élastique : contribution directe à la raideur
        K_iter[ddl][ddl] += res.raideur;
      } else {
        // Domaine plastifié : la raideur tangente est nulle (ou résiduelle eps),
        // et la force de réaction constante oppose le déplacement (donc F_ext - F_cap)
        const epsRaideur = 1e-9;
        K_iter[ddl][ddl] += epsRaideur;
        F_iter[ddl] -= F_cap;
      }
    }

    // Application des conditions aux limites rigides (élimination propre ligne/colonne)
    for (const ddl of ddlBloquesSet) {
      for (let j = 0; j < nbDDL; j++) {
        K_iter[ddl][j] = 0;
        K_iter[j][ddl] = 0;
      }
      K_iter[ddl][ddl] = 1.0;
      F_iter[ddl] = 0.0;
    }

    // Résolution
    const U_nouveau = resoudreSystemeLineaire(K_iter, F_iter);

    // Calcul de la norme du résidu de déplacement
    let maxDiff = 0;
    let maxNorme = 0;
    for (let i = 0; i < nbDDL; i++) {
      const diff = Math.abs(U_nouveau[i] - U_courant[i]);
      if (diff > maxDiff) maxDiff = diff;
      if (Math.abs(U_nouveau[i]) > maxNorme) maxNorme = Math.abs(U_nouveau[i]);
    }

    residuFinal = maxNorme > 1e-6 ? maxDiff / maxNorme : maxDiff;

    // Mise à jour des déplacements avec légère relaxation si nécessaire
    const omega = 1.0;
    for (let i = 0; i < nbDDL; i++) {
      U_courant[i] = U_courant[i] + omega * (U_nouveau[i] - U_courant[i]);
    }

    // Évaluation de la stabilité des ressorts et de la convergence
    let tousRessortsStables = true;
    for (let rIdx = 0; rIdx < ressorts.length; rIdx++) {
      const res = ressorts[rIdx];
      const ddl = statutsRessorts[rIdx].ddlIndex;
      const u_val = U_courant[ddl];
      const F_test = res.raideur * u_val;

      let plas = false;
      if (res.reactionMax !== undefined && F_test > res.reactionMax) plas = true;
      if (res.reactionMin !== undefined && F_test < res.reactionMin) plas = true;

      if (plas !== statutsRessorts[rIdx].plastifie) {
        tousRessortsStables = false;
      }
    }

    if (residuFinal < TOL_CONV && tousRessortsStables) {
      converge = true;
    }

    // Si pas de ressort non linéaire (purement élastique), 1 seule itération suffit
    if (ressorts.every((r) => r.reactionMax === undefined && r.reactionMin === undefined)) {
      converge = true;
      residuFinal = 0;
      break;
    }
  }

  // Recalcul exact des réactions des ressorts avec le champ U final
  const reactionsRessorts = ressorts.map((res, idx) => {
    const ddl = statutsRessorts[idx].ddlIndex;
    const u_val = U_courant[ddl];
    let F_calc = res.raideur * u_val;
    let plastifie = false;

    if (res.reactionMax !== undefined && F_calc > res.reactionMax) {
      F_calc = res.reactionMax;
      plastifie = true;
    } else if (res.reactionMin !== undefined && F_calc < res.reactionMin) {
      F_calc = res.reactionMin;
      plastifie = true;
    }

    const plafond = F_calc >= 0 ? res.reactionMax : res.reactionMin;
    const tauxMobilisation = plafond ? Math.min(1.0, Math.abs(F_calc / plafond)) : undefined;

    return {
      noeudIndex: res.noeudIndex,
      direction: res.direction,
      reaction: F_calc,
      plastifie,
      tauxMobilisation,
    };
  });

  // Calcul des réactions aux appuis rigides bloqués
  // R_appuis = K_poutre * U + R_ressorts - F_ext aux DDL bloqués
  const KU = new Array<number>(nbDDL).fill(0);
  for (let i = 0; i < nbDDL; i++) {
    for (let j = 0; j < nbDDL; j++) {
      KU[i] += K_poutre[i][j] * U_courant[j];
    }
  }

  const reactionsAppuis: ResultatSolveurPoutre['reactionsAppuis'] = [];
  for (const app of appuisBloques) {
    const dOffset = app.direction === 'x' ? 0 : app.direction === 'y' ? 1 : 2;
    const ddl = app.noeudIndex * 3 + dOffset;

    // Réaction du ressort éventuel sur ce même DDL
    const rRessort = reactionsRessorts
      .filter((r) => r.noeudIndex === app.noeudIndex && r.direction === app.direction)
      .reduce((sum, r) => sum + r.reaction, 0);

    // Réaction d'appui équilibrante :
    // Somme(F_ext) = Somme(R_appuis + R_ressorts)
    // R_appui = F_ext - (KU + rRessort) = -(KU + rRessort - F_ext)
    const R_appui = -(KU[ddl] + rRessort - F_ext[ddl]);
    reactionsAppuis.push({
      noeudIndex: app.noeudIndex,
      direction: app.direction,
      reaction: R_appui,
    });
  }

  // Bilan d'équilibre vertical global (pour vérification de conservation)
  let sumChargesY = 0;
  for (let i = 0; i < nbNoeuds; i++) {
    sumChargesY += F_ext[i * 3 + 1];
  }

  let sumReactionsY = 0;
  for (const r of reactionsRessorts) {
    if (r.direction === 'y') sumReactionsY += r.reaction;
  }
  for (const a of reactionsAppuis) {
    if (a.direction === 'y') sumReactionsY += a.reaction;
  }
  const residuVertical = Math.abs(sumChargesY - sumReactionsY);

  // Déplacements structurés
  const deplacements = noeuds.map((_, idx) => ({
    noeudIndex: idx,
    ux: U_courant[idx * 3],
    uy: U_courant[idx * 3 + 1],
    rz: U_courant[idx * 3 + 2],
  }));

  // Efforts internes élément par élément
  // Stockage des efforts aux nœuds (N, V, M)
  const effortsInternes: ResultatSolveurPoutre['effortsInternes'] = Array.from(
    { length: nbNoeuds },
    (_, idx) => ({ noeudIndex: idx, N: 0, V: 0, M: 0 })
  );

  const compteursNoeuds = new Array<number>(nbNoeuds).fill(0);

  for (const elem of elements) {
    const uG = [
      U_courant[elem.n1 * 3],
      U_courant[elem.n1 * 3 + 1],
      U_courant[elem.n1 * 3 + 2],
      U_courant[elem.n2 * 3],
      U_courant[elem.n2 * 3 + 1],
      U_courant[elem.n2 * 3 + 2],
    ];

    // Transformation en repère local : uLoc = T * uG
    const c = elem.c;
    const s = elem.s;
    const uLoc = [
      c * uG[0] + s * uG[1],
      -s * uG[0] + c * uG[1],
      uG[2],
      c * uG[3] + s * uG[4],
      -s * uG[3] + c * uG[4],
      uG[5],
    ];

    const L = elem.L;
    const L2 = L * L;
    const L3 = L2 * L;

    // Forces nodales locales d'élément f = kLoc * uLoc
    const N1 = (E * A / L) * (uLoc[0] - uLoc[3]);
    const V1 = (12 * E * I / L3) * (uLoc[1] - uLoc[4]) + (6 * E * I / L2) * (uLoc[2] + uLoc[5]);
    const M1 = (6 * E * I / L2) * (uLoc[1] - uLoc[4]) + (4 * E * I / L) * uLoc[2] + (2 * E * I / L) * uLoc[5];

    const N2 = -N1;
    const V2 = -V1;
    const M2 = (6 * E * I / L2) * (uLoc[1] - uLoc[4]) + (2 * E * I / L) * uLoc[2] + (4 * E * I / L) * uLoc[5];

    // Convention RdM standard (fibres inférieures) :
    // Effort normal N (+ en traction) = N2
    // Moment fléchissant M : M1 = -P*L à l'encastrement
    // Effort tranchant V : constant = P
    effortsInternes[elem.n1].N += -N1;
    effortsInternes[elem.n1].V += -V1;
    effortsInternes[elem.n1].M += M1;
    compteursNoeuds[elem.n1]++;

    effortsInternes[elem.n2].N += N2;
    effortsInternes[elem.n2].V += -V1; // tranchant constant sur l'élément non chargé réparti
    effortsInternes[elem.n2].M += M2;
    compteursNoeuds[elem.n2]++;
  }

  // Moyennage aux nœuds intérieurs partagés
  for (let i = 0; i < nbNoeuds; i++) {
    if (compteursNoeuds[i] > 1) {
      effortsInternes[i].N /= compteursNoeuds[i];
      effortsInternes[i].V /= compteursNoeuds[i];
      effortsInternes[i].M /= compteursNoeuds[i];
    }
  }

  return {
    deplacements,
    reactionsRessorts,
    reactionsAppuis,
    effortsInternes,
    convergence: {
      convergé: converge,
      iterations: iter,
      residuFinal,
      message: converge
        ? `Convergence atteinte en ${iter} itération(s) (résidu = ${residuFinal.toExponential(2)})`
        : `Non-convergence après ${iter} itérations (résidu = ${residuFinal.toExponential(2)})`,
    },
    equilibreGlobal: {
      sommeChargesAppliqueesY: sumChargesY,
      sommeReactionsY: sumReactionsY,
      residuVertical,
    },
    clauseReference: CLAUSES_EC7.interaction_sol_structure.clause,
    statutNormatif: CLAUSES_EC7.interaction_sol_structure.statut,
  };
}
