import { ConfigurationNormative } from '../types/geotech';

export const CONFIG_NORMATIVE_DEFAUT: ConfigurationNormative = {
  identifiant: 'EC7-2004-valeurs-recommandees',
  libelle: 'EN 1997-1:2004, Annexe A, Valeurs recommandées',
  annexeNationale: null,
  approcheCalcul: 'DA2',
  facteursActions: {
    A1: {
      gamma_G_dst: 1.35,
      gamma_G_stb: 1.00,
      gamma_Q_dst: 1.50,
      gamma_Q_stb: 0.00,
    },
    A2: {
      gamma_G_dst: 1.00,
      gamma_G_stb: 1.00,
      gamma_Q_dst: 1.30,
      gamma_Q_stb: 0.00,
    },
  },
  facteursSol: {
    M1: {
      gamma_phi: 1.00,
      gamma_c: 1.00,
      gamma_cu: 1.00,
      gamma_qu: 1.00,
      gamma_gamma: 1.00,
    },
    M2: {
      gamma_phi: 1.25, // Appliqué à tan(phi'), jamais directement à phi' !
      gamma_c: 1.25,
      gamma_cu: 1.40,
      gamma_qu: 1.40,
      gamma_gamma: 1.00,
    },
  },
  facteursResistance: {
    // gamma_Re : talus et stabilité générale, tableau A.14
    R1: { gamma_Rv: 1.00, gamma_Rh: 1.00, gamma_Rb: 1.00, gamma_Rs: 1.00, gamma_Re: 1.00 },
    R2: { gamma_Rv: 1.40, gamma_Rh: 1.10, gamma_Rb: 1.10, gamma_Rs: 1.10, gamma_Re: 1.10 },
    R3: { gamma_Rv: 1.00, gamma_Rh: 1.00, gamma_Rb: 1.00, gamma_Rs: 1.00, gamma_Re: 1.00 },
    R4: { gamma_Rv: 1.40, gamma_Rh: 1.10, gamma_Rb: 1.45, gamma_Rs: 1.30 },
  },
  coefficientsCorrelationPieux: {
    tableXi: [
      { n: 1, xi3: 1.40, xi4: 1.40 },
      { n: 2, xi3: 1.35, xi4: 1.27 },
      { n: 3, xi3: 1.33, xi4: 1.23 },
      { n: 4, xi3: 1.31, xi4: 1.20 },
      { n: 5, xi3: 1.29, xi4: 1.15 },
      { n: 7, xi3: 1.27, xi4: 1.11 },
      { n: 10, xi3: 1.25, xi4: 1.08 },
    ],
  },
};
