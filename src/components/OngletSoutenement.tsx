import React, { useState } from 'react';
import { ModeleTerrain, OuvrageSoutenement } from '../types/geotech';
import { verifierMurEnLELU } from '../modules/soutenement/murEnL';
import { ShieldAlert, ShieldCheck, Layers, ArrowRight, Shield, Activity } from 'lucide-react';
import { OngletParoiPhasee } from './soutenement/OngletParoiPhasee';

interface OngletSoutenementProps {
  modele: ModeleTerrain;
  onUpdateSoutenement: (mur: OuvrageSoutenement) => void;
}

export const OngletSoutenement: React.FC<OngletSoutenementProps> = ({ modele, onUpdateSoutenement }) => {
  const [sousOnglet, setSousOnglet] = useState<'paroiPhasee' | 'murEnL'>('paroiPhasee');

  const murActif =
    modele.ouvrages.soutenements.find((s) => s.type === 'murEnL') ||
    modele.ouvrages.soutenements[0] || {
      id: 'MUR-01',
      nom: 'Mur en L rampe',
      type: 'murEnL',
      hauteurTotale: 4.5,
      coteTete: 245.3,
      coteFondFouille: 240.8,
      epaisseurVoile: 0.35,
      largeurSemelleB: 2.7,
      debordAvant: 0.6,
      ficheT: 0.8,
      surchargeQ: 10.0,
      inclinaisonTerrePlein: 0.0,
      frottementDeltaSurPhi: 0.667,
      butons: [],
    };

  const updateChamp = (champ: keyof OuvrageSoutenement, val: any) => {
    onUpdateSoutenement({
      ...murActif,
      [champ]: val,
    });
  };

  const resMur = verifierMurEnLELU(
    murActif,
    modele.couches,
    modele.hydrogeologie,
    modele.configurationNormative
  );

  return (
    <div className="space-y-5">
      {/* Sélecteur de niveau de modélisation du Module C */}
      <div className="bg-white border border-slate-200 rounded-xl p-1.5 shadow-xs flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSousOnglet('paroiPhasee')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition ${
            sousOnglet === 'paroiPhasee'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4 text-emerald-400" />
          <span>Niveau 2 : Paroi Flexible Phasée (Poutre-ressorts §8.4)</span>
        </button>

        <button
          type="button"
          onClick={() => setSousOnglet('murEnL')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition ${
            sousOnglet === 'murEnL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Shield className="w-4 h-4 text-amber-400" />
          <span>Niveau 1 : Mur Rigide en L (Équilibre limite §8.3)</span>
        </button>
      </div>

      {sousOnglet === 'paroiPhasee' ? (
        <OngletParoiPhasee modele={modele} onUpdateSoutenement={onUpdateSoutenement} />
      ) : (
        <>
          {/* 1. Géométrie et Surcharge du Mur en L */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
            1. Géométrie du Mur en L (Section 8.2)
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">Hauteur totale H (m)</label>
              <input
                type="number"
                step="0.2"
                min="1.0"
                value={murActif.hauteurTotale}
                onChange={(e) => updateChamp('hauteurTotale', parseFloat(e.target.value) || 2)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Largeur semelle B (m)</label>
              <input
                type="number"
                step="0.2"
                min="0.8"
                value={murActif.largeurSemelleB}
                onChange={(e) => updateChamp('largeurSemelleB', parseFloat(e.target.value) || 1)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Cote Tête de mur (m)</label>
              <input
                type="number"
                step="0.1"
                value={murActif.coteTete}
                onChange={(e) => updateChamp('coteTete', parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-sky-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Cote Fond fouille (m)</label>
              <input
                type="number"
                step="0.1"
                value={murActif.coteFondFouille}
                onChange={(e) => updateChamp('coteFondFouille', parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-emerald-800 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Épaisseur voile (m)</label>
              <input
                type="number"
                step="0.05"
                min="0.2"
                value={murActif.epaisseurVoile}
                onChange={(e) => updateChamp('epaisseurVoile', parseFloat(e.target.value) || 0.3)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Patin avant (m)</label>
              <input
                type="number"
                step="0.1"
                min="0.0"
                value={murActif.debordAvant}
                onChange={(e) => updateChamp('debordAvant', parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3">
            2. Actions & Frottement d'Interface
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">Surcharge terre-plein q (kPa)</label>
              <input
                type="number"
                step="2.0"
                min="0"
                value={murActif.surchargeQ}
                onChange={(e) => updateChamp('surchargeQ', parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-amber-900"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Rapport frottement δ/φ'</label>
              <input
                type="number"
                step="0.05"
                min="0"
                max="1.0"
                value={murActif.frottementDeltaSurPhi}
                onChange={(e) => updateChamp('frottementDeltaSurPhi', parseFloat(e.target.value) || 0.667)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
              />
            </div>
          </div>
          <div className="mt-4 p-2.5 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-800">Résultats des poussées sur l'écran :</div>
            <div>• Coeff. de poussée Ka : <strong>{resMur.pressions.Ka}</strong></div>
            <div>• Poussée terres active Pa,terres : {resMur.pressions.Pa_sol_k} kN/m</div>
            <div>• Poussée due à surcharge Pa,q : {resMur.pressions.Pa_q_k} kN/m</div>
            <div>• Poussée totale de calcul Pa,d : <strong>{resMur.pressions.Pa_d} kN/m</strong></div>
          </div>
        </div>
      </div>

      {/* 2. Les 4 vérifications obligatoires de la clause 9.4.1 */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold text-slate-900 text-sm">
            Les 4 Vérifications Obligatoires (Clause 9.4.1 de l'EN 1997-1)
          </span>
          <span className="text-xs text-slate-500 italic">Combinaisons ELU DA2*</span>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Basculement EQU */}
          <div
            className={`p-4 rounded-xl border ${
              resMur.basculementEQU.conforme ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/60 border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">1. Basculement (EQU)</span>
              {resMur.basculementEQU.conforme ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-600" />
              )}
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-600">Taux EQU :</span>
                <span className="font-extrabold text-base text-slate-900">
                  {(resMur.basculementEQU.taux * 100).toFixed(1)} %
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                M_dst = {resMur.basculementEQU.M_dst_d} kNm/m
                <br />
                M_stb = {resMur.basculementEQU.M_stb_d} kNm/m
              </div>
              <div className="pt-2 text-[10px] font-bold text-emerald-800">
                {resMur.basculementEQU.conforme ? 'Sécurité satisfaite' : 'Risque de renversement'}
              </div>
            </div>
          </div>

          {/* 2. Glissement sur la base */}
          <div
            className={`p-4 rounded-xl border ${
              resMur.glissement.conforme ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/60 border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">2. Glissement base</span>
              {resMur.glissement.conforme ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-600" />
              )}
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-600">Taux glissement :</span>
                <span className="font-extrabold text-base text-slate-900">
                  {(resMur.glissement.taux * 100).toFixed(1)} %
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                H_d = {resMur.glissement.H_d} kN/m
                <br />
                R_hd = {resMur.glissement.R_hd} kN/m
              </div>
              <div className="pt-2 text-[10px] font-bold text-emerald-800">
                {resMur.glissement.conforme ? 'Pas de glissement' : 'Glissement excessif'}
              </div>
            </div>
          </div>

          {/* 3. Portance de la semelle */}
          <div
            className={`p-4 rounded-xl border ${
              resMur.portance.conforme ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/60 border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">3. Portance semelle</span>
              {resMur.portance.conforme ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-600" />
              )}
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-600">Taux portance :</span>
                <span className="font-extrabold text-base text-slate-900">
                  {(resMur.portance.taux * 100).toFixed(1)} %
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                V_d = {resMur.portance.V_d} kN/m
                <br />
                R_vd = {resMur.portance.R_vd} kN/m
              </div>
              <div className="pt-2 text-[10px] font-bold text-emerald-800">
                Largeur eff. B' = {resMur.portance.B_prime} m
              </div>
            </div>
          </div>

          {/* 4. Stabilité générale */}
          <div
            className={`p-4 rounded-xl border ${
              resMur.stabiliteGlobale.conforme ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/60 border-rose-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-800">4. Stabilité globale</span>
              {resMur.stabiliteGlobale.conforme ? (
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              ) : (
                <ShieldAlert className="w-4 h-4 text-rose-600" />
              )}
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-600">Facteur sécurité :</span>
                <span className="font-extrabold text-base text-slate-900">
                  {resMur.stabiliteGlobale.facteurSecurite}
                </span>
              </div>
              <div className="text-[11px] text-slate-500">
                Méthode : {resMur.stabiliteGlobale.methode}
                <br />
                Critère : F ≥ 1.00 (ELU)
              </div>
              <div className="pt-2 text-[10px] font-bold text-emerald-800">
                {resMur.stabiliteGlobale.conforme ? 'Grand glissement évité' : 'Risque grand glissement'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )}
</div>
  );
};
