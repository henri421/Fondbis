import React, { useState, useMemo } from 'react';
import { ModeleTerrain, OuvrageRadier } from '../types/geotech';
import { verifierPortanceRadierELU } from '../modules/radier/portanceELU';
import { calculerTassementRadierELS, calculerCourbeTassementCharge } from '../modules/radier/tassementELS';
import { calculerRadierSurRessortsIteratifs } from '../modules/radier/radierSurRessortsIteratifs';
import { GraphiqueCourbeTassement } from './radier/GraphiqueCourbeTassement';
import {
  ShieldAlert,
  ShieldCheck,
  Check,
  AlertTriangle,
  Layers,
  Copy,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
} from 'lucide-react';
import { Card } from './ui/Card';
import { Verdict } from './ui/Verdict';
import { Champ } from './ui/Champ';
import { Bouton } from './ui/Bouton';

interface OngletRadierProps {
  modele: ModeleTerrain;
  onUpdateRadier: (radier: OuvrageRadier) => void;
}

const LABEL_REGIME: Record<string, string> = {
  surconsolide: 'Surconsolidé (Cs)',
  normalement_consolide: 'Normal. consolidé (Cc)',
  franchissement: 'Franchissement σ\'p (Cs+Cc)',
};

export const OngletRadier: React.FC<OngletRadierProps> = ({ modele, onUpdateRadier }) => {
  const [afficherSolStructure, setAfficherSolStructure] = useState(true);
  const [afficherTableauSousCouches, setAfficherTableauSousCouches] = useState(false);
  const [maillageN, setMaillageN] = useState<number>(8);
  const [copiePressePapier, setCopiePressePapier] = useState(false);

  const radierActif =
    modele.ouvrages.radiers[0] || {
      id: 'RAD-01',
      nom: 'Radier principal',
      longueurL: 15.0,
      largeurB: 10.0,
      coteBase: 242.0,
      epaisseur: 0.6,
      actions: { V_G: 12000, V_Q: 3000, H_G: 200, H_Q: 100, M_G: 1500, M_Q: 500 },
      coteTerrainFini: modele.referentiel.coteTerrainNaturel,
    };

  const updateChamp = (champ: keyof OuvrageRadier, val: any) => {
    onUpdateRadier({
      ...radierActif,
      [champ]: val,
    });
  };

  const updateAction = (champ: keyof OuvrageRadier['actions'], val: number) => {
    onUpdateRadier({
      ...radierActif,
      actions: {
        ...radierActif.actions,
        [champ]: val,
      },
    });
  };

  // Calculs ELU & ELS
  const resELU = verifierPortanceRadierELU(
    radierActif,
    modele.referentiel.coteTerrainNaturel,
    modele.couches,
    modele.hydrogeologie,
    modele.configurationNormative
  );

  const resELS = calculerTassementRadierELS(
    radierActif,
    modele.referentiel.coteTerrainNaturel,
    modele.couches,
    modele.hydrogeologie
  );

  const courbeTassement = useMemo(() => {
    return calculerCourbeTassementCharge(
      radierActif,
      modele.referentiel.coteTerrainNaturel,
      modele.couches,
      modele.hydrogeologie,
      { nbPoints: 25, facteurMaxCharge: 2.0 }
    );
  }, [
    radierActif,
    modele.referentiel.coteTerrainNaturel,
    modele.couches,
    modele.hydrogeologie,
  ]);

  const resRessorts = calculerRadierSurRessortsIteratifs(
    radierActif,
    modele.couches,
    modele.hydrogeologie,
    {
      nx: maillageN,
      ny: maillageN,
      maxIterations: 15,
      toleranceConvergence: 0.01,
      facteurRelaxation: 0.5,
    }
  );

  const copierExportJSON = () => {
    navigator.clipboard.writeText(resRessorts.exportStructuralJSON);
    setCopiePressePapier(true);
    setTimeout(() => setCopiePressePapier(false), 2500);
  };

  const portanceConforme = resELU.tauxExploitationGouvernant <= 1.0;
  const glissementConforme = resELU.tauxGlissementDraine <= 1.0 && resELU.glissementConforme04Vd;

  return (
    <div className="space-y-5">
      {/* 1. Paramètres d'entrée du Radier / Semelle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Géométrie */}
        <Card>
          <h3 className="text-xs font-semibold text-texte-faible uppercase tracking-wide mb-3">
            1. Géométrie & Encastrement (Module A)
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Champ
              id="input-radier-b"
              label="Largeur B (m)"
              type="number"
              step="0.5"
              min="0.5"
              value={radierActif.largeurB}
              onChange={(e) => updateChamp('largeurB', parseFloat(e.target.value) || 1)}
            />
            <Champ
              id="input-radier-l"
              label="Longueur L (m)"
              type="number"
              step="0.5"
              min="0.5"
              value={radierActif.longueurL}
              onChange={(e) => updateChamp('longueurL', parseFloat(e.target.value) || 1)}
            />
            <Champ
              id="input-radier-base"
              label="Cote Base d'assise (m)"
              type="number"
              step="0.1"
              value={radierActif.coteBase}
              onChange={(e) => updateChamp('coteBase', parseFloat(e.target.value) || 0)}
            />
            <Champ
              id="input-radier-epaisseur"
              label="Épaisseur dalle (m)"
              type="number"
              step="0.05"
              min="0.2"
              value={radierActif.epaisseur}
              onChange={(e) => updateChamp('epaisseur', parseFloat(e.target.value) || 0.4)}
            />
          </div>
          <div className="mt-2.5 p-2 bg-surface-appui rounded-rayon-petit text-[11px] text-texte-doux flex justify-between">
            <span>Surface brute : {(radierActif.largeurB * radierActif.longueurL).toFixed(1)} m²</span>
            <span>Encastrement D : {(modele.referentiel.coteTerrainNaturel - radierActif.coteBase).toFixed(2)} m</span>
          </div>
        </Card>

        {/* Actions en base */}
        <Card>
          <h3 className="text-xs font-semibold text-texte-faible uppercase tracking-wide mb-3">
            2. Actions caractéristiques en base (kN, kNm)
          </h3>
          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <Champ
              id="input-radier-vg"
              label="V permanent (G)"
              type="number"
              step="100"
              value={radierActif.actions.V_G}
              onChange={(e) => updateAction('V_G', parseFloat(e.target.value) || 0)}
            />
            <Champ
              id="input-radier-hg"
              label="H permanent (G)"
              type="number"
              step="50"
              value={radierActif.actions.H_G}
              onChange={(e) => updateAction('H_G', parseFloat(e.target.value) || 0)}
            />
            <Champ
              id="input-radier-mg"
              label="M permanent (G)"
              type="number"
              step="100"
              value={radierActif.actions.M_G}
              onChange={(e) => updateAction('M_G', parseFloat(e.target.value) || 0)}
            />
            <Champ
              id="input-radier-vq"
              label="V variable (Q)"
              type="number"
              step="100"
              value={radierActif.actions.V_Q}
              onChange={(e) => updateAction('V_Q', parseFloat(e.target.value) || 0)}
            />
            <Champ
              id="input-radier-hq"
              label="H variable (Q)"
              type="number"
              step="50"
              value={radierActif.actions.H_Q}
              onChange={(e) => updateAction('H_Q', parseFloat(e.target.value) || 0)}
            />
            <Champ
              id="input-radier-mq"
              label="M variable (Q)"
              type="number"
              step="100"
              value={radierActif.actions.M_Q}
              onChange={(e) => updateAction('M_Q', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="mt-2.5 p-2 bg-surface-appui rounded-rayon-petit text-[11px] text-texte-doux flex justify-between font-mono">
            <span>Comb. ELU V_d : {resELU.V_d} kN</span>
            <span>Excentrement e_B : {resELU.e_B} m ({resELU.decollementPartiel ? 'Décollement partiel' : 'Complet'})</span>
          </div>
        </Card>
      </div>

      {/* 2. Résultats ELU : Portance et Glissement */}
      <div className="bg-surface border border-bordure rounded-rayon overflow-hidden">
        <div className="px-4 py-3 bg-surface-appui border-b border-bordure flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-texte text-sm">Vérifications ELU (Résistance & Stabilité)</span>
            <span className="text-[11px] bg-surface text-texte-doux border border-bordure px-2 py-0.5 rounded-rayon-petit font-mono">
              {resELU.combinaison}
            </span>
          </div>
          <span className="text-xs text-texte-doux italic">
            Statut : {resELU.statutNormatif} ({resELU.clauseReference})
          </span>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Carte 1 : Portance drainée & non drainée */}
          <Verdict etat={portanceConforme ? 'ok' : 'refus'}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs">Portance GEO (Annexe D)</span>
              {portanceConforme ? (
                <span className="flex items-center gap-1 text-xs">
                  <ShieldCheck className="w-3.5 h-3.5" /> Conforme
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs">
                  <ShieldAlert className="w-3.5 h-3.5" /> Non conforme
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs font-normal">
              <div className="flex justify-between items-baseline">
                <span>Taux d'exploitation :</span>
                <span className="text-base font-semibold font-mono tabular-nums">
                  {(resELU.tauxExploitationGouvernant * 100).toFixed(1)} %
                </span>
              </div>
              <div className="flex justify-between">
                <span>Charge verticale V_d :</span>
                <span className="font-mono font-semibold">{resELU.V_d} kN</span>
              </div>
              <div className="flex justify-between">
                <span>Résistance calcul R_d :</span>
                <span className="font-mono font-semibold">
                  {resELU.conditionGouvernante === 'Draine' ? resELU.R_d_draine : resELU.R_d_nonDraine} kN
                </span>
              </div>
              <div className="pt-2 border-t border-bordure-douce text-[11px] space-y-0.5">
                <div>Régime gouvernant : <strong>{resELU.conditionGouvernante}</strong></div>
                <div>Surface effective A' : {resELU.A_prime} m² (B'={resELU.B_prime}m)</div>
                <div>Nq={resELU.Nq} • Nc={resELU.Nc} • Nγ={resELU.Ngamma}</div>
              </div>
            </div>
          </Verdict>

          {/* Carte 2 : Glissement */}
          <Verdict etat={glissementConforme ? 'ok' : 'refus'}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs">Glissement (Clause 6.5.3)</span>
              {glissementConforme ? (
                <span className="flex items-center gap-1 text-xs">
                  <ShieldCheck className="w-3.5 h-3.5" /> Conforme
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs">
                  <ShieldAlert className="w-3.5 h-3.5" /> Non conforme
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs font-normal">
              <div className="flex justify-between items-baseline">
                <span>Taux de glissement :</span>
                <span className="text-base font-semibold font-mono tabular-nums">
                  {(resELU.tauxGlissementDraine * 100).toFixed(1)} %
                </span>
              </div>
              <div className="flex justify-between">
                <span>Effort horizontal H_d :</span>
                <span className="font-mono font-semibold">{resELU.H_d} kN</span>
              </div>
              <div className="flex justify-between">
                <span>Résistance glissement R_hd :</span>
                <span className="font-mono font-semibold">{resELU.R_h_draine} kN</span>
              </div>
              <div className="pt-2 border-t border-bordure-douce text-[11px]">
                <div>Critère H_d ≤ 0.4·V_d : {resELU.glissementConforme04Vd ? 'Respecté' : 'Non respecté'}</div>
                <div>Frottement interface δ_d : {resELU.phi_d}°</div>
              </div>
            </div>
          </Verdict>

          {/* Carte 3 : Hydraulique UPL (Sous-pression eau) */}
          <Verdict etat={resELU.upl.conforme ? 'ok' : 'refus'}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs">Soulèvement UPL (Clause 10.2)</span>
              {resELU.upl.conforme ? (
                <span className="flex items-center gap-1 text-xs">
                  <ShieldCheck className="w-3.5 h-3.5" /> Conforme
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs">
                  <ShieldAlert className="w-3.5 h-3.5" /> Risque UPL
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs font-normal">
              <div className="flex justify-between items-baseline">
                <span>Taux sous-pression :</span>
                <span className="text-base font-semibold font-mono tabular-nums">
                  {(resELU.upl.taux * 100).toFixed(1)} %
                </span>
              </div>
              <div className="flex justify-between">
                <span>Sous-pression V_dst,d :</span>
                <span className="font-mono font-semibold">{resELU.upl.V_dst_d} kN</span>
              </div>
              <div className="flex justify-between">
                <span>Poids stabilisant G_stb,d :</span>
                <span className="font-mono font-semibold">{resELU.upl.G_stb_d} kN</span>
              </div>
              <div className="pt-2 border-t border-bordure-douce text-[11px]">
                <div>Nappe ELU défavorable : {modele.hydrogeologie.nappePrincipale.coteDefavorableELU} m</div>
                <div>Condition : V_dst,d ≤ G_stb,d</div>
              </div>
            </div>
          </Verdict>
        </div>
      </div>

      {/* 3. Résultats ELS : Tassement et Déformations */}
      <div className="bg-surface border border-bordure rounded-rayon overflow-hidden">
        <div className="px-4 py-3 bg-surface-appui border-b border-bordure flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-texte text-sm">Vérifications ELS (Tassements & Distorsion)</span>
            <span className="text-xs text-texte-doux">
              Pression appliquée q_ELS = {resELS.pressionAppliquee_q} kPa
            </span>
          </div>
          <span className="text-xs text-texte-doux italic">
            Statut : {resELS.statutNormatif} ({resELS.clauseReference})
          </span>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-surface-appui rounded-rayon-petit border border-bordure">
              <span className="text-[11px] text-texte-doux block">Tassement sous le centre</span>
              <span className="text-lg font-semibold text-texte font-mono tabular-nums">{resELS.tassementCentreTotal_mm} mm</span>
            </div>
            <div className="p-3 bg-surface-appui rounded-rayon-petit border border-bordure">
              <span className="text-[11px] text-texte-doux block">Tassement sous l'angle</span>
              <span className="text-lg font-semibold text-texte font-mono tabular-nums">{resELS.tassementCoinTotal_mm} mm</span>
            </div>
            <div className="p-3 bg-surface-appui rounded-rayon-petit border border-bordure">
              <span className="text-[11px] text-texte-doux block">Tassement différentiel</span>
              <span className="text-lg font-semibold text-texte font-mono tabular-nums">{resELS.tassementDifferentiel_mm} mm</span>
            </div>
            <div className="p-3 bg-surface-appui rounded-rayon-petit border border-bordure">
              <span className="text-[11px] text-texte-doux block">Distorsion angulaire</span>
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-texte font-mono tabular-nums">{resELS.distorsionRatio}</span>
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-rayon-petit ${
                    resELS.critereAdmissibleRespecte ? 'bg-ok-fond text-ok' : 'bg-refus-fond text-refus'
                  }`}
                >
                  {resELS.critereAdmissibleRespecte ? '≤ 1/500 OK' : '> 1/500 Alerte'}
                </span>
              </div>
            </div>
          </div>

          {/* Visualisation Recharts : Courbe de tassement théorique en fonction de la charge */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-bordure-douce pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-texte-faible" />
                <h4 className="text-xs font-semibold text-texte-faible uppercase tracking-wide">
                  Courbe de tassement théorique sous le radier s = f(charge)
                </h4>
              </div>
              <span className="text-[11px] text-texte-doux font-medium">
                Intégration œdométrique Boussinesq &amp; Steinbrenner
              </span>
            </div>

            <GraphiqueCourbeTassement
              points={courbeTassement}
              pressionActuelle_kPa={resELS.pressionAppliquee_q}
              chargeActuelle_kN={Math.max(10, radierActif.actions.V_G + radierActif.actions.V_Q)}
              tassementCentreActuel_mm={resELS.tassementCentreTotal_mm}
              tassementCoinActuel_mm={resELS.tassementCoinTotal_mm}
              tassementMoyenActuel_mm={resELS.tassementMoyen_mm}
              seuilAdmissible_mm={50}
            />
          </Card>

          {/* Découpage en sous-couches et régimes de consolidation */}
          <div className="border border-bordure rounded-rayon overflow-hidden">
            <div className="px-3 py-2 bg-surface-appui border-b border-bordure flex items-center justify-between">
              <span className="text-xs font-semibold text-texte-doux">
                Détail du calcul oedométrique par sous-couche (Loi tri-zone de consolidation)
              </span>
              <button
                type="button"
                onClick={() => setAfficherTableauSousCouches(!afficherTableauSousCouches)}
                className="text-xs font-semibold text-texte-doux hover:text-texte bg-surface px-2 py-0.5 rounded-rayon-petit border border-bordure transition-colors"
              >
                {afficherTableauSousCouches ? 'Masquer tableau' : 'Afficher tableau'}
              </button>
            </div>
            {afficherTableauSousCouches && (
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead className="bg-surface-appui text-texte-doux border-b border-bordure sticky top-0">
                    <tr>
                      <th className="p-2 font-normal">Cote (m)</th>
                      <th className="p-2 font-normal font-sans">Couche</th>
                      <th className="p-2 font-normal">σ'v0 (kPa)</th>
                      <th className="p-2 font-normal">Δσ_v centre (kPa)</th>
                      <th className="p-2 font-normal">σ'p (kPa)</th>
                      <th className="p-2 font-normal font-sans">Régime</th>
                      <th className="p-2 font-normal text-right font-sans">s_i (mm)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bordure-douce">
                    {resELS.detailsSousCouches.map((d) => (
                      <tr key={d.index} className="hover:bg-surface-appui">
                        <td className="p-2">
                          {d.coteHaut.toFixed(1)} à {d.coteBas.toFixed(1)}
                        </td>
                        <td className="p-2 font-sans font-medium text-texte-doux">{d.coucheNom}</td>
                        <td className="p-2 text-texte-doux">{d.sigma_v0_prime}</td>
                        <td className="p-2 text-texte">{d.delta_sigma_v}</td>
                        <td className="p-2 text-texte-doux">{d.sigma_p_prime}</td>
                        <td className="p-2 font-sans">
                          <span className="text-texte-doux bg-surface-appui border border-bordure px-1.5 py-0.5 rounded-rayon-petit text-[10px]">
                            {LABEL_REGIME[d.regime] ?? d.regime}
                          </span>
                        </td>
                        <td className="p-2 text-right text-texte">{d.tassementCentre_mm}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Modélisation Sol-Structure avancée (Plaque 2D sur ressorts non-linéaires couplés — CDC §6.6) */}
      <div className="bg-surface border border-bordure rounded-rayon overflow-hidden">
        <div className="px-4 py-3 bg-surface-appui border-b border-bordure flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-texte-faible" />
            <span className="font-semibold text-texte text-sm">
              4. Couplage Sol-Structure — Radier sur ressorts itératifs (CDC §6.6)
            </span>
            <span className="text-[11px] bg-surface text-texte-doux border border-bordure font-mono px-2 py-0.5 rounded-rayon-petit">
              Solveur direct Gauss ∇⁴w + ks·w = q
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-texte-doux">
              <label htmlFor="select-maillage" className="font-medium">Maillage :</label>
              <select
                id="select-maillage"
                value={maillageN}
                onChange={(e) => setMaillageN(parseInt(e.target.value, 10))}
                className="px-2 py-1 border border-bordure rounded-rayon-petit bg-surface text-xs font-semibold text-texte"
              >
                <option value={4}>4 × 4 (25 nœuds)</option>
                <option value={6}>6 × 6 (49 nœuds)</option>
                <option value={8}>8 × 8 (81 nœuds - standard)</option>
                <option value={10}>10 × 10 (121 nœuds)</option>
                <option value={12}>12 × 12 (169 nœuds - fin)</option>
              </select>
            </div>

            <Bouton onClick={() => setAfficherSolStructure(!afficherSolStructure)}>
              {afficherSolStructure ? 'Masquer détails' : 'Afficher détails'}
            </Bouton>
          </div>
        </div>

        {afficherSolStructure && (
          <div className="p-4 space-y-4">
            {/* Statut de convergence & Avertissements */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-surface-appui border border-bordure rounded-rayon">
              <div className="flex items-center gap-2">
                {resRessorts.convergence.convergé ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-ok bg-ok-fond px-2.5 py-1 rounded-rayon-petit">
                    <CheckCircle2 className="w-4 h-4" />
                    Convergé en {resRessorts.convergence.nbIterations} itérations (Écart final : {resRessorts.convergence.ecartFinalRelatif} % &lt; 1%)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-alerte bg-alerte-fond px-2.5 py-1 rounded-rayon-petit">
                    <AlertTriangle className="w-4 h-4" />
                    Non convergé après {resRessorts.convergence.nbIterations} itérations (Écart : {resRessorts.convergence.ecartFinalRelatif} %)
                  </span>
                )}
                <span className="text-xs text-texte-doux">
                  Sous-relaxation : 0.5 • Tolérance relative : 1.0 %
                </span>
              </div>

              <Bouton onClick={copierExportJSON}>
                {copiePressePapier ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Export copié !
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Exporter format structural (JSON)
                  </>
                )}
              </Bouton>
            </div>

            {/* Avertissements du solveur / de la boucle */}
            {resRessorts.convergence.avertissements && resRessorts.convergence.avertissements.length > 0 && (
              <div className="p-3 bg-alerte-fond border border-bordure rounded-rayon text-xs text-alerte space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Avertissements du solveur de plaque couplé :
                </div>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  {resRessorts.convergence.avertissements.map((av, idx) => (
                    <li key={idx}>{av}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Indicateurs clés du couplage */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-surface-appui rounded-rayon-petit border border-bordure">
                <span className="text-texte-doux block mb-1">Tassement max / min (w)</span>
                <span className="text-base font-semibold text-texte font-mono tabular-nums">
                  {resRessorts.champs.tassementMax_mm} / {resRessorts.champs.tassementMin_mm} mm
                </span>
              </div>
              <div className="p-3 bg-surface-appui rounded-rayon-petit border border-bordure">
                <span className="text-texte-doux block mb-1">Tassement différentiel (Δs)</span>
                <span className="text-base font-semibold text-texte font-mono tabular-nums">
                  {resRessorts.champs.tassementDifferentielMax_mm} mm
                </span>
                <span className="block text-[10px] text-texte-doux mt-0.5">
                  Distorsion : 1 / {Math.round(1 / (resRessorts.champs.distorsionAngulaireMax || 1e-6))}
                </span>
              </div>
              <div className="p-3 bg-surface-appui rounded-rayon-petit border border-bordure">
                <span className="text-texte-doux block mb-1">Pression sol max / min</span>
                <span className="text-base font-semibold text-texte font-mono tabular-nums">
                  {resRessorts.champs.pressionContactMax_kPa} / {resRessorts.champs.pressionContactMin_kPa} kPa
                </span>
              </div>
              <div className="p-3 bg-surface-appui rounded-rayon-petit border border-bordure">
                <span className="text-texte-doux block mb-1">Module réaction ks sol</span>
                <span className="text-base font-semibold text-texte font-mono tabular-nums">
                  {resRessorts.sol.ksFinalMoyen} kN/m³
                </span>
                <span className="block text-[10px] text-texte-doux mt-0.5">
                  Initial : {resRessorts.sol.ksInitialMoyen} kN/m³
                </span>
              </div>
            </div>

            {/* Historique des itérations */}
            <div className="border border-bordure rounded-rayon overflow-hidden">
              <div className="px-3 py-1.5 bg-surface-appui border-b border-bordure text-xs font-semibold text-texte-doux">
                Convergence itérative Sol-Structure (Actualisation des ressorts locaux de Winkler)
              </div>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead className="bg-surface-appui text-texte-doux border-b border-bordure sticky top-0">
                    <tr>
                      <th className="p-2 font-normal font-sans">Itération</th>
                      <th className="p-2 font-normal text-right font-sans">s_max (mm)</th>
                      <th className="p-2 font-normal text-right font-sans">Δs différentiel (mm)</th>
                      <th className="p-2 font-normal text-right font-sans">p_contact max (kPa)</th>
                      <th className="p-2 font-normal text-right font-sans">Écart relatif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bordure-douce">
                    {resRessorts.convergence.historique.map((it) => (
                      <tr key={it.numero} className="hover:bg-surface-appui">
                        <td className="p-2 font-sans font-medium text-texte-doux">Itération {it.numero}</td>
                        <td className="p-2 text-right text-texte">{it.flecheMax_mm.toFixed(2)}</td>
                        <td className="p-2 text-right text-texte font-semibold">{it.tassementDiff_mm.toFixed(2)}</td>
                        <td className="p-2 text-right text-texte-doux">{it.pressionMax_kPa.toFixed(1)}</td>
                        <td className="p-2 text-right">
                          <span
                            className={`px-1.5 py-0.5 rounded-rayon-petit text-[10px] font-semibold ${
                              it.ecartRelatifMax <= 1.0
                                ? 'bg-ok-fond text-ok'
                                : 'bg-surface-appui text-texte-doux'
                            }`}
                          >
                            {it.ecartRelatifMax.toFixed(2)} %
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
