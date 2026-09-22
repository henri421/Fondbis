import React from 'react';

interface ChampProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

/**
 * Label + champ de saisie de la suite Aedificium : les nombres s'alignent à droite en
 * `--mono` tabulaire, le champ reste blanc au repos (`--accent-doux` seulement pendant la
 * saisie active, cf. règle DESIGN.md — pas géré ici par manque de cas d'usage pour l'instant).
 */
export const Champ: React.FC<ChampProps> = ({ label, className = '', type, ...props }) => {
  const estNombre = type === 'number' || type === undefined;
  return (
    <div>
      <label className="block text-texte-faible text-[11px] uppercase tracking-wide mb-1">
        {label}
      </label>
      <input
        type={type ?? 'text'}
        className={`w-full px-2.5 py-1.5 bg-surface border border-bordure rounded-rayon-petit text-texte focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-1 ${
          estNombre ? 'font-mono text-right tabular-nums' : ''
        } ${className}`}
        {...props}
      />
    </div>
  );
};
