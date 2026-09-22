import React, { useState } from 'react';
import { executerTestsAcceptation, TestResultatIndividuel } from '../validation/acceptanceTests';
import { executerTestsAcceptationSolveur } from '../validation/acceptanceTestsSolveur';
import { executerTestsAcceptationSoutenement } from '../validation/acceptanceTestsSoutenement';
import { Play, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Card } from './ui/Card';
import { Verdict } from './ui/Verdict';
import { Bouton } from './ui/Bouton';

export const OngletValidation: React.FC = () => {
  const [resultats, setResultats] = useState<TestResultatIndividuel[]>(() => [
    ...executerTestsAcceptation(),
    ...executerTestsAcceptationSolveur(),
    ...executerTestsAcceptationSoutenement(),
  ]);
  const [enCours, setEnCours] = useState(false);

  const lancerTests = () => {
    setEnCours(true);
    setTimeout(() => {
      const res = [
        ...executerTestsAcceptation(),
        ...executerTestsAcceptationSolveur(),
        ...executerTestsAcceptationSoutenement(),
      ];
      setResultats(res);
      setEnCours(false);
    }, 150);
  };

  const nbReussis = resultats.filter((r) => r.succes).length;
  const nbTotal = resultats.length;
  const toutEstVert = nbReussis === nbTotal;

  return (
    <div className="space-y-5">
      {/* Entête d'exécution des tests */}
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-texte">
              Banc de Recette & Tests d'Acceptation Normatifs
            </h3>
            <span
              className={`px-2 py-0.5 rounded-rayon-petit text-xs font-semibold ${
                toutEstVert ? 'bg-ok-fond text-ok' : 'bg-refus-fond text-refus'
              }`}
            >
              {nbReussis} / {nbTotal} réussis ({Math.round((nbReussis / Math.max(1, nbTotal)) * 100)}%)
            </span>
          </div>
          <p className="text-xs text-texte-doux mt-1">
            Validation mathématique indépendante des formules de l'Eurocode 7 (EN 1997-1:2004 Annexes A, D, F).
          </p>
        </div>

        <Bouton id="btn-lancer-tests" onClick={lancerTests} disabled={enCours}>
          {enCours ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Relancer la suite de recette
        </Bouton>
      </Card>

      {/* Grille des résultats par test */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resultats.map((t) => (
          <Verdict key={t.id} etat={t.succes ? 'ok' : 'refus'} className="p-4">
            <div id={`card-test-${t.id}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-rayon-petit bg-surface-appui text-texte-doux">
                    {t.id}
                  </span>
                  <span className="text-xs font-semibold text-texte">{t.nom}</span>
                </div>
                {t.succes ? (
                  <span className="flex items-center gap-1 text-[11px] font-semibold shrink-0">
                    <CheckCircle2 className="w-3.5 h-3.5" /> SUCCÈS
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-[11px] font-semibold shrink-0">
                    <XCircle className="w-3.5 h-3.5" /> ÉCHEC
                  </span>
                )}
              </div>

              <p className="text-xs text-texte-doux mb-3 font-normal">{t.description}</p>

              <div className="p-2.5 bg-surface rounded-rayon-petit border border-bordure text-xs font-mono space-y-1 font-normal">
                <div className="flex justify-between text-texte-doux">
                  <span>Valeur calculée (moteur) :</span>
                  <span className="font-semibold text-texte">{t.valeurObtenue}</span>
                </div>
                <div className="flex justify-between text-texte-doux">
                  <span>Valeur attendue (référence) :</span>
                  <span className="font-semibold">{t.valeurAttendue}</span>
                </div>
                <div className="flex justify-between text-texte-doux border-t border-bordure-douce pt-1">
                  <span>Tolérance admise :</span>
                  <span>{t.tolerance}</span>
                </div>
              </div>

              <div className="mt-2 text-[11px] text-texte-faible font-normal flex justify-between">
                <span>Phase : {t.phase}</span>
                <span>{t.message}</span>
              </div>
            </div>
          </Verdict>
        ))}
      </div>
    </div>
  );
};
