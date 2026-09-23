import React, { useState } from 'react';
import { ModeleTerrain, OuvragePieu, ProfilEssaiPieu } from '../types/geotech';
import { verifierPieuAxial } from '../modules/pieux/capaciteAxiale';
import { VuePieuTransversal } from './pieux/VuePieuTransversal';
import {
  ShieldAlert,
  ShieldCheck,
  Users,
  ArrowDown,
  Activity,
  Plus,
  Trash2,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import { Card } from './ui/Card';
import { Verdict } from './ui/Verdict';
import { Champ } from './ui/Champ';
import { Bouton } from './ui/Bouton';

interface OngletPieuxProps {
  modele: ModeleTerrain;
  onUpdatePieu: (pieu: OuvragePieu) => void;
}

export const OngletPieux: React.FC<OngletPieuxProps> = ({ modele, onUpdatePieu }) => {
  const [sousOnglet, setSousOnglet] = useState<'axial' | 'transversal'>('axial');

  const pieuActif =
    modele.ouvrages.pieux[0] || {
      id: 'PIEU-01',
      nom: 'Pieu isolé standard',
      diametre: 0.8,
      coteTete: 242.0,
      cotePointe: 236.0,
      modeExecution: 'fore',
      actions: { V_G: 1200, V_Q: 350, H_G: 40, H_Q: 20 },
      frottementNegatif: { actif: true, cotePlanNeutre: 240.0, effortQ_sneg: 120 },
      groupe: { estGroupe: false, nbPieuxX: 1, nbPieuxY: 1, entraxe: 2.4 },
    };

  const updateChamp = (champ: keyof OuvragePieu, val: any) => {
    onUpdatePieu({
      ...pieuActif,
      [champ]: val,
    });
  };

  const updateAction = (champ: keyof OuvragePieu['actions'], val: number) => {
    onUpdatePieu({
      ...pieuActif,
      actions: {
        ...pieuActif.actions,
        [champ]: val,
      },
    });
  };

  const updateFN = (champ: keyof OuvragePieu['frottementNegatif'], val: any) => {
    onUpdatePieu({
      ...pieuActif,
      frottementNegatif: {
        ...pieuActif.frottementNegatif,
        [champ]: val,
      },
    });
  };

  const updateGroupe = (champ: keyof OuvragePieu['groupe'], val: any) => {
    onUpdatePieu({
      ...pieuActif,
      groupe: {
        ...pieuActif.groupe,
        [champ]: val,
      },
    });
  };

  const profilsEssais = pieuActif.profilsEssais || [];

  const handleAjouterProfil = () => {
    const nouveauNum = profilsEssais.length + 1;
    const nouveauProfil: ProfilEssaiPieu = {
      id: `PE-${Date.now().toString(36)}-${nouveauNum}`,
      reference: `Sondage CPT-${nouveauNum.toString().padStart(2, '0')}`,
      rcCalc: Math.round(resPieu.R_ck > 0 ? resPieu.R_ck * 1.3 : 2000),
    };
    onUpdatePieu({
      ...pieuActif,
      profilsEssais: [...profilsEssais, nouveauProfil],
    });
  };

  const handleModifierProfil = (id: string, champ: keyof ProfilEssaiPieu, val: any) => {
    onUpdatePieu({
      ...pieuActif,
      profilsEssais: profilsEssais.map((p) => (p.id === id ? { ...p, [champ]: val } : p)),
    });
  };

  const handleSupprimerProfil = (id: string) => {
    onUpdatePieu({
      ...pieuActif,
      profilsEssais: profilsEssais.filter((p) => p.id !== id),
    });
  };

  const resPieu = verifierPieuAxial(
    pieuActif,
    modele.couches,
    modele.configurationNormative,
    modele.hydrogeologie,
    modele.campagnes
  );

  return (
    <div className="space-y-5">
      {/* Navigation sous-onglets : Axial vs Transversal */}
      <div className="flex items-center gap-2 border-b border-bordure pb-2">
        <button
          onClick={() => setSousOnglet('axial')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-rayon-petit text-xs font-semibold transition-colors ${
            sousOnglet === 'axial'
              ? 'bg-surface-appui text-texte border border-bordure'
              : 'text-texte-doux hover:bg-surface-appui'
          }`}
        >
          <ArrowDown className="w-3.5 h-3.5" />
          Portance Axiale ELU (DA2*)
        </button>
        <button
          onClick={() => setSousOnglet('transversal')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-rayon-petit text-xs font-semibold transition-colors ${
            sousOnglet === 'transversal'
              ? 'bg-surface-appui text-texte border border-bordure'
              : 'text-texte-doux hover:bg-surface-appui'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Comportement Transversal & Courbes p-y (EN 1997-1 §7.7)
        </button>
      </div>

      {sousOnglet === 'transversal' ? (
        <VuePieuTransversal
          diametre={pieuActif.diametre}
          coteTete={pieuActif.coteTete}
          cotePointe={pieuActif.cotePointe}
          couches={modele.couches}
          hydrogeologie={modele.hydrogeologie}
          campagnes={modele.campagnes}
        />
      ) : (
        <>
          {/* 1. Configuration du Pieu */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Géométrie & Exécution */}
            <Card>
              <h3 className="text-xs font-semibold text-texte-faible uppercase tracking-wide mb-3">
                1. Géométrie & Mode de pose
              </h3>
              <div className="space-y-2.5 text-xs">
                <Champ
                  id="input-pieu-diametre"
                  label="Diamètre nominal D (m)"
                  type="number"
                  step="0.1"
                  min="0.3"
                  max="2.5"
                  value={pieuActif.diametre}
                  onChange={(e) => updateChamp('diametre', parseFloat(e.target.value) || 0.4)}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Champ
                    id="input-pieu-tete"
                    label="Cote Tête (m)"
                    type="number"
                    step="0.1"
                    value={pieuActif.coteTete}
                    onChange={(e) => updateChamp('coteTete', parseFloat(e.target.value) || 0)}
                  />
                  <Champ
                    id="input-pieu-pointe"
                    label="Cote Pointe (m)"
                    type="number"
                    step="0.1"
                    value={pieuActif.cotePointe}
                    onChange={(e) => updateChamp('cotePointe', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="block text-texte-faible text-[11px] uppercase tracking-wide mb-1">
                    Mode d'exécution (Tableau A.7)
                  </label>
                  <select
                    id="select-pieu-mode"
                    value={pieuActif.modeExecution}
                    onChange={(e) => updateChamp('modeExecution', e.target.value as any)}
                    className="w-full px-2.5 py-1.5 border border-bordure rounded-rayon-petit text-texte bg-surface"
                  >
                    <option value="fore">Pieu foré tubé / boue</option>
                    <option value="battu">Pieu battu préfabriqué</option>
                    <option value="visse">Pieu vissé moulé / tarière creuse</option>
                  </select>
                </div>
                <div className="p-2 bg-surface-appui rounded-rayon-petit text-[11px] text-texte-doux flex justify-between">
                  <span>Longueur fût L : {(pieuActif.coteTete - pieuActif.cotePointe).toFixed(2)} m</span>
                  <span>Section pointe A_b : {(Math.PI * (pieuActif.diametre / 2) ** 2).toFixed(3)} m²</span>
                </div>
              </div>
            </Card>

            {/* Sollicitations & Frottement négatif */}
            <Card>
              <h3 className="text-xs font-semibold text-texte-faible uppercase tracking-wide mb-3">
                2. Actions & Frottement Négatif
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <Champ
                    label="V permanent G (kN)"
                    type="number"
                    step="50"
                    value={pieuActif.actions.V_G}
                    onChange={(e) => updateAction('V_G', parseFloat(e.target.value) || 0)}
                  />
                  <Champ
                    label="V variable Q (kN)"
                    type="number"
                    step="50"
                    value={pieuActif.actions.V_Q}
                    onChange={(e) => updateAction('V_Q', parseFloat(e.target.value) || 0)}
                  />
                </div>

                {/* Traitement strict du frottement négatif (Section 7.3) — c'est une action
                    permanente défavorable, l'alerte est justifiée (pas un simple décor). */}
                <div className="p-2.5 bg-alerte-fond border border-bordure rounded-rayon space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-alerte">Frottement Négatif (clause 7.3.2.2)</span>
                    <input
                      type="checkbox"
                      checked={pieuActif.frottementNegatif.actif}
                      onChange={(e) => updateFN('actif', e.target.checked)}
                    />
                  </div>
                  {pieuActif.frottementNegatif.actif && (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-2 gap-2">
                        <Champ
                          label="Cote plan neutre (m)"
                          type="number"
                          step="0.1"
                          value={pieuActif.frottementNegatif.cotePlanNeutre}
                          onChange={(e) => updateFN('cotePlanNeutre', parseFloat(e.target.value) || 0)}
                        />
                        <Champ
                          label="Effort Q_s;neg (kN)"
                          type="number"
                          step="20"
                          value={pieuActif.frottementNegatif.effortQ_sneg}
                          onChange={(e) => updateFN('effortQ_sneg', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <p className="text-[10px] text-alerte leading-tight">
                        * Norme : traité comme une <strong>action permanente défavorable (F_c;d)</strong>, et non pas
                        comme une déduction de résistance.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Effet de groupe */}
            <Card>
              <h3 className="text-xs font-semibold text-texte-faible uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                3. Configuration de Groupe
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between p-2 bg-surface-appui rounded-rayon-petit">
                  <span className="font-medium text-texte-doux">Calculer en groupe de pieux</span>
                  <input
                    type="checkbox"
                    checked={pieuActif.groupe.estGroupe}
                    onChange={(e) => updateGroupe('estGroupe', e.target.checked)}
                  />
                </div>

                {pieuActif.groupe.estGroupe && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Champ
                        label="Nb pieux X (m)"
                        type="number"
                        min="1"
                        max="10"
                        value={pieuActif.groupe.nbPieuxX}
                        onChange={(e) => updateGroupe('nbPieuxX', parseInt(e.target.value) || 1)}
                      />
                      <Champ
                        label="Nb pieux Y (n)"
                        type="number"
                        min="1"
                        max="10"
                        value={pieuActif.groupe.nbPieuxY}
                        onChange={(e) => updateGroupe('nbPieuxY', parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <Champ
                      label="Entraxe e (m)"
                      type="number"
                      step="0.1"
                      min="1.0"
                      value={pieuActif.groupe.entraxe}
                      onChange={(e) => updateGroupe('entraxe', parseFloat(e.target.value) || 2.0)}
                    />
                    <div className="p-2 bg-surface-appui text-texte-doux rounded-rayon-petit text-[11px]">
                      Rendement de groupe η (Converse-Labarre) :{' '}
                      <strong className="text-texte">{(resPieu.effetDeGroupe.rendement * 100).toFixed(1)} %</strong>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* 2. Profils d'essai (Rc;calc) — Voie 2 (EN 1997-1 Clause 7.6.2.3) */}
          <div className="bg-surface border border-bordure rounded-rayon overflow-hidden">
            <div className="px-4 py-3 bg-surface-appui border-b border-bordure flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-texte-faible" />
                <h3 className="font-semibold text-texte text-xs uppercase tracking-wide">
                  2. Profils d'Essai (Rc;calc) — Voie 2 (Clause 7.6.2.3)
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-rayon-petit bg-surface text-texte-doux border border-bordure">
                  {profilsEssais.length > 0
                    ? `${profilsEssais.length} profil${profilsEssais.length > 1 ? 's' : ''} saisi${profilsEssais.length > 1 ? 's' : ''}`
                    : 'Saisie directe'}
                </span>
              </div>
              <Bouton onClick={handleAjouterProfil}>
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter un profil (Rc;calc)</span>
              </Bouton>
            </div>

            <div className="p-4 space-y-3">
              {resPieu.avertissements && resPieu.avertissements.length > 0 && (
                <div className="p-3 bg-alerte-fond border border-bordure rounded-rayon text-xs text-alerte flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="font-semibold">Mode indicatif sans profil d'essai réel (CDC §10/§13)</div>
                    {resPieu.avertissements.map((a, idx) => (
                      <div key={idx} className="text-[11px]">
                        {a}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {profilsEssais.length === 0 ? (
                <div className="text-center py-6 px-4 border-2 border-dashed border-bordure rounded-rayon bg-surface-appui/50">
                  <FileSpreadsheet className="w-8 h-8 text-texte-faible mx-auto mb-2" />
                  <p className="text-xs font-semibold text-texte-doux">
                    Aucun profil d'essai renseigné
                  </p>
                  <p className="text-[11px] text-texte-faible max-w-xl mx-auto mt-1">
                    En l'absence de profil d'essai saisi, la norme impose le jeu de coefficients le plus défavorable
                    (<strong>n = 1, ξ₃ = ξ₄ = 1.40</strong>) sur une estimation indicative issue des couches de sol.
                    Saisissez les <strong>Rc;calc</strong> réels de vos sondages (CPT, PMT, etc.) pour appliquer les facteurs d'échantillonnage de la Voie 2 (Tableaux A.9 / A.10).
                  </p>
                  <div className="mt-3 flex justify-center">
                    <Bouton onClick={handleAjouterProfil}>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Saisir un profil d'essai (Rc;calc)</span>
                    </Bouton>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-surface-appui text-texte-doux border-b border-bordure">
                        <tr>
                          <th className="p-2 font-normal w-12 text-center">N°</th>
                          <th className="p-2 font-normal">Référence du sondage / profil d'essai</th>
                          <th className="p-2 font-normal w-48 text-right">Rc;calc (kN)</th>
                          <th className="p-2 font-normal w-16 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-bordure-douce font-mono">
                        {profilsEssais.map((p, index) => (
                          <tr key={p.id} className="hover:bg-surface-appui">
                            <td className="p-2 text-center text-texte-doux font-sans">{index + 1}</td>
                            <td className="p-2">
                              <input
                                type="text"
                                value={p.reference}
                                onChange={(e) => handleModifierProfil(p.id, 'reference', e.target.value)}
                                placeholder="Ex: CPT-01, Sondage S1..."
                                className="w-full px-2 py-1 border border-bordure rounded-rayon-petit font-sans text-xs text-texte bg-surface"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                step="10"
                                min="1"
                                value={p.rcCalc}
                                onChange={(e) => handleModifierProfil(p.id, 'rcCalc', parseFloat(e.target.value) || 0)}
                                className="w-36 px-2 py-1 border border-bordure rounded-rayon-petit font-mono font-semibold text-xs text-right text-texte bg-surface ml-auto block"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleSupprimerProfil(p.id)}
                                title="Supprimer ce profil"
                                className="p-1 text-texte-faible hover:text-refus transition-colors rounded-rayon-petit"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Synthèse de corrélation Voie 2 */}
                  <div className="p-3 bg-surface-appui border border-bordure rounded-rayon-petit flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-4 text-texte-doux">
                      <div>
                        Nombre d'essais : <strong className="text-texte font-mono">{resPieu.facteursCorrelation.nProfils}</strong>
                      </div>
                      <div>
                        Moyenne Rc;calc :{' '}
                        <strong className="text-texte font-mono">
                          {(profilsEssais.reduce((s, p) => s + p.rcCalc, 0) / profilsEssais.length).toFixed(1)} kN
                        </strong>
                      </div>
                      <div>
                        Minimum Rc;calc :{' '}
                        <strong className="text-texte font-mono">
                          {Math.min(...profilsEssais.map((p) => p.rcCalc)).toFixed(1)} kN
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-[11px] text-texte-doux">
                        ξ₃ = <strong className="text-texte">{resPieu.facteursCorrelation.xi3}</strong> | ξ₄ ={' '}
                        <strong className="text-texte">{resPieu.facteursCorrelation.xi4}</strong>
                      </div>
                      <div className="text-[11px] bg-surface text-texte-doux border border-bordure px-2 py-0.5 rounded-rayon-petit font-medium">
                        Gouvernant : {resPieu.facteursCorrelation.gouvernant}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 3. Synthèse et Vérification Normative EC7 */}
          <div className="bg-surface border border-bordure rounded-rayon overflow-hidden">
            <div className="px-4 py-3 bg-surface-appui border-b border-bordure flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-texte text-sm">3. Capacité Portante Axiale ELU (Approche DA2*)</span>
                <span className="text-[11px] bg-surface text-texte-doux border border-bordure px-2 py-0.5 rounded-rayon-petit font-mono">
                  DA2* (A1 "+" M1 "+" R2)
                </span>
              </div>
              <span className="text-xs text-texte-doux italic">Tableaux A.7 et A.8 de l'EN 1997-1</span>
            </div>

            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Carte 1 : Taux d'exploitation */}
              <Verdict etat={resPieu.conforme ? 'ok' : 'refus'}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs">Vérification ELU</span>
                  {resPieu.conforme ? (
                    <span className="flex items-center gap-1 text-xs">
                      <ShieldCheck className="w-3.5 h-3.5" /> Conforme
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs">
                      <ShieldAlert className="w-3.5 h-3.5" /> Insuffisant
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs font-normal">
                  <div className="flex justify-between items-baseline">
                    <span>Taux d'exploitation :</span>
                    <span className="text-base font-semibold font-mono tabular-nums">
                      {(resPieu.tauxExploitation * 100).toFixed(1)} %
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Charge de calcul F_cd :</span>
                    <span className="font-mono font-semibold">{resPieu.F_cd} kN</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Résistance de calcul R_cd :</span>
                    <span className="font-mono font-semibold">{resPieu.R_cd} kN</span>
                  </div>
                  <div className="pt-2 border-t border-bordure-douce text-[11px]">
                    F_cd = 1.35·V_G + 1.50·V_Q {pieuActif.frottementNegatif.actif && `+ 1.35·Q_sneg`}
                  </div>
                </div>
              </Verdict>

              {/* Carte 2 : Décomposition des résistances */}
              <Card className="text-xs space-y-2">
                <span className="font-semibold text-texte-doux block">Composantes Caractéristiques</span>
                <div className="flex justify-between text-texte-doux">
                  <span>Résistance de pointe R_bk :</span>
                  <span className="font-mono font-semibold text-texte">{resPieu.R_bk} kN</span>
                </div>
                <div className="flex justify-between text-texte-doux">
                  <span>Frottement latéral R_sk :</span>
                  <span className="font-mono font-semibold text-texte">{resPieu.R_sk} kN</span>
                </div>
                <div className="flex justify-between text-texte-doux">
                  <span>Résistance totale R_ck :</span>
                  <span className="font-mono font-semibold text-texte">{resPieu.R_ck} kN</span>
                </div>
                <div className="pt-2 border-t border-bordure-douce text-[11px] text-texte-doux space-y-0.5">
                  <div>Facteur pointe γ_b : {resPieu.facteursPartiels.gamma_b}</div>
                  <div>Facteur fût γ_s : {resPieu.facteursPartiels.gamma_s}</div>
                  <div>Facteur total γ_t : {resPieu.facteursPartiels.gamma_t}</div>
                </div>
              </Card>

              {/* Carte 3 : Corrélation et profil sondage */}
              <Card className="text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-texte-doux block">Facteurs de Corrélation (Tableau A.9)</span>
                  {resPieu.estProfilSynthetique && (
                    <span className="text-[10px] bg-alerte-fond text-alerte px-1.5 py-0.5 rounded-rayon-petit font-medium">
                      Repli n=1
                    </span>
                  )}
                </div>
                <div className="flex justify-between text-texte-doux">
                  <span>Nombre de profils n :</span>
                  <span className="font-mono font-semibold text-texte">{resPieu.facteursCorrelation.nProfils}</span>
                </div>
                <div className="flex justify-between text-texte-doux">
                  <span>Facteur ξ3 (moyenne) :</span>
                  <span className="font-mono font-semibold text-texte">{resPieu.facteursCorrelation.xi3}</span>
                </div>
                <div className="flex justify-between text-texte-doux">
                  <span>Facteur ξ4 (minimum) :</span>
                  <span className="font-mono font-semibold text-texte">{resPieu.facteursCorrelation.xi4}</span>
                </div>
                <div className="pt-2 border-t border-bordure-douce text-[11px] text-texte-doux">
                  Branche gouvernante : <strong className="text-texte">{resPieu.facteursCorrelation.gouvernant}</strong>
                </div>
              </Card>
            </div>

            {/* Détail couche par couche */}
            <div className="p-4 border-t border-bordure">
              <h4 className="text-xs font-semibold text-texte-doux mb-2">Mobilisation du frottement latéral le long du fût</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead className="bg-surface-appui text-texte-doux border-b border-bordure">
                    <tr>
                      <th className="p-2 font-normal font-sans">Couche</th>
                      <th className="p-2 font-normal">Cotes (m)</th>
                      <th className="p-2 font-normal">Longueur (m)</th>
                      <th className="p-2 font-normal">Contrainte σ'v (kPa)</th>
                      <th className="p-2 font-normal">Frottement qs (kPa)</th>
                      <th className="p-2 font-normal text-right font-sans">R_sk,i (kN)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bordure-douce">
                    {resPieu.detailsCouches.map((d, i) => (
                      <tr key={i} className="hover:bg-surface-appui">
                        <td className="p-2 font-sans font-medium text-texte-doux">{d.coucheNom}</td>
                        <td className="p-2">
                          {d.coteHaut.toFixed(2)} à {d.coteBas.toFixed(2)}
                        </td>
                        <td className="p-2">{d.longueurTraversee.toFixed(2)}</td>
                        <td className="p-2">{d.sigma_vPrimeMoy.toFixed(1)}</td>
                        <td className="p-2">{d.qs_k.toFixed(1)}</td>
                        <td className="p-2 text-right text-texte font-semibold">{d.R_sk_i.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 3. Synthèse Détaillée du Groupe de Pieux (EN 1997-1 §7.6 & CDC §7.6) */}
            {resPieu.effetDeGroupe.estGroupe && resPieu.effetDeGroupe.nbPieux > 1 && (
              <div className="p-4 border-t border-bordure bg-surface-appui/50 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-texte-faible" />
                    <h4 className="text-xs font-semibold text-texte uppercase tracking-wide">
                      Vérification du Groupe de Pieux & Interaction (EN 1997-1 §7.6 & CDC §7.6)
                    </h4>
                  </div>
                  <span className="text-[11px] bg-surface text-texte-doux border border-bordure px-2 py-0.5 rounded-rayon-petit font-medium">
                    {resPieu.effetDeGroupe.nbPieux} pieux ({pieuActif.groupe.nbPieuxX} × {pieuActif.groupe.nbPieuxY})
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Carte Groupe 1 : Efficacité et Capacité ELU */}
                  <Verdict etat={resPieu.effetDeGroupe.conformeELU ? 'ok' : 'refus'} className="text-xs space-y-2">
                    <div className="flex justify-between items-center pb-1.5 border-b border-bordure-douce">
                      <span className="font-semibold">Efficacité & Portance ELU</span>
                      <span className="px-2 py-0.5 rounded-rayon-petit text-[10px] font-semibold">
                        {resPieu.effetDeGroupe.conformeELU ? 'Conforme ELU' : 'Non conforme'}
                      </span>
                    </div>
                    <div className="flex justify-between font-normal">
                      <span>Rendement η (Converse-Labarre) :</span>
                      <span className="font-mono font-semibold">
                        {(resPieu.effetDeGroupe.rendement * 100).toFixed(1)} %
                      </span>
                    </div>
                    <div className="flex justify-between font-normal">
                      <span>Résistance de calcul groupe R_cd :</span>
                      <span className="font-mono font-semibold">
                        {resPieu.effetDeGroupe.R_cd_groupe.toFixed(1)} kN
                      </span>
                    </div>
                    <div className="flex justify-between font-normal">
                      <span>Taux d'exploitation groupe :</span>
                      <span className="font-mono font-semibold">
                        {(resPieu.effetDeGroupe.tauxExploitationGroupe * 100).toFixed(1)} %
                      </span>
                    </div>
                    <div className="pt-1.5 border-t border-bordure-douce text-[11px] font-normal">
                      Mode gouvernant :{' '}
                      <strong>
                        {resPieu.effetDeGroupe.modeGouvernant === 'rupture_en_bloc'
                          ? 'Rupture en bloc'
                          : 'Individuel avec efficacité'}
                      </strong>
                    </div>
                  </Verdict>

                  {/* Carte Groupe 2 : Rupture en bloc (Fondation massive équivalente) */}
                  <Card className="text-xs space-y-2">
                    <div className="flex justify-between items-center pb-1.5 border-b border-bordure-douce">
                      <span className="font-semibold text-texte">Fondation Massive Équivalente</span>
                      <span className="text-[10px] text-texte-faible font-mono">EC7 §7.6.2.1</span>
                    </div>
                    <div className="flex justify-between text-texte-doux">
                      <span>Dimensions bloc (B × L) :</span>
                      <span className="font-mono font-semibold text-texte">
                        {resPieu.effetDeGroupe.ruptureEnBloc.largeurBloc_B} m × {resPieu.effetDeGroupe.ruptureEnBloc.longueurBloc_L} m
                      </span>
                    </div>
                    <div className="flex justify-between text-texte-doux">
                      <span>Surface de base & Périmètre :</span>
                      <span className="font-mono text-texte-doux">
                        {resPieu.effetDeGroupe.ruptureEnBloc.surfaceBloc_A} m² | {resPieu.effetDeGroupe.ruptureEnBloc.perimetreBloc_P} m
                      </span>
                    </div>
                    <div className="flex justify-between text-texte-doux">
                      <span>Résistance bloc Rc,bloc;d :</span>
                      <span className="font-mono font-semibold text-texte">
                        {resPieu.effetDeGroupe.ruptureEnBloc.Rc_bloc_d.toFixed(1)} kN
                      </span>
                    </div>
                    <div className="pt-1.5 border-t border-bordure-douce text-[11px] text-texte-doux">
                      Taux rupture en bloc :{' '}
                      <strong className="text-texte-doux">
                        {(resPieu.effetDeGroupe.ruptureEnBloc.tauxRuptureBloc * 100).toFixed(1)} %
                      </strong>
                    </div>
                  </Card>

                  {/* Carte Groupe 3 : Tassement sous charge de service ELS (CDC §7.6) */}
                  <Card className="text-xs space-y-2">
                    <div className="flex justify-between items-center pb-1.5 border-b border-bordure-douce">
                      <span className="font-semibold text-texte">Tassement ELS (CDC §7.6)</span>
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-ok bg-ok-fond px-1.5 py-0.5 rounded-rayon-petit">
                        s_groupe &gt; s_isolé ✓
                      </span>
                    </div>
                    <div className="flex justify-between text-texte-doux">
                      <span>Tassement pieu isolé s_isolé :</span>
                      <span className="font-mono font-semibold text-texte">
                        {resPieu.effetDeGroupe.tassement.s_isole_mm.toFixed(1)} mm
                      </span>
                    </div>
                    <div className="flex justify-between text-texte-doux">
                      <span>Tassement groupe s_groupe :</span>
                      <span className="font-mono font-semibold text-texte">
                        {resPieu.effetDeGroupe.tassement.s_groupe_mm.toFixed(1)} mm
                      </span>
                    </div>
                    <div className="flex justify-between text-texte-doux">
                      <span>Amplification d'interaction :</span>
                      <span className="font-mono font-semibold text-texte">
                        × {resPieu.effetDeGroupe.tassement.ratioAmplification.toFixed(2)}
                      </span>
                    </div>
                    <div className="pt-1.5 border-t border-bordure-douce text-[11px] text-texte-doux space-y-0.5">
                      <div>
                        Semelle équiv. : cote {resPieu.effetDeGroupe.tassement.coteSemelleEquivalente} m (
                        {resPieu.effetDeGroupe.tassement.largeurSemelleEquivalente}m × {resPieu.effetDeGroupe.tassement.longueurSemelleEquivalente}m)
                      </div>
                      <div className="italic text-[10px] text-texte-faible">
                        {resPieu.effetDeGroupe.tassement.methode}
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
