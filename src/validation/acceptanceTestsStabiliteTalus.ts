import { TestResultatIndividuel } from './acceptanceTests';
import {
  analyserCercleBishop,
  calculerBishopPourCercle,
  CombinaisonStabilite,
  COMBINAISON_CARACTERISTIQUE,
  combinaisonsStabilite,
  rechercherCercleCritique,
} from '../briques/stabiliteGenerale';
import { CONFIG_NORMATIVE_DEFAUT } from '../norme/configNormativeDefaut';
import { CoucheGeotechnique, Hydrogeologie, SurchargeTalus, TripletGrandeur } from '../types/geotech';

/**
 * Tests de l'étape 1 (talus chargé) — valeurs attendues calculées indépendamment
 * (formes fermées), jamais recopiées d'une sortie du programme.
 */

const t = (v: number, u = ''): TripletGrandeur<number> => ({ v, u, statut: 'mesure', source: 'test' });

export function coucheTest(
  coteToit: number,
  epaisseur: number,
  gammaH: number,
  gammaSat: number,
  phi: number,
  c: number
): CoucheGeotechnique {
  return {
    id: 'C' + coteToit,
    nom: 'Couche test',
    coteToit,
    epaisseur,
    nature: 'sable',
    couleurAffichage: '#c2b280',
    poidsVolumiques: { gammaHumide: t(gammaH, 'kN/m³'), gammaSature: t(gammaSat, 'kN/m³') },
    resistanceDrainee: {
      phiPrime: t(phi, '°'),
      phiCritique: t(phi, '°'),
      cPrime: t(c, 'kPa'),
      psiDilatance: t(0, '°'),
      deltaInterface: t((2 * phi) / 3, '°'),
    },
    resistanceNonDrainee: { cuTete: t(0), gradientCu: t(0) },
    deformation: {
      Echargement: t(20),
      EdechargeRech: t(60),
      nu: t(0.3),
      Eoed: t(25),
      Cc: t(0),
      Cs: t(0),
      e0: t(0.6),
      sigmaPrecons: t(0),
      OCR: { v: null, u: '', statut: 'defaut', source: 'test' },
      Calpha: t(0),
      cv: t(1e-7),
      k: t(1e-5),
    },
  };
}

export const hydroCote = (cote: number): Hydrogeologie => ({
  nappePrincipale: { coteCaracteristique: cote, coteDefavorableELU: cote, regime: 'hydrostatique' },
  gradientVertical: null,
  nappesSecondaires: [],
  poidsVolumiqueEau: 9.81,
});

const ecartPct = (obtenu: number, attendu: number) => (Math.abs(obtenu - attendu) / Math.abs(attendu)) * 100;

