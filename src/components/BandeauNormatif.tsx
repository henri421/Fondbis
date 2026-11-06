import React from 'react';
import { BANDEAU_NORMATIF_OBLIGATOIRE } from '../norme/metadataNorme';
import { AlertTriangle } from 'lucide-react';

export const BandeauNormatif: React.FC = () => {
  return (
    <div
      id="bandeau-normatif-permanent"
      className="bg-alerte-fond border-b border-bordure px-4 py-2.5 text-xs text-alerte flex items-start gap-2.5 select-none"
    >
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="leading-relaxed">
        <span className="font-semibold uppercase tracking-wider mr-1.5">[Avertissement Normatif]</span>
        {BANDEAU_NORMATIF_OBLIGATOIRE}
        <p id="bandeau-non-audite" className="mt-1">
          <span className="font-semibold mr-1.5">Outil non audité.</span>
          Deux erreurs connues dans la portance des semelles : un sol grenu (c<sub>u</sub> = 0) est
          faussement refusé, car le calcul non drainé devient gouvernant ; le glissement part d'un
          effort vertical défavorable (1,35 G + 1,5 Q) au lieu de favorable, du côté de l'insécurité.
          La DA1 n'y calcule que la combinaison 1. Pour les semelles, utiliser l'outil{' '}
          <a
            className="underline font-semibold"
            href="https://henri421.github.io/fondations-superficielles/"
            target="_blank"
            rel="noopener"
          >
            Fondations superficielles
          </a>
          .
        </p>
      </div>
    </div>
  );
};
