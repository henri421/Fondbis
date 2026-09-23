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
        <div className="bg-surface/95 backdrop-blur-xs p-3 border border-bordure rounded-rayon text-xs space-y-1.5 min-w-[200px]">
          <div className="font-semibold text-texte border-b border-bordure-douce pb-1 flex justify-between">
            <span>{uniteX === 'pression' ? `q = ${data.pression_kPa} kPa` : `V = ${data.chargeTotale_kN} kN`}</span>
            <span className="text-texte-doux font-normal">
              {uniteX === 'pression' ? `${data.chargeTotale_kN} kN` : `${data.pression_kPa} kPa`}
            </span>
          </div>
          <div className="text-[11px] text-texte-doux">
            Ratio charge : <strong className="text-texte">{(data.ratioChargeELS * 100).toFixed(0)} % de q_ELS</strong>
          </div>
          <div className="space-y-1 pt-0.5">
            {afficherCentre && (
              <div className="flex justify-between items-center text-texte">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#0284c7] inline-block" />
                  Centre :
                </span>
                <span className="font-semibold font-mono">{data.tassementCentre_mm.toFixed(2)} mm</span>
              </div>
            )}
            {afficherMoyen && (
              <div className="flex justify-between items-center text-texte">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#059669] inline-block" />
                  Moyen :
                </span>
                <span className="font-semibold font-mono">{data.tassementMoyen_mm.toFixed(2)} mm</span>
              </div>
            )}
            {afficherCoin && (
              <div className="flex justify-between items-center text-texte">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#d97706] inline-block" />
                  Coin / Angle :
                </span>
                <span className="font-semibold font-mono">{data.tassementCoin_mm.toFixed(2)} mm</span>
              </div>
            )}
            <div className="flex justify-between items-center text-texte-doux border-t border-bordure-douce pt-1">
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
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-surface-appui p-2.5 rounded-rayon border border-bordure">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-texte-doux">Axe d'effort :</span>
          <div className="inline-flex rounded-rayon-petit border border-bordure bg-surface p-0.5 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setUniteX('pression')}
              className={`px-2.5 py-1 rounded-rayon-petit transition-colors ${
                uniteX === 'pression'
                  ? 'bg-surface-appui text-texte border border-bordure'
                  : 'text-texte-doux hover:text-texte'
              }`}
            >
              Pression q (kPa)
            </button>
            <button
              type="button"
              onClick={() => setUniteX('charge')}
              className={`px-2.5 py-1 rounded-rayon-petit transition-colors ${
                uniteX === 'charge'
                  ? 'bg-surface-appui text-texte border border-bordure'
                  : 'text-texte-doux hover:text-texte'
              }`}
            >
              Charge totale V (kN)
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-texte-doux mr-1">Courbes :</span>
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-texte-doux bg-surface px-2 py-1 rounded-rayon-petit border border-bordure font-medium">
            <span className="w-2 h-2 rounded-full bg-[#0284c7] inline-block" />
            <input
              type="checkbox"
              checked={afficherCentre}
              onChange={(e) => setAfficherCentre(e.target.checked)}
            />
            Centre
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-texte-doux bg-surface px-2 py-1 rounded-rayon-petit border border-bordure font-medium">
            <span className="w-2 h-2 rounded-full bg-[#059669] inline-block" />
            <input
              type="checkbox"
              checked={afficherMoyen}
              onChange={(e) => setAfficherMoyen(e.target.checked)}
            />
            Moyen
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-texte-doux bg-surface px-2 py-1 rounded-rayon-petit border border-bordure font-medium">
            <span className="w-2 h-2 rounded-full bg-[#d97706] inline-block" />
            <input
              type="checkbox"
              checked={afficherCoin}
              onChange={(e) => setAfficherCoin(e.target.checked)}
            />
            Coin
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none text-texte-doux bg-surface px-2 py-1 rounded-rayon-petit border border-bordure font-medium">
            <span className="w-2 h-2 rounded-full bg-refus inline-block" />
            <input
              type="checkbox"
              checked={afficherSeuil}
              onChange={(e) => setAfficherSeuil(e.target.checked)}
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
            <CartesianGrid strokeDasharray="3 3" stroke="#eceae4" />
            <XAxis
              dataKey={xKey}
              type="number"
              domain={['dataMin', 'dataMax']}
              stroke="#6a6862"
              fontSize={11}
              tickLine={false}
              label={{
                value: xLabel,
                position: 'insideBottom',
                offset: -15,
                fill: '#4a4842',
                fontSize: 12,
                fontWeight: 600,
              }}
            />
            <YAxis
              stroke="#6a6862"
              fontSize={11}
              tickLine={false}
              label={{
                value: 'Tassement théorique s (mm)',
                angle: -90,
                position: 'insideLeft',
                offset: 5,
                fill: '#4a4842',
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
              stroke="#1a1a1a"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: `Service ELS (${xValeurActuelle} ${uniteX === 'pression' ? 'kPa' : 'kN'})`,
                position: 'insideTopLeft',
                fill: '#1a1a1a',
                fontSize: 10,
                fontWeight: 'bold',
              }}
            />

            {/* Repère seuil de tassement admissible */}
            {afficherSeuil && (
              <ReferenceLine
                y={seuilAdmissible_mm}
                stroke="#a52121"
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{
                  value: `Admissible ELS (${seuilAdmissible_mm} mm)`,
                  position: 'insideBottomRight',
                  fill: '#a52121',
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-surface-appui border border-bordure rounded-rayon text-xs">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-texte-faible shrink-0" />
          <div>
            <span className="text-texte-doux block text-[11px]">Module de réaction apparent ks</span>
            <span className="font-semibold text-texte font-mono tabular-nums">
              {ks_MNm3.toFixed(1)} <span className="font-normal text-texte-doux text-[10px]">MN/m³ (kPa/mm)</span>
            </span>
          </div>
        </div>
        <div>
          <span className="text-texte-doux block text-[11px]">Raideur globale verticale Kv</span>
          <span className="font-semibold text-texte font-mono tabular-nums">
            {Kv_MNm.toFixed(0)} <span className="font-normal text-texte-doux text-[10px]">MN/m</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-texte-doux text-[11px] leading-tight">
          <Info className="w-4 h-4 text-texte-faible shrink-0" />
          <span>
            Non-linéarité issue des phases de recompression (<span className="font-mono">Cs</span>) et compression vierge (<span className="font-mono">Cc</span>).
          </span>
        </div>
      </div>
    </div>
  );
};
