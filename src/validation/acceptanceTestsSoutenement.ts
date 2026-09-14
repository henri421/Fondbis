import { CoucheGeotechnique, Hydrogeologie, ConfigurationNormative } from '../types/geotech';
import { CONFIG_NORMATIVE_DEFAUT } from '../norme/configNormativeDefaut';
import { TestResultatIndividuel } from './acceptanceTests';
import { calculerProfilPressionLimite } from '../modules/soutenement/pressionLimiteParoi';

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

  return resultats;
}
