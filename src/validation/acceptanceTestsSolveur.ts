import {
  resoudrePoutreSurRessorts,
  NoeudPoutre,
  RessortNodal,
  ChargeNodale,
  AppuiBloque,
} from '../core/solveurPoutreRessorts';
import { TestResultatIndividuel } from './acceptanceTests';

/**
 * Suite de tests d'acceptation normatifs pour la brique §9.3
 * Solveur d'éléments finis pour poutre sur appuis élastoplastiques
 */
export function executerTestsAcceptationSolveur(): TestResultatIndividuel[] {
  const resultats: TestResultatIndividuel[] = [];

  // --------------------------------------------------------------------------
  // T_SOLV.1 — Cantilever, référence poutre classique
  // --------------------------------------------------------------------------
  {
    // Poutre encastrée à gauche (x=0), libre à droite (x=5m)
    const L = 5.0;
    const E = 30e6; // kPa
    const I = 0.0208; // m⁴
    const A = 0.25; // m²
    const P = 100.0; // kN (transversal vertical)

    const noeuds: NoeudPoutre[] = [
      { x: 0.0, y: 0.0 },
      { x: L, y: 0.0 },
    ];

    const appuisBloques: AppuiBloque[] = [
      { noeudIndex: 0, direction: 'x' },
      { noeudIndex: 0, direction: 'y' },
      { noeudIndex: 0, direction: 'rotation' },
    ];

    const charges: ChargeNodale[] = [{ noeudIndex: 1, Fy: P }];

    const res = resoudrePoutreSurRessorts(noeuds, E, I, A, [], charges, appuisBloques);

    // Solutions analytiques fermées Euler-Bernoulli
    const delta_attendu = (P * Math.pow(L, 3)) / (3 * E * I); // = 0.00667735... m
    const delta_obtenu = res.deplacements[1].uy;
    const ecartDeltaRel = Math.abs(delta_obtenu - delta_attendu) / delta_attendu;

    // Moment et effort tranchant internes à l'encastrement
    const M_encastrement = res.effortsInternes[0].M;
    const V_tranchant = res.effortsInternes[0].V;
    const M_attendu = -P * L; // -500 kN.m
    const V_attendu = P; // 100 kN
    const ecartMomentRel = Math.abs(M_encastrement - M_attendu) / Math.abs(M_attendu);
    const ecartTranchantRel = Math.abs(V_tranchant - V_attendu) / V_attendu;

    const tolerance = 0.0001; // 0.01 %
    const succes = ecartDeltaRel <= tolerance && ecartMomentRel <= tolerance && ecartTranchantRel <= tolerance;

    resultats.push({
      id: 'T_SOLV.1',
      nom: 'Cantilever, référence poutre classique (RdM)',
      phase: 'Brique §9.3',
      description: 'Poutre encastrée L=5m, P=100kN en bout. Comparaison avec la solution fermée δ = P*L³/(3*E*I) et M = -P*L.',
      valeurAttendue: `δ = ${(delta_attendu * 1000).toFixed(3)} mm, M = ${M_attendu.toFixed(1)} kNm, V = ${V_attendu.toFixed(1)} kN`,
      valeurObtenue: `δ = ${(delta_obtenu * 1000).toFixed(3)} mm, M = ${M_encastrement.toFixed(1)} kNm, V = ${V_tranchant.toFixed(1)} kN`,
      tolerance: '0.01 %',
      ecartAbsolu: Math.abs(delta_obtenu - delta_attendu),
      ecartPourcentage: ecartDeltaRel * 100,
      succes,
      message: succes
        ? 'Solution éléments finis identique à la solution analytique continue'
        : `Écart supérieur à la tolérance : ${(ecartDeltaRel * 100).toFixed(4)} %`,
    });
  }

  // --------------------------------------------------------------------------
  // T_SOLV.2 — Ressort linéaire, équilibre global
  // --------------------------------------------------------------------------
  {
    const L = 5.0;
    const E = 30e6;
    const I = 0.0208;
    const A = 0.25;
    const kRessort = 500.0; // kN/m
    const P = 50.0; // kN

    const noeuds: NoeudPoutre[] = [
      { x: 0.0, y: 0.0 },
      { x: L, y: 0.0 },
    ];

    const appuisBloques: AppuiBloque[] = [
      { noeudIndex: 0, direction: 'x' },
      { noeudIndex: 0, direction: 'y' },
      { noeudIndex: 0, direction: 'rotation' },
    ];

    const ressorts: RessortNodal[] = [
      {
        noeudIndex: 1,
        raideur: kRessort,
        direction: 'y',
      },
    ];

    const charges: ChargeNodale[] = [{ noeudIndex: 1, Fy: P }];

    const res = resoudrePoutreSurRessorts(noeuds, E, I, A, ressorts, charges, appuisBloques);

    const uy_bout = res.deplacements[1].uy;
    const reactionRessort = res.reactionsRessorts[0]?.reaction ?? 0;
    const reactionHookeTheorique = kRessort * uy_bout;
    const ecartHooke = Math.abs(reactionRessort - reactionHookeTheorique);

    // Équilibre global des forces verticales : somme(charges) = somme(réactions)
    const reactionAppuiY = res.reactionsAppuis.find((a) => a.noeudIndex === 0 && a.direction === 'y')?.reaction ?? 0;
    const residuEquilibre = Math.abs(P - (reactionRessort + reactionAppuiY));

    const succes = ecartHooke < 1e-6 && residuEquilibre < 1e-6;

    resultats.push({
      id: 'T_SOLV.2',
      nom: 'Ressort linéaire & équilibre vertical global',
      phase: 'Brique §9.3',
      description: 'Poutre avec ressort linéaire k=500 kN/m et charge P=50 kN. Vérification loi de Hooke et équilibre global.',
      valeurAttendue: `R_ressort = k*uy = ${(reactionHookeTheorique).toFixed(2)} kN, Résidu équilibre < 1e-6 kN`,
      valeurObtenue: `R_ressort = ${reactionRessort.toFixed(2)} kN, R_appui = ${reactionAppuiY.toFixed(2)} kN, Résidu = ${residuEquilibre.toExponential(2)} kN`,
      tolerance: 'Résidu < 1e-6 kN',
      ecartAbsolu: residuEquilibre,
      ecartPourcentage: (residuEquilibre / P) * 100,
      succes,
      message: succes
        ? 'Loi de Hooke et équilibre des forces respectés à la précision machine'
        : `Défaut d'équilibre : résidu = ${residuEquilibre}`,
    });
  }

  // --------------------------------------------------------------------------
  // T_SOLV.3 — Plastification et convergence
  // --------------------------------------------------------------------------
  {
    const L = 5.0;
    const E = 30e6;
    const I = 0.0208;
    const A = 0.25;
    // Pour que sous P = 50 kN le ressort mobilise son plafond de 20 kN face à la raideur
    // propre de flexion de la poutre (k_poutre = 3EI/L³ = 14976 kN/m), la raideur du ressort
    // doit dépasser 10 000 kN/m (ex: k = 50 000 kN/m).
    const kRessort = 50000.0; // kN/m (500 kN/cm)
    const P = 50.0; // kN
    const reactionMax = 20.0; // Plafond élastoplastique à 20 kN

    const noeuds: NoeudPoutre[] = [
      { x: 0.0, y: 0.0 },
      { x: L, y: 0.0 },
    ];

    const appuisBloques: AppuiBloque[] = [
      { noeudIndex: 0, direction: 'x' },
      { noeudIndex: 0, direction: 'y' },
      { noeudIndex: 0, direction: 'rotation' },
    ];

    const ressorts: RessortNodal[] = [
      {
        noeudIndex: 1,
        raideur: kRessort,
        direction: 'y',
        reactionMax,
      },
    ];

    const charges: ChargeNodale[] = [{ noeudIndex: 1, Fy: P }];

    const res = resoudrePoutreSurRessorts(noeuds, E, I, A, ressorts, charges, appuisBloques);

    const ressortInfo = res.reactionsRessorts[0];
    const reactionRessort = ressortInfo?.reaction ?? 0;
    const estPlastifie = ressortInfo?.plastifie ?? false;

    const reactionAppuiY = res.reactionsAppuis.find((a) => a.noeudIndex === 0 && a.direction === 'y')?.reaction ?? 0;
    const residuEquilibre = Math.abs(P - (reactionRessort + reactionAppuiY));

    // Avec réaction plafonnée à 20 kN, l'appui doit reprendre exactement 30 kN
    const ecartPlafond = Math.abs(reactionRessort - reactionMax);
    const ecartAppui = Math.abs(reactionAppuiY - 30.0);

    const succes =
      res.convergence.convergé &&
      estPlastifie &&
      ecartPlafond < 1e-4 &&
      ecartAppui < 1e-4 &&
      residuEquilibre < 1e-6;

    resultats.push({
      id: 'T_SOLV.3',
      nom: 'Plastification de ressort & convergence non linéaire',
      phase: 'Brique §9.3',
      description: 'Ressort élastoplastique plafonné à 20 kN sous charge de 50 kN. Vérification du plafonnement et de l\'équilibre.',
      valeurAttendue: `Convergé: OUI, R_ressort = 20.00 kN (Plastifié), R_appui = 30.00 kN`,
      valeurObtenue: `Convergé: ${res.convergence.convergé ? 'OUI' : 'NON'} (${res.convergence.iterations} itérations), R_ressort = ${reactionRessort.toFixed(2)} kN (Plastifié=${estPlastifie}), R_appui = ${reactionAppuiY.toFixed(2)} kN`,
      tolerance: 'Plafond exact 20.0 kN, résidu < 1e-6 kN',
      ecartAbsolu: ecartPlafond,
      ecartPourcentage: (ecartPlafond / reactionMax) * 100,
      succes,
      message: succes
        ? 'Convergence non linéaire validée, report intégral du surplus d\'effort à la poutre'
        : 'Échec de convergence ou non respect du seuil élastoplastique',
    });
  }

  return resultats;
}
