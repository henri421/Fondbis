/**
 * Surcouche Paroi de Pieux Sécants (EN 1997-1 §8.5) — post-traitement géométrique, ne
 * recalcule rien du moteur partagé (`solveurPoutreRessorts.ts`, `paroiPhasee.ts`).
 */

export interface ParametresRecouvrementPieuxSecants {
  diametrePrimaire: number;          // m
  diametreSecondaire: number;        // m
  entraxe: number;                   // m
  deviationVerticaliteMax: number;   // sans unité (pente), ex 0.01 = 1%
  recouvrementMinimalRequis: number; // m
}

export interface ResultatRecouvrementPieuxSecants {
  recouvrementSurface: number;       // m, recouvrement nominal en tête (z=0)
  recouvrementProfondeurMax: number; // m, recouvrement au point le plus défavorable (pied)
  conforme: boolean;
  continuiteMecaniqueRompue: boolean; // true si recouvrementProfondeurMax <= 0
}

/**
 * Recouvrement géométrique entre deux cercles de diamètres Dp/Ds séparés par l'entraxe e :
 * (Dp+Ds)/2 - e (somme des rayons moins la distance entre centres). La dérive de forage
 * (déviation de verticalité, saisie directe) écarte les deux axes avec la profondeur — pire
 * cas retenu : les deux forages dérivent en sens opposés, dérive cumulée = 2 × déviation × z.
 */
export function verifierRecouvrementPieuxSecants(
  parametres: ParametresRecouvrementPieuxSecants,
  profondeurMax: number // m, hauteur totale des pieux (coteTete - coteBase)
): ResultatRecouvrementPieuxSecants {
  const rayonsCumules = (parametres.diametrePrimaire + parametres.diametreSecondaire) / 2;
  const deriveMax = 2 * parametres.deviationVerticaliteMax * profondeurMax;
  const entraxeEffectifMax = parametres.entraxe + deriveMax;

  const recouvrementSurface = rayonsCumules - parametres.entraxe;
  const recouvrementProfondeurMax = rayonsCumules - entraxeEffectifMax;
  const continuiteMecaniqueRompue = recouvrementProfondeurMax <= 0;
  const conforme =
    !continuiteMecaniqueRompue && recouvrementProfondeurMax >= parametres.recouvrementMinimalRequis;

  return { recouvrementSurface, recouvrementProfondeurMax, conforme, continuiteMecaniqueRompue };
}

export interface ParametresCompositePieuxSecants {
  diametrePrimaire: number;   // m
  diametreSecondaire: number; // m
  entraxe: number;            // m
}

export interface ResultatInertieCompositePieuxSecants {
  I_m4ParM: number; // m⁴/m — pour ParametresParoiPhasee.I (Niveau 2)
  A_m2ParM: number; // m²/m — pour ParametresParoiPhasee.A
  approximationSuperposition: true;
}

/**
 * Inertie équivalente de la section composite (théorème des axes parallèles), motif
 * répétitif = un pieu primaire + un pieu secondaire adjacent, par superposition des deux
 * sections circulaires PLEINES sans soustraire leur lentille de recouvrement commune —
 * approximation documentée (même principe que l'absence de réduction de voûte pour la
 * Berlinoise : pas de méthode de référence disponible pour une section composite exacte).
 */
export function calculerInertieCompositePieuxSecants(
  parametres: ParametresCompositePieuxSecants
): ResultatInertieCompositePieuxSecants {
  const { diametrePrimaire: Dp, diametreSecondaire: Ds, entraxe } = parametres;
  const Ap = (Math.PI * Dp * Dp) / 4;
  const As = (Math.PI * Ds * Ds) / 4;
  const Ip = (Math.PI * Dp ** 4) / 64;
  const Is = (Math.PI * Ds ** 4) / 64;

  // Centre de gravité du motif (primaire en x=0, secondaire en x=entraxe)
  const centreGravite = (Ap * 0 + As * entraxe) / (Ap + As);
  const dp = centreGravite;
  const ds = entraxe - centreGravite;

  const I_total = Ip + Ap * dp ** 2 + (Is + As * ds ** 2);
  const A_total = Ap + As;

  return {
    I_m4ParM: I_total / entraxe,
    A_m2ParM: A_total / entraxe,
    approximationSuperposition: true,
  };
}
