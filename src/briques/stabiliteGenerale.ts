import { ConfigurationNormative, CoucheGeotechnique, Hydrogeologie, SurchargeTalus } from '../types/geotech';
import { trouverCoucheACote } from '../core/profilContraintes';
import { CLAUSES_EC7 } from '../norme/metadataNorme';

/**
 * Stabilité générale — méthode des tranches de Bishop simplifiée (EN 1997-1:2004 section 11).
 *
 * Repère : x horizontal, y altitude (m). Cercle de centre (xc, yc) et de rayon R ; la surface
 * de rupture est l'arc inférieur y = yc − √(R² − (x − xc)²).
 *
 * Formulation en moments autour du centre :
 *   F = Σ (c'_d·b + (W − u·b)·tan φ'_d) / m_α(F) · R  /  ( M_moteur,d − Σ T_i·(yc − y_i) )
 *   m_α = cos α · (1 + tan α · tan φ'_d / F)
 * F porte sur la seule résistance du sol. Les renforcements horizontaux (sol renforcé),
 * pris à leur résistance de calcul, réduisent le moment moteur : ils ne sont pas divisés
 * une seconde fois par F ni par γR;e.
 */

const DEG = Math.PI / 180;

export interface CercleRupture {
  centreX: number; // m
  centreY: number; // m
  rayon: number; // m
}

/** Zone de matériau rectangulaire, prioritaire sur les couches (massif renforcé, remblai). */
export interface ZoneMateriau {
  nom: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  gammaHumide: number; // kN/m³
  gammaSature: number; // kN/m³
  phiPrime: number; // deg (caractéristique)
  cPrime: number; // kPa (caractéristique)
}

/**
 * Renforcement horizontal (lit d'armatures) à la cote y, de xDebut à xFin.
 * Les résistances sont des valeurs de calcul, par mètre de profil.
 * La partie mobilisée est celle située hors du cercle, en amont du déplacement de la masse.
 */
export interface RenforcementHorizontal {
  y: number;
  xDebut: number;
  xFin: number;
  resistanceRupture_d: number; // kN/m
  arrachementLineique_d: number; // kN/m par m de longueur ancrée
}

/** Jeu de facteurs d'une combinaison de vérification. */
export interface CombinaisonStabilite {
  id: 'caracteristique' | 'DA1-C1' | 'DA1-C2' | 'DA2' | 'DA3';
  libelle: string;
  /**
   * 'effets' (A1 : DA1-C1, DA2) : facteurs appliqués au moment moteur, poids caractéristiques
   * dans la résistance. 'actions' (A2 : DA1-C2, DA3) : facteurs appliqués aux charges.
   */
  mode: 'effets' | 'actions';
  gamma_G: number; // poids du sol et surcharges permanentes (source unique)
  gamma_Q: number; // surcharges variables défavorables (favorables : 0)
  gamma_phi: number; // sur tan φ'
  gamma_c: number;
  gamma_Re: number; // facteur de résistance (ou F cible en calcul caractéristique)
  etatNappe: 'caracteristique' | 'ELU';
}

export interface EntreeBishop {
  cercle: CercleRupture;
  profilTN: Array<{ x: number; y: number }>;
  couches: CoucheGeotechnique[];
  hydrogeologie: Hydrogeologie;
  combinaison: CombinaisonStabilite;
  surcharges?: SurchargeTalus[];
  zones?: ZoneMateriau[];
  renforcements?: RenforcementHorizontal[];
  nbTranches?: number;
}

export interface TrancheBishop {
  index: number;
  x: number; // m, milieu
  largeur: number; // m
  ySol: number;
  yBase: number;
  poidsSol: number; // kN/m, caractéristique
  surchargeG: number; // kN/m, caractéristique
  surchargeQ: number; // kN/m, caractéristique
  qRetenue: boolean; // surcharge variable comptée (défavorable sur cette tranche)
  pression_u: number; // kPa à la base
  alphaDeg: number; // angle de la base, positif dans le sens du glissement
  cPrime_d: number;
  phiPrime_d: number; // deg
  mAlpha: number;
  forceResistante: number; // kN/m, numérateur / m_α
  materiau: string;
}

