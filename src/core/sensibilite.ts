/**
 * Analyse de sensibilité paramétrique par dérivée numérique
 * Conforme au CDC §12.1 :
 * « Ajouter une analyse de sensibilité paramétrique par dérivée numérique sur les
 *   paramètres principaux. [...] afficher un résultat à trois chiffres significatifs sans
 *   indicateur de sensibilité serait trompeur. »
 */

export interface DefinitionParametreSensible {
  label: string;
  unite?: string;
  valeurRef: number;
  appliquer: (valeur: number) => void;
  pasAbsolu?: number; // Pour les paramètres nuls ou proches de zéro (ex: c' = 0)
}

export interface ResultatSensibiliteParametre {
  label: string;
  unite?: string;
  valeurRef: number;
  h: number; // pas appliqué
  derivee: number; // df/dx = (f(x+h) - f(x-h)) / (2h)
  elasticitePourcent: number; // S = ((f(x+h) - f(x-h)) / (2·f(x))) / (deltaRelatif) en % (ex: +8.2% pour +1%)
  impactPourcentPour1Pourcent: number; // idem, valeur signée
  descriptionTexte: string; // ex: "sensible à φ' : +2.1% pour +1%"
}

export interface RapportSensibilite {
  valeurNominale: number;
  parametres: ResultatSensibiliteParametre[];
  parametreDominant?: ResultatSensibiliteParametre;
  resumeCourt: string;
}

/**
 * Calcule la sensibilité numérique par différences finies centrées d'ordre 2
 * sur un ensemble de paramètres d'entrée avec garantie absolue de restauration
 * de la valeur de référence.
 */
export function calculerSensibiliteParametrique(
  evaluer: () => number,
  parametres: DefinitionParametreSensible[],
  deltaRelatif: number = 0.01
): RapportSensibilite {
  // Évaluation nominale de référence
  const y0 = evaluer();

  const resultats: ResultatSensibiliteParametre[] = [];

  for (const param of parametres) {
    const x0 = param.valeurRef;

    // Détermination du pas de perturbation h
    let h: number;
    let deltaEffectif: number;

    if (Math.abs(x0) > 1e-4) {
      h = Math.abs(x0) * deltaRelatif;
      deltaEffectif = deltaRelatif;
    } else {
      // Pour les valeurs nulles ou quasi-nulles (ex: c' = 0 kPa), pas absolu (ex: 1 kPa)
      h = param.pasAbsolu ?? 1.0;
      deltaEffectif = 1.0; // perturbation unitaire
    }

    let yPlus = y0;
    let yMoins = y0;

    try {
      // Évaluation x0 + h
      param.appliquer(x0 + h);
      yPlus = evaluer();

      // Évaluation x0 - h
      param.appliquer(x0 - h);
      yMoins = evaluer();
    } finally {
      // GARANTIE ABSOLUE : Toujours restaurer la valeur nominale de référence
      param.appliquer(x0);
    }

    // Dérivée numérique centrée O(h²)
    const derivee = (yPlus - yMoins) / (2 * h);

    // Élasticité adimensionnelle en % de variation relative de la sortie pour 1% de variation d'entrée
    let elasticite = 0;
    if (Math.abs(y0) > 1e-9) {
      if (Math.abs(x0) > 1e-4) {
        elasticite = ((yPlus - yMoins) / (2 * y0)) / deltaEffectif;
      } else {
        // Paramètre nul : variation relative de y0 pour 1 unité absolue de x
        elasticite = ((yPlus - yMoins) / (2 * y0)) * 100;
      }
    }

    const signe = elasticite >= 0 ? '+' : '';
    const desc = Math.abs(x0) > 1e-4
      ? `sensible à ${param.label} : ${signe}${elasticite.toFixed(1)}% pour +1%`
      : `sensible à ${param.label} : ${signe}${elasticite.toFixed(1)}% pour +1${param.unite || 'u'}`;

    resultats.push({
      label: param.label,
      unite: param.unite,
      valeurRef: x0,
      h,
      derivee,
      elasticitePourcent: elasticite,
      impactPourcentPour1Pourcent: elasticite,
      descriptionTexte: desc,
    });
  }

  // Identifier le paramètre dominant
  let dominant: ResultatSensibiliteParametre | undefined;
  if (resultats.length > 0) {
    dominant = [...resultats].sort((a, b) => Math.abs(b.elasticitePourcent) - Math.abs(a.elasticitePourcent))[0];
  }

  const resumeCourt = dominant
    ? dominant.descriptionTexte
    : 'sensibilité faible';

  return {
    valeurNominale: y0,
    parametres: resultats,
    parametreDominant: dominant,
    resumeCourt,
  };
}

/**
 * Analyse de sensibilité paramétrique de la portance ELU du radier (R_d)
 * aux paramètres de la couche d'assise : φ', c', γ
 */
