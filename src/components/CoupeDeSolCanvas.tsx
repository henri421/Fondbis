import React, { useRef, useState, useEffect, useMemo } from 'react';
import { CoucheGeotechnique, Hydrogeologie, OuvrageRadier, OuvragePieu, OuvrageSoutenement } from '../types/geotech';
import { ZoomIn, ZoomOut, RotateCcw, Layers, Tag, ChevronDown } from 'lucide-react';
import { BoiteEtiquette1D, BoiteEtiquetteResolue, resoudreAntiCollision1D } from '../core/antiCollisionEtiquettes';

// Types d'étiquettes configurables et masquables
export type TypeEtiquetteCoupe =
  | 'couches'      // Cartouches descriptifs des couches à droite
  | 'cotesToit'    // Cotes altimétriques des toits de couches à gauche
  | 'nappes'       // Niveaux d'eau ELS et ELU
  | 'tn'           // Terrain Naturel (TN)
  | 'ouvrage'      // Ouvrage (cotes d'assise, tête, pointe, fouille, charges)
  | 'graduations'; // Graduations régulières sur l'axe altimétrique

const TYPES_ETIQUETTES_CONFIG: {
  id: TypeEtiquetteCoupe;
  label: string;
  dotColor: string;
  description: string;
}[] = [
  { id: 'couches', label: 'Couches', dotColor: 'bg-texte-faible', description: 'Cartouches descriptifs (nom, épaisseur, φ\', c\')' },
  { id: 'cotesToit', label: 'Cotes toits', dotColor: 'bg-texte-faible', description: 'Cotes altimétriques des toits de couches' },
  { id: 'nappes', label: 'Nappes', dotColor: 'bg-accent', description: 'Niveaux phréatiques ELS et ELU' },
  { id: 'tn', label: 'TN', dotColor: 'bg-texte-faible', description: 'Ligne et cote du Terrain Naturel' },
  { id: 'ouvrage', label: 'Ouvrage', dotColor: 'bg-traction', description: 'Cotes d\'exécution, charges et fouille' },
  { id: 'graduations', label: 'Graduations', dotColor: 'bg-texte-faible', description: 'Graduations altimétriques de l\'axe vertical' },
];