export interface RenforcementMobilise {
  y: number;
  longueurAncree: number; // m
  T_d: number; // kN/m
  brasDeLevier: number; // m
}

export type ResultatCercleBishop =
  | {
      valide: true;
      F: number;
      taux: number; // gamma_Re / F
      conforme: boolean;
      momentMoteur_d: number; // kNm/m
      momentResistant_d: number; // kNm/m, résistance du sol mobilisée (= F · (M_moteur − M_renf))
      momentRenforcements_d: number; // kNm/m
      iterations: number;
      // +1 : moment moteur porté par les tranches à x > xc ; la masse tourne en sens horaire
      // et se déplace vers les x décroissants. −1 : l'inverse.
      sens: 1 | -1;
      tranches: TrancheBishop[];
      renforcements: RenforcementMobilise[];
      avertissements: string[];
    }
  | { valide: false; motif: string };

export const interpolerProfil = (profil: Array<{ x: number; y: number }>, x: number): number => {
  if (x <= profil[0].x) return profil[0].y;
  const n = profil.length;
  if (x >= profil[n - 1].x) return profil[n - 1].y;
  for (let p = 0; p < n - 1; p++) {
    const a = profil[p];
    const b = profil[p + 1];
    if (x >= a.x && x <= b.x) {
      const dx = b.x - a.x;
      if (Math.abs(dx) < 1e-9) return Math.max(a.y, b.y);
      return a.y + ((x - a.x) / dx) * (b.y - a.y);
    }
  }
  return profil[n - 1].y;
};

interface Materiau {
  nom: string;
  gammaHumide: number;
  gammaSature: number;
  phiPrime: number;
  cPrime: number;
}

const materiauEn = (
  x: number,
  y: number,
  couches: CoucheGeotechnique[],
  zones: ZoneMateriau[]
): Materiau => {
  for (const z of zones) {
    if (x >= z.xMin && x <= z.xMax && y >= z.yMin && y <= z.yMax) return z;
  }
  const c = trouverCoucheACote(couches, y) ?? couches[0];
  return {
    nom: c.nom,
    gammaHumide: c.poidsVolumiques.gammaHumide.v,
    gammaSature: c.poidsVolumiques.gammaSature.v,
    phiPrime: c.resistanceDrainee.phiPrime.v,
    cPrime: c.resistanceDrainee.cPrime.v,
  };
};

/** Poids d'une colonne de sol de largeur unité entre yBas et yHaut (γ saturé sous la nappe). */
const poidsColonne = (
  x: number,
  yBas: number,
  yHaut: number,
  coteNappe: number,
  couches: CoucheGeotechnique[],
  zones: ZoneMateriau[]
): number => {
  const coupures = new Set<number>([yBas, yHaut]);
  const ajouter = (y: number) => {
    if (y > yBas && y < yHaut) coupures.add(y);
  };
  ajouter(coteNappe);
  for (const c of couches) {
    ajouter(c.coteToit);
    ajouter(c.coteToit - c.epaisseur);
  }
  for (const z of zones) {
    if (x >= z.xMin && x <= z.xMax) {
      ajouter(z.yMin);
      ajouter(z.yMax);
    }
  }
  const ys = [...coupures].sort((a, b) => a - b);
  let poids = 0;
  for (let k = 0; k < ys.length - 1; k++) {
    const yMil = (ys[k] + ys[k + 1]) / 2;
    const m = materiauEn(x, yMil, couches, zones);
    poids += (yMil < coteNappe ? m.gammaSature : m.gammaHumide) * (ys[k + 1] - ys[k]);
  }
  return poids;
};

