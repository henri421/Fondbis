import React, { useState, useMemo } from 'react';
import { ModeleTerrain } from '../types/geotech';
import { calculerStabiliteBishop, rechercherCercleCritique } from '../briques/stabiliteGenerale';
import { analyserSensibiliteStabiliteCercle } from '../core/sensibilite';
import { ShieldCheck, ShieldAlert, Sliders, Search, Activity } from 'lucide-react';

interface OngletStabiliteProps {
  modele: ModeleTerrain;
}

export const OngletStabilite: React.FC<OngletStabiliteProps> = ({ modele }) => {
  const [centreX, setCentreX] = useState<number>(10.0);
  const [centreY, setCentreY] = useState<number>(modele.referentiel.coteTerrainNaturel + 8.0);
  const [rayon, setRayon] = useState<number>(12.0);
  const [nbTranches, setNbTranches] = useState<number>(20);
  const [rechercheEnCours, setRechercheEnCours] = useState<boolean>(false);

  // Profil du terrain : profil réel de ModeleTerrain si présent, sinon profil standard de talus
  const profilEffectif = useMemo(() => {
    if (modele.profilTerrainNaturel && modele.profilTerrainNaturel.length >= 2) {
      return modele.profilTerrainNaturel;
    }
    const ctn = modele.referentiel.coteTerrainNaturel;
    return [
      { x: -10, y: ctn },
      { x: 5, y: ctn },
      { x: 15, y: ctn - 4 },
      { x: 35, y: ctn - 4 },
    ];
  }, [modele.profilTerrainNaturel, modele.referentiel.coteTerrainNaturel]);

  // Calcul du facteur de Bishop
  const resBishop = useMemo(() => {
    return calculerStabiliteBishop({
      cercle: { centreX, centreY, rayon },
      coteTerrainNaturel: modele.referentiel.coteTerrainNaturel,
      profilTN: profilEffectif,
      couches: modele.couches,
      hydrogeologie: modele.hydrogeologie,
      facteursSecurite: {
        gamma_phi: modele.configurationNormative.facteursPartielsSol.M1.gamma_phi,
        gamma_c: modele.configurationNormative.facteursPartielsSol.M1.gamma_c,
      },
      nbTranches,
    });
  }, [centreX, centreY, rayon, profilEffectif, modele.couches, modele.hydrogeologie, modele.configurationNormative, nbTranches]);

  // Analyse de sensibilité paramétrique (CDC §12.1)
  const sensibilite = useMemo(() => {
    return analyserSensibiliteStabiliteCercle(
      (couchesTest) => {
        const res = calculerStabiliteBishop({
          cercle: { centreX, centreY, rayon },
          coteTerrainNaturel: modele.referentiel.coteTerrainNaturel,
          profilTN: profilEffectif,
          couches: couchesTest,
          hydrogeologie: modele.hydrogeologie,
          nbTranches,
        });
        return res.facteurSecurite;
      },
      modele.couches
    );
  }, [centreX, centreY, rayon, profilEffectif, modele.couches, modele.hydrogeologie, nbTranches]);

  const lancerRechercheCritique = () => {
    setRechercheEnCours(true);
    setTimeout(() => {
      try {
        const resultat = rechercherCercleCritique(profilEffectif, modele.couches, modele.hydrogeologie);
        if (resultat && resultat.cercleCritique) {
          setCentreX(Number(resultat.cercleCritique.centreX.toFixed(2)));
          setCentreY(Number(resultat.cercleCritique.centreY.toFixed(2)));
          setRayon(Number(resultat.cercleCritique.rayon.toFixed(2)));
        }
      } finally {
        setRechercheEnCours(false);
      }
    }, 50);
  };

  return (
    <div className="space-y-5">
      {/* Contrôles du cercle de glissement et action de recherche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-600" />
              Cercle de Rupture Circulaire (Bishop simplifié)
            </h3>
            <button
              id="btn-rechercher-cercle-critique"
              onClick={lancerRechercheCritique}
              disabled={rechercheEnCours}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              <Search className={`w-3.5 h-3.5 ${rechercheEnCours ? 'animate-spin' : ''}`} />
              {rechercheEnCours ? 'Recherche...' : 'Rechercher le cercle critique'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">Centre Xc (m)</label>
              <input
                id="input-bishop-xc"
                type="number"
                step="0.5"
                value={centreX}
                onChange={(e) => setCentreX(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Centre Yc / Altitude (m)</label>
              <input
                id="input-bishop-yc"
                type="number"
                step="0.5"
                value={centreY}
                onChange={(e) => setCentreY(parseFloat(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Rayon R (m)</label>
              <input
                id="input-bishop-r"
                type="number"
                step="0.5"
                min="2"
                value={rayon}
                onChange={(e) => setRayon(parseFloat(e.target.value) || 5)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-900 font-bold"
              />
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
            <span>Discrétisation : {resBishop.tranches.length} tranches actives (profil à {profilEffectif.length} sommets)</span>
            <span>Itérations : {resBishop.iterations} convergées</span>
          </div>
        </div>

        {/* Résultat global du Facteur de sécurité */}
        <div
          className={`p-4 rounded-xl border flex flex-col justify-between ${
            resBishop.conforme ? 'bg-emerald-50/60 border-emerald-300' : 'bg-rose-50/60 border-rose-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800">Facteur de Sécurité F</span>
            {resBishop.conforme ? (
              <span className="flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                <ShieldCheck className="w-3.5 h-3.5" /> F ≥ 1.00 OK
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs font-bold text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full">
                <ShieldAlert className="w-3.5 h-3.5" /> Instable
              </span>
            )}
          </div>

          <div className="my-2">
            <span
              className={`text-4xl font-black ${
                resBishop.conforme ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {resBishop.facteurSecurite.toFixed(3)}
            </span>
          </div>

          <div className="text-[11px] text-slate-600 border-t border-slate-200/80 pt-2 space-y-0.5">
            <div>Moment Moteur M_mot : {resBishop.momentMoteurTotal.toFixed(0)} kNm/m</div>
            <div>Moment Résistant M_res : {resBishop.momentResistantTotal.toFixed(0)} kNm/m</div>
          </div>
        </div>
      </div>

      {/* Badge et synthèse de sensibilité paramétrique CDC §12.1 */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-sky-600 shrink-0" />
          <span className="font-semibold text-slate-700">Sensibilité paramétrique (§12.1) :</span>
          <span className="text-slate-600">{sensibilite.resumeCourt}</span>
        </div>
        {sensibilite.parametres.length > 0 && (
          <div className="flex items-center gap-2">
            {sensibilite.parametres.map((p, i) => (
              <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[11px] font-mono text-slate-700">
                {p.label}: {p.impactPourcentPour1Pourcent >= 0 ? '+' : ''}{p.impactPourcentPour1Pourcent.toFixed(1)}%/+1%
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tableau des tranches de sol */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-800">
          Équilibre des Tranches de Bishop (Section 10.1)
        </div>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="p-2 font-medium">Tranche</th>
                <th className="p-2 font-medium">X (m)</th>
                <th className="p-2 font-medium">Largeur b (m)</th>
                <th className="p-2 font-medium">Poids W (kN)</th>
                <th className="p-2 font-medium">Pression u (kPa)</th>
                <th className="p-2 font-medium">Angle α (°)</th>
                <th className="p-2 font-medium text-right">R_mob (kN)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {resBishop.tranches.map((t) => (
                <tr key={t.index} className="hover:bg-slate-50">
                  <td className="p-2 font-bold text-slate-700">#{t.index + 1}</td>
                  <td className="p-2">{t.x.toFixed(2)}</td>
                  <td className="p-2">{t.largeur.toFixed(2)}</td>
                  <td className="p-2">{t.poids_W.toFixed(1)}</td>
                  <td className="p-2 text-sky-700">{t.pression_u.toFixed(1)}</td>
                  <td className="p-2">{t.alphaDeg.toFixed(1)}°</td>
                  <td className="p-2 text-right font-bold text-slate-900">{t.forceResistante.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
