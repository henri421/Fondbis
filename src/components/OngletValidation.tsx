import React, { useState } from 'react';
import { executerTestsAcceptation, TestResultatIndividuel } from '../validation/acceptanceTests';
import { executerTestsAcceptationSolveur } from '../validation/acceptanceTestsSolveur';
import { executerTestsAcceptationSoutenement } from '../validation/acceptanceTestsSoutenement';
import { Play, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

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
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              Banc de Recette & Tests d'Acceptation Normatifs
            </h3>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                toutEstVert ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
              }`}
            >
              {nbReussis} / {nbTotal} réussis ({Math.round((nbReussis / Math.max(1, nbTotal)) * 100)}%)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Validation mathématique indépendante des formules de l'Eurocode 7 (EN 1997-1:2004 Annexes A, D, F).
          </p>
        </div>

        <button
          id="btn-lancer-tests"
          onClick={lancerTests}
          disabled={enCours}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs transition disabled:opacity-50"
        >
          {enCours ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          Relancer la suite de recette
        </button>
      </div>

      {/* Grille des résultats par test */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resultats.map((t) => (
          <div
            key={t.id}
            id={`card-test-${t.id}`}
            className={`p-4 rounded-xl border transition shadow-xs ${
              t.succes
                ? 'bg-emerald-50/30 border-emerald-200 hover:border-emerald-300'
                : 'bg-rose-50/40 border-rose-300 hover:border-rose-400'
            }`}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-800">
                  {t.id}
                </span>
                <span className="text-xs font-bold text-slate-900">{t.nom}</span>
              </div>
              {t.succes ? (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" /> SUCCÈS
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full shrink-0">
                  <XCircle className="w-3.5 h-3.5" /> ÉCHEC
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 mb-3">{t.description}</p>

            <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-xs font-mono space-y-1">
              <div className="flex justify-between text-slate-500">
                <span>Valeur calculée (moteur) :</span>
                <span className="font-bold text-slate-900">{t.valeurObtenue}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Valeur attendue (référence) :</span>
                <span className="font-bold text-emerald-700">{t.valeurAttendue}</span>
              </div>
              <div className="flex justify-between text-slate-500 border-t border-slate-100 pt-1">
                <span>Tolérance admise :</span>
                <span>{t.tolerance}</span>
              </div>
            </div>

            <div className="mt-2 text-[11px] text-slate-400 font-medium flex justify-between">
              <span>Phase : {t.phase}</span>
              <span className="text-slate-500">{t.message}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