const recouvrement = (a0: number, a1: number, b0: number, b1: number): number =>
  Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/**
 * Analyse d'un cercle par la méthode de Bishop simplifiée. Ne renvoie jamais de valeur
 * par défaut : un cercle qui ne coupe pas le terrain, qui sort du profil défini ou qui ne
 * converge pas est déclaré invalide avec son motif.
 */
export function analyserCercleBishop(entree: EntreeBishop): ResultatCercleBishop {
  const { cercle, profilTN, couches, hydrogeologie, combinaison } = entree;
  const surcharges = entree.surcharges ?? [];
  const zones = entree.zones ?? [];
  const renforcements = entree.renforcements ?? [];
  const nbTranches = Math.max(5, Math.round(entree.nbTranches ?? 40));
  const { centreX: xc, centreY: yc, rayon: R } = cercle;

  if (profilTN.length < 2) return { valide: false, motif: 'Profil du terrain incomplet (2 points minimum)' };
  if (couches.length === 0) return { valide: false, motif: 'Aucune couche de sol' };
  if (!(R > 0)) return { valide: false, motif: 'Rayon nul' };

  const coteNappe =
    combinaison.etatNappe === 'ELU'
      ? hydrogeologie.nappePrincipale.coteDefavorableELU
      : hydrogeologie.nappePrincipale.coteCaracteristique;
  const gw = hydrogeologie.poidsVolumiqueEau;

  // Emprise de la masse en mouvement : points de l'arc sous le terrain
  const xProfilMin = profilTN[0].x;
  const xProfilMax = profilTN[profilTN.length - 1].x;
  const yArc = (x: number) => yc - Math.sqrt(Math.max(0, R * R - (x - xc) * (x - xc)));
  const xA = Math.max(xProfilMin, xc - R);
  const xB = Math.min(xProfilMax, xc + R);
  if (xB <= xA) return { valide: false, motif: 'Le cercle ne coupe pas le profil' };

  const nScan = 400;
  let xDebut: number | null = null;
  let xFin: number | null = null;
  for (let s = 0; s <= nScan; s++) {
    const x = xA + ((xB - xA) * s) / nScan;
    if (interpolerProfil(profilTN, x) > yArc(x) + 1e-9) {
      if (xDebut === null) xDebut = x;
      xFin = x;
    }
  }
  if (xDebut === null || xFin === null || xFin - xDebut < 1e-3 * R) {
    return { valide: false, motif: 'Le cercle ne coupe pas le terrain' };
  }
  // La masse ne doit pas être tronquée par les extrémités du profil saisi
  if (
    (xc - R < xProfilMin && interpolerProfil(profilTN, xProfilMin) > yArc(xProfilMin) + 1e-3) ||
    (xc + R > xProfilMax && interpolerProfil(profilTN, xProfilMax) > yArc(xProfilMax) + 1e-3)
  ) {
    return { valide: false, motif: 'Le cercle sort du profil défini (prolonger le profil)' };
  }
  // L'arc doit ressortir au terrain des deux côtés : si le terrain passe au-dessus du centre
  // à l'aplomb d'une extrémité du cercle, la masse serait coupée par une verticale fictive.
  if (
    (xc - R >= xProfilMin && interpolerProfil(profilTN, xc - R) > yc + 1e-9) ||
    (xc + R <= xProfilMax && interpolerProfil(profilTN, xc + R) > yc + 1e-9)
  ) {
    return { valide: false, motif: "Le cercle ne ressort pas au terrain (centre sous le terrain à l'aplomb d'une extrémité)" };
  }
  // Affinage des points d'entrée et de sortie par dichotomie
  const affiner = (xDedans: number, xDehors: number) => {
    let a = xDedans;
    let b = xDehors;
    for (let k = 0; k < 50; k++) {
      const m = (a + b) / 2;
      if (interpolerProfil(profilTN, m) > yArc(m)) a = m;
      else b = m;
    }
    return (a + b) / 2;
  };
  const pas = (xB - xA) / nScan;
  xDebut = xDebut > xA + 1e-12 ? affiner(xDebut, xDebut - pas) : xDebut;
  xFin = xFin < xB - 1e-12 ? affiner(xFin, xFin + pas) : xFin;

  const dx = (xFin - xDebut) / nbTranches;
  const tanPhiD = (phi: number) => Math.tan(phi * DEG) / combinaison.gamma_phi;

  interface Brute {
    x: number;
    ySol: number;
    yBase: number;
    sinA: number;
    cosA: number;
    poidsSol: number;
    G: number;
    Q: number;
    u: number;
    mat: Materiau;
  }
  const brutes: Brute[] = [];
  let momentSolG = 0; // Σ (W + G)·sin α, sens géométrique
  const avertissements: string[] = [];
  let nappeAuDessus = false;

  for (let i = 0; i < nbTranches; i++) {
    const x = xDebut + (i + 0.5) * dx;
    const ySol = interpolerProfil(profilTN, x);
    const yBase = yArc(x);
    if (ySol <= yBase) continue;
    const x0 = x - dx / 2;
    const x1 = x + dx / 2;
    let G = 0;
    let Q = 0;
    for (const s of surcharges) {
      const l = recouvrement(x0, x1, Math.min(s.xDebut, s.xFin), Math.max(s.xDebut, s.xFin));
      if (s.nature === 'G') G += s.q * l;
      else Q += s.q * l;
    }
    if (coteNappe > ySol) nappeAuDessus = true;
    const sinA = (x - xc) / R;
    const tranche: Brute = {
      x,
      ySol,
      yBase,
      sinA,
      cosA: Math.sqrt(Math.max(0, 1 - sinA * sinA)),
      poidsSol: poidsColonne(x, yBase, ySol, coteNappe, couches, zones) * dx,
      G,
      Q,
      u: coteNappe > yBase ? gw * (Math.min(coteNappe, ySol) - yBase) : 0,
      mat: materiauEn(x, yBase + 1e-6, couches, zones),
    };
    momentSolG += (tranche.poidsSol + G) * sinA;
    brutes.push(tranche);
  }
  if (brutes.length === 0) return { valide: false, motif: 'Aucune tranche active' };
  if (nappeAuDessus) {
    avertissements.push(
      "Nappe au-dessus du terrain sur une partie du cercle : l'eau libre (poids et poussée sur le talus) n'est pas modélisée."
    );
  }

  // Sens du glissement : celui du moment des poids permanents
  const sens: 1 | -1 = momentSolG >= 0 ? 1 : -1;

  // Poids pris dans la résistance : caractéristiques en mode 'effets', de calcul en mode 'actions'
  const gG = combinaison.gamma_G;
  const gQ = combinaison.gamma_Q;
  const fG = combinaison.mode === 'actions' ? gG : 1;
  const fQ = combinaison.mode === 'actions' ? gQ : 1;

  // Moment moteur de calcul, divisé par R (homogène à une force)
  let moteur = 0;
  for (const t of brutes) {
    const sinPhys = sens * t.sinA;
    const qDefavorable = t.Q > 0 && sinPhys > 0;
    moteur += gG * (t.poidsSol + t.G) * sinPhys + (qDefavorable ? gQ * t.Q * sinPhys : 0);
  }
  if (!(moteur > 1e-6)) return { valide: false, motif: 'Moment moteur nul ou négatif' };

  // Renforcements : longueur ancrée hors du cercle, en amont du déplacement. Pour sens = +1
  // la masse part vers les x décroissants : le lit est tendu vers la gauche et s'ancre à
  // droite du cercle (au-delà de xd). Pour sens = −1, l'inverse.
  const mobilises: RenforcementMobilise[] = [];
  let momentRenf = 0;
  for (const r of renforcements) {
    const dy = r.y - yc;
    if (dy >= 0 || Math.abs(dy) >= R) continue; // le lit ne coupe pas l'arc inférieur
    const demi = Math.sqrt(R * R - dy * dy);
    const xg = xc - demi;
    const xd = xc + demi;
    const a = Math.min(r.xDebut, r.xFin);
    const b = Math.max(r.xDebut, r.xFin);
    // Point où le lit traverse la surface de rupture, côté amont du glissement
    const xCoupe = sens > 0 ? xd : xg;
    if (xCoupe <= a || xCoupe >= b) continue;
    if (r.y >= interpolerProfil(profilTN, xCoupe)) continue;
    const longueurAncree = sens > 0 ? b - xd : xg - a;
    const T = Math.min(r.resistanceRupture_d, r.arrachementLineique_d * longueurAncree);
    if (T <= 0) continue;
    const bras = yc - r.y;
    mobilises.push({ y: r.y, longueurAncree, T_d: T, brasDeLevier: bras });
    momentRenf += T * bras;
  }

  const termes = (Fc: number) =>
    brutes.map((t) => {
      const sinPhys = sens * t.sinA;
      const tanPhi = tanPhiD(t.mat.phiPrime);
      const qRetenue = t.Q > 0 && sinPhys > 0;
      const Wres = fG * (t.poidsSol + t.G) + (qRetenue ? fQ * t.Q : 0);
      const mBrut = t.cosA * (1 + (sinPhys / t.cosA) * (tanPhi / Fc));
      const mA = Math.max(0.2, mBrut);
      const num = (t.mat.cPrime / combinaison.gamma_c) * dx + Math.max(0, Wres - t.u * dx) * tanPhi;
      return { sinPhys, tanPhi, qRetenue, mA, borne: mBrut < 0.2, num };
    });

  // Moment moteur net des renforcements
  const moteurNet = moteur * R - momentRenf;
  if (moteurNet <= 1e-9 * moteur * R) {
    return { valide: false, motif: 'Les renforcements reprennent tout le moment moteur (F non défini, cercle sans risque)' };
  }

  // Itérations de Bishop
  let F = 1.5;
  let iterations = 0;
  let converge = false;
  for (; iterations < 200; iterations++) {
    const somme = termes(F).reduce((s, t) => s + t.num / t.mA, 0);
    const Fn = (somme * R) / moteurNet;
    if (Math.abs(Fn - F) < 1e-7) {
      F = Fn;
      converge = true;
      break;
    }
    F = Fn;
  }
  if (!converge || !(F > 0)) return { valide: false, motif: 'Itérations de Bishop non convergées' };

  const final = termes(F);
  if (final.some((t) => t.borne)) {
    avertissements.push('m_α < 0,2 sur au moins une tranche (sortie raide) : m_α borné à 0,2, résultat sécuritaire.');
  }
  const tranches: TrancheBishop[] = brutes.map((t, index) => ({
    index,
    x: t.x,
    largeur: dx,
    ySol: t.ySol,
    yBase: t.yBase,
    poidsSol: t.poidsSol,
    surchargeG: t.G,
    surchargeQ: t.Q,
    qRetenue: final[index].qRetenue,
    pression_u: t.u,
    alphaDeg: Math.asin(final[index].sinPhys) / DEG,
    cPrime_d: t.mat.cPrime / combinaison.gamma_c,
    phiPrime_d: Math.atan(final[index].tanPhi) / DEG,
    mAlpha: final[index].mA,
    forceResistante: final[index].num / final[index].mA,
    materiau: t.mat.nom,
  }));

  const taux = combinaison.gamma_Re / F;
  return {
    valide: true,
    F,
    taux,
    conforme: taux <= 1 + 1e-9,
    momentMoteur_d: moteur * R,
    momentResistant_d: F * moteurNet,
    momentRenforcements_d: momentRenf,
    iterations: iterations + 1,
    sens,
    tranches,
    renforcements: mobilises,
    avertissements,
  };
}

