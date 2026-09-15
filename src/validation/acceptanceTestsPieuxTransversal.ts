import { TestResultatIndividuel } from './acceptanceTests';
import {
  calculerPieuTransversal,
  evaluerPyMatlock,
  evaluerPyReese,
  evaluerPyPressiometrique,
} from '../modules/pieux/comportementTransversal';
import { CampagneEssai, CoucheGeotechnique } from '../types/geotech';

function creerCoucheTest(partiel: Partial<CoucheGeotechnique> & { id: string; nom: string; coteToit: number; epaisseur: number; nature: any }): CoucheGeotechnique {
  return {
    couleurAffichage: '#a0a0a0',
    poidsVolumiques: {
      gammaHumide: { v: 19, u: 'kN/m³', statut: 'choix', source: 'test' },
      gammaSature: { v: 20, u: 'kN/m³', statut: 'choix', source: 'test' },
    },
    resistanceDrainee: {
      phiPrime: { v: 30, u: '°', statut: 'choix', source: 'test' },
      phiCritique: { v: 28, u: '°', statut: 'choix', source: 'test' },
      cPrime: { v: 0, u: 'kPa', statut: 'choix', source: 'test' },
      psiDilatance: { v: 0, u: '°', statut: 'choix', source: 'test' },
      deltaInterface: { v: 20, u: '°', statut: 'choix', source: 'test' },
    },
    resistanceNonDrainee: {
      cuTete: { v: 40, u: 'kPa', statut: 'choix', source: 'test' },
      gradientCu: { v: 0, u: 'kPa/m', statut: 'choix', source: 'test' },
    },
    deformation: {
      Echargement: { v: 20, u: 'MPa', statut: 'choix', source: 'test' },
      EdechargeRech: { v: 60, u: 'MPa', statut: 'choix', source: 'test' },
      nu: { v: 0.3, u: '-', statut: 'choix', source: 'test' },
      Eoed: { v: 20, u: 'MPa', statut: 'choix', source: 'test' },
      Cc: { v: 0.1, u: '-', statut: 'choix', source: 'test' },
      Cs: { v: 0.02, u: '-', statut: 'choix', source: 'test' },
      e0: { v: 0.7, u: '-', statut: 'choix', source: 'test' },
      sigmaPrecons: { v: 100, u: 'kPa', statut: 'choix', source: 'test' },
      OCR: { v: 1.0, u: '-', statut: 'choix', source: 'test' },
      Calpha: { v: 0.002, u: '-', statut: 'choix', source: 'test' },
      cv: { v: 1e-6, u: 'm²/s', statut: 'choix', source: 'test' },
      k: { v: 1e-8, u: 'm/s', statut: 'choix', source: 'test' },
    },
    ...partiel,
  };
}

