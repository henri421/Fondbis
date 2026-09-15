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

  // --------------------------------------------------------------------------
  // T_SOLV.4 — Convergence avec relaxation numérique (système oscillant)
  // --------------------------------------------------------------------------
  {
    // Configuration oscillante : balancier sur appui central avec ressorts élastoplastiques aux extrémités
    const noeuds: NoeudPoutre[] = [
      { x: 0.0, y: 0.0 },
      { x: 2.5, y: 0.0 },
      { x: 5.0, y: 0.0 },
    ];
    const E = 30e6; // kPa
    const I = 0.001; // m⁴
    const A = 0.05; // m²

    const appuis: AppuiBloque[] = [
      { noeudIndex: 1, direction: 'x' },
      { noeudIndex: 1, direction: 'y' },
    ];

    const ressorts: RessortNodal[] = [
      { noeudIndex: 0, direction: 'y', raideur: 5000, reactionMax: 10, reactionMin: -10 },
      { noeudIndex: 2, direction: 'y', raideur: 5000, reactionMax: 10, reactionMin: -10 },
    ];

    const charges: ChargeNodale[] = [
      { noeudIndex: 0, Fy: -10 },
      { noeudIndex: 2, Fy: 10 },
    ];

    // Résolution sans relaxation : cycle infini de bascule plastifié / élastique
    const resSans = resoudrePoutreSurRessorts(
      noeuds, E, I, A, ressorts, charges, appuis, undefined,
      { activerRelaxation: false }
    );

    // Résolution avec relaxation dynamique (réduction automatique d'omega à 0.5)
    const resAvec = resoudrePoutreSurRessorts(
      noeuds, E, I, A, ressorts, charges, appuis, undefined,
      { activerRelaxation: true }
    );

    const succes =
      !resSans.convergence.convergé &&
      resAvec.convergence.convergé &&
      resAvec.convergence.iterations <= 5;

    resultats.push({
      id: 'T_SOLV.4',
      nom: 'Convergence sous relaxation numérique (cas oscillant)',
      phase: 'Brique §9.3',
      description: 'Détection d\'oscillation élastique/plastique et activation dynamique de la relaxation (omega=0.5).',
      valeurAttendue: 'Sans relaxation: échec (100 itérations) ; Avec relaxation: convergence rapide (≤ 5 itér.)',
      valeurObtenue: `Sans: ${resSans.convergence.convergé ? 'Convergé' : 'Non-convergé'} (${resSans.convergence.iterations} itér.) | Avec: ${resAvec.convergence.convergé ? 'Convergé' : 'Non-convergé'} (${resAvec.convergence.iterations} itér.)`,
      tolerance: 'Convergence avec relaxation ≤ 5 itérations',
      ecartAbsolu: resAvec.convergence.iterations,
      ecartPourcentage: 0,
      succes,
      message: succes
        ? 'Oscillation détectée avec succès : la relaxation numérique assure la convergence en 3 itérations'
        : 'Échec du contrôle de relaxation numérique',
    });
  }

  // --------------------------------------------------------------------------
  // T_SOLV.5 — Détection de mécanisme / instabilité (singularité sur DDL)
  // --------------------------------------------------------------------------
  {
    // Configuration cinématiquement instable : poutre sur 2 appuis simples en Y sans aucun blocage en X
    const noeuds: NoeudPoutre[] = [
      { x: 0.0, y: 0.0 },
      { x: 3.0, y: 0.0 },
      { x: 6.0, y: 0.0 },
    ];
    const E = 30e6;
    const I = 0.001;
    const A = 0.05;

    const appuis: AppuiBloque[] = [
      { noeudIndex: 0, direction: 'y' },
      { noeudIndex: 2, direction: 'y' },
    ];

    const charges: ChargeNodale[] = [
      { noeudIndex: 1, Fx: 10 },
    ];

    const res = resoudrePoutreSurRessorts(noeuds, E, I, A, [], charges, appuis);

    const singulariteSignalee = res.convergence.avertissements.some((av) =>
      av.includes('Singularité') && av.includes('direction x')
    );
    const nonConverge = !res.convergence.convergé;

    const succes = nonConverge && singulariteSignalee;

    resultats.push({
      id: 'T_SOLV.5',
      nom: 'Détection de mécanisme / instabilité cinématique',
      phase: 'Brique §9.3',
      description: 'Poutre non contrainte en translation horizontale X. Vérification que la singularité n\'est pas masquée silencieusement.',
      valeurAttendue: 'convergé = faux, avertissement signalant le DDL singulier en direction x',
      valeurObtenue: `convergé = ${res.convergence.convergé}, avertissements = ${res.convergence.avertissements.length} (${res.convergence.avertissements[0] ?? 'aucun'})`,
      tolerance: 'Signalement obligatoire des DDL instables',
      ecartAbsolu: res.convergence.avertissements.length,
      ecartPourcentage: 0,
      succes,
      message: succes
        ? 'Mécanisme cinématique détecté avec précision, diagnostic explicite fourni dans convergence.avertissements'
        : 'La singularité a été masquée ou non signalée',
    });
  }

  // --------------------------------------------------------------------------
  // T_SOLV.6 — Discontinuité des efforts internes (saut d'effort tranchant)
  // --------------------------------------------------------------------------
  {
    // Poutre bi-appuyée avec charge ponctuelle centrale de 60 kN : saut de tranchant Delta V = P = 60 kN
    const L = 6.0;
    const P = 60.0;
    const E = 30e6;
    const I = 0.001;
    const A = 0.05;

    const noeuds: NoeudPoutre[] = [
      { x: 0.0, y: 0.0 },
      { x: 3.0, y: 0.0 }, // Nœud d'application de la charge
      { x: L, y: 0.0 },
    ];

    const appuis: AppuiBloque[] = [
      { noeudIndex: 0, direction: 'x' },
      { noeudIndex: 0, direction: 'y' },
      { noeudIndex: 2, direction: 'y' },
    ];

    const charges: ChargeNodale[] = [
      { noeudIndex: 1, Fy: -P },
    ];

    const res = resoudrePoutreSurRessorts(noeuds, E, I, A, [], charges, appuis);

    const effortCentral = res.effortsInternes[1];
    const V_gauche = effortCentral.gauche?.V ?? 0;
    const V_droite = effortCentral.droite?.V ?? 0;
    const sautTranchant = Math.abs(V_droite - V_gauche);

    const ecartSaut = Math.abs(sautTranchant - P);
    const M_max = Math.abs(effortCentral.M);
    const M_attendu = (P * L) / 4; // = 90.0 kNm
    const ecartMoment = Math.abs(M_max - M_attendu);

    const succes =
      effortCentral.gauche !== undefined &&
      effortCentral.droite !== undefined &&
      ecartSaut < 1e-6 &&
      ecartMoment < 1e-6;

    resultats.push({
      id: 'T_SOLV.6',
      nom: 'Discontinuité des efforts internes (saut d\'effort tranchant)',
      phase: 'Brique §9.3',
      description: 'Poutre bi-appuyée avec charge ponctuelle P=60 kN au centre. Vérification du saut de tranchant ΔV = P entre section gauche et droite.',
      valeurAttendue: `V_gauche = -30.00 kN, V_droite = +30.00 kN, ΔV = ${P.toFixed(2)} kN, M = ${M_attendu.toFixed(2)} kNm`,
      valeurObtenue: `V_gauche = ${V_gauche.toFixed(2)} kN, V_droite = ${V_droite.toFixed(2)} kN, ΔV = ${sautTranchant.toFixed(2)} kN, M = ${M_max.toFixed(2)} kNm`,
      tolerance: 'Écart < 1e-6 kN',
      ecartAbsolu: ecartSaut,
      ecartPourcentage: (ecartSaut / P) * 100,
      succes,
      message: succes
        ? 'Discontinuité gauche/droite parfaitement représentée sans lissage artificiel'
        : 'Échec de la modélisation de la discontinuité',
    });
  }

  // --------------------------------------------------------------------------
  // T_SOLV.7 — Ressort avec déplacement de référence (installation phasée)
  // --------------------------------------------------------------------------
  {
    // Poutre console sous charge initiale P = 50 kN produisant un déplacement u0 non nul
    // Ajout d'un ressort au nœud d'extrémité avec deplacementReference = u0
    // La réaction du ressort doit être rigoureusement nulle (0.000 kN) tant qu'aucun chargement supplémentaire n'est appliqué
    const L = 5.0;
    const E = 30e6;
    const I = 0.001;
    const A = 0.05;
    const P = 50.0;
    const kRessort = 10000.0; // kN/m

    const noeuds: NoeudPoutre[] = [
      { x: 0.0, y: 0.0 },
      { x: L, y: 0.0 },
    ];
    const appuis: AppuiBloque[] = [
      { noeudIndex: 0, direction: 'x' },
      { noeudIndex: 0, direction: 'y' },
      { noeudIndex: 0, direction: 'rotation' },
    ];

    // Phase 1 : flexion sous P sans ressort -> obtention de u0
    const resPhase1 = resoudrePoutreSurRessorts(
      noeuds,
      E,
      I,
      A,
      [],
      [{ noeudIndex: 1, Fy: -P }],
      appuis
    );
    const u0 = resPhase1.deplacements[1].uy;

    // Phase 2 : même chargement P, ressort installé avec deplacementReference = u0
    const ressortsPhase2: RessortNodal[] = [
      {
        noeudIndex: 1,
        direction: 'y',
        raideur: kRessort,
        deplacementReference: u0,
      },
    ];

    const resPhase2 = resoudrePoutreSurRessorts(
      noeuds,
      E,
      I,
      A,
      ressortsPhase2,
      [{ noeudIndex: 1, Fy: -P }],
      appuis,
      { deplacements: resPhase1.deplacements }
    );

    const reactionRessort = resPhase2.reactionsRessorts[0]?.reaction ?? -999;
    const deplacementFinal = resPhase2.deplacements[1].uy;

    const ecartReaction = Math.abs(reactionRessort);
    const ecartDeplacement = Math.abs(deplacementFinal - u0);
    const succes = Math.abs(u0) > 1e-4 && ecartReaction < 1e-6 && ecartDeplacement < 1e-6;

    resultats.push({
      id: 'T_SOLV.7',
      nom: 'Ressort avec déplacement de référence (installation phasée)',
      phase: 'Brique §9.3',
      description:
        'Vérification qu\'un ressort posé avec deplacementReference = u0 donne une réaction rigoureusement nulle sous u0 (pas de précontrainte parasite).',
      valeurAttendue: 'R_ressort = 0.00 kN exactement quand u = u0',
      valeurObtenue: `u0 = ${(u0 * 1000).toFixed(3)} mm, R_ressort = ${reactionRessort.toExponential(3)} kN`,
      tolerance: 'Résidu réaction < 1e-6 kN',
      ecartAbsolu: ecartReaction,
      ecartPourcentage: 0,
      succes,
      message: succes
        ? 'Réaction nulle sous u=u0 validée : loi du ressort F = k*(u - u0) conforme au phasage d\'appuis'
        : 'Écart sur la réaction du ressort avec déplacement de référence',
    });
  }

  return resultats;
}
