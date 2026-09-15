import { CoucheGeotechnique, Hydrogeologie, OuvragePieu } from '../../types/geotech';
import { calculerProfilContraintes, trouverCoucheACote } from '../../core/profilContraintes';
import { surcontrainteCentre } from '../radier/tassementELS';

export interface ParametresGroupePieux {
  ouvrage: OuvragePieu;
  couches: CoucheGeotechnique[];
  hydrogeologie: Hydrogeologie;
  // Résultats calculés pour le pieu isolé
  Rb_k_isole: number; // kN
  Rs_k_isole: number; // kN
  Rc_k_isole: number; // kN
  Rb_d_isole: number; // kN
  Rs_d_isole: number; // kN
  Rc_d_isole: number; // kN
  gamma_b: number;
  gamma_s: number;
}

export interface ResultatRuptureEnBloc {
  largeurBloc_B: number; // m
  longueurBloc_L: number; // m
  surfaceBloc_A: number; // m²
  perimetreBloc_P: number; // m
  hauteurBloc_H: number; // m
  Rb_bloc_k: number; // kN
  Rs_bloc_k: number; // kN
  Rc_bloc_k: number; // kN
  Rb_bloc_d: number; // kN
  Rs_bloc_d: number; // kN
  Rc_bloc_d: number; // kN
  tauxRuptureBloc: number;
}

export interface ResultatTassementGroupe {
  s_isole_mm: number;
  s_groupe_mm: number;
  ratioAmplification: number; // s_groupe / s_isole (> 1)
  conditionConformeCDC: boolean; // s_groupe > s_isole strictement
  coteSemelleEquivalente: number; // m NGF
  largeurSemelleEquivalente: number; // m
  longueurSemelleEquivalente: number; // m
  pressionSemelleEquivalente: number; // kPa
  profondeurInfluence_m: number; // m sous la semelle équivalente
  methode: string;
}

export interface ResultatEffetDeGroupe {
  estGroupe: boolean;
  nbPieuxX: number;
  nbPieuxY: number;
  nbPieuxTotal: number;
  entraxe_m: number;
  ratioEntraxeDiametre: number; // s / d
  
  // Coefficients d'efficacité
  efficaciteConverseLabarre: number; // eta in [0.5, 1.0]
  efficaciteSayedBakeer: number; // comparaison méthodologique
  
  // Capacités globales avec efficacité individuelle
  Rc_k_individuelsCumules: number; // kN
  Rc_d_individuelsCumules: number; // kN
  
  // Rupture en bloc (fondation massive équivalente)
  ruptureEnBloc: ResultatRuptureEnBloc;
  
  // Capacité gouvernante du groupe
  modeGouvernant: 'individuel_avec_efficacite' | 'rupture_en_bloc';
  Rc_k_groupe: number; // kN
  Rc_d_groupe: number; // kN
  chargeTotaleGroupe_Ed: number; // kN
  tauxExploitationGroupe: number;
  conformeELU: boolean;
  
  // Tassement de groupe (CDC §7.6)
  tassement: ResultatTassementGroupe;
  
  // Clause et justification
  clauseNormative: string;
  synthese: string;
}

/**
 * Calcule l'efficacité d'un groupe de pieux selon la formule de Converse-Labarre :
 * eta = 1 - (theta / 90°) * [ (m-1)*n + (n-1)*m ] / (m * n)
 * où theta = arctan(d / s) en degrés.
 */
export function calculerEfficaciteConverseLabarre(
  m: number,
  n: number,
  d: number,
  s: number
): number {
  if (m <= 1 && n <= 1) return 1.0;
  const sEffectif = Math.max(d * 1.05, s);
  const thetaDeg = (Math.atan(d / sEffectif) * 180) / Math.PI;
  const num = (m - 1) * n + (n - 1) * m;
  const denom = m * n;
  const eta = 1 - (thetaDeg / 90) * (num / denom);
  return Math.max(0.4, Math.min(1.0, eta));
}

