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

export interface ResultatStabiliteFrontNonSoutenu {
  hauteurCritique: number; // m, Hc = 4.cu,d / gamma
  facteurSecurite: number; // Hc / hauteurPasse
  stable: boolean;
}

/**
 * Stabilité à court terme d'une coupe verticale non soutenue en sol cohérent
 * (Hc = 4.cu/gamma, formule classique de hauteur critique non soutenue).
 */
export function verifierStabiliteFrontNonSoutenu(
  cu_k: number, // kPa
  gamma_cu: number, // facteur partiel (facteursSol.M2.gamma_cu)
  gammaHumide: number, // kN/m³
  hauteurPasse: number // m
): ResultatStabiliteFrontNonSoutenu {
  const cu_d = cu_k / gamma_cu;
  const hauteurCritique = (4 * cu_d) / gammaHumide;
  const facteurSecurite = hauteurCritique / hauteurPasse;
  return { hauteurCritique, facteurSecurite, stable: facteurSecurite >= 1.0 };
}

export interface ResultatResistanceBlindage {
  momentDemande: number; // kN.m/m
  momentResistant: number; // kN.m/m
  conforme: boolean;
}

/**
 * Flexion du madrier une fois posé, poutre simplement appuyée entre deux profilés
 * (portée = entraxe), sous la pression active Pa au niveau considéré.
 */
export function verifierResistanceBlindagePose(
  pressionActive: number, // kPa
  entraxeProfiles: number, // m
  epaisseurBlindage: number, // m
  contrainteAdmissible: number // kPa
): ResultatResistanceBlindage {
  const momentDemande = (pressionActive * entraxeProfiles ** 2) / 8;
  const momentResistant = (contrainteAdmissible * epaisseurBlindage ** 2) / 6;
  return { momentDemande, momentResistant, conforme: momentResistant >= momentDemande };
}
