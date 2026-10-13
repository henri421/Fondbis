/**
 * Modèle de données géotechniques selon EN 1997-1:2004 (Eurocode 7)
 * Version du schéma : 1.0
 */

export type StatutGrandeur = 'mesure' | 'correle' | 'derive' | 'choix' | 'defaut';

export interface TripletGrandeur<T = number | null> {
  v: T;
  u: string;
  statut: StatutGrandeur;
  source: string;
}

export type NatureSol = 'sable' | 'limon' | 'argile' | 'tourbe' | 'roche' | 'remblai';

export interface CoucheGeotechnique {
  id: string;
  nom: string;
  coteToit: number; // Cote absolue NGF/NGL en m
  epaisseur: number; // m (doit être > 0)
  nature: NatureSol;
  couleurAffichage: string;

  poidsVolumiques: {
    gammaHumide: TripletGrandeur<number>; // kN/m³
    gammaSature: TripletGrandeur<number>; // kN/m³
  };

  resistanceDrainee: {
    phiPrime: TripletGrandeur<number>; // deg
    phiCritique: TripletGrandeur<number>; // deg
    cPrime: TripletGrandeur<number>; // kPa
    psiDilatance: TripletGrandeur<number>; // deg
    deltaInterface: TripletGrandeur<number>; // deg
  };

  resistanceNonDrainee: {
    cuTete: TripletGrandeur<number>; // kPa
    gradientCu: TripletGrandeur<number>; // kPa/m
  };

  deformation: {
    Echargement: TripletGrandeur<number>; // MPa
    EdechargeRech: TripletGrandeur<number>; // MPa
    nu: TripletGrandeur<number>; // -
    Eoed: TripletGrandeur<number>; // MPa
    Cc: TripletGrandeur<number>; // -
    Cs: TripletGrandeur<number>; // -
    e0: TripletGrandeur<number>; // -
    sigmaPrecons: TripletGrandeur<number>; // kPa
    OCR: TripletGrandeur<number | null>; // -
    Calpha: TripletGrandeur<number>; // -
    cv: TripletGrandeur<number>; // m²/s
    k: TripletGrandeur<number>; // m/s
  };
}

export interface Referentiel {
  systeme: string; // Ex. NGL, NGF, TAW, local
  coteTerrainNaturel: number; // m
  coteReferenceProjet: number; // m
}

export interface Hydrogeologie {
  nappePrincipale: {
    coteCaracteristique: number; // m (pour ELS)
    coteDefavorableELU: number; // m (pour ELU)
    regime: 'hydrostatique' | 'gradientVertical';
  };
  gradientVertical: number | null;
  nappesSecondaires: Array<{
    type: 'suspendue' | 'captive';
    coucheId: string;
    cotePiezometrique: number;
  }>;
  poidsVolumiqueEau: number; // kN/m³ (9.81 par défaut)
}

export interface PointProfilSondage {
  z: number; // m sous la tête
  qc?: number; // MPa
  fs?: number; // MPa
  u2?: number; // kPa
  N?: number; // SPT
  N60?: number;
  plNette?: number; // PMT MPa
  EM?: number; // PMT MPa
}

export interface CampagneEssai {
  id: string;
  type: 'CPT' | 'CPTu' | 'SPT' | 'DPSH' | 'PMT';
  x: number;
  y: number;
  coteTete: number;
  profil: PointProfilSondage[];
}

export type ApprocheCalcul = 'DA1' | 'DA2' | 'DA3';

export interface JeuFacteursResistance {
  gamma_Rv: number;
  gamma_Rh: number;
  gamma_Rb: number;
  gamma_Rs: number;
  gamma_Re?: number; // talus et stabilité générale (tableau A.14) ; absent des anciens projets
}

export interface ConfigurationNormative {
  identifiant: string;
  libelle: string;
  annexeNationale: string | null;
  approcheCalcul: ApprocheCalcul;
  facteursActions: {
    A1: { gamma_G_dst: number; gamma_G_stb: number; gamma_Q_dst: number; gamma_Q_stb: number };
    A2: { gamma_G_dst: number; gamma_G_stb: number; gamma_Q_dst: number; gamma_Q_stb: number };
  };
  facteursSol: {
    M1: { gamma_phi: number; gamma_c: number; gamma_cu: number; gamma_qu: number; gamma_gamma: number };
    M2: { gamma_phi: number; gamma_c: number; gamma_cu: number; gamma_qu: number; gamma_gamma: number };
  };
  facteursResistance: {
    R1: JeuFacteursResistance;
    R2: JeuFacteursResistance;
    R3: JeuFacteursResistance;
    R4: JeuFacteursResistance;
  };
  coefficientsCorrelationPieux: {
    tableXi: Array<{ n: number; xi3: number; xi4: number }>;
  };
}

