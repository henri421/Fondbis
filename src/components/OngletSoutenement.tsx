import React, { useState } from 'react';
import { ModeleTerrain, OuvrageSoutenement } from '../types/geotech';
import { verifierMurEnLELU } from '../modules/soutenement/murEnL';
import { ShieldAlert, ShieldCheck, Activity, Shield } from 'lucide-react';
import { OngletParoiPhasee } from './soutenement/OngletParoiPhasee';
import { Card } from './ui/Card';
import { Verdict } from './ui/Verdict';
import { Champ } from './ui/Champ';

interface OngletSoutenementProps {
  modele: ModeleTerrain;
  onUpdateSoutenement: (mur: OuvrageSoutenement) => void;
}

export const OngletSoutenement: React.FC<OngletSoutenementProps> = ({ modele, onUpdateSoutenement }) => {
  const [sousOnglet, setSousOnglet] = useState<'paroiPhasee' | 'murEnL'>('paroiPhasee');

  const murActif =
    modele.ouvrages.soutenements.find((s) => s.type === 'murEnL') ||
    modele.ouvrages.soutenements[0] || {
      id: 'MUR-01',
      nom: 'Mur en L rampe',
      type: 'murEnL',
      hauteurTotale: 4.5,
      coteTete: 245.3,
      coteFondFouille: 240.8,
      epaisseurVoile: 0.35,
      largeurSemelleB: 2.7,
      debordAvant: 0.6,
      ficheT: 0.8,
      surchargeQ: 10.0,
      inclinaisonTerrePlein: 0.0,
      frottementDeltaSurPhi: 0.667,
      butons: [],
    };

  const updateChamp = (champ: keyof OuvrageSoutenement, val: any) => {
    onUpdateSoutenement({
      ...murActif,
      [champ]: val,
    });
  };

  const resMur = verifierMurEnLELU(
    murActif,
    modele.couches,
    modele.hydrogeologie,
    modele.configurationNormative
  );

  return (
    <div className="space-y-5">
      {/* Sélecteur de niveau de modélisation du Module C */}
      <div className="bg-surface border border-bordure rounded-rayon p-1.5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSousOnglet('paroiPhasee')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-rayon-petit text-xs font-semibold transition-colors ${
            sousOnglet === 'paroiPhasee'
              ? 'bg-surface-appui text-texte border border-bordure'
              : 'text-texte-doux hover:bg-surface-appui'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Niveau 2 : Paroi Flexible Phasée (Poutre-ressorts §8.4)</span>
        </button>

        <button
          type="button"
          onClick={() => setSousOnglet('murEnL')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-rayon-petit text-xs font-semibold transition-colors ${
            sousOnglet === 'murEnL'
              ? 'bg-surface-appui text-texte border border-bordure'
              : 'text-texte-doux hover:bg-surface-appui'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Niveau 1 : Mur Rigide en L (Équilibre limite §8.3)</span>
        </button>
      </div>

      {sousOnglet === 'paroiPhasee' ? (
        <OngletParoiPhasee modele={modele} onUpdateSoutenement={onUpdateSoutenement} />
      ) : (
        <>
          {/* 1. Géométrie et Surcharge du Mur en L */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <h3 className="text-xs font-semibold text-texte-faible uppercase tracking-wide mb-3">
                1. Géométrie du Mur en L (Section 8.2)
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Champ
                  label="Hauteur totale H (m)"
                  type="number"
                  step="0.2"
                  min="1.0"
                  value={murActif.hauteurTotale}
                  onChange={(e) => updateChamp('hauteurTotale', parseFloat(e.target.value) || 2)}
                />
                <Champ
                  label="Largeur semelle B (m)"
                  type="number"
                  step="0.2"
                  min="0.8"
                  value={murActif.largeurSemelleB}
                  onChange={(e) => updateChamp('largeurSemelleB', parseFloat(e.target.value) || 1)}
                />
                <Champ
                  label="Cote Tête de mur (m)"
                  type="number"
                  step="0.1"
                  value={murActif.coteTete}
                  onChange={(e) => updateChamp('coteTete', parseFloat(e.target.value) || 0)}
                />
                <Champ
                  label="Cote Fond fouille (m)"
                  type="number"
                  step="0.1"
                  value={murActif.coteFondFouille}
                  onChange={(e) => updateChamp('coteFondFouille', parseFloat(e.target.value) || 0)}
                />
                <Champ
                  label="Épaisseur voile (m)"
                  type="number"
                  step="0.05"
                  min="0.2"
                  value={murActif.epaisseurVoile}
                  onChange={(e) => updateChamp('epaisseurVoile', parseFloat(e.target.value) || 0.3)}
                />
                <Champ
                  label="Patin avant (m)"
                  type="number"
                  step="0.1"
                  min="0.0"
                  value={murActif.debordAvant}
                  onChange={(e) => updateChamp('debordAvant', parseFloat(e.target.value) || 0)}
                />
              </div>
            </Card>

            <Card>
              <h3 className="text-xs font-semibold text-texte-faible uppercase tracking-wide mb-3">
                2. Actions & Frottement d'Interface
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <Champ
                  label="Surcharge terre-plein q (kPa)"
                  type="number"
                  step="2.0"
                  min="0"
                  value={murActif.surchargeQ}
                  onChange={(e) => updateChamp('surchargeQ', parseFloat(e.target.value) || 0)}
                />
                <Champ
                  label="Rapport frottement δ/φ'"
                  type="number"
                  step="0.05"
                  min="0"
                  max="1.0"
                  value={murActif.frottementDeltaSurPhi}
                  onChange={(e) => updateChamp('frottementDeltaSurPhi', parseFloat(e.target.value) || 0.667)}
                />
              </div>
              <div className="mt-4 p-2.5 bg-surface-appui rounded-rayon-petit text-xs text-texte-doux space-y-1">
                <div className="font-semibold text-texte">Résultats des poussées sur l'écran :</div>
                <div>• Coeff. de poussée Ka : <strong>{resMur.pressions.Ka}</strong></div>
                <div>• Poussée terres active Pa,terres : {resMur.pressions.Pa_sol_k} kN/m</div>
                <div>• Poussée due à surcharge Pa,q : {resMur.pressions.Pa_q_k} kN/m</div>
                <div>• Poussée totale de calcul Pa,d : <strong>{resMur.pressions.Pa_d} kN/m</strong></div>
              </div>
            </Card>
          </div>

          {/* 2. Les 4 vérifications obligatoires de la clause 9.4.1 */}
          <div className="bg-surface border border-bordure rounded-rayon overflow-hidden">
            <div className="px-4 py-3 bg-surface-appui border-b border-bordure flex items-center justify-between">
              <span className="font-semibold text-texte text-sm">
                Les 4 Vérifications Obligatoires (Clause 9.4.1 de l'EN 1997-1)
              </span>
              <span className="text-xs text-texte-doux italic">Combinaisons ELU DA2*</span>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Basculement EQU */}
              <Verdict etat={resMur.basculementEQU.conforme ? 'ok' : 'refus'}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs">1. Basculement (EQU)</span>
                  {resMur.basculementEQU.conforme ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <ShieldAlert className="w-4 h-4" />
                  )}
                </div>
                <div className="space-y-1.5 text-xs font-normal">
                  <div className="flex justify-between items-baseline">
                    <span>Taux EQU :</span>
                    <span className="font-mono tabular-nums text-base font-semibold">
                      {(resMur.basculementEQU.taux * 100).toFixed(1)} %
                    </span>
                  </div>
                  <div className="text-[11px]">
                    M_dst = {resMur.basculementEQU.M_dst_d} kNm/m
                    <br />
                    M_stb = {resMur.basculementEQU.M_stb_d} kNm/m
                  </div>
                  <div className="pt-2 text-[10px] font-semibold">
                    {resMur.basculementEQU.conforme ? 'Sécurité satisfaite' : 'Risque de renversement'}
                  </div>
                </div>
              </Verdict>

              {/* 2. Glissement sur la base */}
              <Verdict etat={resMur.glissement.conforme ? 'ok' : 'refus'}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs">2. Glissement base</span>
                  {resMur.glissement.conforme ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <ShieldAlert className="w-4 h-4" />
                  )}
                </div>
                <div className="space-y-1.5 text-xs font-normal">
                  <div className="flex justify-between items-baseline">
                    <span>Taux glissement :</span>
                    <span className="font-mono tabular-nums text-base font-semibold">
                      {(resMur.glissement.taux * 100).toFixed(1)} %
                    </span>
                  </div>
                  <div className="text-[11px]">
                    H_d = {resMur.glissement.H_d} kN/m
                    <br />
                    R_hd = {resMur.glissement.R_hd} kN/m
                  </div>
                  <div className="pt-2 text-[10px] font-semibold">
                    {resMur.glissement.conforme ? 'Pas de glissement' : 'Glissement excessif'}
                  </div>
                </div>
              </Verdict>

              {/* 3. Portance de la semelle */}
              <Verdict etat={resMur.portance.conforme ? 'ok' : 'refus'}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs">3. Portance semelle</span>
                  {resMur.portance.conforme ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <ShieldAlert className="w-4 h-4" />
                  )}
                </div>
                <div className="space-y-1.5 text-xs font-normal">
                  <div className="flex justify-between items-baseline">
                    <span>Taux portance :</span>
                    <span className="font-mono tabular-nums text-base font-semibold">
                      {(resMur.portance.taux * 100).toFixed(1)} %
                    </span>
                  </div>
                  <div className="text-[11px]">
                    V_d = {resMur.portance.V_d} kN/m
                    <br />
                    R_vd = {resMur.portance.R_vd} kN/m
                  </div>
                  <div className="pt-2 text-[10px] font-semibold">
                    Largeur eff. B' = {resMur.portance.B_prime} m
                  </div>
                </div>
              </Verdict>

              {/* 4. Stabilité générale */}
              <Verdict etat={resMur.stabiliteGlobale.conforme ? 'ok' : 'refus'}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs">4. Stabilité globale</span>
                  {resMur.stabiliteGlobale.conforme ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <ShieldAlert className="w-4 h-4" />
                  )}
                </div>
                <div className="space-y-1.5 text-xs font-normal">
                  <div className="flex justify-between items-baseline">
                    <span>Facteur sécurité :</span>
                    <span className="font-mono tabular-nums text-base font-semibold">
                      {resMur.stabiliteGlobale.facteurSecurite}
                    </span>
                  </div>
                  <div className="text-[11px]">
                    Méthode : {resMur.stabiliteGlobale.methode}
                    <br />
                    Critère : F ≥ 1.00 (ELU)
                  </div>
                  <div className="pt-2 text-[10px] font-semibold">
                    {resMur.stabiliteGlobale.conforme ? 'Grand glissement évité' : 'Risque grand glissement'}
                  </div>
                </div>
              </Verdict>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