/**
 * Combinaisons de vérification de la stabilité générale selon l'approche de calcul de la
 * configuration (EN 1997-1 §11.5.1 et annexe A). Le calcul caractéristique (F classique,
 * comparé à une cible) est toujours fourni en tête, pour comparaison.
 */
export function combinaisonsStabilite(config: ConfigurationNormative, Fcible: number): CombinaisonStabilite[] {
  const { A1, A2 } = config.facteursActions;
  const { M1, M2 } = config.facteursSol;
  const R = config.facteursResistance;
  const gRe = (jeu: 'R1' | 'R2' | 'R3', defaut: number) => R[jeu].gamma_Re ?? defaut;

  const liste: CombinaisonStabilite[] = [
    {
      id: 'caracteristique',
      libelle: 'Calcul caractéristique (F classique)',
      mode: 'effets',
      gamma_G: 1,
      gamma_Q: 1,
      gamma_phi: 1,
      gamma_c: 1,
      gamma_Re: Fcible,
      etatNappe: 'caracteristique',
    },
  ];
  const effets = (id: 'DA1-C1' | 'DA2', libelle: string, gamma_Re: number): CombinaisonStabilite => ({
    id,
    libelle,
    mode: 'effets',
    gamma_G: A1.gamma_G_dst,
    gamma_Q: A1.gamma_Q_dst,
    gamma_phi: M1.gamma_phi,
    gamma_c: M1.gamma_c,
    gamma_Re,
    etatNappe: 'ELU',
  });
  const actions = (id: 'DA1-C2' | 'DA3', libelle: string, gamma_Re: number): CombinaisonStabilite => ({
    id,
    libelle,
    mode: 'actions',
    gamma_G: A2.gamma_G_dst,
    gamma_Q: A2.gamma_Q_dst,
    gamma_phi: M2.gamma_phi,
    gamma_c: M2.gamma_c,
    gamma_Re,
    etatNappe: 'ELU',
  });

  if (config.approcheCalcul === 'DA1') {
    liste.push(effets('DA1-C1', 'DA1 combinaison 1 (A1 + M1 + R1)', gRe('R1', 1.0)));
    liste.push(actions('DA1-C2', 'DA1 combinaison 2 (A2 + M2 + R1)', gRe('R1', 1.0)));
  } else if (config.approcheCalcul === 'DA2') {
    liste.push(effets('DA2', 'DA2 (A1 + M1 + R2), facteurs sur les effets', gRe('R2', 1.1)));
  } else {
    liste.push(actions('DA3', 'DA3 (A2 + M2 + R3)', gRe('R3', 1.0)));
  }
  return liste;
}