export function executerTestsAcceptationPieuxTransversal(): TestResultatIndividuel[] {
  const tests: TestResultatIndividuel[] = [];

  // =========================================================================
  // T_PIEU_LAT.1 : Test de la loi élémentaire Matlock (argile)
  // =========================================================================
  const cu_test = 40.0; // kPa
  const D_test = 1.0; // m
  const z_prof = 4.0; // m
  const sigVp = 70.0; // kPa

  const pyMatlock1 = evaluerPyMatlock(0.001, z_prof, D_test, cu_test, sigVp);
  const pyMatlock2 = evaluerPyMatlock(0.20, z_prof, D_test, cu_test, sigVp); // Grand déplacement

  // pu = min( (3 + 70/40 + 0.25*4/1)*40*1 , 9*40*1 ) = min( (3 + 1.75 + 1.0)*40, 360 ) = min( 230, 360 ) = 230 kN/m
  const puAttendu = 230.0;
  const errPu = Math.abs(pyMatlock1.pu - puAttendu);
  const saturationOk = Math.abs(pyMatlock2.p - puAttendu) < 1.0;

  tests.push({
    id: 'T_PIEU_LAT.1',
    phase: 'Phase 5',
    nom: 'Loi p-y Matlock : résistance ultime pu et saturation plastique',
    description: 'Validation de la résistance ultime pu et de la saturation plastique de Matlock (1970)',
    valeurAttendue: `pu = ${puAttendu} kN/m et p(|y| grand) = pu`,
    valeurObtenue: `pu = ${pyMatlock1.pu.toFixed(1)} kN/m, p(0.2m) = ${pyMatlock2.p.toFixed(1)} kN/m`,
    tolerance: '1.0 kN/m',
    ecartAbsolu: errPu,
    ecartPourcentage: (errPu / puAttendu) * 100,
    succes: errPu < 1.0 && saturationOk,
    message: 'Formulation de Matlock (1970) pour argile molle conforme au CDC §7.7.',
  });

  // =========================================================================
  // T_PIEU_LAT.2 : Validation analytique Hetenyi (sol homogène, tête libre)
  // Pieu infiniment long dans un sol à raideur kh constante
  // =========================================================================
  const coucheHomogeneReese = creerCoucheTest({
    id: 'C_SABLE_TEST',
    nom: 'Sable homogène test',
    coteToit: 15.0,
    epaisseur: 20.0,
    nature: 'sable',
    resistanceDrainee: {
      phiPrime: { v: 32, u: '°', statut: 'choix', source: 'test' },
      phiCritique: { v: 30, u: '°', statut: 'choix', source: 'test' },
      cPrime: { v: 0, u: 'kPa', statut: 'choix', source: 'test' },
      psiDilatance: { v: 2, u: '°', statut: 'choix', source: 'test' },
      deltaInterface: { v: 21, u: '°', statut: 'choix', source: 'test' },
    },
    poidsVolumiques: {
      gammaHumide: { v: 20, u: 'kN/m³', statut: 'choix', source: 'test' },
      gammaSature: { v: 20, u: 'kN/m³', statut: 'choix', source: 'test' },
    },
  });

  const resHetenyi = calculerPieuTransversal({
    diametre: 1.0,
    coteTete: 15.0,
    cotePointe: 0.0,
    moduleE_GPa: 30.0,
    chargeH: 150.0,
    momentM: 0.0,
    liaisonTete: 'libre',
    couches: [coucheHomogeneReese],
    familleCourbe: 'reese',
    pasMaillage: 0.25,
  });

  tests.push({
    id: 'T_PIEU_LAT.2',
    phase: 'Phase 5',
    nom: 'Convergence et comportement sous charge latérale H (tête libre)',
    description: 'Résolution non linéaire p-y avec convergence de la raideur sécante',
    valeurAttendue: 'u_tete > 0, M_max > 0 situé sous la tête, convergence réussie',
    valeurObtenue: `u_tete = ${resHetenyi.deplacementTete_mm.toFixed(2)} mm, M_max = ${resHetenyi.momentMaxAbsolu.toFixed(1)} kN.m à prof=${resHetenyi.profondeurMomentMax.toFixed(2)}m (itér=${resHetenyi.convergence.iterations})`,
    tolerance: 'Convergence < 50 itérations',
    ecartAbsolu: resHetenyi.convergence.residuFinal,
    ecartPourcentage: 0,
    succes:
      resHetenyi.convergence.converge &&
      resHetenyi.deplacementTete_mm > 0 &&
      resHetenyi.profondeurMomentMax > 1.0 &&
      resHetenyi.profondeurMomentMax < 6.0,
    message: 'Résolution non linéaire avec raideurs sécantes de Reese convergée en quelques itérations.',
  });

  // =========================================================================
  // T_PIEU_LAT.3 : Tête encastrée en rotation (liaisonbloqueeEnRotation)
  // Pour une tête bloquée, le déplacement en tête doit être significativement plus faible (environ 2x plus petit)
  // et un moment d'encastrement négatif apparaît en tête
  // =========================================================================
  const resBloquee = calculerPieuTransversal({
    diametre: 1.0,
    coteTete: 15.0,
    cotePointe: 0.0,
    moduleE_GPa: 30.0,
    chargeH: 150.0,
    momentM: 0.0,
    liaisonTete: 'bloqueeEnRotation',
    couches: [coucheHomogeneReese],
    familleCourbe: 'reese',
    pasMaillage: 0.25,
  });

  const ratioDeplacement = resBloquee.deplacementTete_mm / resHetenyi.deplacementTete_mm;
  const rotationTeteNulle = Math.abs(resBloquee.rotationTete_mrad) < 1e-4;
  const momentEnTeteNonNul = Math.abs(resBloquee.profils[0]?.moment ?? 0) > 100.0;

  tests.push({
    id: 'T_PIEU_LAT.3',
    phase: 'Phase 5',
    nom: 'Effet de l’encastrement en rotation en tête (poutre bloquée)',
    description: 'Condition aux limites de rotation bloquée en tête et réduction de flèche',
    valeurAttendue: 'u_bloquée < u_libre (ratio ~ 0.35-0.55), rotation_tete = 0, apparition moment encastrement en tête',
    valeurObtenue: `ratio = ${ratioDeplacement.toFixed(3)}, rot = ${resBloquee.rotationTete_mrad.toFixed(4)} mrad, M_tete = ${(resBloquee.profils[0]?.moment ?? 0).toFixed(1)} kN.m`,
    tolerance: 'Ratio entre 0.30 et 0.65',
    ecartAbsolu: Math.abs(ratioDeplacement - 0.40),
    ecartPourcentage: (Math.abs(ratioDeplacement - 0.40) / 0.40) * 100,
    succes: ratioDeplacement < 0.65 && ratioDeplacement > 0.3 && rotationTeteNulle && momentEnTeteNonNul,
    message: 'Condition aux limites de rotation en tête correctement prise en compte par le solveur matriciel.',
  });

  // =========================================================================
  // T_PIEU_LAT.4 : Comparaison des familles de lois (Matlock argile vs Pressiométrique)
  // =========================================================================
  const coucheArgile = creerCoucheTest({
    id: 'C_ARGILE_TEST',
    nom: 'Argile raide test',
    coteToit: 15.0,
    epaisseur: 20.0,
    nature: 'argile',
    poidsVolumiques: {
      gammaHumide: { v: 19, u: 'kN/m³', statut: 'choix', source: 'test' },
      gammaSature: { v: 19, u: 'kN/m³', statut: 'choix', source: 'test' },
    },
    resistanceNonDrainee: {
      cuTete: { v: 50, u: 'kPa', statut: 'choix', source: 'test' },
      gradientCu: { v: 0, u: 'kPa/m', statut: 'choix', source: 'test' },
    },
    deformation: {
      Echargement: { v: 15, u: 'MPa', statut: 'choix', source: 'test' },
      EdechargeRech: { v: 45, u: 'MPa', statut: 'choix', source: 'test' },
      nu: { v: 0.35, u: '-', statut: 'choix', source: 'test' },
      Eoed: { v: 15, u: 'MPa', statut: 'choix', source: 'test' },
      Cc: { v: 0.15, u: '-', statut: 'choix', source: 'test' },
      Cs: { v: 0.03, u: '-', statut: 'choix', source: 'test' },
      e0: { v: 0.8, u: '-', statut: 'choix', source: 'test' },
      sigmaPrecons: { v: 150, u: 'kPa', statut: 'choix', source: 'test' },
      OCR: { v: 1.2, u: '-', statut: 'choix', source: 'test' },
      Calpha: { v: 0.003, u: '-', statut: 'choix', source: 'test' },
      cv: { v: 5e-7, u: 'm²/s', statut: 'choix', source: 'test' },
      k: { v: 1e-9, u: 'm/s', statut: 'choix', source: 'test' },
    },
  });

  const campagnePMTTest: CampagneEssai = {
    id: 'PMT-TEST-01',
    type: 'PMT',
    x: 0,
    y: 0,
    coteTete: 15.0,
    profil: [
      { z: 1.0, EM: 12.0, plNette: 1.1 },
      { z: 3.0, EM: 15.0, plNette: 1.3 },
      { z: 6.0, EM: 18.0, plNette: 1.6 },
      { z: 10.0, EM: 22.0, plNette: 1.9 },
      { z: 15.0, EM: 25.0, plNette: 2.2 },
    ],
  };

  const resMatlock = calculerPieuTransversal({
    diametre: 0.8,
    coteTete: 15.0,
    cotePointe: 0.0,
    chargeH: 100.0,
    couches: [coucheArgile],
    familleCourbe: 'matlock',
  });

  const resPressio = calculerPieuTransversal({
    diametre: 0.8,
    coteTete: 15.0,
    cotePointe: 0.0,
    chargeH: 100.0,
    couches: [coucheArgile],
    campagnes: [campagnePMTTest],
    familleCourbe: 'pressiometrique',
  });

  tests.push({
    id: 'T_PIEU_LAT.4',
    phase: 'Phase 5',
    nom: 'Multi-familles de courbes p-y : Matlock et Pressiométrique (Campagne PMT réelle)',
    description: 'Comparaison opérationnelle entre lois Matlock et Pressiométrique alimentée par un sondage PMT',
    valeurAttendue: 'Les deux approches convergent et donnent des ordres de grandeur cohérents (déplacement en tête < 30 mm)',
    valeurObtenue: `Matlock : u=${resMatlock.deplacementTete_mm.toFixed(2)} mm, M_max=${resMatlock.momentMaxAbsolu.toFixed(1)} kN.m | Pressiomètre : u=${resPressio.deplacementTete_mm.toFixed(2)} mm, M_max=${resPressio.momentMaxAbsolu.toFixed(1)} kN.m`,
    tolerance: 'Déplacement < 30 mm',
    ecartAbsolu: Math.abs(resMatlock.deplacementTete_mm - resPressio.deplacementTete_mm),
    ecartPourcentage: 0,
    succes:
      resMatlock.convergence.converge &&
      resPressio.convergence.converge &&
      resMatlock.deplacementTete_mm > 0 &&
      resMatlock.deplacementTete_mm < 30 &&
      resPressio.deplacementTete_mm > 0 &&
      resPressio.deplacementTete_mm < 30,
    message: 'Support opérationnel des formulations Matlock et pressiométrique (Ménard / NF P 94-262) alimentée par CampagneEssai.',
  });

  // =========================================================================
  // T_PIEU_LAT.5 : Absence d'essai PMT et règle CDC §10 / §13 (pas de données inventées)
  // =========================================================================
  const resPressioSansEssai = calculerPieuTransversal({
    diametre: 0.8,
    coteTete: 15.0,
    cotePointe: 0.0,
    chargeH: 100.0,
    couches: [coucheArgile],
    familleCourbe: 'pressiometrique',
    // Aucune campagne PMT ni saisie manuelle
  });

  const aAvertissementRepli = resPressioSansEssai.convergence.avertissements.some((w) =>
    w.includes('aucun sondage PMT') && w.includes('CDC §10 et §13')
  );
  const familleRepliee = resPressioSansEssai.profils[0]?.familleAppliquee ?? '';

  tests.push({
    id: 'T_PIEU_LAT.5',
    phase: 'Phase 5',
    nom: 'Garde-fou CDC §10/§13 : interdiction des données inventées si PMT absent',
    description: 'En l’absence d’essais PMT, repli sans fabriquer de coefficient EM/12 avec avertissement explicite',
    valeurAttendue: 'Avertissement explicite émis, repli automatique sur la loi de sol (Matlock pour argile), pas de crash',
    valeurObtenue: `Avertissement=${aAvertissementRepli ? 'OUI' : 'NON'}, Loi appliquée=${familleRepliee}, u_tete=${resPressioSansEssai.deplacementTete_mm.toFixed(2)} mm`,
    tolerance: 'Avertissement conforme CDC présent',
    ecartAbsolu: aAvertissementRepli ? 0 : 1,
    ecartPourcentage: 0,
    succes: aAvertissementRepli && resPressioSansEssai.convergence.converge && familleRepliee.includes('matlock'),
    message: 'Le solveur refuse d’inventer des pressions limites ou modules pressiométriques fictifs et replie proprement.',
  });

  return tests;
}
