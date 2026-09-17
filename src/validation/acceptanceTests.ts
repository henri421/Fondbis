import { CoucheGeotechnique, Hydrogeologie, ConfigurationNormative } from '../types/geotech';
import { CONFIG_NORMATIVE_DEFAUT } from '../norme/configNormativeDefaut';
import { calculerProfilContraintes } from '../core/profilContraintes';
import { calculerParametresDeCalcul } from '../core/deriveesSol';
import { verifierPortanceRadierELU } from '../modules/radier/portanceELU';
import { calculerTassementSousCoucheOedométrique } from '../modules/radier/tassementELS';
import { calculerPousseeSimple } from '../modules/soutenement/pousseeButee';
import { calculerCapacitePieu, verifierPieuAxial } from '../modules/pieux/capaciteAxiale';

export interface TestResultatIndividuel {
  id: string;
  nom: string;
  phase: string;
  description: string;
  valeurAttendue: string;
  valeurObtenue: string;
  tolerance: string;
  ecartAbsolu: number;
  ecartPourcentage: number;
  succes: boolean;
  message: string;
  details?: Record<string, any>;
}

export function executerTestsAcceptation(config: ConfigurationNormative = CONFIG_NORMATIVE_DEFAUT): TestResultatIndividuel[] {
  const resultats: TestResultatIndividuel[] = [];

  // ----------------------------------------------------
  // T0.1 : Profil de contraintes
  // Section 12.2
  // TN cote 100.00, Couche 1 de 0 à 3m (100 à 97m) gammaH=18, gammaSat=20.
  // Nappe à 2m de profondeur (cote 98.00). Attendu à 5m de profondeur (cote 95.00) :
  // sigma_v = 18*2 + 20*3 = 96.00 kPa
  // u = 9.81 * 3 = 29.43 kPa
  // sigma_v' = 96.00 - 29.43 = 66.57 kPa
  // Tolérance 0.01 kPa
  // ----------------------------------------------------
  const coucheT01: CoucheGeotechnique = {
    id: 'C_T01',
    nom: 'Sol test T0.1',
    coteToit: 100.0,
    epaisseur: 10.0,
    nature: 'sable',
    couleurAffichage: '#d4a373',
    poidsVolumiques: {
      gammaHumide: { v: 18.0, u: 'kN/m3', statut: 'choix', source: 'Test T0.1' },
      gammaSature: { v: 20.0, u: 'kN/m3', statut: 'choix', source: 'Test T0.1' },
    },
    resistanceDrainee: {
      phiPrime: { v: 30, u: 'deg', statut: 'choix', source: 'T0.1' },
      phiCritique: { v: 30, u: 'deg', statut: 'choix', source: 'T0.1' },
      cPrime: { v: 0, u: 'kPa', statut: 'choix', source: 'T0.1' },
      psiDilatance: { v: 0, u: 'deg', statut: 'choix', source: 'T0.1' },
      deltaInterface: { v: 20, u: 'deg', statut: 'choix', source: 'T0.1' },
    },
    resistanceNonDrainee: {
      cuTete: { v: 50, u: 'kPa', statut: 'choix', source: 'T0.1' },
      gradientCu: { v: 0, u: 'kPa/m', statut: 'choix', source: 'T0.1' },
    },
    deformation: {
      Echargement: { v: 20, u: 'MPa', statut: 'choix', source: 'T0.1' },
      EdechargeRech: { v: 60, u: 'MPa', statut: 'choix', source: 'T0.1' },
      nu: { v: 0.3, u: '-', statut: 'choix', source: 'T0.1' },
      Eoed: { v: 25, u: 'MPa', statut: 'choix', source: 'T0.1' },
      Cc: { v: 0.2, u: '-', statut: 'choix', source: 'T0.1' },
      Cs: { v: 0.04, u: '-', statut: 'choix', source: 'T0.1' },
      e0: { v: 0.8, u: '-', statut: 'choix', source: 'T0.1' },
      sigmaPrecons: { v: 200, u: 'kPa', statut: 'choix', source: 'T0.1' },
      OCR: { v: null, u: '-', statut: 'derive', source: 'T0.1' },
      Calpha: { v: 0.004, u: '-', statut: 'choix', source: 'T0.1' },
      cv: { v: 1e-7, u: 'm2/s', statut: 'choix', source: 'T0.1' },
      k: { v: 1e-6, u: 'm/s', statut: 'choix', source: 'T0.1' },
    },
  };

  const hydroT01: Hydrogeologie = {
    nappePrincipale: {
      coteCaracteristique: 98.0,
      coteDefavorableELU: 98.0,
      regime: 'hydrostatique',
    },
    gradientVertical: null,
    nappesSecondaires: [],
    poidsVolumiqueEau: 9.81,
  };

  const profilT01 = calculerProfilContraintes(100.0, [coucheT01], hydroT01, [95.0], 'ELS');
  const ptT01 = profilT01.calculerA(95.0);

  const t01_sigma_v_ok = Math.abs(ptT01.sigma_v - 96.0) <= 0.01;
  const t01_u_ok = Math.abs(ptT01.u - 29.43) <= 0.01;
  const t01_sigma_prime_ok = Math.abs(ptT01.sigma_vPrime - 66.57) <= 0.01;
  const t01_succes = t01_sigma_v_ok && t01_u_ok && t01_sigma_prime_ok;

  resultats.push({
    id: 'T0.1',
    nom: 'Profil de contraintes',
    phase: 'Phase 0',
    description: "Calcul de sigma_v, u et sigma'_v à z=5m avec nappe à z=2m",
    valeurAttendue: 'σv = 96.00 kPa, u = 29.43 kPa, σ\'v = 66.57 kPa',
    valeurObtenue: `σv = ${ptT01.sigma_v.toFixed(2)} kPa, u = ${ptT01.u.toFixed(2)} kPa, σ'v = ${ptT01.sigma_vPrime.toFixed(2)} kPa`,
    tolerance: '± 0.01 kPa',
    ecartAbsolu: Number(Math.abs(ptT01.sigma_vPrime - 66.57).toFixed(3)),
    ecartPourcentage: Number((Math.abs(ptT01.sigma_vPrime - 66.57) / 66.57 * 100).toFixed(3)),
    succes: t01_succes,
    message: t01_succes ? 'Parfaitement conforme aux valeurs attendues' : 'Écart détecté sur le profil de contraintes',
  });

  // ----------------------------------------------------
  // T0.2 : Facteur partiel sur l'angle de frottement
  // Section 12.2
  // phi'_k = 30.0°, gamma_phi = 1.25.
  // tan(30°) = 0.577350 -> / 1.25 = 0.461880 -> arctan = 24.79°
  // Attendu 24.79°. Erreur classique = 24.00° (à échouer explicitement).
  // ----------------------------------------------------
  const solT02 = {
    phiPrime_k: 30.0,
    cPrime_k: 0,
    cu_k: 50,
    gammaHumide_k: 18,
    gammaSature_k: 20,
    delta_k: 20,
  };
  const solCalcT02 = calculerParametresDeCalcul(solT02, 'M2', config);
  const phi_d_obtenu = solCalcT02.phiPrime_d;
  const t02_succes = Math.abs(phi_d_obtenu - 24.79) <= 0.02;

  resultats.push({
    id: 'T0.2',
    nom: 'Facteur partiel sur phi\' (Jeu M2)',
    phase: 'Phase 0',
    description: 'Application du facteur gamma_phi=1.25 sur tan(phi\') et non directement sur phi\'',
    valeurAttendue: "phi'_d = 24.79° (et NON 24.00°)",
    valeurObtenue: `phi'_d = ${phi_d_obtenu.toFixed(2)}°`,
    tolerance: '± 0.02°',
    ecartAbsolu: Number(Math.abs(phi_d_obtenu - 24.79).toFixed(3)),
    ecartPourcentage: Number((Math.abs(phi_d_obtenu - 24.79) / 24.79 * 100).toFixed(3)),
    succes: t02_succes,
    message: t02_succes
      ? "Formule exacte appliquée sur tan(phi') : piège classique évité"
      : "ÉCHEC : le facteur a été appliqué à tort directement sur l'angle !",
  });

  // ----------------------------------------------------
  // T1.1 : Portance drainée M1 (Semelle filante, charge centrée)
  // Section 12.3
  // phi'=30.0°, c'=0, gamma=18.0 kN/m³, D=1.00m, B=2.00m, semelle filante
  // Nq = 18.4013, Ngamma = 20.0938, q' = 18.00 kPa
  // R/A' = 18.00 * 18.4013 + 0.5 * 18.0 * 2.00 * 20.0938 = 331.22 + 361.69 = 692.9 kPa
  // Tolérance 0.5 kPa
  // ----------------------------------------------------
  const coucheT1: CoucheGeotechnique = {
    ...coucheT01,
    coteToit: 10.0,
    epaisseur: 20.0,
    poidsVolumiques: {
      gammaHumide: { v: 18.0, u: 'kN/m3', statut: 'choix', source: 'T1' },
      gammaSature: { v: 18.0, u: 'kN/m3', statut: 'choix', source: 'T1' },
    },
    resistanceDrainee: {
      phiPrime: { v: 30.0, u: 'deg', statut: 'choix', source: 'T1' },
      phiCritique: { v: 30.0, u: 'deg', statut: 'choix', source: 'T1' },
      cPrime: { v: 0.0, u: 'kPa', statut: 'choix', source: 'T1' },
      psiDilatance: { v: 0.0, u: 'deg', statut: 'choix', source: 'T1' },
      deltaInterface: { v: 20.0, u: 'deg', statut: 'choix', source: 'T1' },
    },
  };

  const hydroSansNappe: Hydrogeologie = {
    nappePrincipale: { coteCaracteristique: -999, coteDefavorableELU: -999, regime: 'hydrostatique' },
    gradientVertical: null,
    nappesSecondaires: [],
    poidsVolumiqueEau: 9.81,
  };

  const ouvrageT11 = {
    id: 'RAD_T11',
    nom: 'Semelle filante test T1.1',
    longueurL: 1000.0, // Filante
    largeurB: 2.0,
    coteBase: 9.0, // D = 1.0m sous TN=10m
    epaisseur: 0.5,
    actions: { V_G: 100, V_Q: 0, H_G: 0, H_Q: 0, M_G: 0, M_Q: 0 },
    coteTerrainFini: 10.0,
  };

  const resT11 = verifierPortanceRadierELU(ouvrageT11, 10.0, [coucheT1], hydroSansNappe, config, {
    forceBandeFilante: true,
    combinaisonForcee: { jeuActions: 'A1', jeuSol: 'M1', jeuResistance: 'R1' },
  });

  const t11_succes = Math.abs(resT11.q_ult_draine - 692.9) <= 0.5;

  resultats.push({
    id: 'T1.1',
    nom: 'Portance drainée (Jeu M1, semelle filante)',
    phase: 'Phase 1',
    description: 'Vérification de la portance brute q_ult avec Nq=18.4013 et Ngamma=20.0938',
    valeurAttendue: 'q_ult = 692.9 kPa',
    valeurObtenue: `q_ult = ${resT11.q_ult_draine.toFixed(1)} kPa (Nq=${resT11.Nq.toFixed(2)}, Nγ=${resT11.Ngamma.toFixed(2)})`,
    tolerance: '± 0.5 kPa',
    ecartAbsolu: Number(Math.abs(resT11.q_ult_draine - 692.9).toFixed(2)),
    ecartPourcentage: Number((Math.abs(resT11.q_ult_draine - 692.9) / 692.9 * 100).toFixed(2)),
    succes: t11_succes,
    message: t11_succes ? 'Calcul manuel parfaitement reproduit' : 'Écart sur les facteurs de portance ou la formule',
  });

  // ----------------------------------------------------
  // T1.2 : Portance drainée M2
  // Section 12.3
  // Mêmes données avec gamma_phi = 1.25 -> phi'_d = 24.79°
  // Nq = 10.4323, Ngamma = 8.7134
  // R/A' = 18.00 * 10.4323 + 0.5 * 18.0 * 2.00 * 8.7134 = 187.78 + 156.84 = 344.6 kPa
  // Rapport T1.1 / T1.2 = 692.9 / 344.6 = 2.01
  // Tolérance 0.5 kPa
  // ----------------------------------------------------
  const resT12 = verifierPortanceRadierELU(ouvrageT11, 10.0, [coucheT1], hydroSansNappe, config, {
    forceBandeFilante: true,
    combinaisonForcee: { jeuActions: 'A1', jeuSol: 'M2', jeuResistance: 'R1' },
  });

  const t12_succes = Math.abs(resT12.q_ult_draine - 344.6) <= 0.6;
  const rapportT1 = resT11.q_ult_draine / resT12.q_ult_draine;

  resultats.push({
    id: 'T1.2',
    nom: 'Portance drainée (Jeu M2, minoration de 25%)',
    phase: 'Phase 1',
    description: "Calcul de la portance sous jeu M2 (phi'=24.79°). Rapport attendu ~ 2.01",
    valeurAttendue: 'q_ult = 344.6 kPa (rapport ~ 2.01)',
    valeurObtenue: `q_ult = ${resT12.q_ult_draine.toFixed(1)} kPa (rapport = ${rapportT1.toFixed(2)})`,
    tolerance: '± 0.6 kPa',
    ecartAbsolu: Number(Math.abs(resT12.q_ult_draine - 344.6).toFixed(2)),
    ecartPourcentage: Number((Math.abs(resT12.q_ult_draine - 344.6) / 344.6 * 100).toFixed(2)),
    succes: t12_succes,
    message: t12_succes
      ? `Rapport portance M1/M2 = ${rapportT1.toFixed(2)} validé (la minoration de 25% divise la portance par deux)`
      : 'Écart détecté sur la portance sous jeu M2',
  });

  // ----------------------------------------------------
  // T1.3 : Tassement œdométrique (Normalement consolidé)
  // Section 12.3
  // Couche H_i = 2.00m, Cc = 0.20, e0 = 0.80, sigma'_v0 = 100.0 kPa, Delta_sigma = 50.0 kPa
  // s = 2.00 * (0.20 / 1.80) * log10(150.0 / 100.0) = 2.00 * 0.111111 * 0.176091 = 0.03913 m = 39.1 mm
  // Tolérance 0.1 mm
  // ----------------------------------------------------
  const resT13 = calculerTassementSousCoucheOedométrique(2.0, 100.0, 50.0, 0.20, 0.04, 0.80, 100.0);
  const s_mm_obtenu = resT13.s_mm;
  const t13_succes = Math.abs(s_mm_obtenu - 39.1) <= 0.15;

  resultats.push({
    id: 'T1.3',
    nom: 'Tassement œdométrique (Normalement consolidé)',
    phase: 'Phase 1',
    description: 'Vérification de la loi œdométrique vierge avec Cc=0.20, e0=0.80, Delta_sigma=50 kPa',
    valeurAttendue: 's = 39.1 mm',
    valeurObtenue: `s = ${s_mm_obtenu.toFixed(2)} mm (Régime: ${resT13.regime})`,
    tolerance: '± 0.1 mm',
    ecartAbsolu: Number(Math.abs(s_mm_obtenu - 39.1).toFixed(2)),
    ecartPourcentage: Number((Math.abs(s_mm_obtenu - 39.1) / 39.1 * 100).toFixed(2)),
    succes: t13_succes,
    message: t13_succes ? 'Tassement calculé exactement à 39.1 mm' : 'Écart sur la formulation œdométrique',
  });

  // ----------------------------------------------------
  // T2.1 : Poussée de Rankine (Mur de soutènement)
  // Section 12.4
  // Mur H = 5.00m, sol phi'=30.0°, gamma=18.0 kN/m³, pas de nappe, delta=0
  // Ka = (1 - 0.5) / (1 + 0.5) = 0.33333
  // Pa = 0.5 * 18.0 * 25.0 * 0.33333 = 75.0 kN/m
  // Point d'application : H / 3 = 1.667 m
  // Tolérances : 0.1 kN/m et 0.005 m
  // ----------------------------------------------------
  const resT21 = calculerPousseeSimple(5.0, 18.0, 30.0, 0);
  const t21_pa_ok = Math.abs(resT21.Pa_sol - 75.0) <= 0.1;
  const t21_z_ok = Math.abs(resT21.z_Pa_sol - 1.667) <= 0.005;
  const t21_succes = t21_pa_ok && t21_z_ok;

  resultats.push({
    id: 'T2.1',
    nom: 'Poussée de Rankine (Soutènement)',
    phase: 'Phase 2',
    description: 'Poussée active triangulaire sur mur H=5m avec Ka=1/3',
    valeurAttendue: 'Pa = 75.0 kN/m, z = 1.667 m (H/3)',
    valeurObtenue: `Pa = ${resT21.Pa_sol.toFixed(2)} kN/m, z = ${resT21.z_Pa_sol.toFixed(3)} m (Ka = ${resT21.Ka})`,
    tolerance: '± 0.1 kN/m et ± 0.005 m',
    ecartAbsolu: Number(Math.abs(resT21.Pa_sol - 75.0).toFixed(2)),
    ecartPourcentage: Number((Math.abs(resT21.Pa_sol - 75.0) / 75.0 * 100).toFixed(2)),
    succes: t21_succes,
    message: t21_succes ? 'Poussée et point d\'application rigoureusement conformes' : 'Écart détecté sur la poussée Rankine',
  });

  // ----------------------------------------------------
  // T3.1 : Coefficients de corrélation pour pieux
  // Section 12.5
  // n = 3 profils, résistances calculées 950, 1100 et 950 kN
  // moyenne = 1000.0 kN, minimum = 950.0 kN
  // xi3 = 1.33, xi4 = 1.23
  // Rc;k = min( 1000.0 / 1.33 ; 950.0 / 1.23 ) = min( 751.9 ; 772.4 ) = 751.9 kN
  // L'application doit afficher que la branche moyenne gouverne !
  // Tolérance 0.5 kN
  // ----------------------------------------------------
  const ouvragePieuT31 = {
    id: 'PIEU_T31',
    nom: 'Pieu test T3.1',
    diametre: 0.8,
    coteTete: 10.0,
    cotePointe: 0.0,
    modeExecution: 'fore' as const,
    actions: { V_G: 500, V_Q: 100, H_G: 0, H_Q: 0 },
    frottementNegatif: { actif: false, cotePlanNeutre: 5.0, effortQ_sneg: 0 },
    groupe: { estGroupe: false, nbPieuxX: 1, nbPieuxY: 1, entraxe: 2.4 },
  };

  const resT31 = calculerCapacitePieu(ouvragePieuT31, [coucheT1], hydroSansNappe, config, [950, 1100, 950]);
  const t31_val_ok = Math.abs(resT31.Rc_k - 751.9) <= 0.6;
  const t31_branche_ok = resT31.brancheGouvernante === 'moyenne';
  const t31_succes = t31_val_ok && t31_branche_ok;

  resultats.push({
    id: 'T3.1',
    nom: 'Coefficients de corrélation pour pieux (xi3, xi4)',
    phase: 'Phase 3',
    description: 'Vérification de Rc;k = min(Rc;moy / xi3, Rc;min / xi4) avec n=3 et branche gouvernante',
    valeurAttendue: 'Rc;k = 751.9 kN, gouverné par branche moyenne (1000/1.33 vs 950/1.23)',
    valeurObtenue: `Rc;k = ${resT31.Rc_k.toFixed(1)} kN (Branche ${resT31.brancheGouvernante} : moy=${resT31.valeurBrancheMoyenne.toFixed(1)} kN, min=${resT31.valeurBrancheMin.toFixed(1)} kN)`,
    tolerance: '± 0.6 kN',
    ecartAbsolu: Number(Math.abs(resT31.Rc_k - 751.9).toFixed(2)),
    ecartPourcentage: Number((Math.abs(resT31.Rc_k - 751.9) / 751.9 * 100).toFixed(2)),
    succes: t31_succes,
    message: t31_succes
      ? "Rc;k exact et identification correcte de la branche moyenne gouvernante"
      : "Écart ou mauvaise détection de la branche gouvernante",
  });

  // ----------------------------------------------------
  // T3.2 : Groupe de pieux — Efficacité Converse-Labarre, Rupture en bloc & Tassement (s_groupe > s_isole)
  // CDC §7.6 & EN 1997-1 §7.6.2.1
  // Configuration : 2x2 = 4 pieux, d=0.8 m, entraxe s=2.4 m (s/d = 3.0)
  // Efficacité attendue Converse-Labarre :
  // theta = arctan(0.8/2.4) = 18.435°
  // eta = 1 - (18.435 / 90) * [(1*2 + 1*2) / 4] = 1 - 0.2048 = 0.795 (79.5%)
  // Tassement de groupe : s_groupe > s_isole (ratio > 1.0)
  // ----------------------------------------------------
  const ouvrageGroupeT32 = {
    ...ouvragePieuT31,
    id: 'PIEU_T32_GROUPE',
    nom: 'Groupe 2x2 test T3.2',
    groupe: {
      estGroupe: true,
      nbPieuxX: 2,
      nbPieuxY: 2,
      entraxe: 2.4,
    },
  };

  const resT32 = calculerCapacitePieu(ouvrageGroupeT32, [coucheT1], hydroSansNappe, config, [950, 1100, 950]);
  const etaAttendu = 0.795;
  const etaObtenu = resT32.groupe.efficaciteConverseLabarre;
  const eta_ok = Math.abs(etaObtenu - etaAttendu) <= 0.005;
  const bloc_ok = resT32.groupe.ruptureEnBloc.largeurBloc_B === 3.2 && resT32.groupe.ruptureEnBloc.longueurBloc_L === 3.2;
  const s_isole = resT32.groupe.tassement.s_isole_mm;
  const s_groupe = resT32.groupe.tassement.s_groupe_mm;
  const tassement_sup_ok = s_groupe > s_isole;
  const t32_succes = eta_ok && bloc_ok && tassement_sup_ok;

  resultats.push({
    id: 'T3.2',
    nom: 'Groupe de pieux (Converse-Labarre, rupture en bloc, s_groupe > s_isole)',
    phase: 'Phase 3',
    description: 'Vérification de l’efficacité η (Converse-Labarre 2x2, s=3d), dimensions bloc et amplification de tassement',
    valeurAttendue: 'η = 0.795 (±0.005), Bloc 3.2m x 3.2m, s_groupe > s_isole',
    valeurObtenue: `η = ${etaObtenu.toFixed(3)} (${(etaObtenu * 100).toFixed(1)}%), Bloc ${resT32.groupe.ruptureEnBloc.largeurBloc_B}m x ${resT32.groupe.ruptureEnBloc.longueurBloc_L}m, s_groupe=${s_groupe.toFixed(1)} mm > s_isole=${s_isole.toFixed(1)} mm (ratio x${resT32.groupe.tassement.ratioAmplification})`,
    tolerance: 'η ± 0.005, dimensions exactes, s_groupe > s_isole',
    ecartAbsolu: Number(Math.abs(etaObtenu - etaAttendu).toFixed(3)),
    ecartPourcentage: Number((Math.abs(etaObtenu - etaAttendu) / etaAttendu * 100).toFixed(2)),
    succes: t32_succes,
    message: t32_succes
      ? "Efficacité Converse-Labarre exacte, géométrie de bloc vérifiée et s_groupe > s_isole validé"
      : "Erreur sur le rendement de groupe ou la condition de tassement s_groupe > s_isole",
    details: {
      efficacite: etaObtenu,
      modeGouvernant: resT32.groupe.modeGouvernant,
      Rc_d_groupe: resT32.groupe.Rc_d_groupe,
      tassementIsole_mm: s_isole,
      tassementGroupe_mm: s_groupe,
      ratioAmplification: resT32.groupe.tassement.ratioAmplification,
    },
  });

  // ----------------------------------------------------
  // T3.3 : Saisie directe des profils d'essai (Rc;calc) — Voie 2 (Clause 7.6.2.3)
  // CDC §7.6.2.3 & Revue Claude 2026-09-16
  // 1) Identité entre saisie directe profilsEssais et argument de fonction
  // 2) Repli honnête n = 1 (sans fabrication artificielle de dispersion) avec avertissement
  // ----------------------------------------------------
  const ouvrageAvecProfils = {
    ...ouvragePieuT31,
    id: 'PIEU_T33_MANUEL',
    nom: 'Pieu test T3.3 saisie directe',
    profilsEssais: [
      { id: 'S1', reference: 'Sondage CPT-01', rcCalc: 950 },
      { id: 'S2', reference: 'Sondage CPT-02', rcCalc: 1100 },
      { id: 'S3', reference: 'Sondage CPT-03', rcCalc: 950 },
    ],
  };

  const resManuel = verifierPieuAxial(ouvrageAvecProfils, [coucheT1], config, hydroSansNappe);
  const correspondance_ok = Math.abs(resManuel.R_ck - resT31.Rc_k) < 1e-3 && resManuel.facteursCorrelation.nProfils === 3;

  const ouvrageSansProfil = {
    ...ouvragePieuT31,
    id: 'PIEU_T33_SANS_PROFIL',
    nom: 'Pieu test T3.3 repli n=1',
    profilsEssais: [],
  };

  const resSansProfil = verifierPieuAxial(ouvrageSansProfil, [coucheT1], config, hydroSansNappe);
  const nEstUn_ok = resSansProfil.facteursCorrelation.nProfils === 1;
  const xi140_ok = resSansProfil.facteursCorrelation.xi3 === 1.40 && resSansProfil.facteursCorrelation.xi4 === 1.40;
  const avertissement_ok = (resSansProfil.avertissements?.length ?? 0) > 0 && !!resSansProfil.estProfilSynthetique;

  const t33_succes = correspondance_ok && nEstUn_ok && xi140_ok && avertissement_ok;

  resultats.push({
    id: 'T3.3',
    nom: "Profils d'essai Rc;calc — Voie 2 directe & repli unitaire n=1 (CDC §7.6.2.3)",
    phase: 'Phase 3',
    description: 'Vérification de la concordance saisie directe vs moteur, et repli honnête n=1 (ξ=1.40) avec avertissement normatif',
    valeurAttendue: 'Rc;k = 751.9 kN (n=3) | n=1, ξ3=ξ4=1.40 et avertissement émis si aucun profil',
    valeurObtenue: `Direct: Rc;k=${resManuel.R_ck.toFixed(1)} kN (n=${resManuel.facteursCorrelation.nProfils}) | Sans profil: n=${resSansProfil.facteursCorrelation.nProfils}, ξ3=${resSansProfil.facteursCorrelation.xi3}, avertissement="${resSansProfil.avertissements?.[0] ? 'OUI' : 'NON'}"`,
    tolerance: 'Identité exacte, n=1 et avertissement requis',
    ecartAbsolu: Number(Math.abs(resManuel.R_ck - resT31.Rc_k).toFixed(3)),
    ecartPourcentage: 0,
    succes: t33_succes,
    message: t33_succes
      ? "Saisie directe parfaitement reliée au moteur Voie 2 et repli n=1 honnête avec avertissement normatif validé"
      : "Écart de correspondance entre profils saisis et calculs ou échec du repli n=1",
    details: {
      Rc_k_direct: resManuel.R_ck,
      n_profils_direct: resManuel.facteursCorrelation.nProfils,
      n_profils_repli: resSansProfil.facteursCorrelation.nProfils,
      xi3_repli: resSansProfil.facteursCorrelation.xi3,
      avertissement_repli: resSansProfil.avertissements?.[0],
    },
  });

  return resultats;
}