export interface ResultatRechercheCercle {
  cercle: CercleRupture;
  resultat: Extract<ResultatCercleBishop, { valide: true }>;
  nbCerclesAnalyses: number;
  clauseReference: string;
  statutNormatif: string;
}

export interface OptionsRecherche {
  /** Cote sous laquelle les cercles ne descendent pas (substratum). Défaut : base du modèle. */
  coteLimite?: number;
  nbTranches?: number;
  /** Filtre des cercles admissibles (ex. sortie devant le pied d'un parement). */
  accepter?: (resultat: Extract<ResultatCercleBishop, { valide: true }>, cercle: CercleRupture) => boolean;
}

/**
 * Recherche du cercle critique : grille de centres et de rayons déduite de l'emprise du
 * profil, puis raffinement local (recherche par motifs, pas divisé par 2 jusqu'à 5 cm)
 * à partir des trois meilleurs cercles de la grille. Renvoie null si aucun cercle valide.
 */
export function rechercherCercleCritique(
  base: Omit<EntreeBishop, 'cercle'>,
  options: OptionsRecherche = {}
): ResultatRechercheCercle | null {
  const profil = base.profilTN;
  if (profil.length < 2 || base.couches.length === 0) return null;
  const xMin = profil[0].x;
  const xMax = profil[profil.length - 1].x;
  const yHaut = Math.max(...profil.map((p) => p.y));
  const yBas = Math.min(...profil.map((p) => p.y));
  const H = Math.max(yHaut - yBas, (xMax - xMin) / 10, 1);
  const baseModele = Math.min(...base.couches.map((c) => c.coteToit - c.epaisseur));
  const coteLimite = options.coteLimite ?? Math.max(baseModele, yBas - 3 * H);
  const nbTranches = options.nbTranches ?? 30;

  let nb = 0;
  const evaluer = (c: CercleRupture) => {
    if (c.rayon <= 0.1 || c.centreY - c.rayon < coteLimite - 1e-9) return null;
    nb++;
    const r = analyserCercleBishop({ ...base, cercle: c, nbTranches });
    if (!r.valide) return null;
    const v = r as Extract<ResultatCercleBishop, { valide: true }>;
    return !options.accepter || options.accepter(v, c) ? v : null;
  };

  // 1. Grille
  type Candidat = { c: CercleRupture; F: number };
  const candidats: Candidat[] = [];
  const nx = 14;
  const ny = 8;
  const nr = 10;
  for (let i = 0; i <= nx; i++) {
    const cx = xMin + ((xMax - xMin) * i) / nx;
    for (let j = 0; j <= ny; j++) {
      const cy = yHaut + 0.2 * H + (2.8 * H * j) / ny;
      const rMin = cy - yHaut + 0.05 * H;
      const rMax = cy - coteLimite;
      if (rMax <= rMin) continue;
      for (let k = 0; k <= nr; k++) {
        const c = { centreX: cx, centreY: cy, rayon: rMin + ((rMax - rMin) * k) / nr };
        const r = evaluer(c);
        if (r) candidats.push({ c, F: r.F });
      }
    }
  }
  if (candidats.length === 0) return null;
  candidats.sort((a, b) => a.F - b.F);

  // 2. Raffinement par motifs à partir des 3 meilleurs
  const pasInitial = Math.max((xMax - xMin) / nx, H / 4);
  let meilleur: Candidat = candidats[0];
  const directions = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [0, 1, 1], [0, -1, -1],
  ];
  for (const depart of candidats.slice(0, 3)) {
    let courant = depart;
    let pas = pasInitial;
    while (pas > 0.05) {
      let ameliore = false;
      for (const [ddx, ddy, ddr] of directions) {
        const c = {
          centreX: courant.c.centreX + ddx * pas,
          centreY: courant.c.centreY + ddy * pas,
          rayon: courant.c.rayon + ddr * pas,
        };
        const r = evaluer(c);
        if (r && r.F < courant.F - 1e-6) {
          courant = { c, F: r.F };
          ameliore = true;
        }
      }
      if (!ameliore) pas /= 2;
    }
    if (courant.F < meilleur.F) meilleur = courant;
  }

  const final = analyserCercleBishop({ ...base, cercle: meilleur.c, nbTranches: base.nbTranches ?? 40 });
  if (!final.valide) return null;
  return {
    cercle: meilleur.c,
    resultat: final,
    nbCerclesAnalyses: nb,
    clauseReference: CLAUSES_EC7.stabilite_generale.clause,
    statutNormatif: CLAUSES_EC7.stabilite_generale.statut,
  };
}

export const COMBINAISON_CARACTERISTIQUE: CombinaisonStabilite = {
  id: 'caracteristique',
  libelle: 'Calcul caractéristique',
  mode: 'effets',
  gamma_G: 1,
  gamma_Q: 1,
  gamma_phi: 1,
  gamma_c: 1,
  gamma_Re: 1,
  etatNappe: 'caracteristique',
};

/**
 * Enveloppe historique (tests T_STAB.2, cas de référence) : F caractéristique d'un cercle.
 * Renvoie NaN si le cercle est invalide (plus de valeur par défaut).
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
  const r = analyserCercleBishop({
    cercle: { centreX, centreY, rayon: R },
    profilTN,
    couches,
    hydrogeologie,
    combinaison: COMBINAISON_CARACTERISTIQUE,
    nbTranches,
  });
  return r.valide ? r.F : NaN;
}
