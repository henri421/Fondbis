import React, { useState } from 'react';
import { ModeleTerrain, OuvrageRadier } from '../types/geotech';
import { verifierPortanceRadierELU } from '../modules/radier/portanceELU';
import { calculerTassementRadierELS } from '../modules/radier/tassementELS';
import { calculerRadierSurRessortsIteratifs } from '../modules/radier/radierSurRessortsIteratifs';
import {
  ShieldAlert,
  ShieldCheck,
  HelpCircle,
  Check,
  AlertTriangle,
  ArrowRight,
  Layers,
  Download,
  Copy,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface OngletRadierProps {
  modele: ModeleTerrain;
  onUpdateRadier: (radier: OuvrageRadier) => void;
}

export const OngletRadier: React.FC<OngletRadierProps> = ({ modele, onUpdateRadier }) => {
  const [afficherSolStructure, setAfficherSolStructure] = useState(true);
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

  return (
    <div className="space-y-5">
      {/* 1. Paramètres d'entrée du Radier / Semelle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Géométrie */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
            1. Géométrie & Encastrement (Module A)
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">Largeur B (m)</label>
              <input
                id="input-radier-b"
                type="number"
                step="0.5"
                min="0.5"
                value={radierActif.largeurB}
                onChange={(e) => updateChamp('largeurB', parseFloat(e.target.value) || 1)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Longueur L (m)</label>
              <input
                id="input-radier-l"
                type="number"
                step="0.5"
                min="0.5"
                value={radierActif.longueurL}
                onChange={(e) => updateChamp('longueurL', parseFloat(e.target.value) || 1)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Cote Base d'assise (m)</label>
              <input
                id="input-radier-base"
                type="number"
                step="0.1"
                value={radierActif.coteBase}
                onChange={(e) => updateChamp('coteBase', parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold text-emerald-800 focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Épaisseur dalle (m)</label>
              <input
                id="input-radier-epaisseur"
                type="number"
                step="0.05"
                min="0.2"
                value={radierActif.epaisseur}
                onChange={(e) => updateChamp('epaisseur', parseFloat(e.target.value) || 0.4)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
          <div className="mt-2.5 p-2 bg-slate-50 rounded-lg text-[11px] text-slate-600 flex justify-between">
            <span>Surface brute : {(radierActif.largeurB * radierActif.longueurL).toFixed(1)} m²</span>
            <span>Encastrement D : {(modele.referentiel.coteTerrainNaturel - radierActif.coteBase).toFixed(2)} m</span>
          </div>
        </div>

        {/* Actions en base */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
            2. Actions caractéristiques en base (kN, kNm)
          </h3>
          <div className="grid grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">V permanent (G)</label>
              <input
                id="input-radier-vg"
                type="number"
                step="100"
                value={radierActif.actions.V_G}
                onChange={(e) => updateAction('V_G', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">H permanent (G)</label>
              <input
                id="input-radier-hg"
                type="number"
                step="50"
                value={radierActif.actions.H_G}
                onChange={(e) => updateAction('H_G', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-medium"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">M permanent (G)</label>
              <input
                id="input-radier-mg"
                type="number"
                step="100"
                value={radierActif.actions.M_G}
                onChange={(e) => updateAction('M_G', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-medium"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">V variable (Q)</label>
              <input
                id="input-radier-vq"
                type="number"
                step="100"
                value={radierActif.actions.V_Q}
                onChange={(e) => updateAction('V_Q', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">H variable (Q)</label>
              <input
                id="input-radier-hq"
                type="number"
                step="50"
                value={radierActif.actions.H_Q}
                onChange={(e) => updateAction('H_Q', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-medium"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">M variable (Q)</label>
              <input
                id="input-radier-mq"
                type="number"
                step="100"
                value={radierActif.actions.M_Q}
                onChange={(e) => updateAction('M_Q', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-medium"
              />
            </div>
          </div>
          <div className="mt-2.5 p-2 bg-amber-50/60 rounded-lg text-[11px] text-amber-900 flex justify-between font-mono">
            <span>Comb. ELU V_d : {resELU.V_d} kN</span>
            <span>Excentrement e_B : {resELU.e_B} m ({resELU.decollementPartiel ? 'Décollement partiel' : 'Complet'})</span>
          </div>
        </div>
      </div>

      {/* 2. Résultats ELU : Portance et Glissement */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-sm">Vérifications ELU (Résistance & Stabilité)</span>
            <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
              {resELU.combinaison}
            </span>
          </div>
          <span className="text-xs text-slate-500 italic">
            Statut : {resELU.statutNormatif} ({resELU.clauseReference})
          </span>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Carte 1 : Portance drainée & non drainée */}
          <div
            className={`p-4 rounded-xl border ${
              resELU.tauxExploitationGouvernant <= 1.0
                ? 'bg-emerald-50/50 border-emerald-200'
                : 'bg-rose-50/60 border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">Portance GEO (Annexe D)</span>
              {resELU.tauxExploitationGouvernant <= 1.0 ? (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" /> Conforme
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                  <ShieldAlert className="w-3.5 h-3.5" /> Non conforme
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-600">Taux d'exploitation :</span>
                <span
                  className={`text-base font-extrabold ${
                    resELU.tauxExploitationGouvernant <= 1.0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {(resELU.tauxExploitationGouvernant * 100).toFixed(1)} %
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Charge verticale V_d :</span>
                <span className="font-mono font-bold text-slate-800">{resELU.V_d} kN</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Résistance calcul R_d :</span>
                <span className="font-mono font-bold text-slate-800">
                  {resELU.conditionGouvernante === 'Draine' ? resELU.R_d_draine : resELU.R_d_nonDraine} kN
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-500 space-y-0.5">
                <div>Régime gouvernant : <strong className="text-slate-700">{resELU.conditionGouvernante}</strong></div>
                <div>Surface effective A' : {resELU.A_prime} m² (B'={resELU.B_prime}m)</div>
                <div>Nq={resELU.Nq} • Nc={resELU.Nc} • Nγ={resELU.Ngamma}</div>
              </div>
            </div>
          </div>

          {/* Carte 2 : Glissement */}
          <div
            className={`p-4 rounded-xl border ${
              resELU.tauxGlissementDraine <= 1.0 && resELU.glissementConforme04Vd
                ? 'bg-emerald-50/50 border-emerald-200'
                : 'bg-rose-50/60 border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">Glissement (Clause 6.5.3)</span>
              {resELU.tauxGlissementDraine <= 1.0 && resELU.glissementConforme04Vd ? (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" /> Conforme
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                  <ShieldAlert className="w-3.5 h-3.5" /> Non conforme
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-600">Taux de glissement :</span>
                <span className="text-base font-extrabold text-slate-800">
                  {(resELU.tauxGlissementDraine * 100).toFixed(1)} %
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Effort horizontal H_d :</span>
                <span className="font-mono font-bold text-slate-800">{resELU.H_d} kN</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Résistance glissement R_hd :</span>
                <span className="font-mono font-bold text-slate-800">{resELU.R_h_draine} kN</span>
              </div>
              <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-500">
                <div>Critère H_d ≤ 0.4·V_d : {resELU.glissementConforme04Vd ? 'Respecté' : 'Non respecté'}</div>
                <div>Frottement interface δ_d : {resELU.phi_d}°</div>
              </div>
            </div>
          </div>

          {/* Carte 3 : Hydraulique UPL (Sous-pression eau) */}
          <div
            className={`p-4 rounded-xl border ${
              resELU.upl.conforme ? 'bg-sky-50/50 border-sky-200' : 'bg-rose-50/60 border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">Soulèvement UPL (Clause 10.2)</span>
              {resELU.upl.conforme ? (
                <span className="flex items-center gap-1 text-xs font-bold text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" /> Conforme
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                  <ShieldAlert className="w-3.5 h-3.5" /> Risque UPL
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-600">Taux sous-pression :</span>
                <span className="text-base font-extrabold text-slate-800">
                  {(resELU.upl.taux * 100).toFixed(1)} %
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Sous-pression V_dst,d :</span>
                <span className="font-mono font-bold text-slate-800">{resELU.upl.V_dst_d} kN</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Poids stabilisant G_stb,d :</span>
                <span className="font-mono font-bold text-slate-800">{resELU.upl.G_stb_d} kN</span>
              </div>
              <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-500">
                <div>Nappe ELU défavorable : {modele.hydrogeologie.nappePrincipale.coteDefavorableELU} m</div>
                <div>Condition : V_dst,d ≤ G_stb,d</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Résultats ELS : Tassement et Déformations */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-sm">Vérifications ELS (Tassements & Distorsion)</span>
            <span className="text-xs text-slate-500">
              Pression appliquée q_ELS = {resELS.pressionAppliquee_q} kPa
            </span>
          </div>
          <span className="text-xs text-slate-500 italic">
            Statut : {resELS.statutNormatif} ({resELS.clauseReference})
          </span>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Tassement sous le centre</span>
              <span className="text-lg font-extrabold text-slate-900">{resELS.tassementCentreTotal_mm} mm</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Tassement sous l'angle</span>
              <span className="text-lg font-extrabold text-slate-900">{resELS.tassementCoinTotal_mm} mm</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Tassement différentiel</span>
              <span className="text-lg font-extrabold text-amber-700">{resELS.tassementDifferentiel_mm} mm</span>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-[11px] text-slate-500 block">Distorsion angulaire</span>
              <div className="flex items-center justify-between">
                <span className="text-lg font-extrabold text-slate-900">{resELS.distorsionRatio}</span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    resELS.critereAdmissibleRespecte ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {resELS.critereAdmissibleRespecte ? '≤ 1/500 OK' : '> 1/500 Alerte'}
                </span>
              </div>
            </div>
          </div>

          {/* Découpage en sous-couches et régimes de consolidation */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-700">
              Détail du calcul oedométrique par sous-couche (Loi tri-zone de consolidation)
            </div>
            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="p-2 font-medium">Cote (m)</th>
                    <th className="p-2 font-medium font-sans">Couche</th>
                    <th className="p-2 font-medium">σ'v0 (kPa)</th>
                    <th className="p-2 font-medium">Δσ_v centre (kPa)</th>
                    <th className="p-2 font-medium">σ'p (kPa)</th>
                    <th className="p-2 font-medium font-sans">Régime</th>
                    <th className="p-2 font-medium text-right font-sans">s_i (mm)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resELS.detailsSousCouches.map((d) => (
                    <tr key={d.index} className="hover:bg-slate-50">
                      <td className="p-2">
                        {d.coteHaut.toFixed(1)} à {d.coteBas.toFixed(1)}
                      </td>
                      <td className="p-2 font-sans font-medium text-slate-700">{d.coucheNom}</td>
                      <td className="p-2 text-slate-600">{d.sigma_v0_prime}</td>
                      <td className="p-2 text-sky-700 font-bold">{d.delta_sigma_v}</td>
                      <td className="p-2 text-slate-600">{d.sigma_p_prime}</td>
                      <td className="p-2 font-sans">
                        {d.regime === 'surconsolide' && (
                          <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                            Surconsolidé (Cs)
                          </span>
                        )}
                        {d.regime === 'normalement_consolide' && (
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                            Normal. consolidé (Cc)
                          </span>
                        )}
                        {d.regime === 'franchissement' && (
                          <span className="text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded text-[10px] font-semibold">
                            Franchissement σ'p (Cs+Cc)
                          </span>
                        )}
                      </td>
                      <td className="p-2 text-right font-bold text-slate-900">{d.tassementCentre_mm}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Modélisation Sol-Structure avancée (Plaque 2D sur ressorts non-linéaires couplés — CDC §6.6) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-slate-900 text-sm">
              4. Couplage Sol-Structure — Radier sur ressorts itératifs (CDC §6.6)
            </span>
            <span className="text-[11px] bg-slate-200/80 text-slate-700 font-mono px-2 py-0.5 rounded-full">
              Solveur direct Gauss ∇⁴w + ks·w = q
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <label htmlFor="select-maillage" className="font-medium">Maillage :</label>
              <select
                id="select-maillage"
                value={maillageN}
                onChange={(e) => setMaillageN(parseInt(e.target.value, 10))}
                className="px-2 py-1 border border-slate-300 rounded bg-white text-xs font-semibold text-slate-800"
              >
                <option value={4}>4 × 4 (25 nœuds)</option>
                <option value={6}>6 × 6 (49 nœuds)</option>
                <option value={8}>8 × 8 (81 nœuds - standard)</option>
                <option value={10}>10 × 10 (121 nœuds)</option>
                <option value={12}>12 × 12 (169 nœuds - fin)</option>
              </select>
            </div>

            <button
              onClick={() => setAfficherSolStructure(!afficherSolStructure)}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition"
            >
              {afficherSolStructure ? 'Masquer détails' : 'Afficher détails'}
            </button>
          </div>
        </div>

        {afficherSolStructure && (
          <div className="p-4 space-y-4">
            {/* Statut de convergence & Avertissements */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center gap-2">
                {resRessorts.convergence.convergé ? (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Convergé en {resRessorts.convergence.nbIterations} itérations (Écart final : {resRessorts.convergence.ecartFinalRelatif} % &lt; 1%)
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-full">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Non convergé après {resRessorts.convergence.nbIterations} itérations (Écart : {resRessorts.convergence.ecartFinalRelatif} %)
                  </span>
                )}
                <span className="text-xs text-slate-500">
                  Sous-relaxation : 0.5 • Tolérance relative : 1.0 %
                </span>
              </div>

              <button
                onClick={copierExportJSON}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-semibold shadow-xs transition"
              >
                {copiePressePapier ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    Export copié !
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Exporter format structural (JSON)
                  </>
                )}
              </button>
            </div>

            {/* Avertissements du solveur / de la boucle */}
            {resRessorts.convergence.avertissements && resRessorts.convergence.avertissements.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  Avertissements du solveur de plaque couplé :
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-amber-800 pl-1">
                  {resRessorts.convergence.avertissements.map((av, idx) => (
                    <li key={idx}>{av}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Indicateurs clés du couplage */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block mb-1">Tassement max / min (w)</span>
                <span className="text-base font-extrabold text-slate-900">
                  {resRessorts.champs.tassementMax_mm} / {resRessorts.champs.tassementMin_mm} mm
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block mb-1">Tassement différentiel (Δs)</span>
                <span className="text-base font-extrabold text-emerald-700">
                  {resRessorts.champs.tassementDifferentielMax_mm} mm
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  Distorsion : 1 / {Math.round(1 / (resRessorts.champs.distorsionAngulaireMax || 1e-6))}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block mb-1">Pression sol max / min</span>
                <span className="text-base font-extrabold text-slate-900">
                  {resRessorts.champs.pressionContactMax_kPa} / {resRessorts.champs.pressionContactMin_kPa} kPa
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-slate-500 block mb-1">Module réaction ks sol</span>
                <span className="text-base font-extrabold text-slate-900">
                  {resRessorts.sol.ksFinalMoyen} kN/m³
                </span>
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  Initial : {resRessorts.sol.ksInitialMoyen} kN/m³
                </span>
              </div>
            </div>

            {/* Historique des itérations */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-3 py-1.5 bg-slate-100 border-b border-slate-200 text-xs font-semibold text-slate-700">
                Convergence itérative Sol-Structure (Actualisation des ressorts locaux de Winkler)
              </div>
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-2 font-medium font-sans">Itération</th>
                      <th className="p-2 font-medium text-right font-sans">s_max (mm)</th>
                      <th className="p-2 font-medium text-right font-sans">Δs différentiel (mm)</th>
                      <th className="p-2 font-medium text-right font-sans">p_contact max (kPa)</th>
                      <th className="p-2 font-medium text-right font-sans">Écart relatif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {resRessorts.convergence.historique.map((it) => (
                      <tr key={it.numero} className="hover:bg-slate-50">
                        <td className="p-2 font-sans font-medium text-slate-700">Itération {it.numero}</td>
                        <td className="p-2 text-right font-bold text-slate-800">{it.flecheMax_mm.toFixed(2)}</td>
                        <td className="p-2 text-right text-emerald-700 font-semibold">{it.tassementDiff_mm.toFixed(2)}</td>
                        <td className="p-2 text-right text-slate-700">{it.pressionMax_kPa.toFixed(1)}</td>
                        <td className="p-2 text-right">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              it.ecartRelatifMax <= 1.0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-100 text-slate-700'
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
