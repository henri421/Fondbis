/**
 * antiCollisionEtiquettes.ts
 * Algorithme de relaxation 1D pour l'évitement des chevauchements d'étiquettes
 * géotechniques (cartouches de couches, cotes altimétriques, cotes d'ouvrages, appuis).
 */

export interface BoiteEtiquette1D {
  id: string;
  yIdeal: number;      // Position Y cible idéale (au centre de l'élément géologique ou ouvrage)
  hauteur: number;     // Encombrement vertical de l'étiquette (px)
  yAnchor: number;     // Point d'ancrage physique exact sur le tracé/la ligne (px)
  donnees?: any;       // Métadonnées associées
}

export interface BoiteEtiquetteResolue extends BoiteEtiquette1D {
  yCalcule: number;    // Position Y assignée après résolution anti-collision
  decalee: boolean;    // Vrai si décalée au-delà du seuil de tolérance (nécessite un trait de rappel)
  deltaY: number;      // Écart yCalcule - yIdeal
}

/**
 * Résout le placement d'une liste de boîtes 1D pour garantir qu'aucune ne se chevauche,
 * tout en restant dans les bornes [minY, maxY] et au plus près de leur position idéale.
 *
 * @param boites Liste des boîtes avec leur yIdeal, hauteur et yAnchor
 * @param minY Borne supérieure d'affichage (Y min dans le repère SVG)
 * @param maxY Borne inférieure d'affichage (Y max dans le repère SVG)
 * @param gapMinimal Espacement minimal requis entre deux boîtes consécutives (défaut 6px)
 * @param seuilDecalage Seuil d'écart pour considérer l'étiquette comme décalée (défaut 4px)
 */
export function resoudreAntiCollision1D(
  boites: BoiteEtiquette1D[],
  minY: number,
  maxY: number,
  gapMinimal: number = 6,
  seuilDecalage: number = 4
): BoiteEtiquetteResolue[] {
  if (boites.length === 0) return [];

  // Copie avec index d'origine pour préserver l'ordre si nécessaire
  const items = boites.map((b, idx) => ({
    ...b,
    indexOrigine: idx,
    yCalcule: b.yIdeal,
    decalee: false,
    deltaY: 0,
  }));

  // Tri par position idéale croissante (de haut en bas dans le repère SVG)
  items.sort((a, b) => a.yIdeal - b.yIdeal);

  const n = items.length;

  // Initialisation bornée
  for (let i = 0; i < n; i++) {
    items[i].yCalcule = Math.max(minY, Math.min(maxY - items[i].hauteur, items[i].yIdeal));
  }

  // 1. Balayage descendant (Forward sweep) : pousse les boîtes vers le bas si chevauchement
  for (let i = 1; i < n; i++) {
    const prevBottom = items[i - 1].yCalcule + items[i - 1].hauteur + gapMinimal;
    if (items[i].yCalcule < prevBottom) {
      items[i].yCalcule = prevBottom;
    }
  }

  // 2. Balayage ascendant (Backward sweep) : si la dernière dépasse le bas, remonter l'ensemble
  if (items[n - 1].yCalcule + items[n - 1].hauteur > maxY) {
    items[n - 1].yCalcule = Math.max(minY, maxY - items[n - 1].hauteur);
  }
  for (let i = n - 2; i >= 0; i--) {
    const nextTop = items[i + 1].yCalcule - gapMinimal - items[i].hauteur;
    if (items[i].yCalcule > nextTop) {
      items[i].yCalcule = nextTop;
    }
  }

  // 3. Si la première boîte a été poussée au-dessus de minY, recaler
  if (items[0].yCalcule < minY) {
    items[0].yCalcule = minY;
    // Pousser vers le bas en adaptant éventuellement le gap si l'espace est très contraint
    for (let i = 1; i < n; i++) {
      const prevBottom = items[i - 1].yCalcule + items[i - 1].hauteur + gapMinimal;
      if (items[i].yCalcule < prevBottom) {
        items[i].yCalcule = prevBottom;
      }
    }
  }

  // 4. Si après recalage le bas dépasse toujours (hauteur totale des boîtes > espace disponible),
  //    compression uniforme de l'espacement
  const hauteurTotaleBoites = items.reduce((acc, it) => acc + it.hauteur, 0);
  const espaceDispo = Math.max(0, maxY - minY);
  if (hauteurTotaleBoites + (n - 1) * gapMinimal > espaceDispo && n > 1) {
    const gapCompresse = Math.max(1, (espaceDispo - hauteurTotaleBoites) / (n - 1));
    items[0].yCalcule = minY;
    for (let i = 1; i < n; i++) {
      items[i].yCalcule = items[i - 1].yCalcule + items[i - 1].hauteur + gapCompresse;
    }
  }

  // 5. Calcul des décalages et retour
  return items.map((it) => {
    const deltaY = it.yCalcule - it.yIdeal;
    return {
      id: it.id,
      yIdeal: it.yIdeal,
      hauteur: it.hauteur,
      yAnchor: it.yAnchor,
      donnees: it.donnees,
      yCalcule: it.yCalcule,
      decalee: Math.abs(deltaY) > seuilDecalage,
      deltaY,
    };
  });
}
