import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import { PointCourbeTassementCharge } from '../../modules/radier/tassementELS';
import { Activity, Info } from 'lucide-react';

interface GraphiqueCourbeTassementProps {
  points: PointCourbeTassementCharge[];
  pressionActuelle_kPa: number;
  chargeActuelle_kN: number;
  tassementCentreActuel_mm: number;
  tassementCoinActuel_mm: number;
  tassementMoyenActuel_mm: number;
  seuilAdmissible_mm?: number;
}

export const GraphiqueCourbeTassement: React.FC<GraphiqueCourbeTassementProps> = ({
  points,
  pressionActuelle_kPa,
  chargeActuelle_kN,
  tassementCentreActuel_mm,
  tassementCoinActuel_mm,
  tassementMoyenActuel_mm,
  seuilAdmissible_mm = 50,
}) => {
  const [uniteX, setUniteX] = useState<'pression' | 'charge'>('pression');
  const [afficherCentre, setAfficherCentre] = useState(true);
  const [afficherCoin, setAfficherCoin] = useState(true);
  const [afficherMoyen, setAfficherMoyen] = useState(true);
  const [afficherSeuil, setAfficherSeuil] = useState(true);

  const xKey = uniteX === 'pression' ? 'pression_kPa' : 'chargeTotale_kN';
  const xLabel = uniteX === 'pression' ? 'Pression appliquée q (kPa)' : 'Charge totale V (kN)';
  const xValeurActuelle = uniteX === 'pression' ? pressionActuelle_kPa : chargeActuelle_kN;

  // Raideur équivalente apparente sous la charge ELS
  const ks_MNm3 = tassementMoyenActuel_mm > 0 ? (pressionActuelle_kPa / tassementMoyenActuel_mm) : 0;
  const Kv_MNm = tassementMoyenActuel_mm > 0 ? (chargeActuelle_kN / tassementMoyenActuel_mm) : 0;

  // Formattage des infobulles Recharts
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data: PointCourbeTassementCharge = payload[0].payload;
      return (
        <div className="bg-white/95 backdrop-blur-xs p-3 border border-slate-200 rounded-lg shadow-md text-xs space-y-1.5 min-w-[200px]">
          <div className="font-bold text-slate-800 border-b border-slate-100 pb-1 flex justify-between">
            <span>{uniteX === 'pression' ? `q = ${data.pression_kPa} kPa` : `V = ${data.chargeTotale_kN} kN`}</span>
            <span className="text-slate-500 font-normal">
              {uniteX === 'pression' ? `${data.chargeTotale_kN} kN` : `${data.pression_kPa} kPa`}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Ratio charge : <strong className="text-slate-700">{(data.ratioChargeELS * 100).toFixed(0)} % de q_ELS</strong>
          </div>
          <div className="space-y-1 pt-0.5">
            {afficherCentre && (
              <div className="flex justify-between items-center text-sky-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-600 inline-block" />
                  Centre :
                </span>
                <span className="font-bold font-mono">{data.tassementCentre_mm.toFixed(2)} mm</span>
              </div>
            )}
            {afficherMoyen && (
              <div className="flex justify-between items-center text-emerald-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                  Moyen :
                </span>
                <span className="font-bold font-mono">{data.tassementMoyen_mm.toFixed(2)} mm</span>
              </div>
            )}
            {afficherCoin && (
              <div className="flex justify-between items-center text-amber-700">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-600 inline-block" />
                  Coin / Angle :
                </span>
                <span className="font-bold font-mono">{data.tassementCoin_mm.toFixed(2)} mm</span>
              </div>
            )}
            <div className="flex justify-between items-center text-slate-600 border-t border-slate-100 pt-1">
              <span>Différentiel Δs :</span>
              <span className="font-mono">{data.tassementDifferentiel_mm.toFixed(2)} mm</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-3">
      {/* Barre d'outils et contrôles du graphique */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-700">Axe d'effort :</span>
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setUniteX('pression')}
              className={`px-2.5 py-1 rounded-md transition ${
                uniteX === 'pression'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pression q (kPa)
            </button>
            <button
              type="button"
              onClick={() => setUniteX('charge')}
              className={`px-2.5 py-1 rounded-md transition ${
                uniteX === 'charge'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Charge totale V (kN)
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-slate-700 mr-1">Courbes :</span>
          <label className="flex items-center gap-1 cursor-pointer select-none text-sky-800 bg-sky-50 px-2 py-1 rounded border border-sky-200 font-medium">
            <input
              type="checkbox"
              checked={afficherCentre}
              onChange={(e) => setAfficherCentre(e.target.checked)}
              className="rounded text-sky-600 focus:ring-sky-500"
            />
            Centre
          </label>
          <label className="flex items-center gap-1 cursor-pointer select-none text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 font-medium">
            <input
              type="checkbox"
              checked={afficherMoyen}
              onChange={(e) => setAfficherMoyen(e.target.checked)}
              className="rounded text-emerald-600 focus:ring-emerald-500"
            />
            Moyen
          </label>
          <label className="flex items-center gap-1 cursor-pointer select-none text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200 font-medium">
            <input
              type="checkbox"
              checked={afficherCoin}
              onChange={(e) => setAfficherCoin(e.target.checked)}
              className="rounded text-amber-600 focus:ring-amber-500"
            />
            Coin
          </label>
          <label className="flex items-center gap-1 cursor-pointer select-none text-rose-800 bg-rose-50 px-2 py-1 rounded border border-rose-200 font-medium">
            <input
              type="checkbox"
              checked={afficherSeuil}
              onChange={(e) => setAfficherSeuil(e.target.checked)}
              className="rounded text-rose-600 focus:ring-rose-500"
            />
            Seuil {seuilAdmissible_mm} mm
          </label>
        </div>
      </div>

      {/* Surface du graphique Recharts */}
      <div className="h-72 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 10, right: 30, left: 10, bottom: 25 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey={xKey}
              type="number"
              domain={['dataMin', 'dataMax']}
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              label={{
                value: xLabel,
                position: 'insideBottom',
                offset: -15,
                fill: '#475569',
                fontSize: 12,
                fontWeight: 600,
              }}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              label={{
                value: 'Tassement théorique s (mm)',
                angle: -90,
                position: 'insideLeft',
                offset: 5,
                fill: '#475569',
                fontSize: 12,
                fontWeight: 600,
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              wrapperStyle={{ fontSize: '11px', paddingTop: '2px' }}
            />

            {/* Repère charge de service ELS actuelle */}
            <ReferenceLine
              x={xValeurActuelle}
              stroke="#0f172a"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Service ELS (${xValeurActuelle} ${uniteX === 'pression' ? 'kPa' : 'kN'})`,
                position: 'insideTopLeft',
                fill: '#0f172a',
                fontSize: 10,
                fontWeight: 'bold',
              }}
            />

            {/* Repère seuil de tassement admissible */}
            {afficherSeuil && (
              <ReferenceLine
                y={seuilAdmissible_mm}
                stroke="#e11d48"
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{
                  value: `Admissible ELS (${seuilAdmissible_mm} mm)`,
                  position: 'insideBottomRight',
                  fill: '#e11d48',
                  fontSize: 10,
                  fontWeight: 'bold',
                }}
              />
            )}

            {/* Points actuels mis en valeur */}
            {afficherCentre && (
              <ReferenceDot
                x={xValeurActuelle}
                y={tassementCentreActuel_mm}
                r={5}
                fill="#0284c7"
                stroke="#ffffff"
                strokeWidth={2}
              />
            )}
            {afficherMoyen && (
              <ReferenceDot
                x={xValeurActuelle}
                y={tassementMoyenActuel_mm}
                r={5}
                fill="#059669"
                stroke="#ffffff"
                strokeWidth={2}
              />
            )}
            {afficherCoin && (
              <ReferenceDot
                x={xValeurActuelle}
                y={tassementCoinActuel_mm}
                r={5}
                fill="#d97706"
                stroke="#ffffff"
                strokeWidth={2}
              />
            )}

            {/* Courbes */}
            {afficherCentre && (
              <Line
                type="monotone"
                dataKey="tassementCentre_mm"
                name="Tassement sous le centre"
                stroke="#0284c7"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 6 }}
              />
            )}
            {afficherMoyen && (
              <Line
                type="monotone"
                dataKey="tassementMoyen_mm"
                name="Tassement moyen"
                stroke="#059669"
                strokeWidth={2}
                strokeDasharray="4 2"
                dot={false}
                activeDot={{ r: 5 }}
              />
            )}
            {afficherCoin && (
              <Line
                type="monotone"
                dataKey="tassementCoin_mm"
                name="Tassement sous l'angle"
                stroke="#d97706"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 5 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Cartouche d'analyse et rigidité apparente au point ELS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-600 shrink-0" />
          <div>
            <span className="text-slate-500 block text-[11px]">Module de réaction apparent ks</span>
            <span className="font-extrabold text-slate-800">
              {ks_MNm3.toFixed(1)} <span className="font-normal text-slate-500 text-[10px]">MN/m³ (kPa/mm)</span>
            </span>
          </div>
        </div>
        <div>
          <span className="text-slate-500 block text-[11px]">Raideur globale verticale Kv</span>
          <span className="font-extrabold text-slate-800">
            {Kv_MNm.toFixed(0)} <span className="font-normal text-slate-500 text-[10px]">MN/m</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600 text-[11px] leading-tight">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            Non-linéarité issue des phases de recompression (<span className="font-mono">Cs</span>) et compression vierge (<span className="font-mono">Cc</span>).
          </span>
        </div>
      </div>
    </div>
  );
};