export interface ParametresCaracteristiquesSol {
  phiPrime_k: number;
  cPrime_k: number;
  cu_k: number;
  gammaHumide_k: number;
  gammaSature_k: number;
  delta_k: number;
}

export interface ParametresDeCalculSol {
  phiPrime_d: number; // Calculé via arctan(tan(phi'_k) / gamma_phi)
  cPrime_d: number; // c'_k / gamma_c
  cu_d: number; // cu_k / gamma_cu
  gammaHumide_d: number;
  gammaSature_d: number;
  delta_d: number;
  jeuM: 'M1' | 'M2';
}

export interface OuvrageRadier {
  id: string;
  nom: string;
  longueurL: number; // m
  largeurB: number; // m
  coteBase: number; // m
  epaisseur: number; // m
  // Actions en base
  actions: {
    V_G: number; // kN permanent vertical
    V_Q: number; // kN variable vertical
    H_G: number; // kN horizontal permanent
    H_Q: number; // kN horizontal variable
    M_G: number; // kNm moment permanent
    M_Q: number; // kNm moment variable
  };
  coteTerrainFini: number;
}

export interface ProfilEssaiPieu {
  id: string;
  reference: string; // Ex: 'CPT-01', 'Sondage S1'
  rcCalc: number; // kN (capacité calculée Rc;calc pour ce profil)
}

export interface OuvragePieu {
  id: string;
  nom: string;
  diametre: number; // m
  coteTete: number; // m
  cotePointe: number; // m
  modeExecution: 'fore' | 'battu' | 'tariereContinue';
  actions: {
    V_G: number; // kN
    V_Q: number; // kN
    H_G: number; // kN
    H_Q: number; // kN
  };
  frottementNegatif: {
    actif: boolean;
    cotePlanNeutre: number; // m
    effortQ_sneg: number; // kN (action supplémentaire défavorable)
  };
  groupe: {
    estGroupe: boolean;
    nbPieuxX: number;
    nbPieuxY: number;
    entraxe: number; // m
  };
  // Profils d'essais pour application des facteurs de corrélation (EN 1997-1 §7.6.2.3 Voie 2)
  profilsEssais?: ProfilEssaiPieu[];
}

export interface AppuiPhase {
  id: string;
  cote: number;
  type: 'buton' | 'tirant';
  raideur: number; // kN/m
  reactionMax?: number; // kN, capacité de compression (buton) ou traction (tirant)
  reactionMin?: number;
  phaseActivation: number; // index de la phase où l'appui est posé (commence à 1 ou 0)
}

export interface PhaseParoi {
  numero: number;
  nom: string;
  coteFondFouille: number; // évolue à chaque excavation
  hydrogeologieAmont?: Hydrogeologie; // si non fourni, hérite de la phase précédente / modèle
  hydrogeologieAval?: Hydrogeologie;
  surchargeQ_amont?: number; // surcharge additionnelle amont éventuelle
}

export interface OuvrageSoutenement {
  id: string;
  nom: string;
  type: 'murEnL' | 'paroiFlexible';
  hauteurTotale: number; // m
  coteTete: number; // m
  coteFondFouille: number; // m
  epaisseurVoile?: number; // m
  largeurSemelleB?: number; // m
  debordAvant?: number; // m
  ficheT?: number; // m
  surchargeQ: number; // kPa
  inclinaisonTerrePlein: number; // deg
  frottementDeltaSurPhi: number; // ex: 0.667
  butons: Array<{ cote: number; raideur: number }>;
  // Extension Phase 4 : Paroi phasée
  phases?: PhaseParoi[];
  appuisPhases?: AppuiPhase[];
  EI?: number; // kN.m² rigidité de flexion de la paroi
  EA?: number; // kN rigidité axiale de la paroi
  // Extension : surcouche Berlinoise (§8.5)
  sousType?: 'continue' | 'berlinoise' | 'pieuxSecants';
  parametresBerlinoise?: {
    entraxeProfiles: number; // m
    profile: { I: number; W: number; largeur: number }; // m⁴, m³, m — profilé isolé
    blindage: {
      hauteurPasse: number;         // m
      epaisseur: number;            // m
      contrainteAdmissible: number; // kPa
    };
  };
  // Extension : surcouche Paroi de Pieux Sécants (§8.5)
  parametresPieuxSecants?: {
    diametrePrimaire: number;        // m
    diametreSecondaire: number;      // m
    entraxe: number;                 // m, axe à axe pieu primaire ↔ secondaire adjacent
    deviationVerticaliteMax: number; // sans unité (pente), ex 0.01 = 1% — saisie directe
    recouvrementMinimalRequis: number; // m — seuil d'étanchéité/continuité, saisie directe
  };
  // Extension : persistance complète de la paroi phasée (Réserve 2, revue Berlinoise)
  coteBase?: number;                    // m — cote base/fiche de l'écran (paroi phasée)
  moduleE_GPa?: number;                 // GPa — module d'Young (paroi continue)
  etatCalcul?: 'ELS' | 'ELU';
  khParCouche?: Record<string, number>; // kN/m³, clé = CoucheGeotechnique.id
}