export function executerTestsStabiliteTalus(): TestResultatIndividuel[] {
  const res: TestResultatIndividuel[] = [];
  const ajouter = (
    id: string,
    nom: string,
    description: string,
    attendu: number,
    obtenu: number,
    tolerancePct: number,
    unite = ''
  ) => {
    const e = Number.isFinite(obtenu) ? ecartPct(obtenu, attendu) : Infinity;
    const succes = e <= tolerancePct;
    res.push({
      id,
      nom,
      phase: 'Talus chargé',
      description,
      valeurAttendue: `${attendu.toFixed(4)} ${unite}`.trim(),
      valeurObtenue: `${obtenu.toFixed(4)} ${unite}`.trim(),
      tolerance: `${tolerancePct} %`,
      ecartAbsolu: Math.abs(obtenu - attendu),
      ecartPourcentage: e,
      succes,
      message: succes ? `Écart ${e.toFixed(3)} %` : `Écart ${e.toFixed(3)} % > ${tolerancePct} %`,
    });
  };

  // ---------------------------------------------------------------------------
  // Cas A : sol purement cohérent (φ' = 0, c' = 20 kPa), terrain horizontal y = 0,
  // cercle centre (0 ; 5), R = 10. Le poids du sol est symétrique : moment nul.
  // Bande q = 50 kPa sur [0 ; 6] : moment moteur q·a²/2 = 900 kNm/m.
  // Moment résistant c·R·(2θ)·R avec θ = acos(5/10) = 60°.
  // ---------------------------------------------------------------------------
  const profilPlat = [
    { x: -30, y: 0 },
    { x: 30, y: 0 },
  ];
  const couchesA = [coucheTest(0, 40, 18, 20, 0, 20)];
  const sec = hydroCote(-99);
  const cercleA = { centreX: 0, centreY: 5, rayon: 10 };
  const bandeG: SurchargeTalus = { id: 'g', nom: 'G', xDebut: 0, xFin: 6, q: 50, nature: 'G' };
  const theta = Math.acos(5 / 10);
  const M_res = 20 * 10 * (2 * theta) * 10;
  const M_mot = (50 * 6 * 6) / 2;
  const F_A = M_res / M_mot;

  const rA = analyserCercleBishop({
    cercle: cercleA,
    profilTN: profilPlat,
    couches: couchesA,
    hydrogeologie: sec,
    combinaison: COMBINAISON_CARACTERISTIQUE,
    surcharges: [bandeG],
    nbTranches: 200,
  });
  ajouter(
    'T_STAB.3',
    'Bande sur sol cohérent : F = c·R²·2θ / (q·a²/2)',
    'φ = 0, terrain horizontal, bande permanente d’un seul côté du centre (forme fermée)',
    F_A,
    rA.valide ? rA.F : NaN,
    0.5
  );

  // ---------------------------------------------------------------------------
  // T_STAB.4 : γ saturé sous la nappe et pression interstitielle à la base.
  // Terrain y = 0, nappe à −2, γh = 18, γsat = 20 : poids par m² = 18·2 + 20·(h − 2).
  // ---------------------------------------------------------------------------
  const couchesB = [coucheTest(0, 40, 18, 20, 30, 5)];
  const rB = analyserCercleBishop({
    cercle: { centreX: 0, centreY: 10, rayon: 15 },
    profilTN: profilPlat,
    couches: couchesB,
    hydrogeologie: hydroCote(-2),
    combinaison: COMBINAISON_CARACTERISTIQUE,
    surcharges: [{ id: 'g', nom: 'G', xDebut: 0, xFin: 8, q: 30, nature: 'G' }],
    nbTranches: 41,
  });
  if (rB.valide) {
    const tr = rB.tranches[20];
    const h = tr.ySol - tr.yBase;
    ajouter(
      'T_STAB.4a',
      'Poids de tranche avec γ saturé sous la nappe',
      'W/b = γh·2 + γsat·(h − 2) pour la tranche centrale',
      18 * 2 + 20 * (h - 2),
      tr.poidsSol / tr.largeur,
      1e-6,
      'kPa'
    );
    ajouter(
      'T_STAB.4b',
      'Pression interstitielle à la base',
      'u = γw·(−2 − y_base)',
      9.81 * (-2 - tr.yBase),
      tr.pression_u,
      1e-6,
      'kPa'
    );
  } else {
    ajouter('T_STAB.4a', 'Poids de tranche avec γ saturé sous la nappe', 'motif' in rB ? rB.motif : '', 1, NaN, 0);
  }

  // ---------------------------------------------------------------------------
  // T_STAB.5 : DA2 (facteurs sur les effets) avec φ = 0 : F_d = F_k / γG exactement.
  // T_STAB.9 : DA3 (facteurs sur les actions) avec une bande variable :
  //            F_d = (c/γc)·R²·2θ / (γQ·q·a²/2).
  // ---------------------------------------------------------------------------
  const da2 = combinaisonsStabilite({ ...CONFIG_NORMATIVE_DEFAUT, approcheCalcul: 'DA2' }, 1.5).find(
    (c) => c.id === 'DA2'
  ) as CombinaisonStabilite;
  const rDA2 = analyserCercleBishop({
    cercle: cercleA,
    profilTN: profilPlat,
    couches: couchesA,
    hydrogeologie: sec,
    combinaison: da2,
    surcharges: [bandeG],
    nbTranches: 200,
  });
  ajouter(
    'T_STAB.5',
    'DA2 sur les effets : F_d = F_k / 1,35',
    'φ = 0 (m_α indépendant de F) : le facteur sur le moment moteur se reporte exactement sur F',
    (rA.valide ? rA.F : NaN) / 1.35,
    rDA2.valide ? rDA2.F : NaN,
    1e-6
  );
  ajouter(
    'T_STAB.5b',
    'DA2 : taux = γR;e / F_d avec γR;e = 1,1 (tableau A.14)',
    'Taux de travail de la combinaison DA2',
    1.1 / ((rA.valide ? rA.F : NaN) / 1.35),
    rDA2.valide ? rDA2.taux : NaN,
    1e-6
  );

  const da3 = combinaisonsStabilite({ ...CONFIG_NORMATIVE_DEFAUT, approcheCalcul: 'DA3' }, 1.5).find(
    (c) => c.id === 'DA3'
  ) as CombinaisonStabilite;
  const bandeQ: SurchargeTalus = { ...bandeG, id: 'q', nature: 'Q' };
  const rDA3 = analyserCercleBishop({
    cercle: cercleA,
    profilTN: profilPlat,
    couches: couchesA,
    hydrogeologie: sec,
    combinaison: da3,
    surcharges: [bandeQ],
    nbTranches: 200,
  });
  ajouter(
    'T_STAB.9',
    'DA3 sur les actions : F_d = (c/1,25)·R²·2θ / (1,3·q·a²/2)',
    'Bande variable, A2 (γQ = 1,3) et M2 (γc = 1,25), forme fermée',
    (20 / 1.25) * 10 * (2 * theta) * 10 / (1.3 * M_mot),
    rDA3.valide ? rDA3.F : NaN,
    0.5
  );

  // ---------------------------------------------------------------------------
  // T_STAB.6 : une surcharge variable placée du côté stabilisant est ignorée (γQ;stb = 0).
  // ---------------------------------------------------------------------------
  const rQstb = analyserCercleBishop({
    cercle: cercleA,
    profilTN: profilPlat,
    couches: couchesA,
    hydrogeologie: sec,
    combinaison: COMBINAISON_CARACTERISTIQUE,
    surcharges: [bandeG, { id: 'q2', nom: 'Q stab', xDebut: -6, xFin: 0, q: 40, nature: 'Q' }],
    nbTranches: 200,
  });
  ajouter(
    'T_STAB.6',
    'Surcharge variable stabilisante ignorée',
    'Même F qu’avec la seule bande permanente',
    rA.valide ? rA.F : NaN,
    rQstb.valide ? rQstb.F : NaN,
    1e-9
  );

  // ---------------------------------------------------------------------------
  // T_STAB.7 : talus sableux sec (β = atan(1/2), φ' = 35°, c' = 0). Le cercle critique est
  // superficiel : F tend vers la pente infinie tan φ' / tan β = 1,4004 par valeurs
  // supérieures. La recherche doit s'en approcher à 3 % près.
  // ---------------------------------------------------------------------------
  const profilTalus = [
    { x: -20, y: 10 },
    { x: 0, y: 10 },
    { x: 20, y: 0 },
    { x: 40, y: 0 },
  ];
  const couchesC = [coucheTest(10, 40, 19, 20, 35, 0)];
  const recherche = rechercherCercleCritique({
    profilTN: profilTalus,
    couches: couchesC,
    hydrogeologie: sec,
    combinaison: COMBINAISON_CARACTERISTIQUE,
  });
  const F_inf = Math.tan((35 * Math.PI) / 180) / 0.5;
  ajouter(
    'T_STAB.7',
    'Recherche du cercle critique d’un talus sableux sec',
    'Le minimum tend vers la pente infinie tan φ’ / tan β',
    F_inf,
    recherche ? recherche.resultat.F : NaN,
    3
  );

  // ---------------------------------------------------------------------------
  // T_STAB.8 : un cercle qui ne coupe pas le terrain est invalide (plus de F = 1,35 inventé).
  // ---------------------------------------------------------------------------
  const Finvalide = calculerBishopPourCercle(0, 50, 5, profilPlat, couchesA, sec, 30);
  res.push({
    id: 'T_STAB.8',
    nom: 'Cercle hors du terrain déclaré invalide',
    phase: 'Talus chargé',
    description: 'Le calcul ne renvoie plus de facteur par défaut',
    valeurAttendue: 'NaN (cercle invalide)',
    valeurObtenue: String(Finvalide),
    tolerance: 'exact',
    ecartAbsolu: 0,
    ecartPourcentage: 0,
    succes: Number.isNaN(Finvalide),
    message: Number.isNaN(Finvalide) ? 'Cercle invalide signalé' : 'Une valeur a été inventée',
  });

  return res;
}
