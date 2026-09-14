import { CoucheGeotechnique, Hydrogeologie } from '../types/geotech';

export interface MaillageVerticalParams {
  coteTerrainNaturel: number;
  couches: CoucheGeotechnique[];
  hydrogeologie: Hydrogeologie;
  cotesSingulieres?: number[];
  pasStandard?: number; // 0.10 m par défaut
}

/**
 * Construit un maillage vertical raffiné automatiquement aux points singuliers
 * Selon section 5.1 du cahier des charges
 */
export function construireMaillageVertical(params: MaillageVerticalParams): number[] {
  const { coteTerrainNaturel, couches, hydrogeologie, cotesSingulieres = [], pasStandard = 0.10 } = params;

  if (couches.length === 0) {
    return [coteTerrainNaturel];
  }

  // Calculer la cote minimale atteinte par les couches
  let coteMin = coteTerrainNaturel;
  const pointsClefs = new Set<number>();
  pointsClefs.add(Number(coteTerrainNaturel.toFixed(3)));

  for (const c of couches) {
    const toit = Number(c.coteToit.toFixed(3));
    const base = Number((c.coteToit - c.epaisseur).toFixed(3));
    pointsClefs.add(toit);
    pointsClefs.add(base);
    if (base < coteMin) coteMin = base;
  }

  // Nappes
  pointsClefs.add(Number(hydrogeologie.nappePrincipale.coteCaracteristique.toFixed(3)));
  pointsClefs.add(Number(hydrogeologie.nappePrincipale.coteDefavorableELU.toFixed(3)));

  for (const n of hydrogeologie.nappesSecondaires) {
    pointsClefs.add(Number(n.cotePiezometrique.toFixed(3)));
  }

  // Cotes d'ouvrages
  for (const z of cotesSingulieres) {
    if (!isNaN(z)) {
      pointsClefs.add(Number(z.toFixed(3)));
    }
  }

  // Ordonner les points clés du haut vers le bas
  const clefsTriees = Array.from(pointsClefs).sort((a, b) => b - a);

  // Construire la discrétisation régulière entre chaque intervalle clé
  const maillage: number[] = [];

  for (let i = 0; i < clefsTriees.length - 1; i++) {
    const zHaut = clefsTriees[i];
    const zBas = clefsTriees[i + 1];
    maillage.push(zHaut);

    const delta = zHaut - zBas;
    if (delta > pasStandard) {
      const nbPas = Math.floor(delta / pasStandard);
      const pasReel = delta / (nbPas + 1);
      for (let p = 1; p <= nbPas; p++) {
        maillage.push(Number((zHaut - p * pasReel).toFixed(3)));
      }
    }
  }

  // Ajouter le dernier point
  maillage.push(clefsTriees[clefsTriees.length - 1]);

  return maillage;
}
