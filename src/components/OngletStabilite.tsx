import React, { useState, useMemo } from 'react';
import { ModeleTerrain } from '../types/geotech';
import { calculerStabiliteBishop, rechercherCercleCritique } from '../briques/stabiliteGenerale';
import { analyserSensibiliteStabiliteCercle } from '../core/sensibilite';
import { ShieldCheck, ShieldAlert, Sliders, Search, Activity } from 'lucide-react';
import { Card } from './ui/Card';
import { Verdict } from './ui/Verdict';
import { Bouton } from './ui/Bouton';
import { Champ } from './ui/Champ';

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
        gamma_phi: modele.configurationNormative?.facteursSol?.M1?.gamma_phi ?? 1.0,
        gamma_c: modele.configurationNormative?.facteursSol?.M1?.gamma_c ?? 1.0,
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
        <Card className="col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-texte-faible uppercase tracking-wide flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              Cercle de Rupture Circulaire (Bishop simplifié)
            </h3>
            <Bouton
              id="btn-rechercher-cercle-critique"
              onClick={lancerRechercheCritique}
              disabled={rechercheEnCours}
            >
              <Search className={`w-3.5 h-3.5 ${rechercheEnCours ? 'animate-spin' : ''}`} />
              {rechercheEnCours ? 'Recherche...' : 'Rechercher le cercle critique'}
            </Bouton>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <Champ
              id="input-bishop-xc"
              label="Centre Xc (m)"
              type="number"
              step="0.5"
              value={centreX}
              onChange={(e) => setCentreX(parseFloat(e.target.value) || 0)}
            />
            <Champ
              id="input-bishop-yc"
              label="Centre Yc / Altitude (m)"
              type="number"
              step="0.5"
              value={centreY}
              onChange={(e) => setCentreY(parseFloat(e.target.value) || 0)}
            />
            <Champ
              id="input-bishop-r"
              label="Rayon R (m)"
              type="number"
              step="0.5"
              min="2"
              value={rayon}
              onChange={(e) => setRayon(parseFloat(e.target.value) || 5)}
            />
          </div>

          <div className="mt-3 flex items-center justify-between text-[11px] text-texte-faible">
            <span>Discrétisation : {resBishop.tranches.length} tranches actives (profil à {profilEffectif.length} sommets)</span>
            <span>Itérations : {resBishop.iterations} convergées</span>
          </div>
        </Card>

        {/* Résultat global du Facteur de sécurité */}
        <Verdict etat={resBishop.conforme ? 'ok' : 'refus'} className="flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs">Facteur de Sécurité F</span>
            {resBishop.conforme ? (
              <span className="flex items-center gap-1 text-xs">
                <ShieldCheck className="w-3.5 h-3.5" /> F ≥ 1.00 OK
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs">
                <ShieldAlert className="w-3.5 h-3.5" /> Instable
              </span>
            )}
          </div>

          <div className="my-2">
            <span className="text-4xl font-mono tabular-nums">
              {resBishop.facteurSecurite.toFixed(3)}
            </span>
          </div>

          <div className="text-[11px] font-normal border-t border-bordure-douce pt-2 space-y-0.5">
            <div>Moment Moteur M_mot : {resBishop.momentMoteurTotal.toFixed(0)} kNm/m</div>
            <div>Moment Résistant M_res : {resBishop.momentResistantTotal.toFixed(0)} kNm/m</div>
          </div>
        </Verdict>
      </div>

      {/* Badge et synthèse de sensibilité paramétrique CDC §12.1 */}
      <Card className="!p-3.5 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-texte-faible shrink-0" />
          <span className="font-semibold text-texte-doux">Sensibilité paramétrique (§12.1) :</span>
          <span className="text-texte-doux">{sensibilite.resumeCourt}</span>
        </div>
        {sensibilite.parametres.length > 0 && (
          <div className="flex items-center gap-2">
            {sensibilite.parametres.map((p, i) => (
              <span key={i} className="px-2 py-0.5 bg-surface-appui border border-bordure rounded-rayon-petit text-[11px] font-mono text-texte-doux">
                {p.label}: {p.impactPourcentPour1Pourcent >= 0 ? '+' : ''}{p.impactPourcentPour1Pourcent.toFixed(1)}%/+1%
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Tableau des tranches de sol */}
      <div className="bg-surface border border-bordure rounded-rayon overflow-hidden">
        <div className="px-4 py-3 bg-surface-appui border-b border-bordure text-xs font-semibold text-texte">
          Équilibre des Tranches de Bishop (Section 10.1)
        </div>
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead className="bg-surface-appui text-texte-doux border-b border-bordure sticky top-0">
              <tr>
                <th className="p-2 font-normal">Tranche</th>
                <th className="p-2 font-normal">X (m)</th>
                <th className="p-2 font-normal">Largeur b (m)</th>
                <th className="p-2 font-normal">Poids W (kN)</th>
                <th className="p-2 font-normal">Pression u (kPa)</th>
                <th className="p-2 font-normal">Angle α (°)</th>
                <th className="p-2 font-normal text-right">R_mob (kN)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure-douce">
              {resBishop.tranches.map((t) => (
                <tr key={t.index} className="hover:bg-surface-appui">
                  <td className="p-2 text-texte-doux">#{t.index + 1}</td>
                  <td className="p-2">{t.x.toFixed(2)}</td>
                  <td className="p-2">{t.largeur.toFixed(2)}</td>
                  <td className="p-2">{t.poids_W.toFixed(1)}</td>
                  <td className="p-2">{t.pression_u.toFixed(1)}</td>
                  <td className="p-2">{t.alphaDeg.toFixed(1)}°</td>
                  <td className="p-2 text-right text-texte">{t.forceResistante.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
