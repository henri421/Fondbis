import React from 'react';

interface BoutonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

/**
 * Bouton unique niveau de la suite Aedificium : pas d'« action principale » colorée — le
 * résultat se recalcule en continu, il n'y a rien à valider par un clic important.
 * Voir DESIGN.md.
 */
export const Bouton: React.FC<BoutonProps> = ({ children, className = '', ...props }) => (
  <button
    type="button"
    className={`flex items-center gap-2 px-3 py-1.5 bg-surface-appui hover:bg-[#e8e7e1] border border-bordure rounded-rayon-petit text-xs font-semibold text-texte disabled:opacity-50 transition-colors ${className}`}
    {...props}
  >
    {children}
  </button>
);
