import React, { useState } from 'react';
import { ModeleTerrain, OuvragePieu } from '../types/geotech';
import { verifierPieuAxial } from '../modules/pieux/capaciteAxiale';
import { VuePieuTransversal } from './pieux/VuePieuTransversal';
import { ShieldAlert, ShieldCheck, Layers, Users, ArrowDown, HelpCircle, Activity } from 'lucide-react';

interface OngletPieuxProps {
  modele: ModeleTerrain;
  onUpdatePieu: (pieu: OuvragePieu) => void;
}

export const OngletPieux: React.FC<OngletPieuxProps> = ({ modele, onUpdatePieu }) => {
  const [sousOnglet, setSousOnglet] = useState<'axial' | 'transversal'>('axial');

  const pieuActif =
    modele.ouvrages.pieux[0] || {
      id: 'PIEU-01',
      nom: 'Pieu isolé standard',
      diametre: 0.8,
      coteTete: 242.0,
      cotePointe: 236.0,
      modeExecution: 'fore',
      actions: { V_G: 1200, V_Q: 350, H_G: 40, H_Q: 20 },
      frottementNegatif: { actif: true, cotePlanNeutre: 240.0, effortQ_sneg: 120 },
      groupe: { estGroupe: false, nbPieuxX: 1, nbPieuxY: 1, entraxe: 2.4 },
    };

  const updateChamp = (champ: keyof OuvragePieu, val: any) => {
    onUpdatePieu({
      ...pieuActif,
      [champ]: val,
    });
  };

  const updateAction = (champ: keyof OuvragePieu['actions'], val: number) => {
    onUpdatePieu({
      ...pieuActif,
      actions: {
        ...pieuActif.actions,
        [champ]: val,
      },
    });
  };

  const updateFN = (champ: keyof OuvragePieu['frottementNegatif'], val: any) => {
    onUpdatePieu({
      ...pieuActif,
      frottementNegatif: {
        ...pieuActif.frottementNegatif,
        [champ]: val,
      },
    });
  };

  const updateGroupe = (champ: keyof OuvragePieu['groupe'], val: any) => {
    onUpdatePieu({
      ...pieuActif,
      groupe: {
        ...pieuActif.groupe,
        [champ]: val,
      },
    });
  };

  const resPieu = verifierPieuAxial(
    pieuActif,
    modele.couches,
    modele.configurationNormative,
    modele.hydrogeologie,
    modele.campagnes
  );

  return (
    <div className="space-y-5">
      {/* Navigation sous-onglets : Axial vs Transversal */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setSousOnglet('axial')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            sousOnglet === 'axial'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ArrowDown className="w-3.5 h-3.5" />
          Portance Axiale ELU (DA2*)
        </button>
        <button
          onClick={() => setSousOnglet('transversal')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            sousOnglet === 'transversal'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Activity className="w-3.5 h-3.5 text-sky-400" />
          Comportement Transversal & Courbes p-y (EN 1997-1 §7.7)
        </button>
      </div>

      {sousOnglet === 'transversal' ? (
        <VuePieuTransversal
          diametre={pieuActif.diametre}
          coteTete={pieuActif.coteTete}
          cotePointe={pieuActif.cotePointe}
          couches={modele.couches}
          hydrogeologie={modele.hydrogeologie}
          campagnes={modele.campagnes}
        />
      ) : (
        <>
          {/* 1. Configuration du Pieu */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Géométrie & Exécution */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
            1. Géométrie & Mode de pose
          </h3>
          <div className="space-y-2.5 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">Diamètre nominal D (m)</label>
              <input
                id="input-pieu-diametre"
                type="number"
                step="0.1"
                min="0.3"
                max="2.5"
                value={pieuActif.diametre}
                onChange={(e) => updateChamp('diametre', parseFloat(e.target.value) || 0.4)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-500 mb-1">Cote Tête (m)</label>
                <input
                  id="input-pieu-tete"
                  type="number"
                  step="0.1"
                  value={pieuActif.coteTete}
                  onChange={(e) => updateChamp('coteTete', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold text-sky-800"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Cote Pointe (m)</label>
                <input
                  id="input-pieu-pointe"
                  type="number"
                  step="0.1"
                  value={pieuActif.cotePointe}
                  onChange={(e) => updateChamp('cotePointe', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold text-emerald-800"
                />
              </div>
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Mode d'exécution (Tableau A.7)</label>
              <select
                id="select-pieu-mode"
                value={pieuActif.modeExecution}
                onChange={(e) => updateChamp('modeExecution', e.target.value as any)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 bg-white"
              >
                <option value="fore">Pieu foré tubé / boue</option>
                <option value="battu">Pieu battu préfabriqué</option>
                <option value="visse">Pieu vissé moulé / tarière creuse</option>
              </select>
            </div>
            <div className="p-2 bg-slate-50 rounded text-[11px] text-slate-600 flex justify-between">
              <span>Longueur fût L : {(pieuActif.coteTete - pieuActif.cotePointe).toFixed(2)} m</span>
              <span>Section pointe A_b : {(Math.PI * (pieuActif.diametre / 2) ** 2).toFixed(3)} m²</span>
            </div>
          </div>
        </div>

        {/* Sollicitations & Frottement négatif */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
            2. Actions & Frottement Négatif
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-slate-500 mb-1">V permanent G (kN)</label>
                <input
                  type="number"
                  step="50"
                  value={pieuActif.actions.V_G}
                  onChange={(e) => updateAction('V_G', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">V variable Q (kN)</label>
                <input
                  type="number"
                  step="50"
                  value={pieuActif.actions.V_Q}
                  onChange={(e) => updateAction('V_Q', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold"
                />
              </div>
            </div>

            {/* Traitement strict du frottement négatif (Section 7.3) */}
            <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-950">Frottement Négatif (clause 7.3.2.2)</span>
                <input
                  type="checkbox"
                  checked={pieuActif.frottementNegatif.actif}
                  onChange={(e) => updateFN('actif', e.target.checked)}
                  className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
              </div>
              {pieuActif.frottementNegatif.actif && (
                <div className="space-y-1.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-amber-900">Cote plan neutre (m)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={pieuActif.frottementNegatif.cotePlanNeutre}
                        onChange={(e) => updateFN('cotePlanNeutre', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-amber-300 rounded bg-white text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-amber-900">Effort Q_s;neg (kN)</label>
                      <input
                        type="number"
                        step="20"
                        value={pieuActif.frottementNegatif.effortQ_sneg}
                        onChange={(e) => updateFN('effortQ_sneg', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-amber-300 rounded bg-white text-xs font-bold"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-800 leading-tight">
                    * Norme : traité comme une <strong>action permanente défavorable (F_c;d)</strong>, et non pas
                    comme une déduction de résistance.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Effet de groupe */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            3. Configuration de Groupe
          </h3>
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
              <span className="font-medium text-slate-700">Calculer en groupe de pieux</span>
              <input
                type="checkbox"
                checked={pieuActif.groupe.estGroupe}
                onChange={(e) => updateGroupe('estGroupe', e.target.checked)}
                className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
            </div>

            {pieuActif.groupe.estGroupe && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-500 mb-1">Nb pieux X (m)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={pieuActif.groupe.nbPieuxX}
                      onChange={(e) => updateGroupe('nbPieuxX', parseInt(e.target.value) || 1)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 mb-1">Nb pieux Y (n)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={pieuActif.groupe.nbPieuxY}
                      onChange={(e) => updateGroupe('nbPieuxY', parseInt(e.target.value) || 1)}
                      className="w-full px-2 py-1.5 border border-slate-300 rounded text-slate-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Entraxe e (m)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="1.0"
                    value={pieuActif.groupe.entraxe}
                    onChange={(e) => updateGroupe('entraxe', parseFloat(e.target.value) || 2.0)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded text-slate-900"
                  />
                </div>
                <div className="p-2 bg-blue-50 text-blue-900 rounded text-[11px]">
                  Rendement de groupe η (Converse-Labarre) :{' '}
                  <strong>{(resPieu.effetDeGroupe.rendement * 100).toFixed(1)} %</strong>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Synthèse et Vérification Normative EC7 */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 text-sm">Capacité Portante Axiale ELU (Approche DA2*)</span>
            <span className="text-[11px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono">
              DA2* (A1 "+" M1 "+" R2)
            </span>
          </div>
          <span className="text-xs text-slate-500 italic">Tableaux A.7 et A.8 de l'EN 1997-1</span>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Carte 1 : Taux d'exploitation */}
          <div
            className={`p-4 rounded-xl border ${
              resPieu.tauxExploitation <= 1.0 ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/60 border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">Vérification ELU</span>
              {resPieu.conforme ? (
                <span className="flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                  <ShieldCheck className="w-3.5 h-3.5" /> Conforme
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                  <ShieldAlert className="w-3.5 h-3.5" /> Insuffisant
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-600">Taux d'exploitation :</span>
                <span
                  className={`text-base font-extrabold ${
                    resPieu.tauxExploitation <= 1.0 ? 'text-emerald-700' : 'text-rose-700'
                  }`}
                >
                  {(resPieu.tauxExploitation * 100).toFixed(1)} %
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Charge de calcul F_cd :</span>
                <span className="font-mono font-bold text-slate-800">{resPieu.F_cd} kN</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Résistance de calcul R_cd :</span>
                <span className="font-mono font-bold text-slate-800">{resPieu.R_cd} kN</span>
              </div>
              <div className="pt-2 border-t border-slate-200/80 text-[11px] text-slate-500">
                F_cd = 1.35·V_G + 1.50·V_Q {pieuActif.frottementNegatif.actif && `+ 1.35·Q_sneg`}
              </div>
            </div>
          </div>

          {/* Carte 2 : Décomposition des résistances */}
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-xs space-y-2">
            <span className="font-bold text-slate-800 block">Composantes Caractéristiques</span>
            <div className="flex justify-between text-slate-600">
              <span>Résistance de pointe R_bk :</span>
              <span className="font-mono font-bold text-slate-800">{resPieu.R_bk} kN</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Frottement latéral R_sk :</span>
              <span className="font-mono font-bold text-slate-800">{resPieu.R_sk} kN</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Résistance totale R_ck :</span>
              <span className="font-mono font-bold text-slate-900">{resPieu.R_ck} kN</span>
            </div>
            <div className="pt-2 border-t border-slate-200 text-[11px] text-slate-500 space-y-0.5">
              <div>Facteur pointe γ_b : {resPieu.facteursPartiels.gamma_b}</div>
              <div>Facteur fût γ_s : {resPieu.facteursPartiels.gamma_s}</div>
              <div>Facteur total γ_t : {resPieu.facteursPartiels.gamma_t}</div>
            </div>
          </div>

          {/* Carte 3 : Corrélation et profil sondage */}
          <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 text-xs space-y-2">
            <span className="font-bold text-blue-950 block">Facteurs de Corrélation (Tableau A.9)</span>
            <div className="flex justify-between text-slate-600">
              <span>Nombre de profils n :</span>
              <span className="font-mono font-bold text-slate-800">{resPieu.facteursCorrelation.nProfils}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Facteur ξ3 (moyenne) :</span>
              <span className="font-mono font-bold text-slate-800">{resPieu.facteursCorrelation.xi3}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Facteur ξ4 (minimum) :</span>
              <span className="font-mono font-bold text-slate-800">{resPieu.facteursCorrelation.xi4}</span>
            </div>
            <div className="pt-2 border-t border-blue-200 text-[11px] text-blue-900">
              Branche gouvernante : <strong>{resPieu.facteursCorrelation.gouvernant}</strong>
            </div>
          </div>
        </div>

        {/* Détail couche par couche */}
        <div className="p-4 border-t border-slate-200">
          <h4 className="text-xs font-bold text-slate-800 mb-2">Mobilisation du frottement latéral le long du fût</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="p-2 font-medium font-sans">Couche</th>
                  <th className="p-2 font-medium">Cotes (m)</th>
                  <th className="p-2 font-medium">Longueur (m)</th>
                  <th className="p-2 font-medium">Contrainte σ'v (kPa)</th>
                  <th className="p-2 font-medium">Frottement qs (kPa)</th>
                  <th className="p-2 font-medium text-right font-sans">R_sk,i (kN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resPieu.detailsCouches.map((d, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="p-2 font-sans font-medium text-slate-800">{d.coucheNom}</td>
                    <td className="p-2">
                      {d.coteHaut.toFixed(2)} à {d.coteBas.toFixed(2)}
                    </td>
                    <td className="p-2">{d.longueurTraversee.toFixed(2)}</td>
                    <td className="p-2">{d.sigma_vPrimeMoy.toFixed(1)}</td>
                    <td className="p-2">{d.qs_k.toFixed(1)}</td>
                    <td className="p-2 text-right font-bold text-emerald-800">{d.R_sk_i.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Synthèse Détaillée du Groupe de Pieux (EN 1997-1 §7.6 & CDC §7.6) */}
        {resPieu.effetDeGroupe.estGroupe && resPieu.effetDeGroupe.nbPieux > 1 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/50 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Vérification du Groupe de Pieux & Interaction (EN 1997-1 §7.6 & CDC §7.6)
                </h4>
              </div>
              <span className="text-[11px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-medium">
                {resPieu.effetDeGroupe.nbPieux} pieux ({pieuActif.groupe.nbPieuxX} × {pieuActif.groupe.nbPieuxY})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Carte Groupe 1 : Efficacité et Capacité ELU */}
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                  <span className="font-bold text-slate-800">Efficacité & Portance ELU</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      resPieu.effetDeGroupe.conformeELU
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {resPieu.effetDeGroupe.conformeELU ? 'Conforme ELU' : 'Non conforme'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Rendement η (Converse-Labarre) :</span>
                  <span className="font-mono font-bold text-indigo-700">
                    {(resPieu.effetDeGroupe.rendement * 100).toFixed(1)} %
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Résistance de calcul groupe R_cd :</span>
                  <span className="font-mono font-bold text-slate-900">
                    {resPieu.effetDeGroupe.R_cd_groupe.toFixed(1)} kN
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Taux d'exploitation groupe :</span>
                  <span
                    className={`font-mono font-bold ${
                      resPieu.effetDeGroupe.tauxExploitationGroupe <= 1.0
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {(resPieu.effetDeGroupe.tauxExploitationGroupe * 100).toFixed(1)} %
                  </span>
                </div>
                <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
                  Mode gouvernant :{' '}
                  <strong className="text-slate-800">
                    {resPieu.effetDeGroupe.modeGouvernant === 'rupture_en_bloc'
                      ? 'Rupture en bloc'
                      : 'Individuel avec efficacité'}
                  </strong>
                </div>
              </div>

              {/* Carte Groupe 2 : Rupture en bloc (Fondation massive équivalente) */}
              <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs space-y-2 text-xs">
                <div className="flex justify-between items-center pb-1.5 border-b border-slate-100">
                  <span className="font-bold text-slate-800">Fondation Massive Équivalente</span>
                  <span className="text-[10px] text-slate-500 font-mono">EC7 §7.6.2.1</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Dimensions bloc (B × L) :</span>
                  <span className="font-mono font-bold text-slate-800">
                    {resPieu.effetDeGroupe.ruptureEnBloc.largeurBloc_B} m × {resPieu.effetDeGroupe.ruptureEnBloc.longueurBloc_L} m
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Surface de base & Périmètre :</span>
                  <span className="font-mono text-slate-700">
                    {resPieu.effetDeGroupe.ruptureEnBloc.surfaceBloc_A} m² | {resPieu.effetDeGroupe.ruptureEnBloc.perimetreBloc_P} m
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Résistance bloc Rc,bloc;d :</span>
                  <span className="font-mono font-bold text-slate-900">
                    {resPieu.effetDeGroupe.ruptureEnBloc.Rc_bloc_d.toFixed(1)} kN
                  </span>
                </div>
                <div className="pt-1.5 border-t border-slate-100 text-[11px] text-slate-500">
                  Taux rupture en bloc :{' '}
                  <strong className="text-slate-700">
                    {(resPieu.effetDeGroupe.ruptureEnBloc.tauxRuptureBloc * 100).toFixed(1)} %
                  </strong>
                </div>
              </div>

              {/* Carte Groupe 3 : Tassement sous charge de service ELS (CDC §7.6) */}
              <div className="p-3.5 bg-white rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs space-y-2 text-xs">
                <div className="flex justify-between items-center pb-1.5 border-b border-emerald-100">
                  <span className="font-bold text-slate-900">Tassement ELS (CDC §7.6)</span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded-full">
                    s_groupe &gt; s_isolé ✓
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tassement pieu isolé s_isolé :</span>
                  <span className="font-mono font-bold text-slate-800">
                    {resPieu.effetDeGroupe.tassement.s_isole_mm.toFixed(1)} mm
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tassement groupe s_groupe :</span>
                  <span className="font-mono font-extrabold text-emerald-800">
                    {resPieu.effetDeGroupe.tassement.s_groupe_mm.toFixed(1)} mm
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Amplification d'interaction :</span>
                  <span className="font-mono font-bold text-indigo-700">
                    × {resPieu.effetDeGroupe.tassement.ratioAmplification.toFixed(2)}
                  </span>
                </div>
                <div className="pt-1.5 border-t border-emerald-100 text-[11px] text-slate-500 space-y-0.5">
                  <div>
                    Semelle équiv. : cote {resPieu.effetDeGroupe.tassement.coteSemelleEquivalente} m (
                    {resPieu.effetDeGroupe.tassement.largeurSemelleEquivalente}m × {resPieu.effetDeGroupe.tassement.longueurSemelleEquivalente}m)
                  </div>
                  <div className="italic text-[10px] text-slate-400">
                    {resPieu.effetDeGroupe.tassement.methode}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
};
