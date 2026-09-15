import { ModeleTerrain } from '../types/geotech';
import { CONFIG_NORMATIVE_DEFAUT } from '../norme/configNormativeDefaut';

export const PROJET_EXEMPLE_EC7: ModeleTerrain = {
  schemaVersion: '1.0',
  projet: {
    nom: 'Immeuble Le Belvédère - Étude Géotechnique G2 PRO',
    reference: 'GEO-2026-042',
    auteur: 'Ingénieur Géotechnicien Géoconsult',
    date: '2026-09-14',
    commentaires:
      "Modèle unifié de sol pour dimensionnement selon l'Eurocode 7 (EN 1997-1:2004). Bâtiment R+4 avec sous-sol partiel.",
  },
  referentiel: {
    systeme: 'NGL',
    coteTerrainNaturel: 245.30,
    coteReferenceProjet: 245.00,
  },
  hydrogeologie: {
    nappePrincipale: {
      coteCaracteristique: 242.50, // ELS
      coteDefavorableELU: 244.00, // ELU (distinct et obligatoire !)
      regime: 'hydrostatique',
    },
    gradientVertical: null,
    nappesSecondaires: [
      {
        type: 'suspendue',
        coucheId: 'C2',
        cotePiezometrique: 243.80,
      },
    ],
    poidsVolumiqueEau: 9.81,
  },
  couches: [
    {
      id: 'C1',
      nom: "Limon d'altération et remblai",
      coteToit: 245.30,
      epaisseur: 2.20,
      nature: 'limon',
      couleurAffichage: '#c2a649',
      poidsVolumiques: {
        gammaHumide: { v: 18.0, u: 'kN/m3', statut: 'mesure', source: 'Essai labo C1-01' },
        gammaSature: { v: 19.5, u: 'kN/m3', statut: 'mesure', source: 'Essai labo C1-01' },
      },
      resistanceDrainee: {
        phiPrime: { v: 28.0, u: 'deg', statut: 'mesure', source: 'Boîte Casagrande' },
        phiCritique: { v: 27.0, u: 'deg', statut: 'choix', source: 'Estimation géotechnique' },
        cPrime: { v: 4.0, u: 'kPa', statut: 'mesure', source: 'Triaxial CD' },
        psiDilatance: { v: 0.0, u: 'deg', statut: 'choix', source: 'Sol normalement consolidé' },
        deltaInterface: { v: 24.0, u: 'deg', statut: 'derive', source: 'Clause 6.5.3 (béton coulé en place)' },
      },
      resistanceNonDrainee: {
        cuTete: { v: 45.0, u: 'kPa', statut: 'mesure', source: 'Scissomètre' },
        gradientCu: { v: 1.0, u: 'kPa/m', statut: 'mesure', source: 'Sondages CPT' },
      },
      deformation: {
        Echargement: { v: 10.0, u: 'MPa', statut: 'correle', source: 'Ménard EM' },
        EdechargeRech: { v: 30.0, u: 'MPa', statut: 'correle', source: 'Règle EM x 3' },
        nu: { v: 0.30, u: '-', statut: 'choix', source: 'Pratique courante' },
        Eoed: { v: 12.0, u: 'MPa', statut: 'mesure', source: 'Œdomètre' },
        Cc: { v: 0.20, u: '-', statut: 'mesure', source: 'Essai œdométrique' },
        Cs: { v: 0.035, u: '-', statut: 'mesure', source: 'Essai œdométrique' },
        e0: { v: 0.75, u: '-', statut: 'mesure', source: 'Densité sèche initiale' },
        sigmaPrecons: { v: 90.0, u: 'kPa', statut: 'mesure', source: 'Casagrande sigma_p' },
        OCR: { v: null, u: '-', statut: 'derive', source: 'sigma_p / sigma_v0' },
        Calpha: { v: 0.003, u: '-', statut: 'choix', source: 'Sol inorganique' },
        cv: { v: 3.0e-7, u: 'm2/s', statut: 'mesure', source: 'Consolidation t50' },
        k: { v: 1.0e-8, u: 'm/s', statut: 'correle', source: 'Essai Lefranc' },
      },
    },
    {
      id: 'C2',
      nom: 'Argile limoneuse ferme',
      coteToit: 243.10,
      epaisseur: 4.20,
      nature: 'argile',
      couleurAffichage: '#8a6d3b',
      poidsVolumiques: {
        gammaHumide: { v: 19.0, u: 'kN/m3', statut: 'correle', source: 'Pénétromètre CPT-03' },
        gammaSature: { v: 20.5, u: 'kN/m3', statut: 'correle', source: 'Pénétromètre CPT-03' },
      },
      resistanceDrainee: {
        phiPrime: { v: 26.0, u: 'deg', statut: 'correle', source: 'Corrélation Robertson 2010' },
        phiCritique: { v: 24.0, u: 'deg', statut: 'choix', source: 'Norme NF P 94-261' },
        cPrime: { v: 5.0, u: 'kPa', statut: 'choix', source: 'Valeur prudente' },
        psiDilatance: { v: 0.0, u: 'deg', statut: 'choix', source: 'Argile sous nappe' },
        deltaInterface: { v: 24.0, u: 'deg', statut: 'derive', source: 'Égal à phiCritique' },
      },
      resistanceNonDrainee: {
        cuTete: { v: 65.0, u: 'kPa', statut: 'mesure', source: 'Essai triaxial CU+u' },
        gradientCu: { v: 2.5, u: 'kPa/m', statut: 'mesure', source: 'CPT qc / 15' },
      },
      deformation: {
        Echargement: { v: 14.0, u: 'MPa', statut: 'correle', source: 'Pressiomètre PMT-01' },
        EdechargeRech: { v: 42.0, u: 'MPa', statut: 'correle', source: 'Pressiomètre PMT-01' },
        nu: { v: 0.35, u: '-', statut: 'choix', source: 'Argile saturée' },
        Eoed: { v: 16.0, u: 'MPa', statut: 'correle', source: 'Corrélation alpha=0.66' },
        Cc: { v: 0.22, u: '-', statut: 'mesure', source: 'Œdomètre éprouvette 2' },
        Cs: { v: 0.04, u: '-', statut: 'mesure', source: 'Œdomètre éprouvette 2' },
        e0: { v: 0.78, u: '-', statut: 'mesure', source: 'Indice des vides initial' },
        sigmaPrecons: { v: 180.0, u: 'kPa', statut: 'mesure', source: 'Pression de préconsolidation' },
        OCR: { v: null, u: '-', statut: 'derive', source: 'Surconsolidée par érosion' },
        Calpha: { v: 0.004, u: '-', statut: 'choix', source: 'Recommandation CFMS' },
        cv: { v: 2.5e-7, u: 'm2/s', statut: 'mesure', source: 'Courbe t90' },
        k: { v: 1.0e-9, u: 'm/s', statut: 'correle', source: 'Perméamètre de triaxial' },
      },
    },
    {
      id: 'C3',
      nom: 'Sable et gravier alluvionnaire dense',
      coteToit: 238.90,
      epaisseur: 5.50,
      nature: 'sable',
      couleurAffichage: '#e09f3e',
      poidsVolumiques: {
        gammaHumide: { v: 20.0, u: 'kN/m3', statut: 'mesure', source: 'Densimètre à membrane' },
        gammaSature: { v: 21.5, u: 'kN/m3', statut: 'mesure', source: 'Densimètre à membrane' },
      },
      resistanceDrainee: {
        phiPrime: { v: 36.0, u: 'deg', statut: 'mesure', source: 'Triaxial grands diamètres' },
        phiCritique: { v: 33.0, u: 'deg', statut: 'choix', source: 'État critique sable compact' },
        cPrime: { v: 0.0, u: 'kPa', statut: 'choix', source: 'Sable propre' },
        psiDilatance: { v: 4.0, u: 'deg', statut: 'choix', source: 'Dilatance positive' },
        deltaInterface: { v: 30.0, u: 'deg', statut: 'derive', source: '2/3 phi_k' },
      },
      resistanceNonDrainee: {
        cuTete: { v: 0, u: 'kPa', statut: 'choix', source: 'Non applicable sol grenu' },
        gradientCu: { v: 0, u: 'kPa/m', statut: 'choix', source: 'Non applicable' },
      },
      deformation: {
        Echargement: { v: 65.0, u: 'MPa', statut: 'correle', source: 'CPT qc > 15 MPa' },
        EdechargeRech: { v: 180.0, u: 'MPa', statut: 'correle', source: 'Cycle pressiométrique' },
        nu: { v: 0.25, u: '-', statut: 'choix', source: 'Sable' },
        Eoed: { v: 80.0, u: 'MPa', statut: 'correle', source: 'Module sécant' },
        Cc: { v: 0.06, u: '-', statut: 'correle', source: 'Sol granulaire peu compressible' },
        Cs: { v: 0.01, u: '-', statut: 'correle', source: 'Recompression élastique' },
        e0: { v: 0.52, u: '-', statut: 'mesure', source: 'Compacité relative Id=0.75' },
        sigmaPrecons: { v: 400.0, u: 'kPa', statut: 'choix', source: 'Préchargement historique' },
        OCR: { v: null, u: '-', statut: 'derive', source: 'Élevé' },
        Calpha: { v: 0.0005, u: '-', statut: 'choix', source: 'Négligeable' },
        cv: { v: 1.0e-3, u: 'm2/s', statut: 'choix', source: 'Drainage quasi instantané' },
        k: { v: 5.0e-4, u: 'm/s', statut: 'mesure', source: 'Essai de pompage' },
      },
    },
    {
      id: 'C4',
      nom: 'Substratum marneux compact',
      coteToit: 233.40,
      epaisseur: 8.00,
      nature: 'roche',
      couleurAffichage: '#588157',
      poidsVolumiques: {
        gammaHumide: { v: 22.0, u: 'kN/m3', statut: 'mesure', source: 'Carottes de forage' },
        gammaSature: { v: 23.0, u: 'kN/m3', statut: 'mesure', source: 'Carottes de forage' },
      },
      resistanceDrainee: {
        phiPrime: { v: 32.0, u: 'deg', statut: 'mesure', source: 'Cisaillement roche' },
        phiCritique: { v: 30.0, u: 'deg', statut: 'choix', source: 'Plan de stratification' },
        cPrime: { v: 35.0, u: 'kPa', statut: 'mesure', source: 'Cohésion du substratum' },
        psiDilatance: { v: 0.0, u: 'deg', statut: 'choix', source: 'Négligée' },
        deltaInterface: { v: 28.0, u: 'deg', statut: 'derive', source: 'Béton / marne' },
      },
      resistanceNonDrainee: {
        cuTete: { v: 250.0, u: 'kPa', statut: 'mesure', source: 'Compression simple Rc/2' },
        gradientCu: { v: 10.0, u: 'kPa/m', statut: 'mesure', source: 'Gradient marneux' },
      },
      deformation: {
        Echargement: { v: 150.0, u: 'MPa', statut: 'mesure', source: 'Dilatomètre' },
        EdechargeRech: { v: 450.0, u: 'MPa', statut: 'mesure', source: 'Dilatomètre' },
        nu: { v: 0.28, u: '-', statut: 'choix', source: 'Roche tendre' },
        Eoed: { v: 200.0, u: 'MPa', statut: 'mesure', source: 'Substratum' },
        Cc: { v: 0.02, u: '-', statut: 'choix', source: 'Très faible compressibilité' },
        Cs: { v: 0.005, u: '-', statut: 'choix', source: 'Très faible compressibilité' },
        e0: { v: 0.40, u: '-', statut: 'mesure', source: 'Porosité faible' },
        sigmaPrecons: { v: 1200.0, u: 'kPa', statut: 'mesure', source: 'Très surconsolidé' },
        OCR: { v: null, u: '-', statut: 'derive', source: 'OCR > 5' },
        Calpha: { v: 0.0001, u: '-', statut: 'choix', source: 'Négligeable' },
        cv: { v: 1.0e-6, u: 'm2/s', statut: 'choix', source: 'Faible perméabilité' },
        k: { v: 1.0e-10, u: 'm/s', statut: 'mesure', source: 'Essai Lugeon' },
      },
    },
  ],
  campagnes: [
    {
      id: 'CPT-03',
      type: 'CPT',
      x: 15.0,
      y: 22.5,
      coteTete: 245.30,
      profil: [
        { z: 0.5, qc: 1.2, fs: 0.015, u2: 0.0 },
        { z: 1.0, qc: 1.5, fs: 0.02, u2: 0.0 },
        { z: 1.8, qc: 1.9, fs: 0.025, u2: 0.0 },
        { z: 2.5, qc: 2.8, fs: 0.045, u2: 25.0 },
        { z: 3.5, qc: 3.2, fs: 0.055, u2: 60.0 },
        { z: 5.0, qc: 3.8, fs: 0.065, u2: 95.0 },
        { z: 6.5, qc: 16.5, fs: 0.12, u2: 120.0 },
        { z: 8.0, qc: 22.0, fs: 0.18, u2: 135.0 },
        { z: 10.0, qc: 25.0, fs: 0.22, u2: 150.0 },
        { z: 12.5, qc: 38.0, fs: 0.35, u2: 180.0 },
      ],
    },
    {
      id: 'PMT-01',
      type: 'PMT',
      x: 12.0,
      y: 20.0,
      coteTete: 245.30,
      profil: [
        { z: 1.0, EM: 8.5, plNette: 0.85 },
        { z: 2.5, EM: 12.0, plNette: 1.15 },
        { z: 4.0, EM: 15.5, plNette: 1.40 },
        { z: 6.0, EM: 22.0, plNette: 1.85 },
        { z: 8.5, EM: 45.0, plNette: 2.80 },
        { z: 11.0, EM: 65.0, plNette: 3.50 },
      ],
    },
  ],
  configurationNormative: CONFIG_NORMATIVE_DEFAUT,
  ouvrages: {
    radiers: [
      {
        id: 'RAD-01',
        nom: 'Radier principal sous-sol R-1',
        longueurL: 18.0,
        largeurB: 12.0,
        coteBase: 242.0, // Dans l'argile ferme sous la nappe (nappe ELU=244.0, ELS=242.5)
        epaisseur: 0.60,
        actions: {
          V_G: 18000, // kN (poids bâtiment permanent)
          V_Q: 4500, // kN (charges exploitation)
          H_G: 350,
          H_Q: 150,
          M_G: 2200, // kNm
          M_Q: 900,
        },
        coteTerrainFini: 245.30,
      },
    ],
    pieux: [
      {
        id: 'PIEU-01',
        nom: 'Pieu isolé P1 (axe C-4)',
        diametre: 0.80,
        coteTete: 242.00,
        cotePointe: 236.00, // Ancré dans le sable dense (couche C3)
        modeExecution: 'fore',
        actions: {
          V_G: 1250, // kN
          V_Q: 350,
          H_G: 40,
          H_Q: 25,
        },
        frottementNegatif: {
          actif: true,
          cotePlanNeutre: 240.0,
          effortQ_sneg: 120, // kN action défavorable
        },
        groupe: {
          estGroupe: false,
          nbPieuxX: 1,
          nbPieuxY: 1,
          entraxe: 2.40,
        },
      },
      {
        id: 'PIEU-GRP',
        nom: 'Groupe de pieux 2x2 sous pile centrale',
        diametre: 0.80,
        coteTete: 242.00,
        cotePointe: 235.50,
        modeExecution: 'fore',
        actions: {
          V_G: 1100,
          V_Q: 300,
          H_G: 30,
          H_Q: 15,
        },
        frottementNegatif: {
          actif: false,
          cotePlanNeutre: 240.0,
          effortQ_sneg: 0,
        },
        groupe: {
          estGroupe: true,
          nbPieuxX: 2,
          nbPieuxY: 2,
          entraxe: 2.40,
        },
      },
    ],
    soutenements: [
      {
        id: 'MUR-01',
        nom: 'Mur de soutènement en L de rampe',
        type: 'murEnL',
        hauteurTotale: 4.50,
        coteTete: 245.30,
        coteFondFouille: 240.80,
        epaisseurVoile: 0.35,
        largeurSemelleB: 2.70,
        debordAvant: 0.60,
        ficheT: 0.80,
        surchargeQ: 10.0, // kPa (véhicules sur voirie)
        inclinaisonTerrePlein: 0.0,
        frottementDeltaSurPhi: 0.667,
        butons: [],
      },
    ],
  },
};
