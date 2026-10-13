import { TestResultatIndividuel } from './acceptanceTests';
import { coucheTest, hydroCote } from './acceptanceTestsStabiliteTalus';
import { analyserCercleBishop, COMBINAISON_CARACTERISTIQUE, combinaisonsStabilite, CombinaisonStabilite } from '../briques/stabiliteGenerale';
import { CONFIG_NORMATIVE_DEFAUT } from '../norme/configNormativeDefaut';
import { armatureParDefaut, coefficientsParDefaut, ouvrageSolRenforceParDefaut } from '../modules/solRenforce/parametres';
import { verifierStabiliteInterne } from '../modules/solRenforce/stabiliteInterne';
import { verifierStabiliteExterne } from '../modules/solRenforce/stabiliteExterne';
import { geometrieMassif, rechercherStabiliteGeneraleMassif } from '../modules/solRenforce/stabiliteGeneraleMassif';
import { OuvrageSolRenforce } from '../types/geotech';

/**
 * Tests de l'étape 2 (sol renforcé). Les attendus sont recalculés ici à la main,
 * formule par formule, sans appeler les fonctions testées.
 */

const DEG = Math.PI / 180;

export function executerTestsSolRenforce(): TestResultatIndividuel[] {
  const res: TestResultatIndividuel[] = [];
  const ajouter = (id: string, nom: string, description: string, attendu: number, obtenu: number, tolerancePct: number, unite = '') => {
    const e = Number.isFinite(obtenu) ? (Math.abs(obtenu - attendu) / Math.abs(attendu)) * 100 : Infinity;
    const succes = e <= tolerancePct;
    res.push({
      id,
      nom,
      phase: 'Sol renforcé',
      description,
      valeurAttendue: `${attendu.toFixed(4)} ${unite}`.trim(),
      valeurObtenue: `${obtenu.toFixed(4)} ${unite}`.trim(),
      tolerance: `${tolerancePct} %`,
      ecartAbsolu: Math.abs(obtenu - attendu),
      ecartPourcentage: e,
      succes,
      message: succes ? `Écart ${e.toFixed(4)} %` : `Écart ${e.toFixed(4)} % > ${tolerancePct} %`,
    });
  };

  const da2 = combinaisonsStabilite({ ...CONFIG_NORMATIVE_DEFAUT, approcheCalcul: 'DA2' }, 1.5).find(
    (c) => c.id === 'DA2'
  ) as CombinaisonStabilite;

  // Massif de référence : H = 6, L = 4,5, γr = 19, φ'r = 34°, qQ = 10 kPa, feuillards 45×5,
  // 2 par m, fy = 355 MPa, perte 0,71 mm/face, lits à 0,375 + k·0,75.
  const o: OuvrageSolRenforce = ouvrageSolRenforceParDefaut(10);
  const interne = verifierStabiliteInterne(o, da2);

  // ---------------------------------------------------------------------------
  // T_MSE.1 : lit n° 2 (h = 1,125 m, z = 4,875 m, Sv = 0,75 m)
  // ---------------------------------------------------------------------------
  const Ka = (1 - Math.sin(34 * DEG)) / (1 + Math.sin(34 * DEG));
  const z = 6 - 1.125;
  const KsurKa = 1.7 + (1.2 - 1.7) * (z / 6);
  const sigmaVd = 1.35 * 19 * z + 1.5 * 10;
  const Td = KsurKa * Ka * sigmaVd * 0.75;
  const lit = interne.lits[1];
  ajouter('T_MSE.1a', 'Position du lit 2', 'h = 0,375 + 0,75 = 1,125 m', 1.125, lit.hauteur, 1e-9, 'm');
  ajouter('T_MSE.1b', 'Traction maximale de calcul du lit 2', 'T_d = K(z)·(1,35·γr·z + 1,5·qQ)·Sv', Td, lit.T_d, 1e-9, 'kN/m');

  // ---------------------------------------------------------------------------
  // T_MSE.2 : rupture d'un lit de feuillards corrodés
  // R_t,d = 2 × 45 × (5 − 2×0,71) × 355 / 1000 / 1,35
  // ---------------------------------------------------------------------------
  const Rtd = (2 * 45 * (5 - 2 * 0.71) * 355) / 1000 / 1.35;
  ajouter('T_MSE.2', 'Résistance à la rupture (section corrodée)', 'n·b·(e − 2Δe)·fy / γR;t', Rtd, lit.R_d, 1e-9, 'kN/m');

  // ---------------------------------------------------------------------------
  // T_MSE.3 : arrachement du lit 2. Ligne bilinéaire : h = 1,125 ≤ H/2 → La = 0,6·h.
  // F*(z) = 1,8 + (tan 34° − 1,8)·z/6 ; σv = γr·z (qG = 0) ; B_c = 2 × 0,045 m.
  // ---------------------------------------------------------------------------
  const La = 0.6 * 1.125;
  const Le = 4.5 - La;
  const Fz = 1.8 + (Math.tan(34 * DEG) - 1.8) * (z / 6);
  const Pd = (2 * Fz * 1.0 * (19 * z) * (2 * 0.045) * Le) / 1.35;
  ajouter('T_MSE.3', "Résistance à l'arrachement du lit 2", 'C·F*(z)·α·σv·B_c·Le / γR;a', Pd, lit.P_d, 1e-9, 'kN/m');

  // ---------------------------------------------------------------------------
  // T_MSE.4 : ligne de Rankine pour une armature extensible (géosynthétique)
  // La = h·tan(45° − φ/2) au lit 2.
  // ---------------------------------------------------------------------------
  const oGeo: OuvrageSolRenforce = {
    ...o,
    armature: armatureParDefaut('geosynthetique'),
    coefficients: coefficientsParDefaut('geosynthetique', 34),
  };
  const litGeo = verifierStabiliteInterne(oGeo, da2).lits[1];
  ajouter('T_MSE.4a', 'Longueur active, ligne de Rankine', 'La = h·tan(45° − φ/2)', 1.125 * Math.tan((45 - 17) * DEG), litGeo.longueurActive, 1e-9, 'm');
  ajouter('T_MSE.4b', 'Rupture d’un géosynthétique', 'T_ult / (RF_fl·RF_end·RF_v) / γR;t', 80 / (1.6 * 1.1 * 1.1) / 1.35, litGeo.R_d, 1e-9, 'kN/m');

  // ---------------------------------------------------------------------------
  // T_MSE.5 : stabilité externe, sol retenu et fondation homogènes (γ = 18, φ' = 30°)
  // ---------------------------------------------------------------------------
  const couches = [coucheTest(10, 40, 18, 20, 30, 0)];
  const sec = hydroCote(-99);
  const ext = verifierStabiliteExterne(o, da2, couches, sec, CONFIG_NORMATIVE_DEFAUT);
  const Kab = (1 - Math.sin(30 * DEG)) / (1 + Math.sin(30 * DEG)); // 1/3
  const Psol = 0.5 * Kab * 18 * 36;
  const PqQ = Kab * 10 * 6;
  const Hd = 1.35 * Psol + 1.5 * PqQ;
  const W = 19 * 6 * 4.5;
  const Rhd = (W * Math.tan(30 * DEG)) / 1.1;
  ajouter('T_MSE.5a', 'Glissement : effort de calcul', 'H_d = 1,35·½Ka·γ·H² + 1,5·Ka·qQ·H', Hd, ext.glissement.H_d, 1e-9, 'kN/m');
  ajouter('T_MSE.5b', 'Glissement : résistance de calcul', 'R_h,d = W·tan(min φ’) / γR;h (R2 = 1,1)', Rhd, ext.glissement.R_hd, 1e-9, 'kN/m');
  const e = 4.5 / 2 - (W * 2.25 - (Psol * 2 + PqQ * 3)) / W;
  ajouter('T_MSE.5c', 'Excentricité caractéristique', 'e = L/2 − (M_stb − M_dst)/V', e, ext.excentricite.e, 1e-9, 'm');

  // ---------------------------------------------------------------------------
  // T_MSE.6 : le moment d'un renforcement réduit exactement le moment moteur.
  // Sol cohérent (φ = 0) : m_α ne dépend pas de F, donc F_avec = F_sans·M_mot / (M_mot − T·(yc − y)).
  // ---------------------------------------------------------------------------
  const profilPlat = [
    { x: -30, y: 0 },
    { x: 30, y: 0 },
  ];
  const coh = [coucheTest(0, 40, 18, 20, 0, 20)];
  const base = {
    cercle: { centreX: 0, centreY: 5, rayon: 10 },
    profilTN: profilPlat,
    couches: coh,
    hydrogeologie: sec,
    combinaison: COMBINAISON_CARACTERISTIQUE,
    surcharges: [{ id: 'g', nom: 'G', xDebut: 0, xFin: 6, q: 50, nature: 'G' as const }],
    nbTranches: 100,
  };
  const sans = analyserCercleBishop(base);
  // Bande à droite du centre : rotation horaire, la masse part vers les x décroissants.
  // Lit à y = −2 de x = 0 à 20 : coupe l'arc en x = √(100 − 49) et s'ancre à droite, sur
  // 20 − √51 = 12,9 m. Un lit placé à gauche (x de −20 à 0) serait comprimé : sans effet.
  const avec = analyserCercleBishop({
    ...base,
    renforcements: [{ y: -2, xDebut: 0, xFin: 20, resistanceRupture_d: 30, arrachementLineique_d: 100 }],
  });
  const comprime = analyserCercleBishop({
    ...base,
    renforcements: [{ y: -2, xDebut: -20, xFin: 0, resistanceRupture_d: 30, arrachementLineique_d: 100 }],
  });
  if (sans.valide && avec.valide) {
    ajouter(
      'T_MSE.6',
      'Moment repris par un lit',
      'T = min(30 ; 100·Le) = 30 kN/m, bras yc − y = 7 m, déduit du moment moteur',
      (sans.F * sans.momentMoteur_d) / (sans.momentMoteur_d - 30 * 7),
      avec.F,
      1e-9
    );
    ajouter(
      'T_MSE.6b',
      'Lit placé en aval du déplacement sans effet',
      'Un lit comprimé par la masse ne reprend rien',
      sans.F,
      comprime.valide ? comprime.F : NaN,
      1e-9
    );
  } else {
    ajouter('T_MSE.6', 'Moment résistant apporté par un lit', 'cercle invalide', 1, NaN, 0);
  }

  // ---------------------------------------------------------------------------
  // T_MSE.7 : sans armatures, le massif est moins stable qu'avec (cohérence du branchement).
  // ---------------------------------------------------------------------------
  const avecArm = rechercherStabiliteGeneraleMassif(o, da2, couches, sec);
  const g = geometrieMassif(o);
  const sansArm = rechercherStabiliteGeneraleMassif({ ...o, espacementSv: 100, premierLit: 100 }, da2, couches, sec);
  const ok7 = !!avecArm && !!sansArm && avecArm.resultat.F > sansArm.resultat.F && g.renforcements.length === 8;
  res.push({
    id: 'T_MSE.7',
    nom: 'Stabilité générale : effet des armatures',
    phase: 'Sol renforcé',
    description: '8 lits ; F critique avec armatures > F critique sans armatures',
    valeurAttendue: 'F_avec > F_sans',
    valeurObtenue: `F_avec = ${avecArm?.resultat.F.toFixed(3)} ; F_sans = ${sansArm?.resultat.F.toFixed(3)}`,
    tolerance: 'qualitatif',
    ecartAbsolu: 0,
    ecartPourcentage: 0,
    succes: ok7,
    message: ok7 ? 'Les lits sont bien mobilisés' : 'Branchement des renforcements incorrect',
  });

  // ---------------------------------------------------------------------------
  // T_MSE.8 : nappe au-dessus de la base (massif en déblai sous la nappe). Le module de
  // portance ignore l'eau libre ; plafonnée au terrain devant, la résistance reste positive
  // et la limite est signalée.
  // ---------------------------------------------------------------------------
  const oDeblai: OuvrageSolRenforce = { ...o, coteBase: 10 - 6 };
  const extNappe = verifierStabiliteExterne(oDeblai, da2, couches, hydroCote(9), CONFIG_NORMATIVE_DEFAUT);
  const ok8 = extNappe.portance.R_vd > 0 && extNappe.avertissements.length === 1;
  res.push({
    id: 'T_MSE.8',
    nom: 'Nappe au-dessus de la base : portance positive et limite signalée',
    phase: 'Sol renforcé',
    description: 'Base à 4, terrain devant à 4,6, nappe à 9',
    valeurAttendue: 'R_v,d > 0 et un avertissement',
    valeurObtenue: `R_v,d = ${extNappe.portance.R_vd.toFixed(1)} kN/m ; ${extNappe.avertissements.length} avertissement(s)`,
    tolerance: 'qualitatif',
    ecartAbsolu: 0,
    ecartPourcentage: 0,
    succes: ok8,
    message: ok8 ? 'Limite signalée, pas de résistance négative' : 'Résistance négative ou limite non signalée',
  });

  return res;
}
