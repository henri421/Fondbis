import React from 'react';
import { CoucheGeotechnique, SurchargeTalus } from '../../types/geotech';
import { CercleRupture, ResultatCercleBishop, ZoneMateriau, RenforcementHorizontal } from '../../briques/stabiliteGenerale';

type Valide = Extract<ResultatCercleBishop, { valide: true }>;

interface CoupeTalusProps {
  profil: Array<{ x: number; y: number }>;
  couches: CoucheGeotechnique[];
  coteNappe: number;
  surcharges: SurchargeTalus[];
  cercle: CercleRupture;
  resultat: Valide | null;
  zones?: ZoneMateriau[];
  renforcements?: RenforcementHorizontal[];
  /** Polylignes supplémentaires (ex. ligne des tractions maximales), coordonnées du projet. */
  traces?: Array<{ points: Array<{ x: number; y: number }>; couleur: string; tirets?: boolean }>;
}

/**
 * Coupe du talus à l'échelle (même échelle en x et en y) : couches, nappe, profil, surcharges,
 * cercle analysé avec ses tranches et sa surface de rupture.
 */
export const CoupeTalus: React.FC<CoupeTalusProps> = ({
  profil,
  couches,
  coteNappe,
  surcharges,
  cercle,
  resultat,
  zones = [],
  renforcements = [],
  traces = [],
}) => {
  const xs = profil.map((p) => p.x);
  const ys = profil.map((p) => p.y);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yHaut = Math.max(...ys);
  const yBasProfil = Math.min(...ys);
  const H = Math.max(yHaut - yBasProfil, (xMax - xMin) / 8, 1);
  const yBasArc = resultat ? Math.min(...resultat.tranches.map((t) => t.yBase)) : cercle.centreY - cercle.rayon;
  const yMin = Math.min(yBasProfil - 0.4 * H, yBasArc - 0.15 * H);
  const yMax = Math.max(yHaut + 0.35 * H, Math.min(cercle.centreY + 0.1 * H, yHaut + 3 * H));

  const largeur = 900;
  const marge = { g: 46, d: 12, h: 12, b: 22 };
  const echelle = (largeur - marge.g - marge.d) / (xMax - xMin);
  const hauteur = Math.min(520, Math.max(180, (yMax - yMin) * echelle + marge.h + marge.b));
  // Si la hauteur est plafonnée, on garde la même échelle et on recadre sur le bas
  const yHautVue = yMin + (hauteur - marge.h - marge.b) / echelle;
  const X = (x: number) => marge.g + (x - xMin) * echelle;
  const Y = (y: number) => marge.h + (yHautVue - y) * echelle;

  const sol = `M ${X(xMin)} ${Y(yMin)} ` + profil.map((p) => `L ${X(p.x)} ${Y(p.y)}`).join(' ') + ` L ${X(xMax)} ${Y(yMin)} Z`;
  const pasGraduation = [1, 2, 5, 10, 20, 50].find((p) => (yHautVue - yMin) / p <= 8) ?? 100;
  const graduations: number[] = [];
  for (let y = Math.ceil(yMin / pasGraduation) * pasGraduation; y <= yHautVue; y += pasGraduation) graduations.push(y);

  const hautSurcharge = 0.12 * H;
  const idClip = 'clip-sol-talus';

  return (
    <svg viewBox={`0 0 ${largeur} ${hauteur}`} className="w-full h-auto select-none font-sans" role="img" aria-label="Coupe du talus et cercle de rupture">
      <defs>
        <clipPath id={idClip}>
          <path d={sol} />
        </clipPath>
        <pattern id="hachures-zone" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--texte-faible)" strokeWidth="0.8" />
        </pattern>
      </defs>

      {/* Couches, découpées par le terrain */}
      <g clipPath={`url(#${idClip})`}>
        {couches.map((c) => {
          const haut = Math.min(c.coteToit, yHautVue);
          const bas = Math.max(c.coteToit - c.epaisseur, yMin);
          if (haut <= bas) return null;
          return (
            <rect key={c.id} x={X(xMin)} y={Y(haut)} width={X(xMax) - X(xMin)} height={Y(bas) - Y(haut)}
              fill={c.couleurAffichage} fillOpacity={0.45} stroke="var(--bordure)" strokeWidth={0.5} />
          );
        })}
        {zones.map((z, i) => (
          <rect key={i} x={X(z.xMin)} y={Y(z.yMax)} width={X(z.xMax) - X(z.xMin)} height={Y(z.yMin) - Y(z.yMax)}
            fill="url(#hachures-zone)" stroke="var(--texte-doux)" strokeWidth={1} />
        ))}
        {coteNappe > yMin && coteNappe < yHautVue && (
          <rect x={X(xMin)} y={Y(coteNappe)} width={X(xMax) - X(xMin)} height={Y(yMin) - Y(coteNappe)} fill="var(--accent)" fillOpacity={0.07} />
        )}
      </g>

      {/* Graduations des cotes */}
      {graduations.map((y) => (
        <g key={y}>
          <line x1={marge.g - 4} x2={marge.g} y1={Y(y)} y2={Y(y)} stroke="var(--texte-faible)" />
          <text x={marge.g - 6} y={Y(y) + 3} textAnchor="end" fontSize={10} fill="var(--texte-faible)" className="tabular-nums">{y}</text>
        </g>
      ))}

      {/* Nappe */}
      {coteNappe > yMin && coteNappe < yHautVue && (
        <g>
          <line x1={X(xMin)} x2={X(xMax)} y1={Y(coteNappe)} y2={Y(coteNappe)} stroke="var(--accent)" strokeDasharray="6 4" strokeWidth={1} />
          <text x={X(xMax) - 4} y={Y(coteNappe) - 4} textAnchor="end" fontSize={10} fill="var(--accent)">nappe {coteNappe.toFixed(2)}</text>
        </g>
      )}

      {/* Profil */}
      <polyline points={profil.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')} fill="none" stroke="var(--texte)" strokeWidth={1.6} />

      {/* Renforcements */}
      {renforcements.map((r, i) => (
        <line key={i} x1={X(r.xDebut)} x2={X(r.xFin)} y1={Y(r.y)} y2={Y(r.y)} stroke="var(--traction)" strokeWidth={1.4} />
      ))}

      {/* Tranches et surface de rupture */}
      {resultat && (
        <g>
          {resultat.tranches.map((t) => (
            <line key={t.index} x1={X(t.x - t.largeur / 2)} x2={X(t.x - t.largeur / 2)} y1={Y(t.ySol)} y2={Y(t.yBase)}
              stroke="var(--traction)" strokeOpacity={0.35} strokeWidth={0.6} />
          ))}
          <polyline
            points={resultat.tranches.map((t) => `${X(t.x)},${Y(t.yBase)}`).join(' ')}
            fill="none" stroke="var(--traction)" strokeWidth={2}
          />
        </g>
      )}
      <circle cx={X(cercle.centreX)} cy={Y(cercle.centreY)} r={cercle.rayon * echelle} fill="none" stroke="var(--traction)" strokeOpacity={0.3} strokeDasharray="3 4" />
      {Y(cercle.centreY) > 0 && (
        <g>
          <circle cx={X(cercle.centreX)} cy={Y(cercle.centreY)} r={3} fill="var(--traction)" />
          <text x={X(cercle.centreX) + 6} y={Y(cercle.centreY) - 4} fontSize={10} fill="var(--traction)">
            O ({cercle.centreX.toFixed(1)} ; {cercle.centreY.toFixed(1)}) R = {cercle.rayon.toFixed(1)}
            {resultat ? ` — F = ${resultat.F.toFixed(3)}` : ' — cercle invalide'}
          </text>
        </g>
      )}

      {/* Traces supplémentaires */}
      {traces.map((t, i) => (
        <polyline key={i} points={t.points.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')} fill="none" stroke={t.couleur}
          strokeWidth={1.4} strokeDasharray={t.tirets ? '5 3' : undefined} />
      ))}

      {/* Surcharges */}
      {surcharges.map((s) => {
        const a = Math.max(xMin, Math.min(s.xDebut, s.xFin));
        const b = Math.min(xMax, Math.max(s.xDebut, s.xFin));
        if (b <= a) return null;
        const yS = Math.max(...profil.filter((p) => p.x >= a && p.x <= b).map((p) => p.y), ...[a, b].map((x) => {
          for (let k = 0; k < profil.length - 1; k++) {
            const p = profil[k];
            const q = profil[k + 1];
            if (x >= p.x && x <= q.x) return q.x === p.x ? Math.max(p.y, q.y) : p.y + ((x - p.x) / (q.x - p.x)) * (q.y - p.y);
          }
          return profil[profil.length - 1].y;
        }));
        const couleur = s.nature === 'G' ? 'var(--compression)' : 'var(--alerte)';
        const nbFleches = Math.max(2, Math.round((b - a) / (0.06 * (xMax - xMin))));
        return (
          <g key={s.id}>
            <rect x={X(a)} y={Y(yS + hautSurcharge)} width={X(b) - X(a)} height={hautSurcharge * echelle * 0.25} fill={couleur} fillOpacity={0.25} stroke={couleur} strokeWidth={0.8} />
            {Array.from({ length: nbFleches + 1 }, (_, k) => {
              const x = X(a + ((b - a) * k) / nbFleches);
              return <line key={k} x1={x} x2={x} y1={Y(yS + hautSurcharge * 0.75)} y2={Y(yS) - 2} stroke={couleur} strokeWidth={0.8} />;
            })}
            <text x={(X(a) + X(b)) / 2} y={Y(yS + hautSurcharge) - 3} textAnchor="middle" fontSize={10} fill={couleur}>
              {s.nom} : {s.nature} = {s.q} kPa
            </text>
          </g>
        );
      })}
    </svg>
  );
};
