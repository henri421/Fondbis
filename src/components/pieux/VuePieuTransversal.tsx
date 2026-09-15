import React, { useState, useMemo } from 'react';
import {
  calculerPieuTransversal,
  FamilleCourbePy,
  ResultatPieuTransversal,
} from '../../modules/pieux/comportementTransversal';
import { CampagneEssai, CoucheGeotechnique, Hydrogeologie } from '../../types/geotech';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Layers,
  ArrowRight,
  TrendingDown,
  Compass,
  FileText,
} from 'lucide-react';

interface VuePieuTransversalProps {
  diametre: number;
  coteTete: number;
  cotePointe: number;
  couches: CoucheGeotechnique[];
  hydrogeologie: Hydrogeologie;
  campagnes?: CampagneEssai[];
}

export const VuePieuTransversal: React.FC<VuePieuTransversalProps> = ({
  diametre,
  coteTete,
  cotePointe,
  couches,
  hydrogeologie,
  campagnes,
}) => {
  // Paramètres transversaux configurables
  const [chargeH, setChargeH] = useState<number>(100); // kN
  const [momentM, setMomentM] = useState<number>(0); // kN.m
  const [rotationBloquee, setRotationBloquee] = useState<boolean>(false);
  const [familleCourbe, setFamilleCourbe] = useState<FamilleCourbePy>('automatique');
  const [moduleE_GPa, setModuleE_GPa] = useState<number>(30); // Béton C25/30 ou C30/37
  const [pasDiscretisation, setPasDiscretisation] = useState<number>(0.25); // m

  // Gestion des campagnes PMT réelles et paramètres manuels
  const sondagesPMT = useMemo(() => {
    return (campagnes ?? []).filter((c) => c.type === 'PMT');
  }, [campagnes]);

  const [sondagePMTSelectionne, setSondagePMTSelectionne] = useState<string>('');
  const [modeSaisieManuellePMT, setModeSaisieManuellePMT] = useState<boolean>(false);
  const [emManuel, setEmManuel] = useState<number>(15); // MPa
  const [plNetteManuelle, setPlNetteManuelle] = useState<number>(1.2); // MPa

  const idPMTActif = useMemo(() => {
    if (sondagePMTSelectionne) return sondagePMTSelectionne;
    return sondagesPMT[0]?.id ?? '';
  }, [sondagePMTSelectionne, sondagesPMT]);

  // Calcul transversal
  const resultat: ResultatPieuTransversal = useMemo(() => {
    return calculerPieuTransversal({
      diametre,
      coteTete,
      cotePointe,
      moduleE_GPa,
      chargeH,
      momentM,
      liaisonTete: rotationBloquee ? 'bloqueeEnRotation' : 'libre',
      pasMaillage: pasDiscretisation,
      familleCourbe,
      couches,
      hydrogeologie,
      campagnes,
      sondagePMTId: !modeSaisieManuellePMT && idPMTActif ? idPMTActif : undefined,
      parametresPressioManuels: modeSaisieManuellePMT
        ? { EM_MPa: emManuel, plNette_MPa: plNetteManuelle }
        : undefined,
      maxIterations: 60,
      toleranceConvergence: 1e-3,
    });
  }, [
    diametre,
    coteTete,
    cotePointe,
    moduleE_GPa,
    chargeH,
    momentM,
    rotationBloquee,
    pasDiscretisation,
    familleCourbe,
    couches,
    hydrogeologie,
    campagnes,
    modeSaisieManuellePMT,
    idPMTActif,
    emManuel,
    plNetteManuelle,
  ]);

  const longueurPieu = Math.max(0.1, coteTete - cotePointe);
  const deplacementMaxAbs = useMemo(() => {
    return Math.max(0.01, ...resultat.profils.map((p) => Math.abs(p.ux_mm)));
  }, [resultat]);

  // Lois p-y réellement mobilisées le long du fût (utile en mode "Auto", où la loi
  // effectivement appliquée à chaque couche n'est sinon visible que dans le tableau détaillé)
  const STYLE_LOI: Record<string, { label: string; classes: string }> = {
    matlock: { label: 'Matlock (argile)', classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    reese: { label: 'Reese (sable)', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
    pressiometrique: { label: 'Pressiométrique', classes: 'bg-rose-50 text-rose-700 border-rose-200' },
  };
  const loisAppliquees = useMemo(() => {
    return Array.from(new Set(resultat.profils.map((p) => p.familleAppliquee)));
  }, [resultat]);

  // Échelles pour graphiques SVG
  const svgHeight = 320;
  const svgWidth = 260;
  const padX = 40;
  const padY = 25;
  const plotW = svgWidth - 2 * padX;
  const plotH = svgHeight - 2 * padY;

  // Calcul échelles déplacements u
  const uMaxAbs = Math.max(1, ...resultat.profils.map((p) => Math.abs(p.ux_mm)));
  const uScale = (u: number) => padX + (u / uMaxAbs) * (plotW / 2) + plotW / 2;

  // Calcul échelles moment M
  const mMaxAbs = Math.max(1, ...resultat.profils.map((p) => Math.abs(p.moment)));
  const mScale = (m: number) => padX + (m / mMaxAbs) * (plotW / 2) + plotW / 2;

  // Échelle profondeur z
  const zScale = (z: number) => padY + (z / longueurPieu) * plotH;

  // Points SVG u(z)
  const pathU = resultat.profils
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${uScale(p.ux_mm).toFixed(1)},${zScale(p.profondeur).toFixed(1)}`)
    .join(' ');

  // Points SVG M(z)
  const pathM = resultat.profils
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${mScale(p.moment).toFixed(1)},${zScale(p.profondeur).toFixed(1)}`)
    .join(' ');

  return (
    <div className="space-y-6">
      {/* Panneau de contrôle des sollicitations transversales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Effort tranchant en tête H (kN)
          </label>
          <input
            type="number"
            value={chargeH}
            onChange={(e) => setChargeH(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-mono"
            step="10"
          />
          <span className="text-[11px] text-slate-400">Charge horizontale ELU</span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Moment appliqué M (kNm)
          </label>
          <input
            type="number"
            value={momentM}
            onChange={(e) => setMomentM(parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500 font-mono"
            step="10"
          />
          <span className="text-[11px] text-slate-400">Moment fléchissant en tête</span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Famille de lois p-y (EN 1997-1 §7.7)
          </label>
          <select
            value={familleCourbe}
            onChange={(e) => setFamilleCourbe(e.target.value as FamilleCourbePy)}
            className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-sky-500"
          >
            <option value="automatique">Auto (selon lithologie)</option>
            <option value="reese">Reese (Sables frottants)</option>
            <option value="matlock">Matlock (Argiles / Cu)</option>
            <option value="pressiometrique">Pressiométrique (Ménard)</option>
          </select>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400">
              {familleCourbe === 'automatique' ? 'Appliquée par couche :' : 'Formulation de raideur de sol'}
            </span>
            {familleCourbe === 'automatique' &&
              loisAppliquees.map((loi) => (
                <span
                  key={loi}
                  className={`px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${
                    STYLE_LOI[loi]?.classes ?? 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {STYLE_LOI[loi]?.label ?? loi}
                </span>
              ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Condition en tête
          </label>
          <div className="flex items-center gap-2 mt-2">
            <input
              type="checkbox"
              id="cb-rot-bloquee"
              checked={rotationBloquee}
              onChange={(e) => setRotationBloquee(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <label htmlFor="cb-rot-bloquee" className="text-xs text-slate-700 cursor-pointer">
              Tête bloquée en rotation (θ = 0)
            </label>
          </div>
          <span className="text-[11px] text-slate-400 block mt-1">Ex: liaison rigide à un radier</span>
        </div>
      </div>

      {familleCourbe === 'pressiometrique' && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-rose-500" />
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                Mesures pressiométriques réelles (EN 1997-1 §7.7 / NF P 94-262)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModeSaisieManuellePMT(false)}
                disabled={sondagesPMT.length === 0}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                  !modeSaisieManuellePMT && sondagesPMT.length > 0
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 disabled:opacity-40'
                }`}
              >
                Sondage in situ ({sondagesPMT.length})
              </button>
              <button
                type="button"
                onClick={() => setModeSaisieManuellePMT(true)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
                  modeSaisieManuellePMT
                    ? 'bg-rose-600 text-white border-rose-600'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Saisie directe
              </button>
            </div>
          </div>

          {!modeSaisieManuellePMT && sondagesPMT.length > 0 ? (
            <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-slate-200">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Sondage PMT de référence (interpolé nœud par nœud sur z)
                </label>
                <select
                  value={idPMTActif}
                  onChange={(e) => setSondagePMTSelectionne(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                >
                  {sondagesPMT.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.id} — Tête {s.coteTete.toFixed(2)} m NGF ({s.profil.filter(p => p.EM !== undefined).length} points d’essai)
                    </option>
                  ))}
                </select>
              </div>
              <div className="text-xs text-slate-500 pt-5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Profil in situ relié
                </span>
              </div>
            </div>
          ) : modeSaisieManuellePMT ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-slate-200">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Module pressiométrique E<sub>M</sub> [MPa]
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={emManuel}
                  onChange={(e) => setEmManuel(parseFloat(e.target.value) || 1)}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Pression limite nette p<sub>l</sub>* [MPa]
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.05"
                  value={plNetteManuelle}
                  onChange={(e) => setPlNetteManuelle(parseFloat(e.target.value) || 0.1)}
                  className="w-full px-3 py-1.5 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
              <div className="text-xs space-y-1">
                <p className="font-semibold">
                  Aucun sondage pressiométrique (PMT) dans la campagne d’essais
                </p>
                <p>
                  Conformément au CDC §10 et §13, aucun module E<sub>M</sub> ni pression limite p<sub>l</sub>*
                  n’est inventé à partir des modules de déformation. Vous pouvez basculer en mode « Saisie directe »
                  ci-dessus ou renseigner un sondage PMT dans les campagnes d’essai. En attendant, un repli rigoureux
                  sur les formulations de sol intrinsèques est appliqué.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Avertissements du solveur / CDC */}
      {resultat.convergence.avertissements.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1">
          {resultat.convergence.avertissements.map((av, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-amber-900">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
              <span>{av}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cartes d'indicateurs clés */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Flèche en tête u₀</span>
            <Activity className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-xl font-bold text-slate-800 font-mono">
            {resultat.deplacementTete_mm.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-500">mm</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Flèche max = {deplacementMaxAbs.toFixed(2)} mm
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Moment Max M_max</span>
            <TrendingDown className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-slate-800 font-mono">
            {resultat.momentMaxAbsolu.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-500">kNm</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            à z = {resultat.profondeurMomentMax.toFixed(2)} m
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Rotation en tête</span>
            <Compass className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-slate-800 font-mono">
            {resultat.rotationTete_mrad.toFixed(2)}{' '}
            <span className="text-xs font-normal text-slate-500">mrad</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            {rotationBloquee ? 'Encastrement parfait' : 'Tête libre'}
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span>Convergence p-y</span>
            {resultat.convergence.converge ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            )}
          </div>
          <div className="text-xl font-bold text-slate-800 font-mono">
            {resultat.convergence.iterations}{' '}
            <span className="text-xs font-normal text-slate-500">itér.</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Résidu : {resultat.convergence.residuFinal.toExponential(2)}
          </div>
        </div>
      </div>

      {/* Visualisation graphique des profils Déplacement & Moment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white p-5 border border-slate-200 rounded-xl shadow-xs">
        {/* Graphique 1 : Déplacement transversal u(z) */}
        <div className="flex flex-col items-center">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500 inline-block" />
            Déplacement horizontal u(z) [mm]
          </h4>
          <svg width={svgWidth} height={svgHeight} className="border border-slate-100 rounded-lg bg-slate-50/50">
            {/* Axe central x = 0 */}
            <line
              x1={padX + plotW / 2}
              y1={padY}
              x2={padX + plotW / 2}
              y2={padY + plotH}
              stroke="#cbd5e1"
              strokeDasharray="3 3"
            />
            {/* Ligne du pieu */}
            <path d={pathU} fill="none" stroke="#0284c7" strokeWidth="2.5" />
            {/* Points nodaux */}
            {resultat.profils.map((p, idx) => (
              <circle
                key={idx}
                cx={uScale(p.ux_mm)}
                cy={zScale(p.profondeur)}
                r={idx === 0 ? 4 : 2}
                fill={idx === 0 ? '#0369a1' : '#38bdf8'}
              />
            ))}
            {/* Graduations de profondeur */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const prof = pct * longueurPieu;
              const y = zScale(prof);
              return (
                <g key={pct}>
                  <line x1={padX - 4} y1={y} x2={padX} y2={y} stroke="#94a3b8" />
                  <text x={padX - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">
                    {prof.toFixed(1)}m
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="text-[11px] text-slate-500 mt-2">
            u en tête : <strong>{resultat.deplacementTete_mm.toFixed(2)} mm</strong>
          </div>
        </div>

        {/* Graphique 2 : Moment fléchissant M(z) */}
        <div className="flex flex-col items-center">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
            Moment fléchissant M(z) [kNm]
          </h4>
          <svg width={svgWidth} height={svgHeight} className="border border-slate-100 rounded-lg bg-slate-50/50">
            {/* Axe central M = 0 */}
            <line
              x1={padX + plotW / 2}
              y1={padY}
              x2={padX + plotW / 2}
              y2={padY + plotH}
              stroke="#cbd5e1"
              strokeDasharray="3 3"
            />
            {/* Courbe du moment */}
            <path d={pathM} fill="none" stroke="#d97706" strokeWidth="2.5" />
            {/* Marqueur du moment maximum */}
            <circle
              cx={mScale(resultat.momentMaxAbsolu)}
              cy={zScale(resultat.profondeurMomentMax)}
              r={5}
              fill="#b45309"
            />
            {/* Graduations de profondeur */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
              const prof = pct * longueurPieu;
              const y = zScale(prof);
              return (
                <g key={pct}>
                  <line x1={padX - 4} y1={y} x2={padX} y2={y} stroke="#94a3b8" />
                  <text x={padX - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">
                    {prof.toFixed(1)}m
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="text-[11px] text-slate-500 mt-2">
            M_max = <strong>{resultat.momentMaxAbsolu.toFixed(1)} kNm</strong> à z ={' '}
            {resultat.profondeurMomentMax.toFixed(2)} m
          </div>
        </div>
      </div>

      {/* Tableau détaillé le long du pieu */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <span className="text-xs font-bold text-slate-700">
            Profil numérique le long du pieu (Discrétisation éléments finis)
          </span>
          <span className="text-xs text-slate-400 font-mono">
            {resultat.profils.length} nœuds
          </span>
        </div>
        <div className="max-h-60 overflow-y-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 sticky top-0 border-b border-slate-200">
              <tr>
                <th className="px-3 py-2">Profondeur z (m)</th>
                <th className="px-3 py-2">Cote (m)</th>
                <th className="px-3 py-2">Loi p-y</th>
                <th className="px-3 py-2">Déplacement u (mm)</th>
                <th className="px-3 py-2">Moment M (kNm)</th>
                <th className="px-3 py-2">Effort tranchant V (kN)</th>
                <th className="px-3 py-2">Réaction p (kN/m)</th>
                <th className="px-3 py-2">Raideur ksec (kN/m²)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {resultat.profils.map((p, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-3 py-1.5 font-sans font-medium text-slate-700">
                    {p.profondeur.toFixed(2)}
                  </td>
                  <td className="px-3 py-1.5 text-slate-500">{p.cote.toFixed(2)}</td>
                  <td className="px-3 py-1.5 font-sans text-[11px]">
                    <span
                      className={`px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${
                        STYLE_LOI[p.familleAppliquee]?.classes ?? 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {STYLE_LOI[p.familleAppliquee]?.label ?? p.familleAppliquee}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-sky-700 font-bold">
                    {p.ux_mm.toFixed(3)}
                  </td>
                  <td className="px-3 py-1.5 text-amber-700">{p.moment.toFixed(1)}</td>
                  <td className="px-3 py-1.5 text-slate-600">{p.tranchant.toFixed(1)}</td>
                  <td className="px-3 py-1.5 text-slate-600">{p.reactionSol_p.toFixed(1)}</td>
                  <td className="px-3 py-1.5 text-slate-500">{p.raideurSecante_ksec.toFixed(0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
