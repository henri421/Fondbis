import { CLAUSES_EC7 } from '../../norme/metadataNorme';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

export interface CoefficientsPousseeButee {
  methode: 'Rankine' | 'Coulomb' | 'Jaky_K0';
  phiDeg: number;
  deltaDeg: number;
  betaDeg: number; // Inclinaison du terre-plein
  thetaDeg: number; // Inclinaison du parement intérieur (90° pour vertical)
  Ka: number;
  Kp: number;
  K0: number;
  clauseReference: string;
  statutNormatif: string;
}

/**
 * Calcul des coefficients de poussée Ka, butée Kp et repos K0
 * Selon EN 1997-1:2004 Annexe C
 * Test T2.1 validé directement
 */
export function calculerCoefficientsPousseeButee(
  phiDeg: number,
  deltaDeg: number = 0,
  betaDeg: number = 0,
  thetaDeg: number = 90
): CoefficientsPousseeButee {
  const phi = phiDeg * DEG2RAD;
  const delta = deltaDeg * DEG2RAD;
  const beta = betaDeg * DEG2RAD;
  const theta = thetaDeg * DEG2RAD;

  // Coefficient des terres au repos (Jaky)
  const K0 = Math.max(0.2, 1 - Math.sin(phi));

  // Cas Rankine classique (terre-plein horizontal, parement vertical, delta = 0)
  if (Math.abs(deltaDeg) < 1e-4 && Math.abs(betaDeg) < 1e-4 && Math.abs(thetaDeg - 90) < 1e-4) {
    const sinPhi = Math.sin(phi);
    const Ka_rankine = (1 - sinPhi) / (1 + sinPhi);
    const Kp_rankine = (1 + sinPhi) / (1 - sinPhi);

    return {
      methode: 'Rankine',
      phiDeg,
      deltaDeg: 0,
      betaDeg: 0,
      thetaDeg: 90,
      Ka: Number(Ka_rankine.toFixed(5)),
      Kp: Number(Kp_rankine.toFixed(5)),
      K0: Number(K0.toFixed(4)),
      clauseReference: CLAUSES_EC7.coefficients_poussee_butee.clause,
      statutNormatif: CLAUSES_EC7.coefficients_poussee_butee.statut,
    };
  }

  // Formulation générale de Coulomb
  // Ka
  const numKa = Math.pow(Math.sin(theta + phi), 2);
  const sinTheta = Math.sin(theta);
  const sinThetaMinusDelta = Math.sin(theta - delta);
  const termSqrtKa = Math.sqrt(
    Math.max(0, (Math.sin(phi + delta) * Math.sin(phi - beta)) / (Math.sin(theta - delta) * Math.sin(theta + beta)))
  );
  const denKa = Math.pow(sinTheta, 2) * sinThetaMinusDelta * Math.pow(1 + termSqrtKa, 2);
  const Ka_coulomb = denKa > 0 ? numKa / denKa : (1 - Math.sin(phi)) / (1 + Math.sin(phi));

  // Kp (Attention : Coulomb surestime Kp pour delta élevé, précaution normative)
  const numKp = Math.pow(Math.sin(theta - phi), 2);
  const sinThetaPlusDelta = Math.sin(theta + delta);
  const termSqrtKp = Math.sqrt(
    Math.max(0, (Math.sin(phi + delta) * Math.sin(phi + beta)) / (Math.sin(theta + delta) * Math.sin(theta + beta)))
  );
  const denKp = Math.pow(sinTheta, 2) * sinThetaPlusDelta * Math.pow(Math.max(0.1, 1 - termSqrtKp), 2);
  const Kp_coulomb = denKp > 0 ? numKp / denKp : (1 + Math.sin(phi)) / (1 - Math.sin(phi));

  return {
    methode: 'Coulomb',
    phiDeg,
    deltaDeg,
    betaDeg,
    thetaDeg,
    Ka: Number(Ka_coulomb.toFixed(5)),
    Kp: Number(Kp_coulomb.toFixed(5)),
    K0: Number(K0.toFixed(4)),
    clauseReference: CLAUSES_EC7.coefficients_poussee_butee.clause,
    statutNormatif: CLAUSES_EC7.coefficients_poussee_butee.statut,
  };
}

/**
 * Calcul de la poussée totale d'un sol homogène contre un écran vertical
 * Test T2.1
 */
export function calculerPousseeSimple(
  hauteurH: number, // m
  gamma: number, // kN/m³
  phiDeg: number,
  surchargeQ: number = 0 // kPa
): {
  Ka: number;
  Pa_sol: number; // kN/m (résultante sol)
  z_Pa_sol: number; // m au-dessus de la base (H/3)
  Pa_surcharge: number; // kN/m (résultante surcharge)
  z_Pa_surcharge: number; // m au-dessus de la base (H/2)
  Pa_totale: number; // kN/m
  z_resultante: number; // m au-dessus de la base
} {
  const coeff = calculerCoefficientsPousseeButee(phiDeg, 0, 0, 90);
  const Ka = coeff.Ka;

  const Pa_sol = 0.5 * gamma * hauteurH * hauteurH * Ka;
  const z_Pa_sol = hauteurH / 3;

  const Pa_surcharge = surchargeQ * hauteurH * Ka;
  const z_Pa_surcharge = hauteurH / 2;

  const Pa_totale = Pa_sol + Pa_surcharge;
  const z_resultante =
    Pa_totale > 0 ? (Pa_sol * z_Pa_sol + Pa_surcharge * z_Pa_surcharge) / Pa_totale : z_Pa_sol;

  return {
    Ka: Number(Ka.toFixed(5)),
    Pa_sol: Number(Pa_sol.toFixed(2)),
    z_Pa_sol: Number(z_Pa_sol.toFixed(3)),
    Pa_surcharge: Number(Pa_surcharge.toFixed(2)),
    z_Pa_surcharge: Number(z_Pa_surcharge.toFixed(3)),
    Pa_totale: Number(Pa_totale.toFixed(2)),
    z_resultante: Number(z_resultante.toFixed(3)),
  };
}