/** Surcharge verticale uniforme en bande sur le profil du talus (kPa, par m de profil). */
export interface SurchargeTalus {
  id: string;
  nom: string;
  xDebut: number; // m
  xFin: number; // m
  q: number; // kPa
  nature: 'G' | 'Q'; // permanente ou variable
}

// ---------------------------------------------------------------------------
// Sol renforcé (terre armée, armatures géosynthétiques)
// ---------------------------------------------------------------------------

export type TypeArmature = 'feuillardAcier' | 'grilleAcier' | 'geosynthetique';

export interface ArmatureSolRenforce {
  type: TypeArmature;
  // Acier (feuillards, grilles) : section d'une armature, nombre par mètre de parement et par lit
  largeur_mm: number;
  epaisseur_mm: number;
  fy_MPa: number;
  nbParMetre: number;
  perteEpaisseurParFace_mm: TripletGrandeur<number>; // corrosion sur la durée de service
  // Géosynthétique : résistance par mètre de largeur et facteurs de réduction
  resistanceUltime_kNm: number;
  RF_fluage: number;
  RF_endommagement: number;
  RF_vieillissement: number;
  tauxCouverture: number; // Rc, largeur couverte par mètre de parement (m/m)
}

/** Coefficients de méthode (méthode cohérente gravitaire), modifiables, avec leur source. */
export interface CoefficientsSolRenforce {
  K0_sur_Ka: TripletGrandeur<number>; // K/Ka en tête du massif
  Kz0_sur_Ka: TripletGrandeur<number>; // K/Ka à la profondeur z0 et au-delà
  z0: TripletGrandeur<number>; // m
  Fetoile0: TripletGrandeur<number>; // coefficient de frottement apparent en tête
  FetoileZ0: TripletGrandeur<number>; // à z0 et au-delà (statut 'derive' : recalculé depuis φ')
  alpha: TripletGrandeur<number>; // coefficient d'échelle (effet de longueur)
  C: TripletGrandeur<number>; // nombre de faces frottantes (2)
  gamma_R_rupture: TripletGrandeur<number>;
  gamma_R_arrachement: TripletGrandeur<number>;
  ligne: 'bilineaire' | 'rankine'; // ligne des tractions maximales (inextensible / extensible)
}

/**
 * Massif en sol renforcé à parement vertical. Le parement est en x = xParement, le massif
 * s'étend vers les x croissants sur la longueur des armatures, le sol retenu au-delà.
 */
export interface OuvrageSolRenforce {
  id: string;
  nom: string;
  xParement: number; // m
  coteBase: number; // m, base du massif
  hauteur: number; // m, H
  encastrement: number; // m, D (terrain devant le parement à coteBase + D)
  longueurArmatures: number; // m, L
  remblai: { gamma: number; phiPrime: number }; // remblai renforcé (c' = 0)
  surchargeG: number; // kPa en tête (massif et sol retenu)
  surchargeQ: number; // kPa
  premierLit: number; // m au-dessus de la base
  espacementSv: number; // m
  armature: ArmatureSolRenforce;
  coefficients: CoefficientsSolRenforce;
}

export interface ModeleTerrain {
  schemaVersion: '1.0';
  projet: {
    nom: string;
    reference: string;
    auteur: string;
    date: string;
    commentaires: string;
  };
  referentiel: Referentiel;
  profilTerrainNaturel?: Array<{ x: number; y: number }> | null; // Polyligne de profil réel du talus
  surchargesTalus?: SurchargeTalus[]; // Surcharges sur le talus (onglet Stabilité)
  hydrogeologie: Hydrogeologie;
  couches: CoucheGeotechnique[];
  campagnes: CampagneEssai[];
  configurationNormative: ConfigurationNormative;
  ouvrages: {
    radiers: OuvrageRadier[];
    pieux: OuvragePieu[];
    soutenements: OuvrageSoutenement[];
    solsRenforces?: OuvrageSolRenforce[];
  };
}
