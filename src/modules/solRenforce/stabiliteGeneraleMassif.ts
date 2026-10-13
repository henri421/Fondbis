import { CoucheGeotechnique, Hydrogeologie, OuvrageSolRenforce, SurchargeTalus } from '../../types/geotech';
import {
  CombinaisonStabilite,
  RenforcementHorizontal,
  rechercherCercleCritique,
  ResultatRechercheCercle,
  ZoneMateriau,
} from '../../briques/stabiliteGenerale';
import { arrachementLineique_d, positionsLits, resistanceRupture_d } from './stabiliteInterne';

/**
 * Stabilité générale et mixte du massif : Bishop (brique de stabilité générale) avec
 * - le massif renforcé comme zone de matériau (γr, φ'r, c' = 0) ;
 * - chaque lit coupé par le cercle comme force résistante horizontale
 *   T = min(R_t,d ; arrachement de la longueur ancrée au-delà du cercle) ;
 * - le profil : terrain devant à coteBase + D, parement vertical, tête à coteBase + H,
 *   prolongé de 3·H de part et d'autre ; surcharges G et Q sur la tête (massif et sol retenu) ;
 * - seuls les cercles qui sortent devant le pied du parement sont retenus.
 */

export interface GeometrieMassif {
  profil: Array<{ x: number; y: number }>;
  zone: ZoneMateriau;
  renforcements: RenforcementHorizontal[];
  surcharges: SurchargeTalus[];
}

export function geometrieMassif(o: OuvrageSolRenforce): GeometrieMassif {
  const H = o.hauteur;
  const xP = o.xParement;
  const tete = o.coteBase + H;
  const devant = o.coteBase + o.encastrement;
  const xFinProfil = xP + o.longueurArmatures + 3 * H;
  const R = resistanceRupture_d(o);
  const surcharges: SurchargeTalus[] = [];
  if (o.surchargeG > 0) surcharges.push({ id: 'G', nom: 'qG', xDebut: xP, xFin: xFinProfil, q: o.surchargeG, nature: 'G' });
  if (o.surchargeQ > 0) surcharges.push({ id: 'Q', nom: 'qQ', xDebut: xP, xFin: xFinProfil, q: o.surchargeQ, nature: 'Q' });
  return {
    profil: [
      { x: xP - 3 * H, y: devant },
      { x: xP, y: devant },
      { x: xP, y: tete },
      { x: xFinProfil, y: tete },
    ],
    zone: {
      nom: 'Remblai renforcé',
      xMin: xP,
      xMax: xP + o.longueurArmatures,
      yMin: o.coteBase,
      yMax: tete,
      gammaHumide: o.remblai.gamma,
      gammaSature: o.remblai.gamma + 1,
      phiPrime: o.remblai.phiPrime,
      cPrime: 0,
    },
    renforcements: positionsLits(o).map((lit) => ({
      y: lit.cote,
      xDebut: xP,
      xFin: xP + o.longueurArmatures,
      resistanceRupture_d: R,
      arrachementLineique_d: arrachementLineique_d(o, lit.z),
    })),
    surcharges,
  };
}

export function rechercherStabiliteGeneraleMassif(
  o: OuvrageSolRenforce,
  comb: CombinaisonStabilite,
  couches: CoucheGeotechnique[],
  hydrogeologie: Hydrogeologie
): ResultatRechercheCercle | null {
  const g = geometrieMassif(o);
  return rechercherCercleCritique(
    {
      profilTN: g.profil,
      couches,
      hydrogeologie,
      combinaison: comb,
      surcharges: g.surcharges,
      zones: [g.zone],
      renforcements: g.renforcements,
    },
    {
      coteLimite: o.coteBase - 2 * o.hauteur,
      // Surface de rupture passant sous le pied du parement : les cercles qui recoupent le
      // parement relèvent de la stabilité interne (le parement retient le sol entre deux lits).
      accepter: (_r, c) => {
        const dx = o.xParement - c.centreX;
        if (Math.abs(dx) >= c.rayon) return false;
        return c.centreY - Math.sqrt(c.rayon * c.rayon - dx * dx) <= o.coteBase + o.encastrement + 1e-6;
      },
    }
  );
}
