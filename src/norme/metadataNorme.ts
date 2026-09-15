/**
 * Métadonnées normatives EN 1997-1:2004
 * Clause references et statuts (Normatif, Informatif, NDP)
 */

export interface ClauseReference {
  code: string;
  clause: string;
  titre: string;
  statut: 'Normative' | 'Informative' | 'NDP (Paramètre Déterminé Nationalement)';
  description: string;
}

export const CLAUSES_EC7: Record<string, ClauseReference> = {
  portance_superficielle: {
    code: 'portance_superficielle',
    clause: 'EN 1997-1:2004 Annexe D',
    titre: 'Portance des fondations superficielles',
    statut: 'Informative',
    description: 'Formule semi-empirique de portance drainée et non drainée avec facteurs de forme, inclinaison et profondeur.',
  },
  glissement_superficielle: {
    code: 'glissement_superficielle',
    clause: 'EN 1997-1:2004 Clause 6.5.3',
    titre: 'Résistance au glissement',
    statut: 'Normative',
    description: 'Vérification de la composante horizontale limite V_d * tan(delta_d) ou A_c * cu_d <= 0.4 V_d.',
  },
  tassement_superficielle: {
    code: 'tassement_superficielle',
    clause: 'EN 1997-1:2004 Annexe F',
    titre: 'Évaluation du tassement des fondations',
    statut: 'Informative',
    description: 'Calcul élastique et œdométrique par intégration des surcontraintes de Boussinesq/Steinbrenner.',
  },
  coefficients_poussee_butee: {
    code: 'coefficients_poussee_butee',
    clause: 'EN 1997-1:2004 Annexe C',
    titre: 'Coefficients de poussée et de butée des terres',
    statut: 'Informative',
    description: 'Formulations de Rankine, Coulomb et tables pour écran vertical ou incliné.',
  },
  facteurs_partiels_a: {
    code: 'facteurs_partiels_a',
    clause: 'EN 1997-1:2004 Annexe A (Tableaux A.3 à A.8)',
    titre: 'Jeux de facteurs partiels (A, M, R)',
    statut: 'NDP (Paramètre Déterminé Nationalement)',
    description: 'Facteurs de sécurité sur actions, paramètres de sol et résistances selon les approches DA1, DA2, DA3.',
  },
  correlation_pieux: {
    code: 'correlation_pieux',
    clause: 'EN 1997-1:2004 Clause 7.6.2.3 & Tableaux A.9 à A.11',
    titre: 'Facteurs de corrélation xi pour pieux',
    statut: 'NDP (Paramètre Déterminé Nationalement)',
    description: 'Facteurs xi3 et xi4 décroissant avec le nombre de profils de reconnaissance n.',
  },
  upl_hyd: {
    code: 'upl_hyd',
    clause: 'EN 1997-1:2004 Section 10',
    titre: 'États limites hydrauliques UPL et HYD',
    statut: 'Normative',
    description: 'Soulèvement global par sous-pression (UPL) et soulèvement hydraulique / renard (HYD).',
  },
  stabilite_generale: {
    code: 'stabilite_generale',
    clause: 'EN 1997-1:2004 Section 11',
    titre: 'Stabilité générale et des pentes',
    statut: 'Normative',
    description: 'Vérification de rupture globale selon la méthode des tranches de Bishop simplifiée.',
  },
  interaction_sol_structure: {
    code: 'interaction_sol_structure',
    clause: 'CDC §9.3 (brique commune) — EN 1997-1:2004 Section 9 pour le contexte de vérification',
    titre: 'Interaction sol-structure par éléments finis et appuis élastoplastiques',
    statut: 'Informative',
    description: 'Méthode numérique (poutre sur appuis élastoplastiques, coefficient de réaction) non prescrite par une clause EC7 spécifique : outil de calcul au service des vérifications normatives de la section 9 (ouvrages de soutènement), pas lui-même une clause citable.',
  },
  effet_transversal_pieu: {
    code: 'effet_transversal_pieu',
    clause: 'EN 1997-1:2004 Clause 7.7',
    titre: 'Chargement transversal des pieux',
    statut: 'Normative',
    description: 'Modélisation par poutre sur appuis élastoplastiques non linéaires (courbes de réaction p-y de Matlock, Reese ou approche pressiométrique).',
  },
};

export const BANDEAU_NORMATIF_OBLIGATOIRE = 
  "Jeu de facteurs partiels : valeurs recommandées EN 1997-1:2004 annexe A. Aucune annexe nationale chargée. Ces valeurs sont des paramètres déterminés au niveau national et peuvent être modifiées par l'annexe nationale applicable au projet. Vérification à la charge de l'ingénieur.";
