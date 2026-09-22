import React from 'react';

export type EtatVerdict = 'ok' | 'alerte' | 'refus';

interface VerdictProps {
  etat: EtatVerdict;
  children: React.ReactNode;
  className?: string;
}

const STYLES: Record<EtatVerdict, string> = {
  ok: 'bg-ok-fond text-ok border-l-ok',
  alerte: 'bg-alerte-fond text-alerte border-l-alerte',
  refus: 'bg-refus-fond text-refus border-l-refus',
};

/**
 * Forme unique des 3 verdicts de la suite Aedificium : liséré gauche 3px, fond `*-fond`,
 * texte en couleur pleine, poids 600. Remplace les dizaines de variantes
 * `bg-emerald-50/70 border-emerald-200...` recopiées à la main dans chaque onglet.
 * Voir DESIGN.md. L'état "attente" (pas encore de saisie) n'est PAS un verdict — ne pas
 * détourner ce composant pour ça (bloc gris `bg-surface-appui`, sans liséré, cf. DESIGN.md).
 */
export const Verdict: React.FC<VerdictProps> = ({ etat, children, className = '' }) => (
  <div className={`rounded-rayon border-l-[3px] p-3 font-semibold ${STYLES[etat]} ${className}`}>
    {children}
  </div>
);
