import {
  ArmatureSolRenforce,
  CoefficientsSolRenforce,
  ConfigurationNormative,
  OuvrageSolRenforce,
  StatutGrandeur,
  TripletGrandeur,
  TypeArmature,
} from '../../types/geotech';
import { combinaisonsStabilite, CombinaisonStabilite } from '../../briques/stabiliteGenerale';

/**
 * Valeurs par défaut du sol renforcé — méthode cohérente gravitaire « simplifiée »
 * (FHWA-NHI-10-024, reprise par AASHTO LRFD §11.10). La NF P 94-270 suit la même démarche
 * mais son texte n'a pas été lu : aucun de ses coefficients n'est recopié ici. Toutes ces
 * valeurs sont modifiables dans l'interface et portent leur source.
 */

const FHWA = 'FHWA-NHI-10-024 / AASHTO LRFD §11.10.6 (méthode simplifiée)';
const val = (v: number, u: string, statut: StatutGrandeur, source: string): TripletGrandeur<number> => ({ v, u, statut, source });

export const LIBELLES_ARMATURE: Record<TypeArmature, string> = {
  feuillardAcier: 'Feuillards acier (terre armée)',
  grilleAcier: 'Grilles ou treillis acier',
  geosynthetique: 'Géosynthétique (géogrille, géotextile)',
};

export function coefficientsParDefaut(type: TypeArmature, phiRemblai: number): CoefficientsSolRenforce {
  const tanPhi = Math.tan((phiRemblai * Math.PI) / 180);
  const gammaR = (nom: string) =>
    val(1.35, '-', 'defaut', `Valeur indicative de l'outil pour ${nom} — à fixer selon le référentiel du projet (NF P 94-270, EBGEO…)`);
  if (type === 'feuillardAcier') {
    return {
      K0_sur_Ka: val(1.7, '-', 'defaut', FHWA + ', feuillards métalliques'),
      Kz0_sur_Ka: val(1.2, '-', 'defaut', FHWA + ', feuillards métalliques'),
      z0: val(6, 'm', 'defaut', FHWA),
      Fetoile0: val(1.8, '-', 'defaut', FHWA + ' : F* = 1,2 + log Cu ≤ 2, avec Cu = 4 supposé (à justifier par la granulométrie)'),
      FetoileZ0: val(tanPhi, '-', 'derive', "tan φ'r (" + FHWA + ')'),
      alpha: val(1.0, '-', 'defaut', FHWA + ' (armature inextensible)'),
      C: val(2, '-', 'defaut', 'Deux faces frottantes (bande)'),
      gamma_R_rupture: gammaR('la rupture'),
      gamma_R_arrachement: gammaR("l'arrachement"),
      ligne: 'bilineaire',
    };
  }
  if (type === 'grilleAcier') {
    return {
      K0_sur_Ka: val(2.5, '-', 'defaut', FHWA + ', grilles métalliques'),
      Kz0_sur_Ka: val(1.2, '-', 'defaut', FHWA + ', grilles métalliques'),
      z0: val(6, 'm', 'defaut', FHWA),
      Fetoile0: val(1.5, '-', 'defaut', FHWA + ' : F* = 20·t/St en tête — valeur à calculer pour la grille réelle'),
      FetoileZ0: val(0.75, '-', 'defaut', FHWA + ' : F* = 10·t/St à 6 m — valeur à calculer pour la grille réelle'),
      alpha: val(1.0, '-', 'defaut', FHWA + ' (armature inextensible)'),
      C: val(2, '-', 'defaut', 'Deux faces frottantes'),
      gamma_R_rupture: gammaR('la rupture'),
      gamma_R_arrachement: gammaR("l'arrachement"),
      ligne: 'bilineaire',
    };
  }
  return {
    K0_sur_Ka: val(1.0, '-', 'defaut', FHWA + ', armatures extensibles'),
    Kz0_sur_Ka: val(1.0, '-', 'defaut', FHWA + ', armatures extensibles'),
    z0: val(6, 'm', 'defaut', FHWA),
    Fetoile0: val(0.67 * tanPhi, '-', 'derive', "0,67·tan φ'r (" + FHWA + ', valeur prudente sans essai)'),
    FetoileZ0: val(0.67 * tanPhi, '-', 'derive', "0,67·tan φ'r (" + FHWA + ', valeur prudente sans essai)'),
    alpha: val(0.8, '-', 'defaut', FHWA + ' (géogrille ; 0,6 pour un géotextile)'),
    C: val(2, '-', 'defaut', 'Deux faces frottantes'),
    gamma_R_rupture: gammaR('la rupture'),
    gamma_R_arrachement: gammaR("l'arrachement"),
    ligne: 'rankine',
  };
}

export function armatureParDefaut(type: TypeArmature): ArmatureSolRenforce {
  return {
    type,
    largeur_mm: type === 'grilleAcier' ? 100 : 45,
    epaisseur_mm: type === 'grilleAcier' ? 8 : 5,
    fy_MPa: 355,
    nbParMetre: 2,
    perteEpaisseurParFace_mm: val(
      0.71,
      'mm',
      'defaut',
      'FHWA-NHI-10-024 §3.5 : 75 ans, galvanisation 86 µm, puis 12 µm/an/face (≈ 0,71 mm) — à adapter à la durée de service et au remblai'
    ),
    resistanceUltime_kNm: 80,
    RF_fluage: 1.6,
    RF_endommagement: 1.1,
    RF_vieillissement: 1.1,
    tauxCouverture: 1.0,
  };
}

/** Coefficient F* en vigueur (le statut 'derive' suit φ'r du remblai). */
export function fetoileEffectifs(o: OuvrageSolRenforce): { F0: number; Fz0: number } {
  const tanPhi = Math.tan((o.remblai.phiPrime * Math.PI) / 180);
  const c = o.coefficients;
  const facteur = o.armature.type === 'geosynthetique' ? 0.67 : 1;
  return {
    F0: c.Fetoile0.statut === 'derive' ? facteur * tanPhi : c.Fetoile0.v,
    Fz0: c.FetoileZ0.statut === 'derive' ? facteur * tanPhi : c.FetoileZ0.v,
  };
}

export function ouvrageSolRenforceParDefaut(coteTerrainNaturel: number): OuvrageSolRenforce {
  const H = 6;
  return {
    id: 'MSE-1',
    nom: 'Massif en terre armée',
    xParement: 0,
    // Massif en remblai fondé au terrain naturel, encastré de 0,6 m
    coteBase: Number((coteTerrainNaturel - 0.6).toFixed(3)),
    hauteur: H,
    encastrement: 0.6,
    longueurArmatures: 4.5,
    remblai: { gamma: 19, phiPrime: 34 },
    surchargeG: 0,
    surchargeQ: 10,
    premierLit: 0.375,
    espacementSv: 0.75,
    armature: armatureParDefaut('feuillardAcier'),
    coefficients: coefficientsParDefaut('feuillardAcier', 34),
  };
}

/** Jeu de résistances associé à chaque combinaison (annexe A). */
export const JEU_RESISTANCE: Record<CombinaisonStabilite['id'], 'R1' | 'R2' | 'R3'> = {
  caracteristique: 'R1',
  'DA1-C1': 'R1',
  'DA1-C2': 'R1',
  DA2: 'R2',
  DA3: 'R3',
};

/** Combinaisons ELU de la configuration (sans le calcul caractéristique). */
export function combinaisonsELU(config: ConfigurationNormative): CombinaisonStabilite[] {
  return combinaisonsStabilite(config, 1.5).filter((c) => c.id !== 'caracteristique');
}
