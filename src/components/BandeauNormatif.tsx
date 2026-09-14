import React from 'react';
import { BANDEAU_NORMATIF_OBLIGATOIRE } from '../norme/metadataNorme';
import { AlertTriangle } from 'lucide-react';

export const BandeauNormatif: React.FC = () => {
  return (
    <div
      id="bandeau-normatif-permanent"
      className="bg-amber-50 border-b border-amber-300 px-4 py-2.5 text-xs text-amber-950 flex items-start gap-2.5 shadow-xs select-none"
    >
      <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
      <div className="leading-relaxed font-medium">
        <span className="font-bold uppercase tracking-wider text-amber-900 mr-1.5">[Avertissement Normatif]</span>
        {BANDEAU_NORMATIF_OBLIGATOIRE}
      </div>
    </div>
  );
};