// Tronque un libellé de couche pour qu'il tienne dans le cartouche de la coupe (largeur fixe
// ~240px) — un <text> SVG ne wrappe ni ne coupe automatiquement, un nom trop long déborde
// silencieusement hors du cartouche et devient illisible plutôt que d'être coupé proprement.
const tronquerLabel = (texte: string, maxChars: number): string =>
  texte.length > maxChars ? `${texte.slice(0, maxChars - 1).trimEnd()}…` : texte;

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

  // État de masquage par type d'étiquette
  const [filtreEtiquettesOuvert, setFiltreEtiquettesOuvert] = useState(false);
  const [visibilites, setVisibilites] = useState<Record<TypeEtiquetteCoupe, boolean>>({
    couches: true,
    cotesToit: true,
    nappes: true,
    tn: true,
    ouvrage: true,
    graduations: true,
  });

  const toggleType = (type: TypeEtiquetteCoupe) => {
    setVisibilites((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const toutMasquer = () => {
    setVisibilites({
      couches: false,
      cotesToit: false,
      nappes: false,
      tn: false,
      ouvrage: false,
      graduations: false,
    });
  };

  const toutAfficher = () => {
    setVisibilites({
      couches: true,
      cotesToit: true,
      nappes: true,
      tn: true,
      ouvrage: true,
      graduations: true,
    });
  };

  const nbActives = Object.values(visibilites).filter(Boolean).length;
  const totalTypes = TYPES_ETIQUETTES_CONFIG.length;

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
  const yELS = getSvgY(nappeELS);
  const yELU = getSvgY(nappeELU);

  // =========================================================================
  // MOTEUR D'ANTI-COLLISION / ANTI-CHEVAUCHEMENT DES ÉTIQUETTES
  // =========================================================================

  // 1. Cartouches descriptifs des couches à droite (240px x 32px)
  const boitesCartouches: BoiteEtiquette1D[] = useMemo(() => {
    return couches.map((c) => {
      const yToit = getSvgY(c.coteToit);
      const yBase = getSvgY(c.coteToit - c.epaisseur);
      const yMid = (yToit + yBase) / 2;
      return {
        id: c.id,
        yIdeal: yMid - 16,
        hauteur: 32,
        yAnchor: yMid,
        donnees: c,
      };
    });
  }, [couches, echelleY, coteHaut, zoom]);

  const cartouchesMap = useMemo(() => {
    const resolues = resoudreAntiCollision1D(
      boitesCartouches,
      paddingHaut + 4,
      paddingHaut + zoneDessinH - 36,
      8 // gap minimal de 8px entre cartouches
    );
    const map = new Map<string, BoiteEtiquetteResolue>();
    resolues.forEach((b) => map.set(b.id, b));
    return map;
  }, [boitesCartouches, paddingHaut, zoneDessinH]);

  // 2. Cotes altimétriques des toits de couches à gauche (17px de haut)
  const boitesToits: BoiteEtiquette1D[] = useMemo(() => {
    return couches.map((c) => {
      const yToit = getSvgY(c.coteToit);
      return {
        id: c.id,
        yIdeal: yToit + 3,
        hauteur: 17,
        yAnchor: yToit,
        donnees: c,
      };
    });
  }, [couches, echelleY, coteHaut, zoom]);

  const toitsMap = useMemo(() => {
    const resolues = resoudreAntiCollision1D(
      boitesToits,
      paddingHaut + 2,
      paddingHaut + zoneDessinH - 20,
      4 // gap minimal de 4px entre cotes de toit
    );
    const map = new Map<string, BoiteEtiquetteResolue>();
    resolues.forEach((b) => map.set(b.id, b));
    return map;
  }, [boitesToits, paddingHaut, zoneDessinH]);

  // 3. Positionnement anti-collision pour les Nappes (ELS et ELU)
  const nappeProcheToit = useMemo(() => {
    return couches.some((c) => Math.abs(getSvgY(c.coteToit) - yELS) < 18);
  }, [couches, yELS]);

  const diffELS_ELU = Math.abs(yELS - yELU);
  // Si ELS et ELU sont à la même cote ou très proches (< 20px) :
  // ELS se positionne au-dessus de la ligne d'eau (yELS - 18)
  // ELU se positionne en-dessous (yELU + 2)
  const yBadgeELS = diffELS_ELU < 20 ? yELS - 18 : (nappeProcheToit ? yELS - 18 : yELS + 2);
  const yBadgeELU = diffELS_ELU < 20 ? yELU + 2 : yELU + 2;
  const xBadgeELS = nappeProcheToit && diffELS_ELU >= 20 ? xSolDebut + 115 : xSolDebut + 36;

  return (
    <div className="flex flex-col h-full bg-surface border border-bordure rounded-rayon overflow-hidden">
      {/* Barre d'outils de la coupe */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-surface-appui border-b border-bordure text-xs text-texte-doux">
        <div className="flex items-center gap-2 font-semibold">
          <Layers className="w-4 h-4 text-texte-faible" />
          <span className="text-texte">Coupe Stratigraphique & Ouvrage</span>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Bouton de bascule du panneau des étiquettes */}
          <button
            id="btn-toggle-filtre-etiquettes"
            onClick={() => setFiltreEtiquettesOuvert((v) => !v)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-rayon-petit text-xs font-medium transition-colors border ${
              filtreEtiquettesOuvert
                ? 'bg-surface text-texte border-bordure font-semibold'
                : 'bg-surface text-texte-doux hover:bg-surface-appui border-bordure'
            }`}
            title="Masquer / Afficher les types d'étiquettes"
          >
            <Tag className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Étiquettes</span>
            <span className="px-1.5 py-0.2 rounded-rayon-petit text-[10px] font-semibold bg-surface-appui text-texte-doux border border-bordure">
              {nbActives}/{totalTypes}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${filtreEtiquettesOuvert ? 'rotate-180' : ''}`} />
          </button>

          <div className="h-4 w-px bg-bordure mx-0.5" />

          <button
            id="btn-zoom-in"
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
            className="p-1 rounded-rayon-petit hover:bg-surface-appui text-texte-doux hover:text-texte transition-colors"
            title="Zoom avant"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-zoom-out"
            onClick={() => setZoom((z) => Math.max(0.7, z - 0.2))}
            className="p-1 rounded-rayon-petit hover:bg-surface-appui text-texte-doux hover:text-texte transition-colors"
            title="Zoom arrière"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            id="btn-zoom-reset"
            onClick={() => setZoom(1.0)}
            className="p-1 rounded-rayon-petit hover:bg-surface-appui text-texte-doux hover:text-texte transition-colors"
            title="Réinitialiser"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Ruban de filtrage / masquage par type d'étiquette */}
      {filtreEtiquettesOuvert && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 px-3 py-2 bg-surface-appui border-b border-bordure text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-semibold text-texte-doux mr-1">Types d'étiquettes :</span>
            {TYPES_ETIQUETTES_CONFIG.map((cfg) => {
              const estActif = visibilites[cfg.id];
              return (
                <button
                  key={cfg.id}
                  id={`chip-etiquette-${cfg.id}`}
                  onClick={() => toggleType(cfg.id)}
                  className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-rayon-petit text-[11px] font-medium transition-colors border ${
                    estActif
                      ? 'bg-surface text-texte border-bordure'
                      : 'bg-surface-appui text-texte-faible border-dashed border-bordure line-through opacity-70'
                  }`}
                  title={`${estActif ? 'Masquer' : 'Afficher'} : ${cfg.description}`}
                >
                  <span className={`w-2 h-2 rounded-full ${estActif ? cfg.dotColor : 'bg-bordure'}`} />
                  <span>{cfg.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              id="btn-masquer-toutes-etiquettes"
              onClick={toutMasquer}
              className="text-[11px] text-texte-doux hover:text-texte px-2 py-0.5 rounded-rayon-petit hover:bg-surface transition-colors"
            >
              Tout masquer
            </button>
            <span className="text-texte-faible">|</span>
            <button
              id="btn-afficher-toutes-etiquettes"
              onClick={toutAfficher}
              className="text-[11px] text-texte-doux hover:text-texte font-semibold px-2 py-0.5 rounded-rayon-petit hover:bg-surface transition-colors"
            >
              Tout afficher
            </button>
          </div>
        </div>
      )}

      {/* Surface SVG de dessin */}
      <div ref={containerRef} className="relative flex-1 overflow-auto bg-fond select-none">
        <svg
          width={dimensions.width}
          height={Math.max(dimensions.height, paddingHaut + paddingBas + zoneDessinH)}
          className="block"
        >
          <defs>
            <pattern id="hachure-remblai" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M-1,1 l2,-2 M0,10 l10,-10 M9,11 l2,-2" stroke="rgba(30,41,59,0.22)" strokeWidth="0.9" />
            </pattern>
            <pattern id="hachure-sable" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="0.75" fill="rgba(30,41,59,0.22)" />
              <circle cx="6" cy="6" r="0.75" fill="rgba(30,41,59,0.22)" />
            </pattern>
            <pattern id="hachure-argile" width="12" height="6" patternUnits="userSpaceOnUse">
              <line x1="0" y1="3" x2="6" y2="3" stroke="rgba(30,41,59,0.20)" strokeWidth="0.9" />
            </pattern>
            <pattern id="hachure-limon" width="12" height="8" patternUnits="userSpaceOnUse">
              <line x1="0" y1="2" x2="4" y2="2" stroke="rgba(30,41,59,0.20)" strokeWidth="0.9" />
              <circle cx="9" cy="6" r="0.75" fill="rgba(30,41,59,0.20)" />
            </pattern>
            <pattern id="hachure-roche" width="12" height="12" patternUnits="userSpaceOnUse">
              <path d="M2,2 L10,10 M10,2 L2,10" stroke="rgba(30,41,59,0.16)" strokeWidth="0.8" />
            </pattern>
            <marker id="arrow-v" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#1a1a1a" />
            </marker>
          </defs>

          {/* Axe altimétrique vertical à gauche */}
          <line x1="75" y1={paddingHaut} x2="75" y2={paddingHaut + zoneDessinH} stroke="#c8c6c0" strokeWidth="1.5" />

          {/* Graduations en mètres (avec masquage de l'étiquette si désactivé) */}
          {graduations.map((z) => {
            const y = getSvgY(z);
            return (
              <g key={`grad-${z}`}>
                <line x1="68" y1={y} x2="75" y2={y} stroke="#6a6862" strokeWidth="1.2" />
                <line x1="75" y1={y} x2={xSolFin} y2={y} stroke="#eceae4" strokeDasharray="3,3" strokeWidth="0.8" />
                {visibilites.graduations && (
                  <text x="63" y={y + 3.5} textAnchor="end" fontSize="10" fill="#4a4842" fontWeight="600" fontFamily="monospace">
                    {z.toFixed(1)} m
                  </text>
                )}
              </g>
            );
          })}

          {/* Couches de sol : géométrie et hachures */}
          {couches.map((c) => {
            const yToit = getSvgY(c.coteToit);
            const yBase = getSvgY(c.coteToit - c.epaisseur);
            const h = Math.max(2, yBase - yToit);

            const patternUrl =
              c.nature === 'sable'
                ? 'url(#hachure-sable)'
                : c.nature === 'argile'
                ? 'url(#hachure-argile)'
                : c.nature === 'limon'
                ? 'url(#hachure-limon)'
                : c.nature === 'roche'
                ? 'url(#hachure-roche)'
                : 'url(#hachure-remblai)';

            return (
              <g key={`couche-geom-${c.id}`}>
                {/* Rectangle de couche */}
                <rect
                  x={xSolDebut}
                  y={yToit}
                  width={largeurSol}
                  height={h}
                  fill={c.couleurAffichage || '#e7eaee'}
                  fillOpacity="0.85"
                  stroke="#6a6862"
                  strokeWidth="1"
                />

                {/* Hachure thématique */}
                <rect
                  x={xSolDebut}
                  y={yToit}
                  width={largeurSol}
                  height={h}
                  fill={patternUrl}
                />
              </g>
            );
          })}

          {/* Cotes de toit des couches à gauche (avec anti-collision) */}
          {couches.map((c) => {
            const yToit = getSvgY(c.coteToit);
            const toitResolue = toitsMap.get(c.id);
            const yBadge = toitResolue?.yCalcule ?? yToit + 3;
            const decalee = toitResolue?.decalee ?? false;

            return (
              <g key={`toit-${c.id}`}>
                {/* Trait de repère sur la ligne de toit — neutre, simple repère de cotation
                    (pas la couleur de la Nappe ELS : les deux sont des concepts distincts) */}
                <line x1={xSolDebut - 6} y1={yToit} x2={xSolDebut} y2={yToit} stroke="#9a978f" strokeWidth="1.5" />

                {visibilites.cotesToit && (
                  <g>
                    {/* Trait de rappel si l'étiquette a été décalée pour éviter un chevauchement */}
                    {decalee && (
                      <path
                        d={`M ${xSolDebut} ${yToit} L ${xSolDebut + 4} ${yBadge + 8}`}
                        fill="none"
                        stroke="#9a978f"
                        strokeWidth="1"
                        strokeDasharray="2,2"
                      />
                    )}
                    <g transform={`translate(${xSolDebut + 6}, ${yBadge})`}>
                      <rect
                        x="0"
                        y="0"
                        width={c.id.length * 6 + 64}
                        height="16"
                        rx="3"
                        fill="rgba(255, 255, 255, 0.94)"
                        stroke="#c8c6c0"
                        strokeWidth="0.8"
                      />
                      <text x="5" y="12" fill="#1a1a1a" fontSize="9" fontWeight="700" fontFamily="monospace">
                        {c.id} ({c.coteToit.toFixed(2)} m)
                      </text>
                    </g>
                  </g>
                )}
              </g>
            );
          })}

          {/* Cartouches descriptifs des couches à droite (avec anti-collision et rappel visuel) */}
          {visibilites.couches &&
            couches.map((c) => {
              const cartouche = cartouchesMap.get(c.id);
              if (!cartouche) return null;
              const yBox = cartouche.yCalcule;
              const yAnchor = cartouche.yAnchor;
              const decalee = cartouche.decalee;

              return (
                <g key={`cartouche-${c.id}`}>
                  {/* Trait de rappel vers le milieu de la couche si le cartouche est décalé */}
                  {decalee && (
                    <g>
                      <polyline
                        points={`${xSolFin - 253},${yBox + 16} ${xSolFin - 263},${yBox + 16} ${xSolFin - 275},${yAnchor}`}
                        fill="none"
                        stroke="#c8c6c0"
                        strokeWidth="1.2"
                        strokeDasharray="2,2"
                      />
                      <circle cx={xSolFin - 275} cy={yAnchor} r="2.5" fill="#6a6862" />
                    </g>
                  )}
                  <g transform={`translate(${xSolFin - 8}, ${yBox})`}>
                    <rect
                      x="-245"
                      y="0"
                      width="240"
                      height="32"
                      rx="4"
                      fill="rgba(255, 255, 255, 0.94)"
                      stroke="#c8c6c0"
                      strokeWidth="0.8"
                    />
                    <text x="-8" y="13" textAnchor="end" fill="#1a1a1a" fontSize="10.5" fontWeight="700">
                      {tronquerLabel(c.nom, 30)}
                      <title>{c.nom}</title>
                    </text>
                    <text x="-8" y="25" textAnchor="end" fill="#4a4842" fontSize="9" fontWeight="500">
                      {tronquerLabel(
                        `ép. ${c.epaisseur.toFixed(2)}m • φ'=${c.resistanceDrainee.phiPrime.v}° • c'=${c.resistanceDrainee.cPrime.v} kPa`,
                        38
                      )}
                    </text>
                  </g>
                </g>
              );
            })}

          {/* Ligne du Terrain Naturel (TN) — repère neutre, pas un verdict */}
          <line
            x1={xSolDebut}
            y1={getSvgY(coteTerrainNaturel)}
            x2={xSolFin}
            y2={getSvgY(coteTerrainNaturel)}
            stroke="#9a978f"
            strokeWidth="2.5"
          />
          {visibilites.tn && (
            <g transform={`translate(${xSolDebut + 5}, ${Math.max(paddingHaut - 10, getSvgY(coteTerrainNaturel) - 20)})`}>
              <rect
                x="0"
                y="0"
                width="142"
                height="18"
                rx="3"
                fill="rgba(255, 255, 255, 0.95)"
                stroke="#c8c6c0"
                strokeWidth="1"
              />
              <text
                x="6"
                y="13"
                fill="#4a4842"
                fontSize="10"
                fontWeight="700"
              >
                TN {coteTerrainNaturel.toFixed(2)} m NGL
              </text>
            </g>
          )}

          {/* Niveau de Nappe ELS (Caractéristique) — repère informationnel, --accent
              (précédent poinçonnement : une construction géométrique, pas un effort) */}
          {nappeELS > coteBas && (
            <g>
              <line
                x1={xSolDebut}
                y1={yELS}
                x2={xSolFin}
                y2={yELS}
                stroke="#1e5aa8"
                strokeWidth="2"
              />
              {/* Symbole triangle nappe */}
              <polygon
                points={`${xSolDebut + 22},${yELS} ${xSolDebut + 32},${yELS} ${xSolDebut + 27},${yELS + 8}`}
                fill="#1e5aa8"
              />
              {visibilites.nappes && (
                <g transform={`translate(${xBadgeELS}, ${yBadgeELS})`}>
                  <rect
                    x="0"
                    y="0"
                    width="118"
                    height="16"
                    rx="3"
                    fill="rgba(255, 255, 255, 0.94)"
                    stroke="#eaf1f9"
                    strokeWidth="0.8"
                  />
                  <text x="5" y="12" fill="#1e5aa8" fontSize="9.5" fontWeight="700">
                    Nappe ELS {nappeELS.toFixed(2)} m
                  </text>
                </g>
              )}
            </g>
          )}

          {/* Niveau de Nappe ELU (Défavorable) — c'est littéralement l'hypothèse
              défavorable retenue pour le dimensionnement : --alerte */}
          {nappeELU > coteBas && (
            <g>
              <line
                x1={xSolDebut}
                y1={yELU}
                x2={xSolFin}
                y2={yELU}
                stroke="#8a6d00"
                strokeDasharray="5,4"
                strokeWidth="1.8"
              />
              <polygon
                points={`${xSolDebut + 160},${yELU} ${xSolDebut + 170},${yELU} ${xSolDebut + 165},${yELU + 8}`}
                fill="#8a6d00"
              />
              {visibilites.nappes && (
                <g transform={`translate(${xSolDebut + 174}, ${yBadgeELU})`}>
                  <rect
                    x="0"
                    y="0"
                    width="175"
                    height="16"
                    rx="3"
                    fill="rgba(255, 255, 255, 0.94)"
                    stroke="#fdf6e3"
                    strokeWidth="0.8"
                  />
                  <text x="5" y="12" fill="#8a6d00" fontSize="9.5" fontWeight="700">
                    Nappe ELU {nappeELU.toFixed(2)} m (défav.)
                  </text>
                </g>
              )}
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
                      fill="#f2f1ec"
                      fillOpacity="0.8"
                      stroke="#c8c6c0"
                      strokeDasharray="3,3"
                      strokeWidth="1"
                    />

                    {/* Dalle radier en béton */}
                    <rect
                      x={xDebut}
                      y={yHaut}
                      width={pixLargeur}
                      height={pixEpaisseur}
                      fill="#e7eaee"
                      stroke="#4a4842"
                      strokeWidth="1.8"
                    />

                    {/* Ligne d'assise */}
                    <line x1={xDebut} y1={yBase} x2={xDebut + pixLargeur} y2={yBase} stroke="#1a1a1a" strokeWidth="2.5" />

                    {/* Flèche de charge verticale V */}
                    <line
                      x1={xCentreOuvrage}
                      y1={Math.max(paddingHaut + 15, yHaut - 35)}
                      x2={xCentreOuvrage}
                      y2={yHaut}
                      stroke="#1a1a1a"
                      strokeWidth="3"
                      markerEnd="url(#arrow-v)"
                    />

                    {visibilites.ouvrage && (
                      <g transform={`translate(${xCentreOuvrage - 60}, ${Math.max(paddingHaut + 2, yHaut - 52)})`}>
                        <rect
                          x="0"
                          y="0"
                          width="120"
                          height="16"
                          rx="3"
                          fill="rgba(255, 255, 255, 0.94)"
                          stroke="#c8c6c0"
                          strokeWidth="0.8"
                        />
                        <text
                          x="60"
                          y="12"
                          textAnchor="middle"
                          fill="#1a1a1a"
                          fontSize="10"
                          fontWeight="700"
                        >
                          V_Ed = {(radier.actions.V_G * 1.35 + radier.actions.V_Q * 1.5).toFixed(0)} kN
                        </text>
                      </g>
                    )}

                    {/* Cote sous semelle */}
                    {visibilites.ouvrage && (
                      <g transform={`translate(${xDebut + pixLargeur + 8}, ${yBase - 8})`}>
                        <rect
                          x="0"
                          y="0"
                          width="160"
                          height="16"
                          rx="3"
                          fill="rgba(255, 255, 255, 0.94)"
                          stroke="#c8c6c0"
                          strokeWidth="0.8"
                        />
                        <text
                          x="5"
                          y="12"
                          fill="#1a1a1a"
                          fontSize="9.5"
                          fontWeight="700"
                        >
                          Assise {radier.coteBase.toFixed(2)} m (B={radier.largeurB}m)
                        </text>
                      </g>
                    )}
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
                    {/* Fût du pieu — béton */}
                    <rect
                      x={xPieu - pixDiam / 2}
                      y={yTete}
                      width={pixDiam}
                      height={yPointe - yTete}
                      fill="#e7eaee"
                      stroke="#4a4842"
                      strokeWidth="1.5"
                    />

                    {/* Pointe biseautée */}
                    <polygon
                      points={`${xPieu - pixDiam / 2},${yPointe} ${xPieu + pixDiam / 2},${yPointe} ${xPieu},${yPointe + 10}`}
                      fill="#e7eaee"
                      stroke="#4a4842"
                      strokeWidth="1.5"
                    />

                    {/* Si plan neutre frottement négatif — action permanente défavorable réelle,
                        --alerte (même traitement que dans OngletPieux) */}
                    {pieu.frottementNegatif.actif && (
                      <g>
                        <line
                          x1={xPieu - pixDiam / 2 - 15}
                          y1={getSvgY(pieu.frottementNegatif.cotePlanNeutre)}
                          x2={xPieu + pixDiam / 2 + 15}
                          y2={getSvgY(pieu.frottementNegatif.cotePlanNeutre)}
                          stroke="#8a6d00"
                          strokeDasharray="3,3"
                          strokeWidth="2"
                        />
                      </g>
                    )}

                    {/* Cotes tête, plan neutre et pointe (avec moteur anti-collision) */}
                    {visibilites.ouvrage && (() => {
                      const boitesPieu: BoiteEtiquette1D[] = [
                        {
                          id: 'tete',
                          yIdeal: yTete - 8,
                          hauteur: 16,
                          yAnchor: yTete,
                          donnees: {
                            label: `Tête ${pieu.coteTete.toFixed(2)} m`,
                            width: 95,
                            color: '#1a1a1a',
                            borderColor: '#c8c6c0',
                          },
                        },
                        ...(pieu.frottementNegatif.actif
                          ? [
                              {
                                id: 'planNeutre',
                                yIdeal: getSvgY(pieu.frottementNegatif.cotePlanNeutre) - 8,
                                hauteur: 16,
                                yAnchor: getSvgY(pieu.frottementNegatif.cotePlanNeutre),
                                donnees: {
                                  label: `Plan neutre (${pieu.frottementNegatif.cotePlanNeutre.toFixed(1)}m)`,
                                  width: 132,
                                  color: '#8a6d00',
                                  borderColor: '#fdf6e3',
                                },
                              },
                            ]
                          : []),
                        {
                          id: 'pointe',
                          yIdeal: yPointe - 8,
                          hauteur: 16,
                          yAnchor: yPointe,
                          donnees: {
                            label: `Pointe ${pieu.cotePointe.toFixed(2)} m (Ø ${pieu.diametre}m)`,
                            width: 155,
                            color: '#1a1a1a',
                            borderColor: '#c8c6c0',
                          },
                        },
                      ];

                      const resolues = resoudreAntiCollision1D(
                        boitesPieu,
                        paddingHaut + 2,
                        paddingHaut + zoneDessinH - 20,
                        5
                      );

                      return resolues.map((lbl) => {
                        const xBase = xPieu + pixDiam / 2 + 8;
                        return (
                          <g key={lbl.id}>
                            {lbl.decalee && (
                              <line
                                x1={xPieu + pixDiam / 2}
                                y1={lbl.yAnchor}
                                x2={xBase}
                                y2={lbl.yCalcule + 8}
                                stroke="#c8c6c0"
                                strokeWidth="1"
                                strokeDasharray="2,2"
                              />
                            )}
                            <g transform={`translate(${xBase}, ${lbl.yCalcule})`}>
                              <rect
                                x="0"
                                y="0"
                                width={lbl.donnees.width}
                                height="16"
                                rx="3"
                                fill="rgba(255, 255, 255, 0.94)"
                                stroke={lbl.donnees.borderColor}
                                strokeWidth="0.8"
                              />
                              <text
                                x="5"
                                y="12"
                                fill={lbl.donnees.color}
                                fontSize="9.5"
                                fontWeight="700"
                              >
                                {lbl.donnees.label}
                              </text>
                            </g>
                          </g>
                        );
                      });
                    })()}
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
                      fill="#f2f1ec"
                      fillOpacity="0.9"
                      stroke="#c8c6c0"
                      strokeDasharray="3,3"
                      strokeWidth="1"
                    />

                    {/* Voile vertical du mur en L — béton */}
                    <rect
                      x={xVoile}
                      y={yTete}
                      width={pixEVoile}
                      height={pixH}
                      fill="#e7eaee"
                      stroke="#4a4842"
                      strokeWidth="1.5"
                    />

                    {/* Semelle horizontale du mur en L — béton */}
                    <rect
                      x={xVoile - 15}
                      y={yBase - 15}
                      width={pixB}
                      height={18}
                      fill="#e7eaee"
                      stroke="#4a4842"
                      strokeWidth="1.5"
                    />

                    {/* Ligne fond de fouille aval — repère neutre (pas la Nappe ELS) */}
                    <line x1={xSolDebut} y1={yFond} x2={xVoile} y2={yFond} stroke="#9a978f" strokeWidth="2" />
                    {visibilites.ouvrage && (
                      <g transform={`translate(${xSolDebut + 8}, ${yFond - 20})`}>
                        <rect
                          x="0"
                          y="0"
                          width="142"
                          height="16"
                          rx="3"
                          fill="rgba(255, 255, 255, 0.94)"
                          stroke="#c8c6c0"
                          strokeWidth="0.8"
                        />
                        <text x="5" y="12" fill="#4a4842" fontSize="9.5" fontWeight="700">
                          Fond de fouille {mur.coteFondFouille.toFixed(2)} m
                        </text>
                      </g>
                    )}

                    {/* Flèche de poussée active sur le voile — --traction (action déstabilisante,
                        même axe sémantique que la suite STM : "la traction est rouge-terre") */}
                    <polygon
                      points={`${xVoile + pixEVoile + 25},${yTete + pixH * 0.6} ${xVoile + pixEVoile + 5},${yTete + pixH * 0.6} ${xVoile + pixEVoile + 10},${yTete + pixH * 0.6 - 4} ${xVoile + pixEVoile + 10},${yTete + pixH * 0.6 + 4}`}
                      fill="#a8442a"
                    />
                    {visibilites.ouvrage && (
                      <g transform={`translate(${xVoile + pixEVoile + 28}, ${yTete + pixH * 0.6 - 8})`}>
                        <rect
                          x="0"
                          y="0"
                          width="76"
                          height="16"
                          rx="3"
                          fill="rgba(255, 255, 255, 0.94)"
                          stroke="#a8442a"
                          strokeWidth="0.8"
                        />
                        <text
                          x="5"
                          y="12"
                          fill="#a8442a"
                          fontSize="9.5"
                          fontWeight="700"
                        >
                          Poussée Pa
                        </text>
                      </g>
                    )}
                  </g>
                );
              })()}
            </g>
          )}
        </svg>
      </div>

      {/* Légende en pied de coupe */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3.5 py-2.5 bg-surface-appui border-t border-bordure text-[11px] text-texte-doux">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-1 bg-neutre rounded-full inline-block"></span>
          <span className="font-medium text-texte-doux">Terrain Naturel (TN)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-1 bg-accent rounded-full inline-block"></span>
          <span className="font-medium text-texte-doux">Nappe ELS</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-1 bg-alerte rounded-full border-b border-dashed border-alerte inline-block"></span>
          <span className="font-medium text-texte-doux">Nappe ELU défavorable</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-2.5 bg-beton border border-bordure rounded-xs inline-block"></span>
          <span className="font-medium text-texte-doux">Béton armé</span>
        </div>
      </div>
    </div>
  );
};
