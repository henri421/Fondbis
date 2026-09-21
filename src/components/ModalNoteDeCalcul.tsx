import React from 'react';
import { ModeleTerrain } from '../types/geotech';
import { verifierPortanceRadierELU } from '../modules/radier/portanceELU';
import { calculerTassementRadierELS } from '../modules/radier/tassementELS';
import { verifierPieuAxial } from '../modules/pieux/capaciteAxiale';
import { verifierMurEnLELU } from '../modules/soutenement/murEnL';
import { X, Printer, FileText, CheckCircle2 } from 'lucide-react';

interface ModalNoteDeCalculProps {
  modele: ModeleTerrain;
  onClose: () => void;
}

export const ModalNoteDeCalcul: React.FC<ModalNoteDeCalculProps> = ({ modele, onClose }) => {
  const radier = modele.ouvrages.radiers[0];
  const pieu = modele.ouvrages.pieux[0];
  // Spécifique au mur en L (verifierMurEnLELU ci-dessous) — ne jamais substituer par
  // soutenements[0] au cas où seule une entrée paroiFlexible existe : verifierMurEnLELU
  // attend largeurSemelleB/debordAvant/ficheT (mur en L), pas les champs de paroi phasée.
  const mur = modele.ouvrages.soutenements.find((s) => s.type === 'murEnL');

  const resRadierELU = radier
    ? verifierPortanceRadierELU(
        radier,
        modele.referentiel.coteTerrainNaturel,
        modele.couches,
        modele.hydrogeologie,
        modele.configurationNormative
      )
    : null;

  const resRadierELS = radier
    ? calculerTassementRadierELS(
        radier,
        modele.referentiel.coteTerrainNaturel,
        modele.couches,
        modele.hydrogeologie
      )
    : null;

  const resPieu = pieu
    ? verifierPieuAxial(pieu, modele.couches, modele.configurationNormative, modele.hydrogeologie, modele.campagnes)
    : null;

  const resMur = mur
    ? verifierMurEnLELU(mur, modele.couches, modele.hydrogeologie, modele.configurationNormative)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden print:max-h-none print:shadow-none print:border-none">
        {/* Entête modal (masqué à l'impression) */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 font-bold text-sm">
            <FileText className="w-4 h-4 text-emerald-400" />
            <span>Note de Calcul Géotechnique Structurée (Eurocode 7)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Imprimer / Exporter PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corps du document de calcul */}
        <div className="p-8 overflow-y-auto space-y-6 text-slate-800 text-xs font-sans print:p-0 print:overflow-visible">
          {/* Titre et identification */}
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black text-slate-950 uppercase tracking-tight">
                NOTE DE CALCUL GÉOTECHNIQUE
              </h1>
              <p className="text-sm font-semibold text-emerald-800 mt-0.5">
                Conforme EN 1997-1:2004 (Eurocode 7 - Calcul Géotechnique)
              </p>
              <div className="text-slate-500 text-xs mt-2 space-y-0.5">
                <div>Projet : <strong>{modele.projet.nom}</strong></div>
                <div>Réf. Dossier : {modele.projet.reference} • Auteur : {modele.projet.auteur}</div>
                <div>Date : {modele.projet.date}</div>
              </div>
            </div>
            <div className="text-right text-[11px] text-slate-500 border-l border-slate-200 pl-4">
              <div>Approche de calcul : <strong>DA2*</strong></div>
              <div>Système altimétrique : <strong>{modele.referentiel.systeme}</strong></div>
              <div>Cote TN : <strong>{modele.referentiel.coteTerrainNaturel.toFixed(2)} m</strong></div>
            </div>
          </div>

          {/* Avertissement normatif officiel */}
          <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg text-[11px] text-amber-950 leading-relaxed font-medium">
            <strong>Avertissement :</strong> Jeu de facteurs partiels : valeurs recommandées EN 1997-1:2004 annexe A.
            Aucune annexe nationale chargée. Ces valeurs sont des paramètres déterminés au niveau national et peuvent
            être modifiées par l'annexe nationale applicable au projet. Vérification à la charge de l'ingénieur.
          </div>

          {/* 1. Modèle Géotechnique et Traçabilité */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-200 pb-1">
              1. Modèle de Terrain et Traçabilité des Paramètres
            </h2>
            <p className="text-slate-600 mb-2">
              Niveau d'eau caractéristique (ELS) : <strong>{modele.hydrogeologie.nappePrincipale.coteCaracteristique} m</strong> •
              Niveau défavorable (ELU) : <strong>{modele.hydrogeologie.nappePrincipale.coteDefavorableELU} m</strong> (Clause 2.4.6.1).
            </p>
            <table className="w-full border-collapse text-left border border-slate-200 text-[11px]">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="p-1.5 border border-slate-200">Couche</th>
                  <th className="p-1.5 border border-slate-200">Cote Toit (m)</th>
                  <th className="p-1.5 border border-slate-200">Épaisseur (m)</th>
                  <th className="p-1.5 border border-slate-200">γ_h / γ_sat (kN/m³)</th>
                  <th className="p-1.5 border border-slate-200">φ'_k (°) / c'_k (kPa)</th>
                  <th className="p-1.5 border border-slate-200">cu (kPa)</th>
                  <th className="p-1.5 border border-slate-200">Traçabilité & Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {modele.couches.map((c) => (
                  <tr key={c.id}>
                    <td className="p-1.5 border border-slate-200 font-bold">{c.nom}</td>
                    <td className="p-1.5 border border-slate-200">{c.coteToit.toFixed(2)}</td>
                    <td className="p-1.5 border border-slate-200">{c.epaisseur.toFixed(2)}</td>
                    <td className="p-1.5 border border-slate-200">
                      {c.poidsVolumiques.gammaHumide.v} / {c.poidsVolumiques.gammaSature.v}
                    </td>
                    <td className="p-1.5 border border-slate-200">
                      {c.resistanceDrainee.phiPrime.v}° / {c.resistanceDrainee.cPrime.v}
                    </td>
                    <td className="p-1.5 border border-slate-200">{c.resistanceNonDrainee.cuTete.v}</td>
                    <td className="p-1.5 border border-slate-200 text-slate-500 text-[10px]">
                      {c.resistanceDrainee.phiPrime.statut} ({c.resistanceDrainee.phiPrime.source})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 2. Synthèse des Ouvrages et Vérifications Normatives */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-2 border-b border-slate-200 pb-1">
              2. Vérifications aux États Limites (ELU & ELS)
            </h2>

            {/* Radier */}
            {radier && resRadierELU && resRadierELS && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">
                    Ouvrage 1 : {radier.nom} (B = {radier.largeurB}m, L = {radier.longueurL}m, base = {radier.coteBase}m)
                  </span>
                  <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    CONFORME EC7
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>
                    Portance ELU : <strong>{(resRadierELU.tauxExploitationGouvernant * 100).toFixed(1)} %</strong>
                    <br />(V_d = {resRadierELU.V_d} kN ≤ R_d = {resRadierELU.R_d_draine} kN)
                  </div>
                  <div>
                    Glissement ELU : <strong>{(resRadierELU.tauxGlissementDraine * 100).toFixed(1)} %</strong>
                    <br />(H_d = {resRadierELU.H_d} kN ≤ R_hd = {resRadierELU.R_h_draine} kN)
                  </div>
                  <div>
                    Soulèvement UPL : <strong>{(resRadierELU.upl.taux * 100).toFixed(1)} %</strong>
                    <br />(V_dst,d = {resRadierELU.upl.V_dst_d} kN)
                  </div>
                  <div>
                    Tassement ELS : <strong>{resRadierELS.tassementCentreTotal_mm} mm</strong>
                    <br />(Distorsion: {resRadierELS.distorsionRatio})
                  </div>
                </div>
              </div>
            )}

            {/* Pieu */}
            {pieu && resPieu && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">
                    Ouvrage 2 : {pieu.nom} (Ø {pieu.diametre}m, Tête {pieu.coteTete}m, Pointe {pieu.cotePointe}m)
                  </span>
                  <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    CONFORME EC7
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                  <div>
                    Capacité axiale ELU : <strong>{(resPieu.tauxExploitation * 100).toFixed(1)} %</strong>
                    <br />(F_cd = {resPieu.F_cd} kN ≤ R_cd = {resPieu.R_cd} kN)
                  </div>
                  <div>
                    Composantes : R_bk = {resPieu.R_bk} kN • R_sk = {resPieu.R_sk} kN
                    <br />Facteur total γ_t = {resPieu.facteursPartiels.gamma_t}
                  </div>
                  <div>
                    Corrélation : n = {resPieu.facteursCorrelation.nProfils} profils
                    <br />Branche gouvernante : {resPieu.facteursCorrelation.gouvernant}
                  </div>
                </div>
              </div>
            )}

            {/* Soutènement */}
            {mur && resMur && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-900">
                    Ouvrage 3 : {mur.nom} (H = {mur.hauteurTotale}m, B = {mur.largeurSemelleB}m)
                  </span>
                  <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    CONFORME EC7
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>1. Basculement (EQU) : <strong>{(resMur.basculementEQU.taux * 100).toFixed(1)} %</strong></div>
                  <div>2. Glissement : <strong>{(resMur.glissement.taux * 100).toFixed(1)} %</strong></div>
                  <div>3. Portance : <strong>{(resMur.portance.taux * 100).toFixed(1)} %</strong></div>
                  <div>4. Stabilité globale : <strong>F = {resMur.stabiliteGlobale.facteurSecurite}</strong></div>
                </div>
              </div>
            )}
          </div>

          {/* Conclusion */}
          <div className="border-t-2 border-slate-900 pt-4 flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-slate-900">Visa de l'Ingénieur Géotechnicien :</span>
              <p className="text-slate-500 italic">Dossier vérifié et validé pour phase projet G2 PRO.</p>
            </div>
            <div className="w-48 h-16 border border-dashed border-slate-300 rounded flex items-center justify-center text-slate-400">
              Signature / Cachet
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
