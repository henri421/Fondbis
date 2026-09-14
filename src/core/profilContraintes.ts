import { CoucheGeotechnique, Hydrogeologie } from '../types/geotech';

export interface PointContrainte {
  cote: number; // m
  profondeur: number; // m sous le TN
  coucheId: string;
  nomCouche: string;
  sigma_v: number; // kPa (contrainte totale)
  u: number; // kPa (pression interstitielle)
  sigma_vPrime: number; // kPa (contrainte effective)
  gammaEffectifLocal: number; // kN/m³ (pour calculs locaux de portance)
}

export interface ProfilContraintesResult {
  etat: 'ELS' | 'ELU';
  coteNappe: number;
  points: PointContrainte[];
  calculerA: (cote: number) => PointContrainte;
}

/**
 * Recherche la couche géotechnique active à une cote donnée
 */
export function trouverCoucheACote(couches: CoucheGeotechnique[], cote: number): CoucheGeotechnique | null {
  if (couches.length === 0) return null;
  for (const c of couches) {
    const toit = c.coteToit;
    const base = c.coteToit - c.epaisseur;
    // Tolérance d'arrondi
    if (cote <= toit + 1e-4 && cote >= base - 1e-4) {
      return c;
    }
  }
  // Si en dessous de la dernière couche, prolonger la dernière couche
  const derniere = couches[couches.length - 1];
  if (cote < derniere.coteToit - derniere.epaisseur) {
    return derniere;
  }
  return couches[0];
}

/**
 * Calcule le profil vertical des contraintes (totale, interstitielle, effective)
 * Section 5.2 et Test T0.1
 */
export function calculerProfilContraintes(
  coteTerrainNaturel: number,
  couches: CoucheGeotechnique[],
  hydrogeologie: Hydrogeologie,
  maillage: number[],
  etat: 'ELS' | 'ELU'
): ProfilContraintesResult {
  const coteNappe =
    etat === 'ELS'
      ? hydrogeologie.nappePrincipale.coteCaracteristique
      : hydrogeologie.nappePrincipale.coteDefavorableELU;

  const gamma_w = hydrogeologie.poidsVolumiqueEau;

  // Tri du maillage du haut vers le bas
  const cotesTriees = [...new Set(maillage)].sort((a, b) => b - a);

  // Fonction pour calculer la contrainte exacte à n'importe quelle cote z <= coteTerrainNaturel
  function evaluerContrainteExacte(coteCible: number): PointContrainte {
    if (coteCible > coteTerrainNaturel) {
      const couche = trouverCoucheACote(couches, coteTerrainNaturel);
      return {
        cote: coteCible,
        profondeur: 0,
        coucheId: couche?.id || '',
        nomCouche: couche?.nom || '',
        sigma_v: 0,
        u: 0,
        sigma_vPrime: 0,
        gammaEffectifLocal: couche?.poidsVolumiques.gammaHumide.v || 18,
      };
    }

    // Découpage en intervalles homogènes selon les interfaces de couches et le niveau de la nappe
    const pointsCles = new Set<number>();
    pointsCles.add(coteTerrainNaturel);
    pointsCles.add(coteCible);
    if (coteNappe < coteTerrainNaturel && coteNappe > coteCible) {
      pointsCles.add(coteNappe);
    }
    for (const c of couches) {
      const toit = c.coteToit;
      const base = c.coteToit - c.epaisseur;
      if (toit < coteTerrainNaturel && toit > coteCible) pointsCles.add(toit);
      if (base < coteTerrainNaturel && base > coteCible) pointsCles.add(base);
    }

    const segments = Array.from(pointsCles).sort((a, b) => b - a);

    let sigma_v = 0;
    for (let i = 0; i < segments.length - 1; i++) {
      const zHaut = segments[i];
      const zBas = segments[i + 1];
      const dz = zHaut - zBas;
      const zMilieu = (zHaut + zBas) / 2;

      const couche = trouverCoucheACote(couches, zMilieu);
      if (!couche) continue;

      // Au-dessus de la nappe: gammaHumide, sous la nappe: gammaSature
      const estSousNappe = zMilieu <= coteNappe;
      const gamma = estSousNappe
        ? couche.poidsVolumiques.gammaSature.v
        : couche.poidsVolumiques.gammaHumide.v;

      sigma_v += gamma * dz;
    }

    // Pression interstitielle u
    let u = 0;
    if (coteCible < coteNappe) {
      u = gamma_w * (coteNappe - coteCible);
    }

    const sigma_vPrime = sigma_v - u;
    const coucheActive = trouverCoucheACote(couches, coteCible);
    const estSousNappeLocal = coteCible <= coteNappe;
    const gammaEffectifLocal = coucheActive
      ? (estSousNappeLocal ? coucheActive.poidsVolumiques.gammaSature.v - gamma_w : coucheActive.poidsVolumiques.gammaHumide.v)
      : 18;

    return {
      cote: Number(coteCible.toFixed(3)),
      profondeur: Number((coteTerrainNaturel - coteCible).toFixed(3)),
      coucheId: coucheActive?.id || '',
      nomCouche: coucheActive?.nom || '',
      sigma_v: Number(sigma_v.toFixed(4)),
      u: Number(u.toFixed(4)),
      sigma_vPrime: Number(sigma_vPrime.toFixed(4)),
      gammaEffectifLocal: Number(gammaEffectifLocal.toFixed(4)),
    };
  }

  const points = cotesTriees.map((z) => evaluerContrainteExacte(z));

  return {
    etat,
    coteNappe,
    points,
    calculerA: evaluerContrainteExacte,
  };
}