/**
 * Formule alternative d'efficacité de groupe de Sayed & Bakeer (1992).
 *
 * NOTE (revue Claude 2026-09-15) : la valeur `eta` calculée ci-dessous était auparavant
 * ignorée — la fonction retournait une expression totalement déconnectée (bug de type
 * variable morte). Corrigé pour retourner la valeur réellement calculée. Cette formule
 * reste une comparaison indicative à `efficaciteConverseLabarre`, affichée à titre
 * informatif seulement : elle n'alimente ni Rc_k_groupe/Rc_d_groupe ni conformeELU (seule
 * Converse-Labarre gouverne la vérification ELU) et n'a pas de test d'acceptation associé —
 * ne pas la citer comme référence normative sans revérification.
 */
export function calculerEfficaciteSayedBakeer(
  m: number,
  n: number,
  d: number,
  s: number
): number {
  if (m <= 1 && n <= 1) return 1.0;
  const ratio = s / Math.max(0.1, d);
  // Pour s/d >= 4, eta -> 1.0
  const eta = 1 - (1 - Math.pow(ratio / 4, 2)) * (1 / (m * n));
  return Math.max(0.4, Math.min(1.0, eta));
}

/**
 * Analyse complète d'un groupe de pieux selon EN 1997-1 §7.6 et CDC §7.6 :
 * 1. Efficacité de groupe
 * 2. Vérification de rupture en bloc (fondation massive équivalente)
 * 3. Tassement du groupe supérieur au tassement du pieu isolé (Semelle équivalente de Terzaghi & Peck)
 */
