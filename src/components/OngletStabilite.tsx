import React, { useState } from 'react';
import { ModeleTerrain } from '../types/geotech';
import { calculerStabiliteBishop } from '../briques/stabiliteGenerale';
import { ShieldCheck, ShieldAlert, Sliders, RefreshCw } from 'lucide-react';

interface OngletStabiliteProps {
  modele: ModeleTerrain;
}

export const OngletStabilite: React.FC<OngletStabiliteProps> = ({ modele }) => {
  const [centreX, setCentreX] = useState<number>(10.0);
  const [centreY, setCentreY] = useState<number>(modele.referentiel.coteTerrainNaturel + 8.0);
  const [rayon, setRayon] = useState<number>(12.0);
  const [nbTranches, setNbTranches] = useState<number>(20);

  const resBishop = calculerStabiliteBishop({
    cercle: { centreX, centreY, rayon },
    coteTerrainNaturel: modele.referentiel.coteTerrainNaturel,
    couches: modele.couches,
    hydrogeologie: modele.hydrogeologie,
    facteursSecurite: {
      gamma_phi: modele.configurationNormative.facteursPartielsSol.M1.gamma_phi,
      gamma_c: modele.configurationNormative.facteursPartielsSol.M1.gamma_c,
    },
    nbTranches,
  });

  return (
    <div className="space-y-5">
      {/* Contrôles du cercle de glissement */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs col-span-2">
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-emerald-600" />
            Cercle de Rupture Circulaire (Bishop simplifié)
          </h3>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">Centre Xc (m)</label>
              <input
                id="input-bishop-xc"
                type="number"
                step="0.5"
                value={centreX}
                onChange={(e) => setCentreX(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Centre Yc / Altitude (m)</label>
              <input
                id="input-bishop-yc"
                type="number"
                step="0.5"
                value={centreY}
                onChange={(e) => setCentreY(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Rayon R (m)</label>
              <input
                id="input-bishop-r"
                type="number"
                step="0.5"
                min="2"
                value={rayon}
                onChange={(e) => setRayon(parseFloat(e.target.value) || 5)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold"
              />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
            <span>Discrétisation : {resBishop.tranches.length} tranches verticales actives</span>
            <span>Itérations : {resBishop.iterations} convergées</span>
          </div>
        </div>

        {/* Résultat global du Facteur de sécurité */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            resBishop.conforme ? 'bg-emerald-50/60 border-emerald-300' : 'bg-rose-50/60 border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">Facteur de Sécurité F</span>
            {resBishop.conforme ? (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" /> F ≥ 1.00 OK
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">
                <ShieldAlert className="w-3.5 h-3.5" /> Instable
              </span>
            )}
          </div>

          <div className="my-2">
            <span
              className={`text-4xl font-black ${
                resBishop.conforme ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {resBishop.facteurSecurite.toFixed(3)}
            </span>
          </div>

          <div className="text-[11px] text-slate-600 border-t border-slate-200/80 pt-2 space-y-0.5">
            <div>Moment Moteur M_mot : {resBishop.momentMoteurTotal.toFixed(0)} kNm/m</div>
            <div>Moment Résistant M_res : {resBishop.momentResistantTotal.toFixed(0)} kNm/m</div>
          </div>
        </div>
      </div>

      {/* Tableau des tranches de sol */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-800">
          Équilibre des Tranches de Bishop (Section 10.1)
        </div>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2 font-medium">Tranche</th>
                <th className="p-2 font-medium">X (m)</th>
                <th className="p-2 font-medium">Largeur b (m)</th>
                <th className="p-2 font-medium">Poids W (kN)</th>
                <th className="p-2 font-medium">Pression u (kPa)</th>
                <th className="p-2 font-medium">Angle α (°)</th>
                <th className="p-2 font-medium text-right">R_mob (kN)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resBishop.tranches.map((t) => (
                <tr key={t.index} className="hover:bg-slate-50">
                  <td className="p-2 font-bold text-slate-700">#{t.index + 1}</td>
                  <td className="p-2">{t.x.toFixed(2)}</td>
                  <td className="p-2">{t.largeur.toFixed(2)}</td>
                  <td className="p-2">{t.poids_W.toFixed(1)}</td>
                  <td className="p-2 text-sky-700">{t.pression_u.toFixed(1)}</td>
                  <td className="p-2">{t.alphaDeg.toFixed(1)}°</td>
                  <td className="p-2 text-right font-bold text-slate-900">{t.forceResistante.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
