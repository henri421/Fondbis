import { CoucheGeotechnique, Hydrogeologie, ConfigurationNormative, AppuiPhase, PhaseParoi } from '../types/geotech';
import { CONFIG_NORMATIVE_DEFAUT } from '../norme/configNormativeDefaut';
import { TestResultatIndividuel } from './acceptanceTests';
import { calculerProfilPressionLimite } from '../modules/soutenement/pressionLimiteParoi';
import { calculerParoiPhasee } from '../modules/soutenement/paroiPhasee';
import {
  calculerRepartitionProfileBlindage,
  verifierStabiliteFrontNonSoutenu,
  verifierResistanceBlindagePose,
  verifierFicheProfileReduite,
} from '../modules/soutenement/berlinoise';
import {
  verifierRecouvrementPieuxSecants,
  calculerInertieCompositePieuxSecants,
} from '../modules/soutenement/pieuxSecants';

/**
 * Suite de tests d'acceptation normatifs pour les écrans et parois de soutènement (Phase 4 / §8)
 */
export function executerTestsAcceptationSoutenement(
  config: ConfigurationNormative = CONFIG_NORMATIVE_DEFAUT
): TestResultatIndividuel[] {
  const resultats: TestResultatIndividuel[] = [];

  // --------------------------------------------------------------------------
  // T_PRESS.1 — Profil de pression limite le long d'un écran (§8.2)
  // --------------------------------------------------------------------------
  {
    // Couche homogène de sable : phi'=30°, c'=0, gamma=18 kN/m³
    const coucheSable: CoucheGeotechnique = {
      id: 'C_PRESS_1',
      nom: 'Sable de référence T_PRESS.1',
      coteToit: 100.0,
      epaisseur: 25.0,
      nature: 'sable',
      couleurAffichage: '#e9c46a',
      poidsVolumiques: {
        gammaHumide: { v: 18.0, u: 'kN/m³', statut: 'mesure', source: 'essai' },
        gammaSature: { v: 20.0, u: 'kN/m³', statut: 'mesure', source: 'essai' },
      },
      resistanceDrainee: {
        phiPrime: { v: 30.0, u: 'deg', statut: 'mesure', source: 'essai' },
        phiCritique: { v: 30.0, u: 'deg', statut: 'mesure', source: 'essai' },
        cPrime: { v: 0.0, u: 'kPa', statut: 'mesure', source: 'essai' },
        psiDilatance: { v: 0.0, u: 'deg', statut: 'mesure', source: 'essai' },
        deltaInterface: { v: 0.0, u: 'deg', statut: 'mesure', source: 'essai' },
      },
      resistanceNonDrainee: {
        cuTete: { v: 0.0, u: 'kPa', statut: 'mesure', source: 'defaut' },
        gradientCu: { v: 0.0, u: 'kPa/m', statut: 'mesure', source: 'defaut' },
      },
      deformation: {} as any,
    };

    // Pas de nappe (profonde)
    const hydroSansNappe: Hydrogeologie = {
      nappePrincipale: {
        coteCaracteristique: -100.0,
        coteDefavorableELU: -100.0,
        regime: 'hydrostatique',
      },
      gradientVertical: null,
      nappesSecondaires: [],
      poidsVolumiqueEau: 9.81,
    };

    const coteTerrainAmont = 100.0;
    const coteFondFouille = 97.0; // 3 m d'excavation
    const maillageTest = [100.0, 98.0, 97.0, 95.0, 90.0, 85.0];

    // Calcul du profil de pression limite (état ELS / valeurs caractéristiques, jeu M1)
    const profil = calculerProfilPressionLimite(
      coteTerrainAmont,
      coteFondFouille,
      [coucheSable],
      hydroSansNappe,
      hydroSansNappe,
      maillageTest,
      config,
      'ELS'
    );

    // Recherche des points aux cotes 90 et 98
    const pt90 = profil.find((p) => Math.abs(p.cote - 90.0) < 1e-3);
    const pt98 = profil.find((p) => Math.abs(p.cote - 98.0) < 1e-3);

    // Valeurs théoriques attendues
    // À la cote 90 (10 m sous TN amont, 7 m sous fond de fouille) :
    // Ka = 0.33333, Kp = 3.00000
    // sigma'_v,amont = 18 * 10 = 180.00 kPa -> Pa = 60.00 kPa
    // sigma'_v,aval = 18 * 7 = 126.00 kPa -> Pp = 378.00 kPa
    const Pa_attendu_90 = 60.0;
    const Pp_attendu_90 = 378.0;

    // À la cote 98 (au-dessus du fond de fouille côté aval) :
    // Pp = 0.00 kPa exactement
    // Pa = Ka * 18 * 2 = 12.00 kPa
    const Pa_attendu_98 = 12.0;
    const Pp_attendu_98 = 0.0;

    const Pa_obtenu_90 = pt90?.Pa ?? -1;
    const Pp_obtenu_90 = pt90?.Pp ?? -1;
    const Pa_obtenu_98 = pt98?.Pa ?? -1;
    const Pp_obtenu_98 = pt98?.Pp ?? -1;

    // Tolérance 0.5%
    const ecartPa90 = Math.abs(Pa_obtenu_90 - Pa_attendu_90);
    const ecartPp90 = Math.abs(Pp_obtenu_90 - Pp_attendu_90);
    const ecartPa98 = Math.abs(Pa_obtenu_98 - Pa_attendu_98);
    const ecartPp98 = Math.abs(Pp_obtenu_98 - Pp_attendu_98);

    const tolPa90 = (0.5 / 100) * Pa_attendu_90; // 0.30 kPa
    const tolPp90 = (0.5 / 100) * Pp_attendu_90; // 1.89 kPa
    const tolPa98 = (0.5 / 100) * Pa_attendu_98; // 0.06 kPa

    const succes =
      pt90 !== undefined &&
      pt98 !== undefined &&
      ecartPa90 <= tolPa90 &&
      ecartPp90 <= tolPp90 &&
      ecartPa98 <= tolPa98 &&
      ecartPp98 < 1e-4; // Strictement zéro au-dessus du fond de fouille

    const maxEcartPourcent = Math.max(
      (ecartPa90 / Pa_attendu_90) * 100,
      (ecartPp90 / Pp_attendu_90) * 100,
      (ecartPa98 / Pa_attendu_98) * 100
    );

    resultats.push({
      id: 'T_PRESS.1',
      nom: 'Profil de pressions limites le long d\'un écran (Pa, Pp, eau)',
      phase: 'Brique §8.2',
      description:
        'Calcul des bornes de pression active (amont) et passive (aval) avec excavation à 3 m. Vérification de Pa(90)=60 kPa, Pp(90)=378 kPa, et Pp(98)=0 kPa (excavé).',
      valeurAttendue: `Cote 90: Pa=60.00 kPa, Pp=378.00 kPa | Cote 98: Pa=12.00 kPa, Pp=0.00 kPa`,
      valeurObtenue: `Cote 90: Pa=${Pa_obtenu_90.toFixed(2)} kPa, Pp=${Pp_obtenu_90.toFixed(2)} kPa | Cote 98: Pa=${Pa_obtenu_98.toFixed(2)} kPa, Pp=${Pp_obtenu_98.toFixed(2)} kPa`,
      tolerance: '0.5 % sur Pa/Pp sous fond de fouille, Pp=0 exact au-dessus',
      ecartAbsolu: Math.max(ecartPa90, ecartPp90, ecartPa98, ecartPp98),
      ecartPourcentage: Number(maxEcartPourcent.toFixed(3)),
      succes,
      message: succes
        ? 'Pressions limites Pa et Pp parfaitement conformes aux solutions analytiques de Rankine amont/aval, sol excavé à Pp=0'
        : 'Écart hors tolérance sur les pressions limites de soutènement',
    });
  }

  // Couche sable standard pour les tests de phasage
  const coucheSable: CoucheGeotechnique = {
    id: 'C_SABLE',
    nom: 'Sable homogène de référence',
    coteToit: 100.0,
    epaisseur: 25.0,
    nature: 'sable',
    couleurAffichage: '#e9c46a',
    poidsVolumiques: {
      gammaHumide: { v: 18.0, u: 'kN/m³', statut: 'mesure', source: 'essai' },
      gammaSature: { v: 20.0, u: 'kN/m³', statut: 'mesure', source: 'essai' },
    },
    resistanceDrainee: {
      phiPrime: { v: 30.0, u: 'deg', statut: 'mesure', source: 'essai' },
      phiCritique: { v: 30.0, u: 'deg', statut: 'mesure', source: 'essai' },
      cPrime: { v: 0.0, u: 'kPa', statut: 'mesure', source: 'essai' },
      psiDilatance: { v: 0.0, u: 'deg', statut: 'mesure', source: 'essai' },
      deltaInterface: { v: 0.0, u: 'deg', statut: 'mesure', source: 'essai' },
    },
    resistanceNonDrainee: {
      cuTete: { v: 0.0, u: 'kPa', statut: 'mesure', source: 'defaut' },
      gradientCu: { v: 0.0, u: 'kPa/m', statut: 'mesure', source: 'defaut' },
    },
    deformation: {} as any,
  };

  const hydroSansNappe: Hydrogeologie = {
    nappePrincipale: {
      coteCaracteristique: -100.0,
      coteDefavorableELU: -100.0,
      regime: 'hydrostatique',
    },
    gradientVertical: null,
    nappesSecondaires: [],
    poidsVolumiqueEau: 9.81,
  };

  // --------------------------------------------------------------------------
  // T_PHASE.1 — Cohérence statique phase unique (§8.4)
  // --------------------------------------------------------------------------
  {
    const coteTete = 100.0;
    const coteFond = 97.0; // 3 m d'excavation
    const coteBase = 88.0; // 9 m de fiche

    const phase1: PhaseParoi = {
      numero: 1,
      nom: 'Excavation 3m sans appui',
      coteFondFouille: coteFond,
    };

    const resCalcul = calculerParoiPhasee({
      coteTete,
      coteBase,
      E: 30e6, // 30 GPa
      I: 0.04, // m4/m
      A: 0.8, // m2/m
      couches: [coucheSable],
      hydrogeologie: hydroSansNappe,
      configurationNormative: config,
      etat: 'ELS',
      phases: [phase1],
      appuis: [],
      khParCouche: 20000, // kN/m3
      pasMaillage: 0.25,
    });

    const phaseRes = resCalcul.phases[0];
    const prof = phaseRes.profilPressionLimite;

    // Somme nodale (lumped) de Pa(z) * largeurTributaire, UNIQUEMENT au-dessus du fond de
    // fouille : c'est exactement la charge appliquée par calculerParoiPhasee (moteur), nœud par
    // nœud. En dessous du fond de fouille, l'interaction sol est portée par le ressort net borné
    // [-Pa, +Pp] et non par une charge séparée (cf. revue Claude 2026-09-15) — l'inclure ici
    // recréerait le double-comptage corrigé dans le moteur. On recalcule ici avec la même
    // quadrature nodale que le moteur (pas une intégrale trapézoïdale continue, qui diverge
    // légèrement de la coupure nette au fond de fouille) pour que la comparaison soit une
    // vérification d'équilibre exacte, pas approximative.
    let Pa_integrale = 0;
    let Ma_base_integrale = 0;
    for (let i = 0; i < resCalcul.noeuds.length; i++) {
      const cote = resCalcul.noeuds[i].y;
      if (cote <= coteFond + 1e-4) continue;
      const pt = prof.find((p) => Math.abs(p.cote - cote) < 1e-3);
      const lt = resCalcul.largeursTributaires[i];
      const chargeNoeud = (pt?.Pa ?? 0) * lt;
      Pa_integrale += chargeNoeud;
      Ma_base_integrale += chargeNoeud * (cote - coteBase);
    }

    // Résultante totale et moment total donnés par les réactions des ressorts du solveur
    let R_totale_solveur = 0;
    let MR_base_solveur = 0;
    for (const r of phaseRes.resultatSolveur.reactionsRessorts) {
      R_totale_solveur += r.reaction;
      const coteNoeud = resCalcul.noeuds[r.noeudIndex].y;
      MR_base_solveur += r.reaction * (coteNoeud - coteBase);
    }

    const ecartR = Math.abs(R_totale_solveur - Pa_integrale);
    const ecartRelR = (ecartR / Pa_integrale) * 100;
    const ecartM = Math.abs(MR_base_solveur - Ma_base_integrale);
    const ecartRelM = (ecartM / Ma_base_integrale) * 100;

    const succes =
      phaseRes.resultatSolveur.convergence.convergé &&
      ecartRelR < 1.0 &&
      ecartRelM < 1.0;

    resultats.push({
      id: 'T_PHASE.1',
      nom: 'Cohérence statique phase unique (somme des réactions vs intégrale Pa)',
      phase: 'Brique §8.4',
      description:
        'Vérifie que la résultante horizontale totale et le moment à la base issus des réactions de ressorts du solveur équilibrent exactement la charge Pa(z) réellement appliquée au-dessus du fond de fouille (même quadrature nodale que le moteur). Contrôle l\'équilibre global du solveur, pas la pertinence physique du modèle de ressort en fiche (couverte qualitativement par T_PHASE.3 et la revue Claude).',
      valeurAttendue: `R_sol = ${Pa_integrale.toFixed(2)} kN/m, M_base = ${Ma_base_integrale.toFixed(2)} kNm/m`,
      valeurObtenue: `R_solveur = ${R_totale_solveur.toFixed(2)} kN/m, M_solveur = ${MR_base_solveur.toFixed(2)} kNm/m (écarts: R ${ecartRelR.toFixed(3)}%, M ${ecartRelM.toFixed(3)}%)`,
      tolerance: 'Écart relatif < 1.0 % (erreur de discrétisation)',
      ecartAbsolu: Math.max(ecartR, ecartM),
      ecartPourcentage: Number(Math.max(ecartRelR, ecartRelM).toFixed(3)),
      succes,
      message: succes
        ? 'Équilibre statique global rigoureusement vérifié entre intégrale Pa et réactions de sol'
        : 'Non-cohérence statique entre réactions de ressorts et diagramme de poussée',
    });
  }

  // --------------------------------------------------------------------------
  // T_PHASE.2 — Chaînage et buton installé en cours de phasage (§8.4)
  // --------------------------------------------------------------------------
  {
    const coteTete = 100.0;
    const coteBase = 88.0;
    const coteButon = 99.0;
    const kButon = 50000.0; // kN/m

    const appuiButon: AppuiPhase = {
      id: 'BUTON_1',
      cote: coteButon,
      type: 'buton',
      raideur: kButon,
      phaseActivation: 2, // Activé en phase 2 seulement
    };

    const phase1: PhaseParoi = {
      numero: 1,
      nom: 'Excavation 2m sans appui',
      coteFondFouille: 98.0,
    };

    const phase2: PhaseParoi = {
      numero: 2,
      nom: 'Excavation 5m avec buton activé à 99m',
      coteFondFouille: 95.0,
    };

    const resCalcul = calculerParoiPhasee({
      coteTete,
      coteBase,
      E: 30e6,
      I: 0.04,
      A: 0.8,
      couches: [coucheSable],
      hydrogeologie: hydroSansNappe,
      configurationNormative: config,
      etat: 'ELS',
      phases: [phase1, phase2],
      appuis: [appuiButon],
      khParCouche: 20000,
      pasMaillage: 0.25,
    });

    const p1Res = resCalcul.phases[0];
    const p2Res = resCalcul.phases[1];

    // Recherche de l'index du nœud correspondant à la cote du buton
    const idxButon = resCalcul.noeuds.findIndex(
      (n) => Math.abs(n.y - coteButon) < 1e-4
    );

    const u1 = p1Res.resultatSolveur.deplacements[idxButon].ux;
    const u2 = p2Res.resultatSolveur.deplacements[idxButon].ux;

    const infoButonP2 = p2Res.reactionsAppuis.find((a) => a.appuiId === 'BUTON_1');
    const reactionObtenue = infoButonP2?.reaction ?? 0;
    const reactionAttendue = kButon * (u2 - u1);
    const reactionFausseSansChainage = kButon * u2;

    const ecartAbsolu = Math.abs(reactionObtenue - reactionAttendue);
    const ecartChainageVsFaux = Math.abs(reactionObtenue - reactionFausseSansChainage);

    const succes =
      Math.abs(u1) > 1e-4 && // u1 doit être non nul pour que le test ait du sens
      ecartAbsolu < 1e-5 && // Réaction égale à k*(u2 - u1)
      ecartChainageVsFaux > 10.0; // Vérification que sans chaînage, la valeur aurait été significativement fausse

    resultats.push({
      id: 'T_PHASE.2',
      nom: 'Chaînage et buton installé en cours de phasage (loi F = k*(u2 - u1))',
      phase: 'Brique §8.4',
      description:
        'Vérifie qu\'un appui activé en phase 2 prend pour référence le déplacement u1 de la phase 1, avec réaction exacte R = k*(u2 - u1) et non k*u2.',
      valeurAttendue: `u1 = ${(u1 * 1000).toFixed(2)} mm, R_buton = ${reactionAttendue.toFixed(2)} kN/m`,
      valeurObtenue: `u1 = ${(u1 * 1000).toFixed(2)} mm, R_buton = ${reactionObtenue.toFixed(2)} kN/m (si sans chaînage: ${reactionFausseSansChainage.toFixed(2)} kN/m)`,
      tolerance: 'Résidu < 1e-5 kN/m sur la loi du ressort, u1 > 0.1 mm',
      ecartAbsolu,
      ecartPourcentage: Number(((ecartAbsolu / Math.max(1, Math.abs(reactionAttendue))) * 100).toFixed(6)),
      succes,
      message: succes
        ? 'Chaînage des déplacements parfaitement effectif : déformation initiale u1 neutralisée dans le buton'
        : 'Échec du chaînage : déplacement de référence u1 non pris en compte dans le buton',
    });
  }

  // --------------------------------------------------------------------------
  // T_PHASE.3 — Monotonie physique (garde-fou cantilever) (§8.4)
  // --------------------------------------------------------------------------
  {
    const coteTete = 100.0;
    const coteBase = 86.0;

    const phase1: PhaseParoi = {
      numero: 1,
      nom: 'Excavation 2m',
      coteFondFouille: 98.0,
    };

    const phase2: PhaseParoi = {
      numero: 2,
      nom: 'Excavation 4m',
      coteFondFouille: 96.0,
    };

    const resCalcul = calculerParoiPhasee({
      coteTete,
      coteBase,
      E: 30e6,
      I: 0.04,
      A: 0.8,
      couches: [coucheSable],
      hydrogeologie: hydroSansNappe,
      configurationNormative: config,
      etat: 'ELS',
      phases: [phase1, phase2],
      appuis: [],
      khParCouche: 20000,
      pasMaillage: 0.25,
    });

    const M1 = resCalcul.phases[0].momentMaxAbsolu;
    const M2 = resCalcul.phases[1].momentMaxAbsolu;
    const u1Max = resCalcul.phases[0].deplacementMaxAbsolu;
    const u2Max = resCalcul.phases[1].deplacementMaxAbsolu;

    const succes = M2 > M1 && u2Max > u1Max;

    resultats.push({
      id: 'T_PHASE.3',
      nom: 'Monotonie physique (augmentation des sollicitations avec excavation)',
      phase: 'Brique §8.4',
      description:
        'Vérifie sur une paroi cantilever que le moment fléchissant maximal et la flèche maximale augmentent strictement entre une excavation à 2 m et une excavation à 4 m.',
      valeurAttendue: 'M_max(phase 2) > M_max(phase 1) et u_max(phase 2) > u_max(phase 1)',
      valeurObtenue: `M1 = ${M1.toFixed(2)} kNm/m, M2 = ${M2.toFixed(2)} kNm/m | u1 = ${(u1Max * 1000).toFixed(2)} mm, u2 = ${(u2Max * 1000).toFixed(2)} mm`,
      tolerance: 'M2 > M1 et u2 > u1 stricts',
      ecartAbsolu: 0,
      ecartPourcentage: 0,
      succes,
      message: succes
        ? 'Monotonie physique respectée : sollicitations et flèches augmentent strictement avec le creusement'
        : 'Violation de la monotonie physique (possible inversion de signe des charges ou rigidités)',
    });
  }

  // --------------------------------------------------------------------------
  // T_PHASE.4 — Détection de rupture passive / mécanisme cinématique (§8.4 / §9.3)
  // --------------------------------------------------------------------------
  {
    // Paroi de 12 m avec fiche insuffisante (excavation à 10 m, fiche de 2 m)
    const coucheSable: CoucheGeotechnique = {
      id: 'C_PHASE_4_SABLE',
      nom: 'Sable alluvial frottant modéré',
      coteToit: 100.0,
      epaisseur: 15.0,
      nature: 'sable',
      couleurAffichage: '#e9c46a',
      poidsVolumiques: {
        gammaHumide: { v: 18.0, u: 'kN/m³', statut: 'mesure', source: 'essai' },
        gammaSature: { v: 20.0, u: 'kN/m³', statut: 'mesure', source: 'essai' },
      },
      resistanceDrainee: {
        phiPrime: { v: 25.0, u: 'deg', statut: 'mesure', source: 'essai' },
        phiCritique: { v: 25.0, u: 'deg', statut: 'mesure', source: 'essai' },
        cPrime: { v: 0.0, u: 'kPa', statut: 'mesure', source: 'essai' },
        psiDilatance: { v: 0.0, u: 'deg', statut: 'mesure', source: 'essai' },
        deltaInterface: { v: 0.0, u: 'deg', statut: 'mesure', source: 'essai' },
      },
      resistanceNonDrainee: {
        cuTete: { v: 0.0, u: 'kPa', statut: 'mesure', source: 'defaut' },
        gradientCu: { v: 0.0, u: 'kPa/m', statut: 'mesure', source: 'defaut' },
      },
      deformation: {} as any,
    };

    const hydroSansNappe: Hydrogeologie = {
      nappePrincipale: {
        coteCaracteristique: 80.0,
        coteDefavorableELU: 80.0,
        regime: 'hydrostatique',
      },
      gradientVertical: null,
      nappesSecondaires: [],
      poidsVolumiqueEau: 9.81,
    };

    // Paroi de 12 m de hauteur (cote tête = 100, cote base = 88)
    // Phase 1 : creusement modéré à 97 m (-3 m)
    // Phase 2 : pose buton à 98 m, creusement à 94 m (-6 m)
    // Phase 3 : creusement excessif à 90 m (-10 m), fiche restante de 2 m menant à la rupture de butée
    const resPhasee = calculerParoiPhasee({
      coteTete: 100.0,
      coteBase: 88.0,
      E: 30e6,
      I: (1 * Math.pow(0.6, 3)) / 12,
      A: 0.6,
      couches: [coucheSable],
      hydrogeologie: hydroSansNappe,
      configurationNormative: config,
      etat: 'ELS',
      phases: [
        { numero: 1, nom: 'Phase 1 - Excavation 3m', coteFondFouille: 97.0 },
        { numero: 2, nom: 'Phase 2 - Buton & Excavation 6m', coteFondFouille: 94.0 },
        { numero: 3, nom: 'Phase 3 - Excavation critique 10m', coteFondFouille: 90.0 },
      ],
      appuis: [
        { id: 'BUTON-01', cote: 98.0, type: 'buton', raideur: 100000, reactionMax: 500, phaseActivation: 2 },
      ],
      khParCouche: 20000,
      pasMaillage: 0.25,
    });

    const p1 = resPhasee.phases[0];
    const p2 = resPhasee.phases[1];
    const p3 = resPhasee.phases[2];

    const p1Convergé = p1.resultatSolveur.convergence.convergé;
    const p2Convergé = p2.resultatSolveur.convergence.convergé;
    const p3EchecSignale = !p3.resultatSolveur.convergence.convergé;
    const avertissementPresent = p3.resultatSolveur.convergence.avertissements.some(
      (a) => a.includes('Capacité passive insuffisante') || a.includes('mécanisme')
    );
    const deplacementBorne = p3.deplacementMaxAbsolu <= 3.0; // Pas de nombre divergent à 10+ chiffres

    const succes = p1Convergé && p2Convergé && p3EchecSignale && avertissementPresent && deplacementBorne;

    resultats.push({
      id: 'T_PHASE.4',
      nom: 'Détection explicite de rupture passive et garde-fou de déplacement (§8.4 / §9.3)',
      phase: 'Brique §8.4',
      description:
        'Vérifie que lorsqu une fouille dépasse la capacité passive de la fiche (mécanisme de rotation), le solveur signale explicitement la non-convergence, émet un avertissement normatif sans divergence numérique à 10+ chiffres.',
      valeurAttendue: 'Phase 1 & 2 convergées, Phase 3 convergé=false, avertissement mécanisme émis, u_max borné ≤ 3m',
      valeurObtenue: `P1: ${p1Convergé ? 'OK' : 'KO'}, P2: ${p2Convergé ? 'OK' : 'KO'}, P3 convergé: ${p3.resultatSolveur.convergence.convergé}, u3_max: ${(p3.deplacementMaxAbsolu * 1000).toFixed(1)} mm, avertissements: ${p3.resultatSolveur.convergence.avertissements.length}`,
      tolerance: 'Détection explicite de mécanisme et bornage physique rigoureux',
      ecartAbsolu: 0,
      ecartPourcentage: 0,
      succes,
      message: succes
        ? 'Rupture passive et mécanisme cinématique détectés avec succès : non-convergence explicitement signalée et déplacement physiquement borné'
        : 'Échec de détection de mécanisme : le solveur renvoie une convergence erronée ou un déplacement aberrant non borné',
    });
  }

  // --------------------------------------------------------------------------
  // T_BERL.1 — Répartition profilé/blindage, sans voûte (§8.5)
  // --------------------------------------------------------------------------
  {
    const momentGlobalMaxParM = 150.0; // kNm/m, valeur de référence arbitraire
    const entraxe = 1.2; // m

    const rep = calculerRepartitionProfileBlindage(momentGlobalMaxParM, entraxe);
    const momentProfileAttendu = 180.0; // 150 * 1.2, calcul à la main

    const ecart = Math.abs(rep.momentProfile - momentProfileAttendu);
    const succes = ecart < 1e-6 && rep.voûteNonPriseEnCompte === true;

    resultats.push({
      id: 'T_BERL.1',
      nom: 'Répartition profilé/blindage sans réduction de voûte',
      phase: 'Surcouche §8.5',
      description:
        'Conversion du moment global lissé (150 kNm/m) en moment sur un profilé isolé à entraxe 1.2 m, sans aucune réduction liée à un effet de voûte (hypothèse conservatrice).',
      valeurAttendue: `momentProfile = ${momentProfileAttendu.toFixed(2)} kNm, voûteNonPriseEnCompte = true`,
      valeurObtenue: `momentProfile = ${rep.momentProfile.toFixed(2)} kNm, voûteNonPriseEnCompte = ${rep.voûteNonPriseEnCompte}`,
      tolerance: 'Exact (calcul déterministe)',
      ecartAbsolu: ecart,
      ecartPourcentage: 0,
      succes,
      message: succes
        ? 'Répartition profilé/blindage conforme, hypothèse conservatrice bien signalée'
        : 'Écart sur le moment redistribué au profilé',
    });
  }

  // --------------------------------------------------------------------------
  // T_BERL.2 — Stabilité du front non soutenu, cas stable et instable (§8.5)
  // --------------------------------------------------------------------------
  {
    const cu_k = 40.0; // kPa
    const gamma_cu = 1.40; // M2 par défaut (CONFIG_NORMATIVE_DEFAUT)
    const gammaHumide = 18.0; // kN/m³
    const hauteurCritiqueAttendue = (4 * (cu_k / gamma_cu)) / gammaHumide; // 6.3492 m

    const casStable = verifierStabiliteFrontNonSoutenu(cu_k, gamma_cu, gammaHumide, 1.5);
    const casInstable = verifierStabiliteFrontNonSoutenu(cu_k, gamma_cu, gammaHumide, 8.0);

    const ecartHc = Math.abs(casStable.hauteurCritique - hauteurCritiqueAttendue);
    const succes =
      ecartHc < 1e-3 &&
      casStable.stable === true &&
      casStable.facteurSecurite > 1.0 &&
      casInstable.stable === false &&
      casInstable.facteurSecurite < 1.0;

    resultats.push({
      id: 'T_BERL.2',
      nom: 'Stabilité du front non soutenu (Hc = 4.cu/gamma)',
      phase: 'Surcouche §8.5',
      description:
        'cu_k=40 kPa, gamma_cu=1.40 (M2), gamma=18 kN/m³ -> Hc=6.35 m. Passe de 1.5 m stable, passe de 8.0 m instable.',
      valeurAttendue: `Hc = ${hauteurCritiqueAttendue.toFixed(2)} m ; stable(1.5m)=true ; stable(8.0m)=false`,
      valeurObtenue: `Hc = ${casStable.hauteurCritique.toFixed(2)} m ; FS(1.5m)=${casStable.facteurSecurite.toFixed(2)} (stable=${casStable.stable}) ; FS(8.0m)=${casInstable.facteurSecurite.toFixed(2)} (stable=${casInstable.stable})`,
      tolerance: '1e-3 m sur Hc, comparaisons strictes sur stable',
      ecartAbsolu: ecartHc,
      ecartPourcentage: 0,
      succes,
      message: succes
        ? 'Hauteur critique correcte, cas stable et instable correctement distingués'
        : 'Écart sur Hc ou mauvaise classification stable/instable',
    });
  }

  // --------------------------------------------------------------------------
  // T_BERL.3 — Résistance du blindage posé, cas conforme et non conforme (§8.5)
  // --------------------------------------------------------------------------
  {
    const pressionActive = 30.0; // kPa
    const entraxe = 1.2; // m
    const epaisseur = 0.05; // m
    const momentDemandeAttendu = (30.0 * 1.2 ** 2) / 8; // 5.4 kNm/m

    const casConforme = verifierResistanceBlindagePose(pressionActive, entraxe, epaisseur, 15000);
    const casNonConforme = verifierResistanceBlindagePose(pressionActive, entraxe, epaisseur, 8000);

    const ecart = Math.abs(casConforme.momentDemande - momentDemandeAttendu);
    const succes =
      ecart < 1e-6 &&
      casConforme.conforme === true &&
      casNonConforme.conforme === false &&
      casConforme.momentDemande === casNonConforme.momentDemande;

    resultats.push({
      id: 'T_BERL.3',
      nom: 'Résistance en flexion du blindage posé',
      phase: 'Surcouche §8.5',
      description:
        'Pa=30 kPa, entraxe=1.2 m, epaisseur=5 cm -> moment demandé 5.4 kNm/m. Contrainte admissible 15 MPa -> conforme, 8 MPa -> non conforme.',
      valeurAttendue: `momentDemande = ${momentDemandeAttendu.toFixed(2)} kNm/m ; conforme(15MPa)=true ; conforme(8MPa)=false`,
      valeurObtenue: `momentDemande = ${casConforme.momentDemande.toFixed(2)} kNm/m ; conforme(15MPa)=${casConforme.conforme} (resistant=${casConforme.momentResistant.toFixed(2)}) ; conforme(8MPa)=${casNonConforme.conforme} (resistant=${casNonConforme.momentResistant.toFixed(2)})`,
      tolerance: 'Exact sur le moment demandé, strict sur conforme',
      ecartAbsolu: ecart,
      ecartPourcentage: 0,
      succes,
      message: succes
        ? 'Moment demandé correct, classification conforme/non conforme correcte selon la contrainte admissible'
        : 'Écart sur le moment demandé ou mauvaise classification',
    });
  }

  // --------------------------------------------------------------------------
  // T_BERL.4 — Fiche réduite : conforme, non conforme, garde-fou déclenché (§8.5)
  // --------------------------------------------------------------------------
  {
    const entraxe = 1.2; // m
    const largeurProfile = 0.3; // m

    // Cas A : conforme (Pp élevé -> capacité réduite suffisante), solveur convergé
    const noeudsConforme = [
      { cote: 90.0, demandeMobiliseeParM: 50.0, Pp: 800.0, largeurTributaire: 0.5 },
    ];
    const casConforme = verifierFicheProfileReduite(
      noeudsConforme, entraxe, largeurProfile, true, 0.01
    );

    // Cas B : non conforme, mais garde-fou NON déclenché (solveur convergé)
    const noeudsNonConforme = [
      { cote: 90.0, demandeMobiliseeParM: 50.0, Pp: 200.0, largeurTributaire: 0.5 },
    ];
    const casNonConforme = verifierFicheProfileReduite(
      noeudsNonConforme, entraxe, largeurProfile, true, 0.01
    );

    // Cas C : garde-fou déclenché — le solveur Niveau 2 signale lui-même la non-convergence
    // (mécanisme / capacité passive insuffisante détectée par solveurPoutreRessorts.ts)
    const casGardeFou = verifierFicheProfileReduite(
      noeudsConforme, entraxe, largeurProfile, false, 2.5
    );

    const succes =
      casConforme.conforme === true &&
      casConforme.gardeFouDeclenche === false &&
      casNonConforme.conforme === false &&
      casNonConforme.gardeFouDeclenche === false &&
      casGardeFou.gardeFouDeclenche === true &&
      casGardeFou.conforme === false &&
      typeof casGardeFou.avertissement === 'string' &&
      casGardeFou.avertissement.length > 0;

    resultats.push({
      id: 'T_BERL.4',
      nom: 'Fiche réduite sur largeur propre du profilé + garde-fou local',
      phase: 'Surcouche §8.5',
      description:
        'Cas A (Pp=800 kPa, solveur convergé) conforme sans garde-fou ; Cas B (Pp=200 kPa, solveur convergé) non conforme sans garde-fou ; Cas C (solveur non convergé) garde-fou déclenché avec avertissement explicite.',
      valeurAttendue: 'conforme=true/false/false, garde-fou=false/false/true, avertissement non vide en C',
      valeurObtenue: `A: conforme=${casConforme.conforme}, garde-fou=${casConforme.gardeFouDeclenche} | B: conforme=${casNonConforme.conforme}, garde-fou=${casNonConforme.gardeFouDeclenche} | C: conforme=${casGardeFou.conforme}, garde-fou=${casGardeFou.gardeFouDeclenche}`,
      tolerance: 'Comparaisons strictes (booléens)',
      ecartAbsolu: 0,
      ecartPourcentage: 0,
      succes,
      message: succes
        ? 'Fiche réduite correctement évaluée sur les 3 cas, garde-fou local opérationnel et non silencieux'
        : 'Classification incorrecte sur au moins un des 3 cas (conforme / garde-fou / avertissement)',
    });
  }

  // --------------------------------------------------------------------------
  // T_PSEC.1 — Recouvrement pieux sécants : conforme, insuffisant, rompu (§8.5)
  // --------------------------------------------------------------------------
  {
    const geometrie = {
      diametrePrimaire: 0.8,
      diametreSecondaire: 0.8,
      entraxe: 0.65,
    };
    const profondeurMax = 10.0; // m

    // Cas A : déviation 0.5%, seuil 0.03 m -> conforme
    // recouvrementSurface = (0.8+0.8)/2 - 0.65 = 0.15 m
    // dériveMax = 2*0.005*10 = 0.1 m -> entraxeEffectifMax = 0.75 m
    // recouvrementProfondeurMax = 0.8 - 0.75 = 0.05 m >= 0.03 m -> conforme
    const casConforme = verifierRecouvrementPieuxSecants(
      { ...geometrie, deviationVerticaliteMax: 0.005, recouvrementMinimalRequis: 0.03 },
      profondeurMax
    );

    // Cas B : même géométrie, seuil 0.08 m -> non conforme (mais continuité pas rompue)
    const casInsuffisant = verifierRecouvrementPieuxSecants(
      { ...geometrie, deviationVerticaliteMax: 0.005, recouvrementMinimalRequis: 0.08 },
      profondeurMax
    );

    // Cas C : déviation 2% -> recouvrementProfondeurMax = 0.8 - (0.65 + 0.4) = -0.25 m
    // -> continuité mécanique rompue, quel que soit le seuil
    const casRompu = verifierRecouvrementPieuxSecants(
      { ...geometrie, deviationVerticaliteMax: 0.02, recouvrementMinimalRequis: 0.03 },
      profondeurMax
    );

    const recouvrementSurfaceAttendu = 0.15;
    const ecartSurface = Math.abs(casConforme.recouvrementSurface - recouvrementSurfaceAttendu);
    const recouvrementProfondeurAttendu = 0.05;
    const ecartProfondeur = Math.abs(casConforme.recouvrementProfondeurMax - recouvrementProfondeurAttendu);

    const succes =
      ecartSurface < 1e-9 &&
      ecartProfondeur < 1e-9 &&
      casConforme.conforme === true &&
      casConforme.continuiteMecaniqueRompue === false &&
      casInsuffisant.conforme === false &&
      casInsuffisant.continuiteMecaniqueRompue === false &&
      casRompu.continuiteMecaniqueRompue === true &&
      casRompu.conforme === false &&
      Math.abs(casRompu.recouvrementProfondeurMax - -0.25) < 1e-9;

    resultats.push({
      id: 'T_PSEC.1',
      nom: 'Recouvrement pieux sécants : conforme, insuffisant, continuité rompue',
      phase: 'Surcouche §8.5',
      description:
        'Dp=Ds=0.8 m, entraxe=0.65 m, profondeur=10 m. Cas A (déviation 0.5%, seuil 0.03 m) conforme ; Cas B (même géométrie, seuil 0.08 m) non conforme sans rupture ; Cas C (déviation 2%) continuité mécanique rompue.',
      valeurAttendue: 'recouvrementSurface=0.15 m, recouvrementProfondeurMax(A)=0.05 m, conforme=true/false, rompu(C)=true (recouvrement=-0.25 m)',
      valeurObtenue: `A: surface=${casConforme.recouvrementSurface.toFixed(3)} m, profondeur=${casConforme.recouvrementProfondeurMax.toFixed(3)} m, conforme=${casConforme.conforme} | B: conforme=${casInsuffisant.conforme}, rompu=${casInsuffisant.continuiteMecaniqueRompue} | C: profondeur=${casRompu.recouvrementProfondeurMax.toFixed(3)} m, rompu=${casRompu.continuiteMecaniqueRompue}`,
      tolerance: '1e-9 sur les valeurs géométriques, strict sur les booléens',
      ecartAbsolu: Math.max(ecartSurface, ecartProfondeur),
      ecartPourcentage: 0,
      succes,
      message: succes
        ? 'Recouvrement géométrique correct sur les 3 cas, dérive de forage et seuil d\'étanchéité correctement appliqués'
        : 'Écart sur le recouvrement géométrique ou mauvaise classification conforme/rompu',
    });
  }

  // --------------------------------------------------------------------------
  // T_PSEC.2 — Inertie composite pieux sécants, cas symétrique (§8.5)
  // --------------------------------------------------------------------------
  {
    // Non-régression : pas de solution de référence externe indépendante disponible pour
    // une section composite exacte (cf. spec, approximation par superposition documentée) —
    // ce test fige la formule des axes parallèles (Huygens) une fois vérifiée à la main,
    // il ne prouve pas son exactitude physique de façon indépendante.
    const Dp = 0.8;
    const Ds = 0.8;
    const entraxe = 0.65;

    const resultat = calculerInertieCompositePieuxSecants({
      diametrePrimaire: Dp,
      diametreSecondaire: Ds,
      entraxe,
    });

    // Calcul à la main (cas symétrique Dp=Ds -> centre de gravité exactement à entraxe/2) :
    const Ap = (Math.PI * Dp * Dp) / 4;
    const Ip = (Math.PI * Dp ** 4) / 64;
    const d = entraxe / 2;
    const I_totalAttendu = 2 * (Ip + Ap * d * d);
    const A_totalAttendu = 2 * Ap;
    const I_m4ParMAttendu = I_totalAttendu / entraxe;
    const A_m2ParMAttendu = A_totalAttendu / entraxe;

    const ecartI = Math.abs(resultat.I_m4ParM - I_m4ParMAttendu);
    const ecartA = Math.abs(resultat.A_m2ParM - A_m2ParMAttendu);

    const succes = ecartI < 1e-9 && ecartA < 1e-9 && resultat.approximationSuperposition === true;

    resultats.push({
      id: 'T_PSEC.2',
      nom: 'Inertie composite pieux sécants (superposition, cas symétrique)',
      phase: 'Surcouche §8.5',
      description:
        'Dp=Ds=0.8 m, entraxe=0.65 m : par symétrie le centre de gravité du motif primaire+secondaire est exactement à entraxe/2. Vérifie la formule des axes parallèles (Huygens) appliquée par le moteur contre le même calcul reproduit indépendamment dans le test.',
      valeurAttendue: `I_m4ParM = ${I_m4ParMAttendu.toFixed(6)} m⁴/m, A_m2ParM = ${A_m2ParMAttendu.toFixed(6)} m²/m, approximationSuperposition = true`,
      valeurObtenue: `I_m4ParM = ${resultat.I_m4ParM.toFixed(6)} m⁴/m, A_m2ParM = ${resultat.A_m2ParM.toFixed(6)} m²/m, approximationSuperposition = ${resultat.approximationSuperposition}`,
      tolerance: '1e-9 (calcul déterministe)',
      ecartAbsolu: Math.max(ecartI, ecartA),
      ecartPourcentage: 0,
      succes,
      message: succes
        ? 'Inertie composite conforme à la formule des axes parallèles, hypothèse de superposition bien signalée'
        : 'Écart sur l\'inertie ou l\'aire composite calculée',
    });
  }

  return resultats;
}
