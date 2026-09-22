import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Conteneur de base de la suite Aedificium : `--surface` + filet `--bordure` 1px, un seul
 * niveau de séparation (jamais d'ombre portée, jamais de second gris). Voir DESIGN.md.
 */
export const Card: React.FC<CardProps> = ({ children, className = '' }) => (
  <div className={`bg-surface border border-bordure rounded-rayon p-4 ${className}`}>
    {children}
  </div>
);
