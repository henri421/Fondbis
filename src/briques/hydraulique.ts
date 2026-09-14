import { CLAUSES_EC7 } from '../norme/metadataNorme';

export interface ResultatHydrauliqueFouille {
  gammaSature: number; // kN/m³
  gammaEau: number; // kN/m³
  i_critique: number; // [-]
  perteDeChargeDeltaH: number; // m
  longueurEcoulementL: number; // m
  i_ecoulement: number; // [-]
  facteurSecuriteRenard: number; // [-]
  securiteConforme: boolean; // F >= 1.5
  clauseReference: string;
  statutNormatif: string;
}

export function verifierRenardFondDeFouille(
  gammaSature: number,
  coteNappeAmont: number,
  coteFondFouille: number,
  ficheRideauT: number,
  gammaEau: number = 9.81
): ResultatHydrauliqueFouille {
  const i_critique = (gammaSature - gammaEau) / gammaEau;
  const deltaH = Math.max(0, coteNappeAmont - coteFondFouille);
  // Trajet d'écoulement simplifié sous la fiche du rideau : 2 * fiche
  const longueurEcoulement = Math.max(0.5, 2 * ficheRideauT);
  const i_ecoulement = deltaH / longueurEcoulement;
  const facteurSecurite = i_ecoulement > 0 ? i_critique / i_ecoulement : 99;

  return {
    gammaSature,
    gammaEau,
    i_critique: Number(i_critique.toFixed(3)),
    perteDeChargeDeltaH: Number(deltaH.toFixed(2)),
    longueurEcoulementL: Number(longueurEcoulement.toFixed(2)),
    i_ecoulement: Number(i_ecoulement.toFixed(3)),
    facteurSecuriteRenard: Number(facteurSecurite.toFixed(2)),
    securiteConforme: facteurSecurite >= 1.5,
    clauseReference: CLAUSES_EC7.upl_hyd.clause,
    statutNormatif: CLAUSES_EC7.upl_hyd.statut,
  };
}
