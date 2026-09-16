import { TestResultatIndividuel } from './acceptanceTests';
import { calculerSensibiliteParametrique } from '../core/sensibilite';
import { verifierPortanceRadierELU } from '../modules/radier/portanceELU';
import { calculerBishopPourCercle } from '../briques/stabiliteGenerale';
import { flecheNavierTimoshenko, resoudrePlaque2DSurRessorts } from '../core/solveurPlaqueSurRessorts';
import { calculerRadierSurRessortsIteratifs } from '../modules/radier/radierSurRessortsIteratifs';
import { CONFIG_NORMATIVE_DEFAUT } from '../norme/configNormativeDefaut';
import { CoucheGeotechnique, Hydrogeologie, OuvrageRadier, TripletGrandeur } from '../types/geotech';

const tVal = (v: number, u: string = ''): TripletGrandeur<number> => ({
  v,
  u,
  source: 'labo',
  statut: 'mesure',
});

function creerCouche(
  id: string,
  nom: string,
  coteToit: number,
  epaisseur: number,
  gamma: number,
  phi: number,
  c: number,
  nature: 'sable' | 'argile' = 'sable'
): CoucheGeotechnique {
  return {
    id,
    nom,
    coteToit,
    epaisseur,
    nature,
    couleurAffichage: '#c2b280',
    poidsVolumiques: {
      gammaHumide: tVal(gamma, 'kN/m³'),
      gammaSature: tVal(gamma + 1, 'kN/m³'),
    },
    resistanceDrainee: {
      phiPrime: tVal(phi, '°'),
      phiCritique: tVal(phi, '°'),
      cPrime: tVal(c, 'kPa'),
      psiDilatance: tVal(0, '°'),
      deltaInterface: tVal(0, '°'),
    },
    resistanceNonDrainee: {
      cuTete: tVal(50, 'kPa'),
      gradientCu: tVal(0, 'kPa/m'),
    },
    deformation: {
      Echargement: tVal(20, 'MPa'),
      EdechargeRech: tVal(60, 'MPa'),
      nu: tVal(0.3, '-'),
      Eoed: tVal(25, 'MPa'),
      Cc: tVal(0.1, '-'),
      Cs: tVal(0.02, '-'),
      e0: tVal(0.7, '-'),
      sigmaPrecons: tVal(100, 'kPa'),
      OCR: { v: 1.0, u: '-', source: 'labo', statut: 'mesure' },
      Calpha: tVal(0.005, '-'),
      cv: tVal(1e-6, 'm²/s'),
      k: tVal(1e-8, 'm/s'),
    },
  };
}

const hydroSec: Hydrogeologie = {
  nappePrincipale: { coteCaracteristique: -99, coteDefavorableELU: -99, regime: 'hydrostatique' },
  gradientVertical: null,
  nappesSecondaires: [],
  poidsVolumiqueEau: 9.81,
};

function ajouterTest(
  resultats: TestResultatIndividuel[],
  data: {
    id: string;
    phase: string;
    nom: string;
    description: string;
    tolerance: string;
    succes: boolean;
    valeurAttendue: string;
    valeurObtenue: string;
    ecartAbsolu: number;
    ecartPourcentage: number;
    message: string;
    details?: Record<string, any>;
  }
) {
  resultats.push(data);
}

