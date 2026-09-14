import React, { useRef, useState, useEffect } from 'react';
import { CoucheGeotechnique, Hydrogeologie, OuvrageRadier, OuvragePieu, OuvrageSoutenement } from '../types/geotech';
import { ZoomIn, ZoomOut, RotateCcw, Layers } from 'lucide-react';

interface CoupeDeSolCanvasProps {
  coteTerrainNaturel: number;
  couches: CoucheGeotechnique[];
  hydrogeologie: Hydrogeologie;
  ouvrageActif?: {
    type: 'radier' | 'pieu' | 'soutenement';
    radier?: OuvrageRadier;
    pieu?: OuvragePieu;
    soutenement?: OuvrageSoutenement;
  };
}

export const CoupeDeSolCanvas: React.FC<CoupeDeSolCanvasProps> = ({
  coteTerrainNaturel,
  couches,
  hydrogeologie,
  ouvrageActif,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 450 });
  const [zoom, setZoom] = useState(1.0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: Math.max(320, entry.contentRect.width),
          height: Math.max(380, entry.contentRect.height),
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Calcul des bornes verticales
  const coteHaut = Math.max(
    coteTerrainNaturel + 1.0,
    ...couches.map((c) => c.coteToit + 0.5)
  );
  const coteBas = Math.min(
    coteTerrainNaturel - 12.0,
    ...couches.map((c) => c.coteToit - c.epaisseur - 0.5)
  );
  const deltaCote = Math.max(5, coteHaut - coteBas);

  // Échelle verticale
  const paddingHaut = 40;
  const paddingBas = 30;
  const zoneDessinH = (dimensions.height - paddingHaut - paddingBas) * zoom;
  const echelleY = zoneDessinH / deltaCote;

  const getSvgY = (cote: number) => {
    return paddingHaut + (coteHaut - cote) * echelleY;
  };

  const xSolDebut = 90;
  const xSolFin = dimensions.width - 20;
  const largeurSol = Math.max(100, xSolFin - xSolDebut);
  const xCentreOuvrage = xSolDebut + largeurSol * 0.45;

  // Graduations tous les mètres
  const graduations: number[] = [];
  const minEntier = Math.ceil(coteBas);
  const maxEntier = Math.floor(coteHaut);
  for (let z = minEntier; z <= maxEntier; z++) {
    graduations.push(z);
  }

  const nappeELS = hydrogeologie.nappePrincipale.coteCaracteristique;
  const nappeELU = hydrogeologie.nappePrincipale.coteDefavorableELU;

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-700/80 rounded-xl overflow-hidden shadow-md">
      {/* Barre d'outils de la coupe */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800/90 border-b border-slate-700/80 text-xs text-slate-300">
        <div className="flex items-center gap-2 font-medium">
          <Layers className="w-4 h-4 text-emerald-400" />
          <span>Coupe Stratigraphique & Ouvrage</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            id="btn-zoom-in"
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
            className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Zoom avant"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-zoom-out"
            onClick={() => setZoom((z) => Math.max(0.7, z - 0.2))}
            className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Zoom arrière"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-zoom-reset"
            onClick={() => setZoom(1.0)}
            className="p-1 rounded hover:bg-slate-700 text-slate-300 hover:text-white transition"
            title="Réinitialiser"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Surface SVG de dessin */}
      <div ref={containerRef} className="relative flex-1 overflow-auto bg-slate-950/70 select-none">
        <svg
          width={dimensions.width}
          height={Math.max(dimensions.height, paddingHaut + paddingBas + zoneDessinH)}
          className="block"
        >
          <defs>
            <pattern id="hachure-remblai" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M-1,1 l2,-2 M0,10 l10,-10 M9,11 l2,-2" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            </pattern>
            <pattern id="hachure-sable" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.8" fill="rgba(255,255,255,0.25)" />
              <circle cx="6" cy="6" r="0.8" fill="rgba(255,255,255,0.25)" />
            </pattern>
            <pattern id="hachure-argile" width="12" height="6" patternUnits="userSpaceOnUse">
              <line x1="0" y1="3" x2="6" y2="3" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            </pattern>
          </defs>

          {/* Axe altimétrique vertical à gauche */}
          <line x1="75" y1={paddingHaut} x2="75" y2={paddingHaut + zoneDessinH} stroke="#475569" strokeWidth="1.5" />

          {/* Graduations en mètres */}
          {graduations.map((z) => {
            const y = getSvgY(z);
            return (
              <g key={`grad-${z}`}>
                <line x1="68" y1={y} x2="75" y2={y} stroke="#64748b" strokeWidth="1" />
                <line x1="75" y1={y} x2={xSolFin} y2={y} stroke="#1e293b" strokeDasharray="2,4" strokeWidth="0.8" />
                <text x="63" y={y + 3.5} textAnchor="end" fontSize="10" fill="#94a3b8" fontFamily="monospace">
                  {z.toFixed(1)} m
                </text>
              </g>
            );
          })}

          {/* Couches de sol */}
          {couches.map((c) => {
            const yToit = getSvgY(c.coteToit);
            const yBase = getSvgY(c.coteToit - c.epaisseur);
            const h = Math.max(2, yBase - yToit);

            return (
              <g key={c.id}>
                {/* Rectangle de couche */}
                <rect
                  x={xSolDebut}
                  y={yToit}
                  width={largeurSol}
                  height={h}
                  fill={c.couleurAffichage || '#334155'}
                  fillOpacity="0.85"
                  stroke="#0f172a"
                  strokeWidth="1"
                />

                {/* Hachure thématique */}
                <rect
                  x={xSolDebut}
                  y={yToit}
                  width={largeurSol}
                  height={h}
                  fill={
                    c.nature === 'sable'
                      ? 'url(#hachure-sable)'
                      : c.nature === 'argile'
                      ? 'url(#hachure-argile)'
                      : 'url(#hachure-remblai)'
                  }
                />

                {/* Étiquette de couche */}
                <g transform={`translate(${xSolFin - 10}, ${yToit + 16})`}>
                  <text textAnchor="end" fill="#ffffff" fontSize="11" fontWeight="bold">
                    {c.nom}
                  </text>
                  <text textAnchor="end" y="14" fill="#cbd5e1" fontSize="9.5">
                    ép. {c.epaisseur.toFixed(2)}m • φ'={c.resistanceDrainee.phiPrime.v}° • c'={c.resistanceDrainee.cPrime.v}kPa
                  </text>
                </g>

                {/* Cote du toit */}
                <line x1={xSolDebut - 6} y1={yToit} x2={xSolDebut} y2={yToit} stroke="#38bdf8" strokeWidth="1.5" />
                <text x={xSolDebut + 8} y={yToit + 13} fill="#e2e8f0" fontSize="10" fontWeight="600">
                  {c.id} ({c.coteToit.toFixed(2)}m)
                </text>
              </g>
            );
          })}

          {/* Ligne du Terrain Naturel (TN) */}
          <line
            x1={xSolDebut}
            y1={getSvgY(coteTerrainNaturel)}
            x2={xSolFin}
            y2={getSvgY(coteTerrainNaturel)}
            stroke="#22c55e"
            strokeWidth="2.5"
          />
          <text
            x={xSolDebut + 5}
            y={getSvgY(coteTerrainNaturel) - 6}
            fill="#4ade80"
            fontSize="10.5"
            fontWeight="bold"
          >
            TN {coteTerrainNaturel.toFixed(2)} m NGL
          </text>

          {/* Niveau de Nappe ELS (Caractéristique) */}
          {nappeELS > coteBas && (
            <g>
              <line
                x1={xSolDebut}
                y1={getSvgY(nappeELS)}
                x2={xSolFin}
                y2={getSvgY(nappeELS)}
                stroke="#38bdf8"
                strokeWidth="2"
              />
              {/* Symbole triangle nappe */}
              <polygon
                points={`${xSolDebut + 25},${getSvgY(nappeELS)} ${xSolDebut + 35},${getSvgY(nappeELS)} ${xSolDebut + 30},${getSvgY(nappeELS) + 9}`}
                fill="#38bdf8"
              />
              <text x={xSolDebut + 40} y={getSvgY(nappeELS) + 10} fill="#38bdf8" fontSize="10" fontWeight="bold">
                Nappe ELS {nappeELS.toFixed(2)} m
              </text>
            </g>
          )}

          {/* Niveau de Nappe ELU (Défavorable) */}
          {nappeELU > coteBas && (
            <g>
              <line
                x1={xSolDebut}
                y1={getSvgY(nappeELU)}
                x2={xSolFin}
                y2={getSvgY(nappeELU)}
                stroke="#f43f5e"
                strokeDasharray="5,4"
                strokeWidth="1.8"
              />
              <polygon
                points={`${xSolDebut + 90},${getSvgY(nappeELU)} ${xSolDebut + 100},${getSvgY(nappeELU)} ${xSolDebut + 95},${getSvgY(nappeELU) + 9}`}
                fill="#f43f5e"
              />
              <text x={xSolDebut + 105} y={getSvgY(nappeELU) + 10} fill="#fb7185" fontSize="10" fontWeight="bold">
                Nappe ELU {nappeELU.toFixed(2)} m (défavorable)
              </text>
            </g>
          )}

          {/* ========================================================= */}
          {/* SUPERPOSITION DE L'OUVRAGE ACTIF */}
          {/* ========================================================= */}
          {ouvrageActif?.type === 'radier' && ouvrageActif.radier && (
            <g>
              {(() => {
                const radier = ouvrageActif.radier;
                const echellePixParM = echelleY;
                const pixLargeur = Math.min(largeurSol * 0.7, radier.largeurB * echellePixParM);
                const pixEpaisseur = Math.max(10, radier.epaisseur * echellePixParM);
                const yBase = getSvgY(radier.coteBase);
                const yHaut = yBase - pixEpaisseur;
                const xDebut = xCentreOuvrage - pixLargeur / 2;

                return (
                  <g>
                    {/* Fouille ouverte au dessus */}
                    <rect
                      x={xDebut - 15}
                      y={getSvgY(coteTerrainNaturel)}
                      width={pixLargeur + 30}
                      height={yBase - getSvgY(coteTerrainNaturel)}
                      fill="#0f172a"
                      fillOpacity="0.4"
                    />

                    {/* Dalle radier en béton */}
                    <rect
                      x={xDebut}
                      y={yHaut}
                      width={pixLargeur}
                      height={pixEpaisseur}
                      fill="#94a3b8"
                      stroke="#f1f5f9"
                      strokeWidth="2"
                    />

                    {/* Ligne d'assise */}
                    <line x1={xDebut} y1={yBase} x2={xDebut + pixLargeur} y2={yBase} stroke="#ef4444" strokeWidth="2.5" />

                    {/* Flèche de charge verticale V */}
                    <line
                      x1={xCentreOuvrage}
                      y1={yHaut - 35}
                      x2={xCentreOuvrage}
                      y2={yHaut}
                      stroke="#f59e0b"
                      strokeWidth="3"
                      markerEnd="url(#arrow-v)"
                    />
                    <text
                      x={xCentreOuvrage}
                      y={yHaut - 40}
                      textAnchor="middle"
                      fill="#fbbf24"
                      fontSize="11"
                      fontWeight="bold"
                    >
                      V_Ed = {(radier.actions.V_G * 1.35 + radier.actions.V_Q * 1.5).toFixed(0)} kN
                    </text>

                    {/* Cote sous semelle */}
                    <text
                      x={xDebut + pixLargeur + 8}
                      y={yBase + 4}
                      fill="#fca5a5"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      Assise {radier.coteBase.toFixed(2)} m (B={radier.largeurB}m)
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {ouvrageActif?.type === 'pieu' && ouvrageActif.pieu && (
            <g>
              {(() => {
                const pieu = ouvrageActif.pieu;
                const pixDiam = Math.max(12, pieu.diametre * echelleY);
                const yTete = getSvgY(pieu.coteTete);
                const yPointe = getSvgY(pieu.cotePointe);
                const xPieu = xCentreOuvrage;

                return (
                  <g>
                    {/* Fût du pieu */}
                    <rect
                      x={xPieu - pixDiam / 2}
                      y={yTete}
                      width={pixDiam}
                      height={yPointe - yTete}
                      fill="#64748b"
                      stroke="#e2e8f0"
                      strokeWidth="1.5"
                    />

                    {/* Pointe biseautée */}
                    <polygon
                      points={`${xPieu - pixDiam / 2},${yPointe} ${xPieu + pixDiam / 2},${yPointe} ${xPieu},${yPointe + 10}`}
                      fill="#475569"
                      stroke="#e2e8f0"
                      strokeWidth="1.5"
                    />

                    {/* Si plan neutre frottement négatif */}
                    {pieu.frottementNegatif.actif && (
                      <g>
                        <line
                          x1={xPieu - pixDiam / 2 - 15}
                          y1={getSvgY(pieu.frottementNegatif.cotePlanNeutre)}
                          x2={xPieu + pixDiam / 2 + 15}
                          y2={getSvgY(pieu.frottementNegatif.cotePlanNeutre)}
                          stroke="#fb923c"
                          strokeDasharray="3,3"
                          strokeWidth="2"
                        />
                        <text
                          x={xPieu + pixDiam / 2 + 20}
                          y={getSvgY(pieu.frottementNegatif.cotePlanNeutre) + 3}
                          fill="#fb923c"
                          fontSize="9.5"
                        >
                          Plan neutre ({pieu.frottementNegatif.cotePlanNeutre.toFixed(1)}m)
                        </text>
                      </g>
                    )}

                    {/* Cotes tête et pointe */}
                    <text x={xPieu + pixDiam / 2 + 8} y={yTete + 4} fill="#e2e8f0" fontSize="10" fontWeight="bold">
                      Tête {pieu.coteTete.toFixed(2)} m
                    </text>
                    <text x={xPieu + pixDiam / 2 + 8} y={yPointe + 4} fill="#e2e8f0" fontSize="10" fontWeight="bold">
                      Pointe {pieu.cotePointe.toFixed(2)} m (Ø {pieu.diametre}m)
                    </text>
                  </g>
                );
              })()}
            </g>
          )}

          {ouvrageActif?.type === 'soutenement' && ouvrageActif.soutenement && (
            <g>
              {(() => {
                const mur = ouvrageActif.soutenement;
                const yTete = getSvgY(mur.coteTete);
                const yFond = getSvgY(mur.coteFondFouille);
                const yBase = getSvgY(mur.coteTete - mur.hauteurTotale);
                const xVoile = xCentreOuvrage;
                const pixH = yBase - yTete;
                const pixB = Math.max(40, (mur.largeurSemelleB || 2.5) * echelleY);
                const pixEVoile = Math.max(8, (mur.epaisseurVoile || 0.35) * echelleY);

                return (
                  <g>
                    {/* Zone excavée en aval (fouille) */}
                    <rect
                      x={xSolDebut}
                      y={yFond}
                      width={xVoile - xSolDebut - 15}
                      height={yBase - yFond + 20}
                      fill="#020617"
                      fillOpacity="0.8"
                    />

                    {/* Voile vertical du mur en L */}
                    <rect
                      x={xVoile}
                      y={yTete}
                      width={pixEVoile}
                      height={pixH}
                      fill="#94a3b8"
                      stroke="#f8fafc"
                      strokeWidth="1.5"
                    />

                    {/* Semelle horizontale du mur en L */}
                    <rect
                      x={xVoile - 15}
                      y={yBase - 15}
                      width={pixB}
                      height={18}
                      fill="#94a3b8"
                      stroke="#f8fafc"
                      strokeWidth="1.5"
                    />

                    {/* Ligne fond de fouille aval */}
                    <line x1={xSolDebut} y1={yFond} x2={xVoile} y2={yFond} stroke="#38bdf8" strokeWidth="2" />
                    <text x={xSolDebut + 10} y={yFond - 5} fill="#38bdf8" fontSize="10" fontWeight="bold">
                      Fond de fouille {mur.coteFondFouille.toFixed(2)} m
                    </text>

                    {/* Flèches de poussée active sur le voile */}
                    <polygon
                      points={`${xVoile + pixEVoile + 25},${yTete + pixH * 0.6} ${xVoile + pixEVoile + 5},${yTete + pixH * 0.6} ${xVoile + pixEVoile + 10},${yTete + pixH * 0.6 - 4} ${xVoile + pixEVoile + 10},${yTete + pixH * 0.6 + 4}`}
                      fill="#f97316"
                    />
                    <text
                      x={xVoile + pixEVoile + 30}
                      y={yTete + pixH * 0.6 + 3}
                      fill="#fb923c"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      Poussée Pa
                    </text>
                  </g>
                );
              })()}
            </g>
          )}
        </svg>
      </div>

      {/* Légende en pied de coupe */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 bg-slate-900 border-t border-slate-800 text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-emerald-500 inline-block"></span>
          <span>Terrain Naturel (TN)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-sky-400 inline-block"></span>
          <span>Nappe ELS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-rose-500 border-b border-dashed border-rose-500 inline-block"></span>
          <span>Nappe ELU défavorable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-2 bg-slate-400 rounded-xs inline-block"></span>
          <span>Béton armé</span>
        </div>
      </div>
    </div>
  );
};