export function analyserSensibilitePortanceRadier(
  evaluerPortanceRd: (couchesModifiees: any[]) => number,
  couches: any[],
  indexCoucheAssise: number = 0,
  deltaRelatif: number = 0.01
): RapportSensibilite {
  const couche = couches[indexCoucheAssise];
  if (!couche) {
    return {
      valeurNominale: evaluerPortanceRd(couches),
      parametres: [],
      resumeCourt: 'Aucune couche d\'assise identifiée',
    };
  }

  const params: DefinitionParametreSensible[] = [
    {
      label: "φ'",
      unite: "°",
      valeurRef: couche.resistanceDrainee.phiPrime.v,
      appliquer: (val) => {
        couche.resistanceDrainee.phiPrime.v = Math.max(0.1, val);
      },
    },
    {
      label: "c'",
      unite: "kPa",
      valeurRef: couche.resistanceDrainee.cPrime.v,
      pasAbsolu: 1.0, // si c' = 0 kPa
      appliquer: (val) => {
        couche.resistanceDrainee.cPrime.v = Math.max(0, val);
      },
    },
    {
      label: "γ",
      unite: "kN/m³",
      valeurRef: couche.poidsVolumiques.gammaHumide.v,
      appliquer: (val) => {
        couche.poidsVolumiques.gammaHumide.v = Math.max(1, val);
        couche.poidsVolumiques.gammaSature.v = Math.max(1, val + 1);
      },
    },
  ];

  return calculerSensibiliteParametrique(
    () => evaluerPortanceRd(couches),
    params,
    deltaRelatif
  );
}

/**
 * Analyse de sensibilité paramétrique de la capacité axiale du pieu (Rc;k)
 * aux caractéristiques des couches de sol
 */
export function analyserSensibiliteCapacitePieu(
  evaluerCapaciteRck: (couchesModifiees: any[]) => number,
  couches: any[],
  deltaRelatif: number = 0.01
): RapportSensibilite {
  if (!couches || couches.length === 0) {
    return {
      valeurNominale: evaluerCapaciteRck(couches),
      parametres: [],
      resumeCourt: 'Aucune couche de sol',
    };
  }

  // Sensibilité sur la première couche ou couche porteuse principale
  const params: DefinitionParametreSensible[] = [];

  couches.forEach((c, idx) => {
    if (c.nature === 'sable' || c.resistanceDrainee.phiPrime.v > 0) {
      params.push({
        label: `φ' (${c.nom || c.id})`,
        unite: "°",
        valeurRef: c.resistanceDrainee.phiPrime.v,
        appliquer: (val) => {
          c.resistanceDrainee.phiPrime.v = Math.max(0.1, val);
        },
      });
    }
    if (c.nature === 'argile' || c.resistanceNonDrainee.cuTete.v > 0) {
      params.push({
        label: `cu (${c.nom || c.id})`,
        unite: "kPa",
        valeurRef: c.resistanceNonDrainee.cuTete.v,
        pasAbsolu: 2.0,
        appliquer: (val) => {
          c.resistanceNonDrainee.cuTete.v = Math.max(0.1, val);
        },
      });
    }
  });

  return calculerSensibiliteParametrique(
    () => evaluerCapaciteRck(couches),
    params.slice(0, 4), // limiter aux 4 paramètres majeurs pour rester instantané
    deltaRelatif
  );
}

/**
 * Analyse de sensibilité paramétrique de la stabilité générale (F de Bishop sur cercle fixé)
 * aux paramètres de sol φ' et c'
 */
export function analyserSensibiliteStabiliteCercle(
  evaluerBishopF: (couchesModifiees: any[]) => number,
  couches: any[],
  deltaRelatif: number = 0.01
): RapportSensibilite {
  if (!couches || couches.length === 0) {
    return {
      valeurNominale: evaluerBishopF(couches),
      parametres: [],
      resumeCourt: 'Aucune couche de sol',
    };
  }

  const params: DefinitionParametreSensible[] = [];

  couches.forEach((c) => {
    params.push({
      label: `φ' (${c.nom || c.id})`,
      unite: "°",
      valeurRef: c.resistanceDrainee.phiPrime.v,
      appliquer: (val) => {
        c.resistanceDrainee.phiPrime.v = Math.max(0.1, val);
      },
    });

    params.push({
      label: `c' (${c.nom || c.id})`,
      unite: "kPa",
      valeurRef: c.resistanceDrainee.cPrime.v,
      pasAbsolu: 1.0,
      appliquer: (val) => {
        c.resistanceDrainee.cPrime.v = Math.max(0, val);
      },
    });
  });

  return calculerSensibiliteParametrique(
    () => evaluerBishopF(couches),
    params.slice(0, 4),
    deltaRelatif
  );
}

