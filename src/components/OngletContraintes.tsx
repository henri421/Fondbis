import React, { useState } from 'react';
import { ModeleTerrain } from '../types/geotech';
import { construireMaillageVertical } from '../core/maillage';
import { calculerProfilContraintes } from '../core/profilContraintes';
import { LineChart, Download } from 'lucide-react';
import { Card } from './ui/Card';
import { Bouton } from './ui/Bouton';

interface OngletContraintesProps {
  modele: ModeleTerrain;
}

export const OngletContraintes: React.FC<OngletContraintesProps> = ({ modele }) => {
  const [pasMaillage, setPasMaillage] = useState<number>(0.25);
  const [etatAffiche, setEtatAffiche] = useState<'ELS' | 'ELU' | 'LesDeux'>('LesDeux');

  const cotesSingulieres: number[] = [];
  if (modele.ouvrages.radiers[0]) cotesSingulieres.push(modele.ouvrages.radiers[0].coteBase);
  if (modele.ouvrages.pieux[0]) {
    cotesSingulieres.push(modele.ouvrages.pieux[0].coteTete);
    cotesSingulieres.push(modele.ouvrages.pieux[0].cotePointe);
  }
  const soutenementPourCoupe =
    modele.ouvrages.soutenements.find((s) => s.type === 'murEnL') ??
    modele.ouvrages.soutenements[0];
  if (soutenementPourCoupe) {
    cotesSingulieres.push(soutenementPourCoupe.coteFondFouille);
  }

  const maillage = construireMaillageVertical({
    coteTerrainNaturel: modele.referentiel.coteTerrainNaturel,
    couches: modele.couches,
    hydrogeologie: modele.hydrogeologie,
    cotesSingulieres,
    pasStandard: pasMaillage,
  });

  const profilELS = calculerProfilContraintes(
    modele.referentiel.coteTerrainNaturel,
    modele.couches,
    modele.hydrogeologie,
    maillage,
    'ELS'
  );

  const profilELU = calculerProfilContraintes(
    modele.referentiel.coteTerrainNaturel,
    modele.couches,
    modele.hydrogeologie,
    maillage,
    'ELU'
  );

  const pointsAffichage = profilELS.points;

  // Export CSV
  const exporterCSV = () => {
    let csv = 'Cote (m);Profondeur (m);Couche;sigma_v_ELS (kPa);u_ELS (kPa);sigma_prime_v_ELS (kPa);sigma_v_ELU (kPa);u_ELU (kPa);sigma_prime_v_ELU (kPa)\n';
    for (let i = 0; i < profilELS.points.length; i++) {
      const ptELS = profilELS.points[i];
      const ptELU = profilELU.points[i];
      csv += `${ptELS.cote};${ptELS.profondeur};"${ptELS.nomCouche}";${ptELS.sigma_v};${ptELS.u};${ptELS.sigma_vPrime};${ptELU.sigma_v};${ptELU.u};${ptELU.sigma_vPrime}\n`;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Profil_Contraintes_${modele.projet.reference || 'EC7'}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Barre d'information et paramètres */}
      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-texte flex items-center gap-2">
            <LineChart className="w-4 h-4" />
            Noyau de Calcul : Profil des Contraintes Verticales (Phase 0)
          </h3>
          <p className="text-xs text-texte-doux mt-0.5">
            Calcul en parallèle des états ELS (nappe {modele.hydrogeologie.nappePrincipale.coteCaracteristique}m) et ELU
            défavorable (nappe {modele.hydrogeologie.nappePrincipale.coteDefavorableELU}m).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <label className="text-texte-doux font-medium">Pas du maillage :</label>
            <select
              value={pasMaillage}
              onChange={(e) => setPasMaillage(parseFloat(e.target.value))}
              className="px-2 py-1 border border-bordure rounded-rayon-petit bg-surface text-texte font-medium"
            >
              <option value="0.10">0.10 m (Raffiné)</option>
              <option value="0.25">0.25 m (Standard)</option>
              <option value="0.50">0.50 m (Rapide)</option>
            </select>
          </div>

          <div className="flex items-center bg-surface-appui p-0.5 rounded-rayon-petit text-xs font-medium">
            <button
              onClick={() => setEtatAffiche('ELS')}
              className={`px-2.5 py-1 rounded-rayon-petit transition-colors ${etatAffiche === 'ELS' ? 'bg-surface font-semibold text-texte' : 'text-texte-doux'}`}
            >
              ELS seul
            </button>
            <button
              onClick={() => setEtatAffiche('ELU')}
              className={`px-2.5 py-1 rounded-rayon-petit transition-colors ${etatAffiche === 'ELU' ? 'bg-surface font-semibold text-texte' : 'text-texte-doux'}`}
            >
              ELU seul
            </button>
            <button
              onClick={() => setEtatAffiche('LesDeux')}
              className={`px-2.5 py-1 rounded-rayon-petit transition-colors ${etatAffiche === 'LesDeux' ? 'bg-surface font-semibold text-texte' : 'text-texte-doux'}`}
            >
              Comparatif ELS / ELU
            </button>
          </div>

          <Bouton id="btn-export-contraintes-csv" onClick={exporterCSV}>
            <Download className="w-3.5 h-3.5" />
            Exporter CSV
          </Bouton>
        </div>
      </Card>

      {/* Tableau des points de contraintes */}
      <div className="bg-surface border border-bordure rounded-rayon overflow-hidden">
        <div className="px-4 py-3 bg-surface-appui border-b border-bordure flex items-center justify-between text-xs">
          <span className="font-semibold text-texte">
            Discrétisation et Contraintes aux Nœuds du Maillage ({pointsAffichage.length} nœuds)
          </span>
          <span className="text-texte-doux">
            Formules : σv = ∫γ·dz, u = γw·(z_nappe - z), σ'v = σv - u (hydrostatique)
          </span>
        </div>

        <div className="max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-surface-appui text-texte-doux sticky top-0 border-b border-bordure z-10">
              <tr>
                <th className="p-2.5 font-semibold">Cote (m)</th>
                <th className="p-2.5 font-semibold">Prof. (m)</th>
                <th className="p-2.5 font-semibold">Couche</th>
                {(etatAffiche === 'ELS' || etatAffiche === 'LesDeux') && (
                  <>
                    <th className="p-2.5 font-semibold border-l border-bordure-douce">σ_v ELS (kPa)</th>
                    <th className="p-2.5 font-semibold">u ELS (kPa)</th>
                    <th className="p-2.5 font-semibold text-texte">σ'_v ELS (kPa)</th>
                  </>
                )}
                {(etatAffiche === 'ELU' || etatAffiche === 'LesDeux') && (
                  <>
                    <th className="p-2.5 font-semibold border-l border-bordure-douce">σ_v ELU (kPa)</th>
                    <th className="p-2.5 font-semibold">u ELU (kPa)</th>
                    <th className="p-2.5 font-semibold text-texte">σ'_v ELU (kPa)</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure-douce font-mono">
              {pointsAffichage.map((ptELS, idx) => {
                const ptELU = profilELU.points[idx] || ptELS;
                const estSingulier =
                  Math.abs(ptELS.cote - modele.hydrogeologie.nappePrincipale.coteCaracteristique) < 0.01 ||
                  Math.abs(ptELS.cote - modele.hydrogeologie.nappePrincipale.coteDefavorableELU) < 0.01 ||
                  modele.couches.some((c) => Math.abs(c.coteToit - ptELS.cote) < 0.01);

                return (
                  <tr
                    key={idx}
                    className={`hover:bg-surface-appui transition-colors ${estSingulier ? 'bg-alerte-fond/40 font-semibold' : ''}`}
                  >
                    <td className="p-2 text-texte">{ptELS.cote.toFixed(2)}</td>
                    <td className="p-2 text-texte-doux">{ptELS.profondeur.toFixed(2)}</td>
                    <td className="p-2 font-sans text-texte-doux truncate max-w-xs">{ptELS.nomCouche}</td>

                    {(etatAffiche === 'ELS' || etatAffiche === 'LesDeux') && (
                      <>
                        <td className="p-2 text-texte-doux border-l border-bordure-douce">{ptELS.sigma_v.toFixed(2)}</td>
                        <td className="p-2 text-texte-doux">{ptELS.u.toFixed(2)}</td>
                        <td className="p-2 font-semibold text-texte">{ptELS.sigma_vPrime.toFixed(2)}</td>
                      </>
                    )}

                    {(etatAffiche === 'ELU' || etatAffiche === 'LesDeux') && (
                      <>
                        <td className="p-2 text-texte-doux border-l border-bordure-douce">{ptELU.sigma_v.toFixed(2)}</td>
                        <td className="p-2 text-texte-doux">{ptELU.u.toFixed(2)}</td>
                        <td className="p-2 font-semibold text-texte">{ptELU.sigma_vPrime.toFixed(2)}</td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
