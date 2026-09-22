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
      </div>
    </div>
  );
};
