import { ConfigurationNormative, ParametresCaracteristiquesSol, ParametresDeCalculSol } from '../types/geotech';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/**
 * Calcul des valeurs de calcul géotechniques à partir des valeurs caractéristiques
 * EN 1997-1:2004 Clause 2.4.6.2 & Tableau A.4
 * 
 * ATTENTION ERREUR CLASSIQUE (Test T0.2) :
 * Le facteur de sécurité gamma_phi s'applique sur la TANGENTE de l'angle de frottement :
 * tan(phi'_d) = tan(phi'_k) / gamma_phi
 * phi'_d = arctan( tan(phi'_k) / gamma_phi )
 */
export function calculerParametresDeCalcul(
  k: ParametresCaracteristiquesSol,
  jeuM: 'M1' | 'M2',
  config: ConfigurationNormative
): ParametresDeCalculSol {
  const facteurs = config.facteursSol[jeuM];

  const tanPhi = Math.tan(k.phiPrime_k * DEG2RAD);
  const tanPhi_d = tanPhi / facteurs.gamma_phi;
  const phiPrime_d = Math.atan(tanPhi_d) * RAD2DEG;

  const tanDelta = Math.tan(k.delta_k * DEG2RAD);
  const tanDelta_d = tanDelta / facteurs.gamma_phi;
  const delta_d = Math.atan(tanDelta_d) * RAD2DEG;

  const cPrime_d = k.cPrime_k / facteurs.gamma_c;
  const cu_d = k.cu_k / facteurs.gamma_cu;
  const gammaHumide_d = k.gammaHumide_k / facteurs.gamma_gamma;
  const gammaSature_d = k.gammaSature_k / facteurs.gamma_gamma;

  return {
    phiPrime_d,
    cPrime_d,
    cu_d,
    gammaHumide_d,
    gammaSature_d,
    delta_d,
    jeuM,
  };
}