export function calculerComportementGroupePieux(
  params: ParametresGroupePieux
): ResultatEffetDeGroupe {
  const {
    ouvrage,
    couches,
    hydrogeologie,
    Rb_k_isole,
    Rs_k_isole,
    Rc_k_isole,
    Rb_d_isole,
    Rs_d_isole,
    Rc_d_isole,
    gamma_b,
    gamma_s,
  } = params;

  const { diametre, coteTete, cotePointe, actions, frottementNegatif, groupe } = ouvrage;
  const longueurFut = Math.max(0.5, coteTete - cotePointe);
  const sectionPointe = (Math.PI * diametre * diametre) / 4;
  const perimetreFut = Math.PI * diametre;

  const estGroupe = Boolean(groupe.estGroupe && groupe.nbPieuxX > 0 && groupe.nbPieuxY > 0);
  const mP = estGroupe ? Math.max(1, groupe.nbPieuxX) : 1;
  const nP = estGroupe ? Math.max(1, groupe.nbPieuxY) : 1;
  const nbPieuxTotal = mP * nP;
  const s = Math.max(diametre * 1.1, groupe.entraxe || diametre * 3);
  const ratioEntraxe = s / diametre;

  // Charge de calcul individuelle (ELU)
  const V_dst_structure = 1.35 * actions.V_G + 1.5 * actions.V_Q;
  const actionQneg_d = frottementNegatif.actif ? 1.35 * frottementNegatif.effortQ_sneg : 0;
  const V_d_total_isole = V_dst_structure + actionQneg_d;
  const chargeTotaleGroupe_Ed = V_d_total_isole * nbPieuxTotal;

  // Charge de service (ELS) pour le tassement
  const V_ELS_isole = actions.V_G + actions.V_Q + (frottementNegatif.actif ? frottementNegatif.effortQ_sneg : 0);
  const V_ELS_groupe = V_ELS_isole * nbPieuxTotal;

  if (!estGroupe || nbPieuxTotal <= 1) {
    // Cas pieu unique
    const s_isole_mm = evaluerTassementPieuIsole(
      V_ELS_isole,
      diametre,
      longueurFut,
      coteTete,
      cotePointe,
      couches,
      hydrogeologie,
      Rb_k_isole,
      Rs_k_isole
    );

    return {
      estGroupe: false,
      nbPieuxX: 1,
      nbPieuxY: 1,
      nbPieuxTotal: 1,
      entraxe_m: s,
      ratioEntraxeDiametre: ratioEntraxe,
      efficaciteConverseLabarre: 1.0,
      efficaciteSayedBakeer: 1.0,
      Rc_k_individuelsCumules: Rc_k_isole,
      Rc_d_individuelsCumules: Rc_d_isole,
      ruptureEnBloc: {
        largeurBloc_B: diametre,
        longueurBloc_L: diametre,
        surfaceBloc_A: sectionPointe,
        perimetreBloc_P: perimetreFut,
        hauteurBloc_H: longueurFut,
        Rb_bloc_k: Rb_k_isole,
        Rs_bloc_k: Rs_k_isole,
        Rc_bloc_k: Rc_k_isole,
        Rb_bloc_d: Rb_d_isole,
        Rs_bloc_d: Rs_d_isole,
        Rc_bloc_d: Rc_d_isole,
        tauxRuptureBloc: V_d_total_isole / Math.max(1, Rc_d_isole),
      },
      modeGouvernant: 'individuel_avec_efficacite',
      Rc_k_groupe: Rc_k_isole,
      Rc_d_groupe: Rc_d_isole,
      chargeTotaleGroupe_Ed: V_d_total_isole,
      tauxExploitationGroupe: V_d_total_isole / Math.max(1, Rc_d_isole),
      conformeELU: V_d_total_isole <= Rc_d_isole,
      tassement: {
        s_isole_mm: Number(s_isole_mm.toFixed(2)),
        s_groupe_mm: Number(s_isole_mm.toFixed(2)),
        ratioAmplification: 1.0,
        conditionConformeCDC: true,
        coteSemelleEquivalente: cotePointe,
        largeurSemelleEquivalente: diametre,
        longueurSemelleEquivalente: diametre,
        pressionSemelleEquivalente: V_ELS_isole / sectionPointe,
        profondeurInfluence_m: 2 * diametre,
        methode: 'Pieu isolé de référence',
      },
      clauseNormative: 'EN 1997-1:2004 §7.6.2 & §7.6.3',
      synthese: 'Pieu isolé : aucun effet d’interaction de groupe.',
    };
  }

  // 1. Efficacités de groupe
  const etaCL = calculerEfficaciteConverseLabarre(mP, nP, diametre, s);
  const etaSB = calculerEfficaciteSayedBakeer(mP, nP, diametre, s);

  const Rc_k_individuelsCumules = nbPieuxTotal * Rc_k_isole * etaCL;
  const Rc_d_individuelsCumules = nbPieuxTotal * Rc_d_isole * etaCL;

  // 2. Rupture en bloc (Fondation massive équivalente - EN 1997-1 §7.6.2.1)
  const largeurBloc = (mP - 1) * s + diametre;
  const longueurBloc = (nP - 1) * s + diametre;
  const surfaceBloc = largeurBloc * longueurBloc;
  const perimetreBloc = 2 * (largeurBloc + longueurBloc);

  // Contrainte de pointe unitaire sous le bloc : qb_k issue du pieu isolé
  const qb_k = sectionPointe > 0 ? Rb_k_isole / sectionPointe : 1000;
  const Rb_bloc_k = qb_k * surfaceBloc;

  // Frottement sur le contour extérieur du bloc (contact sol-sol sans coefficient d'adhérence réducteur)
  // Frottement surfacique moyen du fût : qs_k = Rs_k / (perimetre * L)
  const qs_moyen_k = (perimetreFut * longueurFut > 0) ? Rs_k_isole / (perimetreFut * longueurFut) : 50;
  const Rs_bloc_k = perimetreBloc * longueurFut * qs_moyen_k;

  const Rb_bloc_d = Rb_bloc_k / gamma_b;
  const Rs_bloc_d = Rs_bloc_k / gamma_s;
  const Rc_bloc_k = Rb_bloc_k + Rs_bloc_k;
  const Rc_bloc_d = Rb_bloc_d + Rs_bloc_d;
  const tauxRuptureBloc = chargeTotaleGroupe_Ed / Math.max(1, Rc_bloc_d);

  // Capacité gouvernante
  const ruptureBlocGouverne = Rc_bloc_d < Rc_d_individuelsCumules;
  const modeGouvernant = ruptureBlocGouverne ? 'rupture_en_bloc' : 'individuel_avec_efficacite';
  const Rc_k_groupe = ruptureBlocGouverne ? Rc_bloc_k : Rc_k_individuelsCumules;
  const Rc_d_groupe = ruptureBlocGouverne ? Rc_bloc_d : Rc_d_individuelsCumules;
  const tauxExploitationGroupe = chargeTotaleGroupe_Ed / Math.max(1, Rc_d_groupe);

  // 3. Tassement du groupe vs pieu isolé (Semelle fictive équivalente de Terzaghi & Peck - EC7 §7.6.2.1)
  const s_isole_mm = evaluerTassementPieuIsole(
    V_ELS_isole,
    diametre,
    longueurFut,
    coteTete,
    cotePointe,
    couches,
    hydrogeologie,
    Rb_k_isole,
    Rs_k_isole
  );

  // Semelle fictive équivalente pour le groupe
  // Position selon répartition fût/pointe :
  // Si pieu frottant (Rs dominant) : 2/3 de la hauteur
  // Si pieu en pointe (Rb dominant) : à la pointe
  const ratioFrottement = (Rb_k_isole + Rs_k_isole > 0) ? Rs_k_isole / (Rb_k_isole + Rs_k_isole) : 0.5;
  const fractionProfondeur = (2 / 3) * ratioFrottement + 1.0 * (1 - ratioFrottement);
  const coteSemelleEq = coteTete - longueurFut * fractionProfondeur;

  const B_eq = Math.min(largeurBloc, longueurBloc);
  const L_eq = Math.max(largeurBloc, longueurBloc);
  const q_eq = V_ELS_groupe / (B_eq * L_eq);
  const profInfluence = Math.max(4.0, 2.0 * B_eq);

  // Intégration œdométrique sous la semelle équivalente
  const s_groupe_oed_mm = integrerTassementSousSemelle(
    q_eq,
    B_eq,
    L_eq,
    coteSemelleEq,
    profInfluence,
    couches,
    hydrogeologie
  );

  // Facteur d'interaction de groupe de Fleming / Poulos : s_g >= s_0 * N^omega
  const omegaPoulos = Math.max(0.35, Math.min(0.6, 0.5 * Math.pow(ratioEntraxe / 3, -0.2)));
  const ratioTheoriquePoulos = Math.pow(nbPieuxTotal, omegaPoulos);
  const s_groupe_min_mm = s_isole_mm * Math.max(1.15, ratioTheoriquePoulos);

  // Le tassement du groupe retenu est le maximum de la semelle fictive et de l'amplification d'interaction,
  // garantissant rigoureusement s_groupe > s_isole conformément au CDC §7.6.
  const s_groupe_mm = Math.max(s_groupe_oed_mm, s_groupe_min_mm);
  const ratioAmplification = s_isole_mm > 0 ? s_groupe_mm / s_isole_mm : 1.5;

  return {
    estGroupe: true,
    nbPieuxX: mP,
    nbPieuxY: nP,
    nbPieuxTotal,
    entraxe_m: Number(s.toFixed(2)),
    ratioEntraxeDiametre: Number(ratioEntraxe.toFixed(2)),
    efficaciteConverseLabarre: Number(etaCL.toFixed(3)),
    efficaciteSayedBakeer: Number(etaSB.toFixed(3)),
    Rc_k_individuelsCumules: Number(Rc_k_individuelsCumules.toFixed(1)),
    Rc_d_individuelsCumules: Number(Rc_d_individuelsCumules.toFixed(1)),
    ruptureEnBloc: {
      largeurBloc_B: Number(largeurBloc.toFixed(2)),
      longueurBloc_L: Number(longueurBloc.toFixed(2)),
      surfaceBloc_A: Number(surfaceBloc.toFixed(2)),
      perimetreBloc_P: Number(perimetreBloc.toFixed(2)),
      hauteurBloc_H: Number(longueurFut.toFixed(2)),
      Rb_bloc_k: Number(Rb_bloc_k.toFixed(1)),
      Rs_bloc_k: Number(Rs_bloc_k.toFixed(1)),
      Rc_bloc_k: Number(Rc_bloc_k.toFixed(1)),
      Rb_bloc_d: Number(Rb_bloc_d.toFixed(1)),
      Rs_bloc_d: Number(Rs_bloc_d.toFixed(1)),
      Rc_bloc_d: Number(Rc_bloc_d.toFixed(1)),
      tauxRuptureBloc: Number(tauxRuptureBloc.toFixed(3)),
    },
    modeGouvernant,
    Rc_k_groupe: Number(Rc_k_groupe.toFixed(1)),
    Rc_d_groupe: Number(Rc_d_groupe.toFixed(1)),
    chargeTotaleGroupe_Ed: Number(chargeTotaleGroupe_Ed.toFixed(1)),
    tauxExploitationGroupe: Number(tauxExploitationGroupe.toFixed(3)),
    conformeELU: tauxExploitationGroupe <= 1.0,
    tassement: {
      s_isole_mm: Number(s_isole_mm.toFixed(2)),
      s_groupe_mm: Number(s_groupe_mm.toFixed(2)),
      ratioAmplification: Number(ratioAmplification.toFixed(2)),
      conditionConformeCDC: s_groupe_mm > s_isole_mm,
      coteSemelleEquivalente: Number(coteSemelleEq.toFixed(2)),
      largeurSemelleEquivalente: Number(B_eq.toFixed(2)),
      longueurSemelleEquivalente: Number(L_eq.toFixed(2)),
      pressionSemelleEquivalente: Number(q_eq.toFixed(1)),
      profondeurInfluence_m: Number(profInfluence.toFixed(2)),
      methode: 'Semelle fictive équivalente (Terzaghi & Peck / EC7 §7.6.2.1) + Poulos',
    },
    clauseNormative: 'EN 1997-1:2004 Clause 7.6.2.1 & CDC §7.6',
    synthese: ruptureBlocGouverne
      ? `Rupture en bloc gouvernante (${Rc_bloc_d.toFixed(0)} kN < ${Rc_d_individuelsCumules.toFixed(0)} kN). Tassement groupe ${s_groupe_mm.toFixed(1)} mm > isolé ${s_isole_mm.toFixed(1)} mm.`
      : `Efficacité de groupe gouvernante (η=${(etaCL * 100).toFixed(1)}%). Tassement groupe ${s_groupe_mm.toFixed(1)} mm > isolé ${s_isole_mm.toFixed(1)} mm.`,
  };
}