export function executerTestsAcceptationSensibilitePlaqueStabilite(): TestResultatIndividuel[] {
  const resultats: TestResultatIndividuel[] = [];

  // =========================================================================
  // T_SENS.1 | Sensibilité paramétrique — Vérification analytique indépendante
  // =========================================================================
  // Sur le cas T1.1 (φ'=30°, c'=0, γ=18 kN/m³, B=2m, D=1m, semelle filante non inclinée)
  // Formule de portance : q_ult = q' * Nq + 0.5 * γ' * B' * Nγ
  // Dérivée analytique calculée de manière totalement indépendante de l'utilitaire numérique
  const phi0_deg = 30.0;
  const phi0_rad = (phi0_deg * Math.PI) / 180;
  const cosPhi = Math.cos(phi0_rad);
  const sinPhi = Math.sin(phi0_rad);
  const tanPhi = Math.tan(phi0_rad);

  // Formules exactes fermées de Nq et Ngamma
  const Nq_0 = Math.exp(Math.PI * tanPhi) * Math.pow(Math.tan(Math.PI / 4 + phi0_rad / 2), 2);
  const Ngamma_0 = 2 * (Nq_0 - 1) * tanPhi;

  // Dérivées exactes par rapport à phi en radians :
  // d(Nq)/d(phi_rad) = Nq * (pi / cos²phi + 2 / cosphi)
  const dNq_dphi_rad = Nq_0 * (Math.PI / (cosPhi * cosPhi) + 2 / cosPhi);
  // d(Ngamma)/d(phi_rad) = 2 * dNq/dphi * tanphi + 2 * (Nq - 1) / cos²phi
  const dNgamma_dphi_rad = 2 * dNq_dphi_rad * tanPhi + (2 * (Nq_0 - 1)) / (cosPhi * cosPhi);

  // Conversion en dérivée par rapport à phi en degrés : d/d(phi_deg) = d/d(phi_rad) * (pi / 180)
  const dNq_dphi_deg = dNq_dphi_rad * (Math.PI / 180);
  const dNgamma_dphi_deg = dNgamma_dphi_rad * (Math.PI / 180);

  // Pour q' = 18 kPa, B' = 2 m, gamma = 18 kN/m³ :
  // q_ult = 18 * Nq + 18 * Ngamma = 18 * (Nq + Ngamma)
  const q_ult_0 = 18 * Nq_0 + 18 * Ngamma_0;
  const dq_ult_dphi_analytique = 18 * (dNq_dphi_deg + dNgamma_dphi_deg);
  // Élasticité analytique en % de variation relative de q_ult pour 1% de variation relative de phi
  const elasticiteAnalytique_pourcent = ((phi0_deg * dq_ult_dphi_analytique) / q_ult_0) * 0.01 * 100;

  // Modèle numérique pour l'utilitaire
  const coucheT11: CoucheGeotechnique = creerCouche('C1', 'Sable T1.1', 0, 10, 18, 30.0, 0.0);

  const ouvrageT11: OuvrageRadier = {
    id: 'R1',
    nom: 'Radier T1.1',
    longueurL: 100,
    largeurB: 2,
    coteBase: -1,
    epaisseur: 0.5,
    actions: { V_G: 200, V_Q: 0, H_G: 0, H_Q: 0, M_G: 0, M_Q: 0 },
    coteTerrainFini: 0,
  };

  const rapportNum = calculerSensibiliteParametrique(
    () => {
      const res = verifierPortanceRadierELU(ouvrageT11, 0, [coucheT11], hydroSec, CONFIG_NORMATIVE_DEFAUT, {
        forceBandeFilante: true,
        combinaisonForcee: { jeuActions: 'A1', jeuSol: 'M1', jeuResistance: 'R1' },
      });
      return res.q_ult_draine;
    },
    [
      {
        label: "φ'",
        valeurRef: 30.0,
        appliquer: (val) => {
          coucheT11.resistanceDrainee.phiPrime.v = val;
        },
      },
    ],
    0.01 // h = 1%
  );

  const deriveeNum = rapportNum.parametres[0].derivee;
  const ecartDerivee = Math.abs((deriveeNum - dq_ult_dphi_analytique) / dq_ult_dphi_analytique) * 100;
  const succes_T_SENS1 = ecartDerivee < 2.0;

  ajouterTest(resultats, {
    id: 'T_SENS.1',
    phase: 'Brique §12.1',
    nom: 'Sensibilité paramétrique — Dérivée numérique vs Solution analytique exacte fermée',
    description: 'Vérification de la dérivée numérique de portance par rapport à phi vs la solution analytique exacte fermée',
    tolerance: 'Écart < 2%',
    succes: succes_T_SENS1,
    valeurAttendue: `d(q_ult)/dφ' analytique = ${dq_ult_dphi_analytique.toFixed(2)} kPa/° (Élasticité ~ ${elasticiteAnalytique_pourcent.toFixed(1)}%/%)`,
    valeurObtenue: `d(q_ult)/dφ' numérique = ${deriveeNum.toFixed(2)} kPa/° (Écart = ${ecartDerivee.toFixed(3)}% < 2%)`,
    ecartAbsolu: Math.abs(deriveeNum - dq_ult_dphi_analytique),
    ecartPourcentage: ecartDerivee,
    message: succes_T_SENS1
      ? `Validation analytique rigoureuse indépendante réussie (écart troncature ${ecartDerivee.toFixed(3)}% < 2%)`
      : `Écart excessif entre dérivée numérique et dérivée analytique fermée (${ecartDerivee.toFixed(2)}%)`,
    details: {
      deriveeAnalytique: dq_ult_dphi_analytique,
      deriveeNumerique: deriveeNum,
      ecartPourcent: ecartDerivee,
      elasticite: rapportNum.parametres[0].elasticitePourcent,
    },
  });

  // =========================================================================
  // T_STAB.2 | Stabilité générale — Limite de pente infinie à grand rayon (Bishop)
  // =========================================================================
  // Formule classique de mécanique des sols pour pente infinie (Taylor / Terzaghi) :
  // F = [c' + (γ·h·cos²β - u)·tanφ'] / (γ·h·sinβ·cosβ)
  const penteBetaDeg = 20.0;
  const penteBetaRad = (penteBetaDeg * Math.PI) / 180;
  const hGlissement = 3.0; // m
  const gammaSol = 19.0; // kN/m³
  const phiSolDeg = 28.0;
  const phiSolRad = (phiSolDeg * Math.PI) / 180;
  const cSol = 0.0; // kPa (sol frottant pur pour annuler l'effet de lentille 2/3 h aux extrémités)

  const cosBeta = Math.cos(penteBetaRad);
  const sinBeta = Math.sin(penteBetaRad);
  const cos2Beta = cosBeta * cosBeta;
  const tanPhiSol = Math.tan(phiSolRad);

  // Formule canonique de pente infinie pour sol pulvérulent sec : F = tan(φ') / tan(β)
  const numPenteInfinie = cSol + gammaSol * hGlissement * cos2Beta * tanPhiSol;
  const denPenteInfinie = gammaSol * hGlissement * sinBeta * cosBeta;
  const F_analytiquePenteInfinie = numPenteInfinie / denPenteInfinie; // = tan(28°) / tan(20°) ≈ 1.461

  // Modèle numérique de pente infinie rectiligne continue à 20°
  // Pente z(x) = yTete - x * tan(20°) sur toute l'étendue pour éliminer les butées de replat
  const xTete = 0;
  const yTete = 50;
  const xPied = 100;
  const yPied = yTete - xPied * Math.tan(penteBetaRad);

  const profilTalusInfini = [
    { x: -50, y: yTete + 50 * Math.tan(penteBetaRad) },
    { x: 0, y: yTete },
    { x: 100, y: yPied },
    { x: 150, y: yPied - 50 * Math.tan(penteBetaRad) },
  ];

  const coucheTalus: CoucheGeotechnique = creerCouche(
    'C_TALUS',
    'Sol pente infinie',
    100,
    150,
    gammaSol,
    phiSolDeg,
    cSol
  );

  // Grand rayon R = 400m pour approcher asymptotiquement le glissement plan parallèle
  // Centre positionné sur la normale au milieu du talus (xMid = 50, yMid = 50 - 50*tan(20°) = 31.8)
  const xMid = 50;
  const yMid = yTete - xMid * Math.tan(penteBetaRad);
  const R_grand = 400.0;
  // Normale sortante vers le haut au-dessus du talus : vecteur (+sin(20°), +cos(20°))
  const centreX_stab = xMid + (R_grand - hGlissement) * sinBeta;
  const centreY_stab = yMid + (R_grand - hGlissement) * cosBeta;

  const F_bishopObtenu = calculerBishopPourCercle(
    centreX_stab,
    centreY_stab,
    R_grand,
    profilTalusInfini,
    [coucheTalus],
    hydroSec,
    40
  );

  const ecartPenteInfinie = Math.abs((F_bishopObtenu - F_analytiquePenteInfinie) / F_analytiquePenteInfinie) * 100;
  const succes_T_STAB2 = ecartPenteInfinie < 5.0; // tolérance 5% pour effet résiduel de courbure

  ajouterTest(resultats, {
    id: 'T_STAB.2',
    phase: 'Phase 6',
    nom: 'Stabilité générale — Asymptote de pente infinie pour grand rayon R ≫ H',
    description: 'Vérification de la convergence asymptotique de Bishop vers la formule classique de pente infinie (Taylor)',
    tolerance: 'Écart < 5%',
    succes: succes_T_STAB2,
    valeurAttendue: `F_analytique = ${F_analytiquePenteInfinie.toFixed(3)} (Pente β=20°, φ'=28°, sol frottant c'=0)`,
    valeurObtenue: `F_Bishop(R=${R_grand}m) = ${F_bishopObtenu.toFixed(3)} (Écart = ${ecartPenteInfinie.toFixed(2)}% < 5%)`,
    ecartAbsolu: Math.abs(F_bishopObtenu - F_analytiquePenteInfinie),
    ecartPourcentage: ecartPenteInfinie,
    message: succes_T_STAB2
      ? `Convergence asymptotique du solveur circulaire de Bishop vers la formule classique de pente infinie validée (écart ${ecartPenteInfinie.toFixed(2)}%)`
      : `Écart excessif à la limite de pente infinie (${ecartPenteInfinie.toFixed(2)}% > 5%)`,
    details: {
      F_analytique: F_analytiquePenteInfinie,
      F_bishop: F_bishopObtenu,
      ecartPourcent: ecartPenteInfinie,
      rayon: R_grand,
    },
  });

  // =========================================================================
  // T_PLAQUE.1 | Solveur de plaque 2D — Comparaison analytique Timoshenko / Navier
  // =========================================================================
  // Plaque carrée simplement appuyée 4m x 4m, épaisseur 0.25m, charge uniforme q = 50 kPa
  // E = 30 GPa (30e6 kPa), nu = 0.2
  const aPlaque = 4.0; // m
  const hPlaque = 0.25; // m
  const EPlaque = 30e6; // kPa
  const nuPlaque = 0.2;
  const qPlaque = 50.0; // kPa
  const DPlaque = (EPlaque * Math.pow(hPlaque, 3)) / (12 * (1 - nuPlaque * nuPlaque)); // ~ 40685.76 kNm

  // Flèche analytique Navier / Timoshenko exacte
  const wNavierAnalytique = flecheNavierTimoshenko(qPlaque, aPlaque, aPlaque, DPlaque, 40);

  // Résolution par éléments de plaque discrétisés (12x12) avec ks = 0 (aucun sol, appuis simples en périphérie)
  const resPlaqueTimoshenko = resoudrePlaque2DSurRessorts(
    {
      longueurX: aPlaque,
      largeurY: aPlaque,
      epaisseur: hPlaque,
      E: EPlaque,
      nu: nuPlaque,
      nx: 12,
      ny: 12,
      conditionsBords: 'appuye',
    },
    new Array(13 * 13).fill(qPlaque),
    new Array(13 * 13).fill(0) // sans ressort de sol
  );

  const ecartPlaqueTimoshenko = Math.abs((resPlaqueTimoshenko.flecheMax - wNavierAnalytique) / wNavierAnalytique) * 100;
  const succes_T_PLAQUE1 = ecartPlaqueTimoshenko < 3.0; // écart de discrétisation < 3%

  ajouterTest(resultats, {
    id: 'T_PLAQUE.1',
    phase: 'Phase 7',
    nom: 'Solveur de plaque mince 2D — Flèche maximale vs Solution analytique de Timoshenko / Navier',
    description: 'Comparaison de la flèche maximale au centre d’une plaque carrée appuyée avec la solution exacte de Navier',
    tolerance: 'Écart < 3%',
    succes: succes_T_PLAQUE1,
    valeurAttendue: `w_Navier = ${(wNavierAnalytique * 1000).toFixed(3)} mm (Plaque 4x4m appuyée sous q=50 kPa)`,
    valeurObtenue: `w_solveur = ${(resPlaqueTimoshenko.flecheMax * 1000).toFixed(3)} mm (Écart = ${ecartPlaqueTimoshenko.toFixed(2)}% < 3%)`,
    ecartAbsolu: Math.abs(resPlaqueTimoshenko.flecheMax - wNavierAnalytique) * 1000,
    ecartPourcentage: ecartPlaqueTimoshenko,
    message: succes_T_PLAQUE1
      ? `Solveur de plaque 2D conforme à la solution analytique de référence de Timoshenko (écart ${ecartPlaqueTimoshenko.toFixed(2)}% < 3%)`
      : `Écart excessif avec la théorie des plaques minces de Timoshenko (${ecartPlaqueTimoshenko.toFixed(2)}%)`,
    details: {
      w_analytique_mm: wNavierAnalytique * 1000,
      w_solveur_mm: resPlaqueTimoshenko.flecheMax * 1000,
      ecartPourcent: ecartPlaqueTimoshenko,
    },
  });

  // =========================================================================
  // T_PLAQUE.2 | Phase 7 — Radier sur ressorts itératifs : Convergence et tassement différentiel
  // =========================================================================
  // Radier carré 6m x 6m, épaisseur 0.50m, charge 3600 kN (q moyen = 100 kPa)
  // Reposant sur une couche de sol meuble compressible
  const ouvrageRadierTest: OuvrageRadier = {
    id: 'RADIER_ITER_TEST',
    nom: 'Radier 6x6 itératif',
    longueurL: 6.0,
    largeurB: 6.0,
    epaisseur: 0.50,
    actions: { V_G: 2400, V_Q: 1200, H_G: 0, H_Q: 0, M_G: 0, M_Q: 0 },
    coteTerrainFini: 0,
    coteBase: -1.0,
  };

  const coucheRadierCompressible: CoucheGeotechnique = creerCouche(
    'C_SOL_COMP',
    'Sol argilo-limoneux',
    0,
    8.0,
    19,
    24,
    12,
    'argile'
  );

  const resRadierIter = calculerRadierSurRessortsIteratifs(
    ouvrageRadierTest,
    [coucheRadierCompressible],
    hydroSec,
    {
      nx: 8,
      ny: 8,
      maxIterations: 15,
      toleranceConvergence: 0.01, // 1%
      facteurRelaxation: 0.5,
    }
  );

  const convergeEnMoinsDe15 = resRadierIter.convergence.convergé && resRadierIter.convergence.nbIterations <= 15;
  const tassementDiffPositif = resRadierIter.champs.tassementDifferentielMax_mm > 0.1; // radier flexible / souple
  const formatExportValide = resRadierIter.exportStructuralJSON.length > 100;

  const succes_T_PLAQUE2 = convergeEnMoinsDe15 && tassementDiffPositif && formatExportValide;

  ajouterTest(resultats, {
    id: 'T_PLAQUE.2',
    phase: 'Phase 7',
    nom: 'Radier sur ressorts itératifs — Boucle CDC §6.6 (Convergence < 1%, tassement différentiel et export structural)',
    description: 'Vérification de la boucle sol-structure couplée : convergence relative < 1% en ≤ 15 itérations',
    tolerance: 'Convergence ≤ 15 itér, Δs > 0',
    succes: succes_T_PLAQUE2,
    valeurAttendue: 'Convergence < 1% en ≤ 15 itérations, Δs > 0, export structural JSON généré',
    valeurObtenue: `Convergé en ${resRadierIter.convergence.nbIterations} itérations (Écart final = ${resRadierIter.convergence.ecartFinalRelatif}%), s_max = ${resRadierIter.champs.tassementMax_mm} mm, Δs = ${resRadierIter.champs.tassementDifferentielMax_mm} mm`,
    ecartAbsolu: resRadierIter.convergence.ecartFinalRelatif,
    ecartPourcentage: resRadierIter.convergence.ecartFinalRelatif,
    message: succes_T_PLAQUE2
      ? `Boucle itérative sol-structure convergée avec succès en ${resRadierIter.convergence.nbIterations} itérations (respect du critère relatif 1%), distribution de pression et export structural opérationnels`
      : `Échec de convergence itérative ou de comportement sol-structure sur ressorts`,
    details: {
      nbIterations: resRadierIter.convergence.nbIterations,
      ecartFinal: resRadierIter.convergence.ecartFinalRelatif,
      tassementMax: resRadierIter.champs.tassementMax_mm,
      tassementDiff: resRadierIter.champs.tassementDifferentielMax_mm,
      pressionMax: resRadierIter.champs.pressionContactMax_kPa,
    },
  });

  // =========================================================================
  // T_PLAQUE.3 | Phase 7 — Solveur de plaque directe : Bords libres sur ressorts de sol
  // Invariance de maillage (nx=4, 8, 12) et équilibre exact sous ressorts de Winkler
  // =========================================================================
  const qUniforme = 120.0; // kPa
  const ksConstante = 24000.0; // kN/m³
  const wTheoriqueUniforme_m = qUniforme / ksConstante; // 0.005 m = 5.0 mm

  // Test sur 3 finesses de maillage : nx = 4, 8, 12
  const raffinements = [4, 8, 12];
  const flechesObtenues_mm: number[] = [];
  let tousConverges = true;

  for (const n of raffinements) {
    const nTot = (n + 1) * (n + 1);
    const solRessorts = resoudrePlaque2DSurRessorts(
      {
        longueurX: 6.0,
        largeurY: 6.0,
        epaisseur: 0.5,
        E: 30e6,
        nu: 0.2,
        nx: n,
        ny: n,
        conditionsBords: 'libre',
      },
      new Array(nTot).fill(qUniforme),
      new Array(nTot).fill(ksConstante)
    );

    if (!solRessorts.convergé) tousConverges = false;
    flechesObtenues_mm.push(solRessorts.flecheMax * 1000);
  }

  // Écart relatif maximal par rapport à la solution exacte w = q / ks
  const ecartsTheoriques = flechesObtenues_mm.map((w) =>
    Math.abs((w - wTheoriqueUniforme_m * 1000) / (wTheoriqueUniforme_m * 1000)) * 100
  );
  const ecartMaxRefinement = Math.max(...ecartsTheoriques);
  const succes_T_PLAQUE3 = tousConverges && ecartMaxRefinement < 0.1;

  ajouterTest(resultats, {
    id: 'T_PLAQUE.3',
    phase: 'Phase 7',
    nom: 'Solveur de plaque 2D — Branche Bords Libres sur Ressorts (Invariance de maillage & équilibre exact)',
    description: 'Vérification de la formulation variationnelle directe sur bords libres avec ressorts de sol sous raffinement de maillage (nx=4, 8, 12)',
    tolerance: 'Écart < 0.1%, Invariance parfaite nx=4 à 12, statut convergé = true',
    succes: succes_T_PLAQUE3,
    valeurAttendue: `w_th = ${(wTheoriqueUniforme_m * 1000).toFixed(3)} mm (exact q/ks), stabilité invariante sur nx=4, 8, 12`,
    valeurObtenue: `nx=4: ${flechesObtenues_mm[0].toFixed(3)} mm | nx=8: ${flechesObtenues_mm[1].toFixed(3)} mm | nx=12: ${flechesObtenues_mm[2].toFixed(3)} mm (Écart max = ${ecartMaxRefinement.toFixed(4)}%)`,
    ecartAbsolu: Math.abs(flechesObtenues_mm[1] - wTheoriqueUniforme_m * 1000),
    ecartPourcentage: ecartMaxRefinement,
    message: succes_T_PLAQUE3
      ? 'Solveur direct de plaque sur ressorts en bords libres parfaitement stable et invariant sous raffinement de maillage'
      : 'Instabilité numérique détectée sur la branche bords libres avec ressorts de sol',
    details: {
      w_th_mm: wTheoriqueUniforme_m * 1000,
      fleches_mm: flechesObtenues_mm,
      tousConverges,
    },
  });

  return resultats;
}
