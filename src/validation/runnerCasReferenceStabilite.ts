import casReference from './casReferenceStabilite.json';
import { calculerBishopPourCercle } from '../briques/stabiliteGenerale';
import { CoucheGeotechnique, Hydrogeologie, TripletGrandeur } from '../types/geotech';

const tVal = (v: number, u: string = ''): TripletGrandeur<number> => ({
  v,
  u,
  source: 'labo',
  statut: 'mesure',
});

export interface RapportCasReferenceStabilite {
  id: string;
  nom: string;
  source: string;
  estPlaceholder: boolean;
  facteurCalcule: number | null;
  facteurAttendu: number | null;
  ecartRelatifPourcent: number | null;
  conforme: boolean | null;
  message: string;
}

/**
 * Exécute la confrontation aux cas de référence publiés de stabilité de talus (CDC §12.6)
 * Ne valide que si une valeur attendue réelle est fournie par l'ingénieur conseil.
 */
export function executerCasReferenceStabilite(): RapportCasReferenceStabilite[] {
  const resultats: RapportCasReferenceStabilite[] = [];

  for (const cas of casReference) {
    const estPlaceholder = cas.source.includes('PLACEHOLDER') || cas.facteurSecuriteAttendu === null;

    if (estPlaceholder) {
      resultats.push({
        id: cas.id,
        nom: cas.nom,
        source: cas.source,
        estPlaceholder: true,
        facteurCalcule: null,
        facteurAttendu: null,
        ecartRelatifPourcent: null,
        conforme: null,
        message: 'Cas de référence en attente des spécifications fournies par l\'ingénieur (CDC §12.6)',
      });
      continue;
    }

    // Reconstruction du modèle de sol minimal
    const couches: CoucheGeotechnique[] = cas.couches.map((c) => ({
      id: c.id,
      nom: c.nom,
      coteToit: c.coteToit,
      epaisseur: c.epaisseur,
      nature: 'sable',
      couleurAffichage: '#d4b886',
      poidsVolumiques: {
        gammaHumide: tVal(c.gamma, 'kN/m³'),
        gammaSature: tVal(c.gamma + 1, 'kN/m³'),
      },
      resistanceDrainee: {
        phiPrime: tVal(c.phiPrime, '°'),
        phiCritique: tVal(c.phiPrime, '°'),
        cPrime: tVal(c.cPrime, 'kPa'),
        psiDilatance: tVal(0, '°'),
        deltaInterface: tVal((c.phiPrime * 2) / 3, '°'),
      },
      resistanceNonDrainee: {
        cuTete: tVal(50, 'kPa'),
        gradientCu: tVal(0, 'kPa/m'),
      },
      deformation: {
        Echargement: tVal(20, 'MPa'),
        EdechargeRech: tVal(60, 'MPa'),
        nu: tVal(0.3, '-'),
        Eoed: tVal(25, 'MPa'),
        Cc: tVal(0.1, '-'),
        Cs: tVal(0.02, '-'),
        e0: tVal(0.7, '-'),
        sigmaPrecons: tVal(100, 'kPa'),
        OCR: { v: 1.0, u: '-', source: 'labo', statut: 'mesure' },
        Calpha: tVal(0.005, '-'),
        cv: tVal(1e-6, 'm²/s'),
        k: tVal(1e-8, 'm/s'),
      },
    }));

    const hydro: Hydrogeologie = {
      nappePrincipale: {
        coteCaracteristique: cas.nappe.active ? cas.nappe.cote : -99,
        coteDefavorableELU: cas.nappe.active ? cas.nappe.cote : -99,
        regime: 'hydrostatique',
      },
      gradientVertical: null,
      nappesSecondaires: [],
      poidsVolumiqueEau: 9.81,
    };

    const F = calculerBishopPourCercle(
      cas.cercleTest.centreX,
      cas.cercleTest.centreY,
      cas.cercleTest.rayon,
      cas.geometrieTalus,
      couches,
      hydro,
      30
    );

    const attendu = cas.facteurSecuriteAttendu as number;
    const ecart = Math.abs((F - attendu) / attendu) * 100;
    const conforme = ecart <= (cas.tolerancePourcent || 3.0);

    resultats.push({
      id: cas.id,
      nom: cas.nom,
      source: cas.source,
      estPlaceholder: false,
      facteurCalcule: F,
      facteurAttendu: attendu,
      ecartRelatifPourcent: Number(ecart.toFixed(2)),
      conforme,
      message: conforme
        ? `Conforme au cas de référence (écart ${ecart.toFixed(2)}% ≤ ${cas.tolerancePourcent}%)`
        : `Écart excessif (${ecart.toFixed(2)}% > ${cas.tolerancePourcent}%)`,
    });
  }

  return resultats;
}
