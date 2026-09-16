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
    R1: { gamma_Rv: number; gamma_Rh: number; gamma_Rb: number; gamma_Rs: number };
    R2: { gamma_Rv: number; gamma_Rh: number; gamma_Rb: number; gamma_Rs: number };
    R3: { gamma_Rv: number; gamma_Rh: number; gamma_Rb: number; gamma_Rs: number };
    R4: { gamma_Rv: number; gamma_Rh: number; gamma_Rb: number; gamma_Rs: number };
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
  hydrogeologie: Hydrogeologie;
  couches: CoucheGeotechnique[];
  campagnes: CampagneEssai[];
  configurationNormative: ConfigurationNormative;
  ouvrages: {
    radiers: OuvrageRadier[];
    pieux: OuvragePieu[];
    soutenements: OuvrageSoutenement[];
  };
}
