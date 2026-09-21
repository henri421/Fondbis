/**
 * Surcouche Berlinoise (EN 1997-1 §8.5) — post-traitement des résultats de
 * `calculerParoiPhasee` (Niveau 2). Ne recalcule rien du moteur partagé.
 */
import {
  ConfigurationNormative,
  CoucheGeotechnique,
  PhaseParoi,
} from '../../types/geotech';
import { ResultatCalculParoiPhasee } from './paroiPhasee';
import { trouverCoucheACote } from '../../core/profilContraintes';

export interface ParametresProfileBerlinoise {
  entraxeProfiles: number; // m
  profile: { I: number; W: number; largeur: number }; // m⁴, m³, m
  blindage: { hauteurPasse: number; epaisseur: number; contrainteAdmissible: number };
}

export interface ResultatRepartitionProfileBlindage {
  momentProfile: number; // kN.m, moment demandé sur UN profilé isolé
  voûteNonPriseEnCompte: true;
}

/**
 * Convertit le moment global "par mètre linéaire lissé" (sortie du solveur Niveau 2) en
 * moment discret sur un profilé, en supposant qu'il reprend 100% de l'effort sur sa largeur
 * tributaire (entraxe) — hypothèse conservatrice, pas de méthode de voûte sourcée disponible
 * (cf. DEVPLAN, spec surcouche Berlinoise).
 */
export function calculerRepartitionProfileBlindage(
  momentGlobalMaxParM: number, // kN.m/m — resultatPhase.momentMaxAbsolu
  entraxeProfiles: number
): ResultatRepartitionProfileBlindage {
  return {
    momentProfile: momentGlobalMaxParM * entraxeProfiles,
    voûteNonPriseEnCompte: true,
  };
}
