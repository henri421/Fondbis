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

export interface NoeudFicheBerlinoise {
  cote: number;
  demandeMobiliseeParM: number; // kN/m — |reaction ressort x| au nœud (résultat smeared du solveur)
  Pp: number; // kPa — borne passive pleine largeur à ce nœud
  largeurTributaire: number; // m — hauteur d'influence verticale du nœud
}

export interface ResultatFicheReduite {
  demandeMax: number; // kN — pire cas sur un profilé isolé
  capaciteReduiteMax: number; // kN — butée dispo sur la largeur propre du profilé, même nœud
  conforme: boolean;
  gardeFouDeclenche: boolean;
  avertissement?: string;
}

/**
 * Vérifie la fiche sur la largeur PROPRE du profilé (pas la largeur tributaire pleine
 * qu'utilise le solveur Niveau 2 smeared) : sous le fond de fouille, un profilé isolé ne
 * peut mobiliser la butée que sur sa propre largeur physique, pas sur toute la largeur
 * qu'occuperait un écran continu.
 *
 * Garde-fou : s'appuie directement sur `resultatSolveur.convergence.convergé`, désormais
 * fiable (le solveur détecte lui-même l'insuffisance de capacité passive / mécanisme — cf.
 * DEVPLAN, tâche "Correction définitive du solveur (Cause 2)", corrigée en amont). On ne
 * fait pas confiance au résultat de fiche si la phase elle-même n'a pas convergé : le moment
 * et le déplacement remontés seraient ceux d'un mécanisme, pas d'un état d'équilibre réel.
 */
export function verifierFicheProfileReduite(
  noeudsSousFiche: NoeudFicheBerlinoise[],
  entraxeProfiles: number,
  largeurProfile: number,
  solveurConverge: boolean,
  deplacementMaxPhase: number // m, pour le message uniquement
): ResultatFicheReduite {
  let demandeMax = 0;
  let capaciteReduiteMax = 0;
  let pireRatio = 0;

  for (const n of noeudsSousFiche) {
    const demandeNode = n.demandeMobiliseeParM * entraxeProfiles; // kN
    const capaciteNode = n.Pp * largeurProfile * n.largeurTributaire; // kN
    const ratio = capaciteNode > 1e-6 ? demandeNode / capaciteNode : demandeNode > 1e-6 ? Infinity : 0;
    if (ratio > pireRatio) {
      pireRatio = ratio;
      demandeMax = demandeNode;
      capaciteReduiteMax = capaciteNode;
    }
  }

  const conformeBrut = pireRatio <= 1.0;
  const gardeFouDeclenche = !solveurConverge;

  return {
    demandeMax,
    capaciteReduiteMax,
    conforme: gardeFouDeclenche ? false : conformeBrut,
    gardeFouDeclenche,
    avertissement: gardeFouDeclenche
      ? `Le solveur Niveau 2 signale une non-convergence sur cette phase (déplacement=${(deplacementMaxPhase * 1000).toFixed(0)} mm) — capacité passive possiblement insuffisante, mécanisme potentiel. Fiche ou appuis à revoir avant tout usage.`
      : undefined,
  };
}

export interface ResultatSurcoucheBerlinoisePhase {
  phase: PhaseParoi;
  repartition: ResultatRepartitionProfileBlindage;
  stabiliteFront: ResultatStabiliteFrontNonSoutenu;
  resistanceBlindage: ResultatResistanceBlindage;
  ficheReduite: ResultatFicheReduite;
}

/**
 * Orchestrateur : calcule les 4 vérifications §8.5 pour chaque phase à partir des résultats
 * déjà produits par calculerParoiPhasee (Niveau 2). Ne recalcule jamais le moteur partagé.
 */
export function calculerSurcoucheBerlinoise(
  resultat: ResultatCalculParoiPhasee,
  parametres: ParametresProfileBerlinoise,
  couches: CoucheGeotechnique[],
  configurationNormative: ConfigurationNormative
): ResultatSurcoucheBerlinoisePhase[] {
  return resultat.phases.map((resultatPhase) => {
    const repartition = calculerRepartitionProfileBlindage(
      resultatPhase.momentMaxAbsolu,
      parametres.entraxeProfiles
    );

    const coteFondFouille = resultatPhase.phase.coteFondFouille;
    const coucheFront = trouverCoucheACote(couches, coteFondFouille - 0.1) || couches[0];
    const stabiliteFront = verifierStabiliteFrontNonSoutenu(
      coucheFront.resistanceNonDrainee.cuTete.v,
      configurationNormative.facteursSol.M2.gamma_cu,
      coucheFront.poidsVolumiques.gammaHumide.v,
      parametres.blindage.hauteurPasse
    );

    const ptFront = resultatPhase.profilPressionLimite
      .filter((p) => p.cote <= coteFondFouille + 1e-4)
      .sort((a, b) => b.cote - a.cote)[0];
    const resistanceBlindage = verifierResistanceBlindagePose(
      ptFront?.Pa ?? 0,
      parametres.entraxeProfiles,
      parametres.blindage.epaisseur,
      parametres.blindage.contrainteAdmissible
    );

    const noeudsSousFiche: NoeudFicheBerlinoise[] = [];
    for (let i = 0; i < resultat.cotes.length; i++) {
      const cote = resultat.cotes[i];
      if (cote > coteFondFouille - 1e-4) continue;
      const pt = resultatPhase.profilPressionLimite.find((p) => Math.abs(p.cote - cote) < 1e-3);
      const reactionRessort = resultatPhase.resultatSolveur.reactionsRessorts.find(
        (r) => r.noeudIndex === i && r.direction === 'x'
      );
      noeudsSousFiche.push({
        cote,
        demandeMobiliseeParM: Math.abs(reactionRessort?.reaction ?? 0),
        Pp: pt?.Pp ?? 0,
        largeurTributaire: resultat.largeursTributaires[i],
      });
    }
    const ficheReduite = verifierFicheProfileReduite(
      noeudsSousFiche,
      parametres.entraxeProfiles,
      parametres.profile.largeur,
      resultatPhase.resultatSolveur.convergence.convergé,
      resultatPhase.deplacementMaxAbsolu
    );

    return { phase: resultatPhase.phase, repartition, stabiliteFront, resistanceBlindage, ficheReduite };
  });
}