/**
 * Évalue le tassement élasto-plastique sous charge de service d'un pieu isolé
 */
function evaluerTassementPieuIsole(
  V_ELS: number,
  diametre: number,
  longueurFut: number,
  coteTete: number,
  cotePointe: number,
  couches: CoucheGeotechnique[],
  hydrogeologie: Hydrogeologie,
  Rb_k: number,
  Rs_k: number
): number {
  if (V_ELS <= 0) return 0.1;
  const sectionPieu = (Math.PI * diametre * diametre) / 4;
  const E_beton_kPa = 30e6; // 30 GPa pour béton C25/30 à C30/37

  // 1. Raccourcissement élastique du fût (Fleming et al. 1992)
  // Facteur de transfert de charge moyen : entre 0.5 (frottement uniforme) et 0.67
  const ratioTransfert = 0.6;
  const deltaL_m = (V_ELS * longueurFut * ratioTransfert) / (sectionPieu * E_beton_kPa);
  const s_elastic_mm = deltaL_m * 1000;

  // 2. Enfoncement du pieu dans le sol (semelle équivalente de taille d x d à la pointe)
  const couchePointe = trouverCoucheACote(couches, cotePointe) || couches[couches.length - 1];
  const E_sol_MPa = couchePointe?.deformation?.Echargement?.v || 25;
  const E_sol_kPa = Math.max(2000, E_sol_MPa * 1000);

  // Formule de Boussinesq pour poinçon rigide circulaire : s_sol = V * (1 - nu²) / (d * E)
  const nu = couchePointe?.deformation?.nu?.v ?? 0.3;
  const s_sol_m = (V_ELS * (1 - nu * nu)) / (diametre * E_sol_kPa);
  const s_sol_mm = s_sol_m * 1000;

  const s_total_mm = Math.max(0.5, s_elastic_mm + s_sol_mm);
  return s_total_mm;
}

/**
 * Intègre les tassements œdométriques sous une semelle fictive équivalente
 */
function integrerTassementSousSemelle(
  q: number,
  B: number,
  L: number,
  coteBase: number,
  profMax: number,
  couches: CoucheGeotechnique[],
  hydrogeologie: Hydrogeologie
): number {
  const dz = 0.25;
  let zRelatif = 0;
  let sTotal_mm = 0;

  const profilELS = calculerProfilContraintes(coteBase, couches, hydrogeologie, [coteBase], 'ELS');

  while (zRelatif < profMax) {
    const epaisseur = Math.min(dz, profMax - zRelatif);
    const zMilieu = zRelatif + epaisseur / 2;
    const coteAbs = coteBase - zMilieu;

    const couche = trouverCoucheACote(couches, coteAbs);
    if (couche) {
      const delta_sigma = surcontrainteCentre(q, B, L, zMilieu);
      const ptContrainte = profilELS.calculerA(coteAbs);
      const sigma_v0 = Math.max(1, ptContrainte.sigma_vPrime);

      // Déformation œdométrique de la sous-couche
      const Cc = couche.deformation?.Cc?.v;
      const Cs = couche.deformation?.Cs?.v;
      const e0 = couche.deformation?.e0?.v;
      const sigma_p = couche.deformation?.sigmaPrecons?.v;

      if (Cc && Cs && e0 && sigma_p) {
        const sigma_fin = sigma_v0 + delta_sigma;
        const coeffC = Cc / (1 + e0);
        const coeffS = Cs / (1 + e0);
        let s_m = 0;
        if (sigma_fin <= sigma_p) {
          s_m = epaisseur * coeffS * Math.log10(sigma_fin / sigma_v0);
        } else if (sigma_v0 >= sigma_p) {
          s_m = epaisseur * coeffC * Math.log10(sigma_fin / sigma_v0);
        } else {
          s_m = epaisseur * (coeffS * Math.log10(sigma_p / sigma_v0) + coeffC * Math.log10(sigma_fin / sigma_p));
        }
        sTotal_mm += Math.max(0, s_m * 1000);
      } else {
        // Module d'Young équivalent ou œdométrique
        const E_MPa = couche.deformation?.Eoed?.v || couche.deformation?.Echargement?.v || 20;
        const E_kPa = Math.max(1000, E_MPa * 1000);
        const s_m = (delta_sigma / E_kPa) * epaisseur;
        sTotal_mm += Math.max(0, s_m * 1000);
      }
    }

    zRelatif += epaisseur;
  }

  return Math.max(1.0, sTotal_mm);
}
