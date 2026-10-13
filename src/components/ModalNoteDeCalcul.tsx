import React from 'react';
import { ModeleTerrain } from '../types/geotech';
import { verifierPortanceRadierELU } from '../modules/radier/portanceELU';
import { calculerTassementRadierELS } from '../modules/radier/tassementELS';
import { verifierPieuAxial } from '../modules/pieux/capaciteAxiale';
import { verifierMurEnLELU } from '../modules/soutenement/murEnL';
import { combinaisonsELU } from '../modules/solRenforce/parametres';
import { verifierStabiliteInterne } from '../modules/solRenforce/stabiliteInterne';
import { verifierStabiliteExterne } from '../modules/solRenforce/stabiliteExterne';
import { X, Printer, FileText } from 'lucide-react';
import { Bouton } from './ui/Bouton';

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

  const massif = modele.ouvrages.solsRenforces?.[0];
  const resMassif = massif
    ? combinaisonsELU(modele.configurationNormative).map((c) => ({
        combinaison: c,
        interne: verifierStabiliteInterne(massif, c),
        externe: verifierStabiliteExterne(massif, c, modele.couches, modele.hydrogeologie, modele.configurationNormative),
      }))
    : null;

  // Verdict calculé (et non plus affiché « CONFORME » d'office)
  const badge = (tauxMax: number, perimetre: string) =>
    tauxMax <= 1 ? (
      <span className="font-semibold text-ok bg-ok-fond px-2 py-0.5 rounded-rayon-petit">
        CONFORME ({perimetre}, taux max {(tauxMax * 100).toFixed(0)} %)
      </span>
    ) : (
      <span className="font-semibold text-refus bg-refus-fond px-2 py-0.5 rounded-rayon-petit">
        NON CONFORME ({perimetre}, taux max {Number.isFinite(tauxMax) ? (tauxMax * 100).toFixed(0) : '∞'} %)
      </span>
    );

  return (
    <div className="fixed inset-0 z-50 bg-texte/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-surface">
      <div className="bg-surface rounded-rayon max-w-4xl w-full max-h-[90vh] flex flex-col border border-bordure overflow-hidden print:max-h-none print:border-none">
        {/* Entête modal (masqué à l'impression) */}
        <div className="px-6 py-4 bg-surface-appui text-texte flex items-center justify-between border-b border-bordure print:hidden">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <FileText className="w-4 h-4" />
            <span>Note de Calcul Géotechnique Structurée (Eurocode 7)</span>
          </div>
          <div className="flex items-center gap-2">
            <Bouton onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" />
              Imprimer / Exporter PDF
            </Bouton>
            <button
              onClick={onClose}
              className="p-1.5 rounded-rayon-petit hover:bg-[#e8e7e1] text-texte-faible hover:text-texte transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corps du document de calcul */}
        <div className="p-8 overflow-y-auto space-y-6 text-texte text-xs font-sans print:p-0 print:overflow-visible">
          {/* Titre et identification */}
          <div className="border-b-2 border-texte pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-semibold text-texte uppercase tracking-wide">
                NOTE DE CALCUL GÉOTECHNIQUE
              </h1>
              <p className="text-sm font-semibold text-texte-doux mt-0.5">
                Conforme EN 1997-1:2004 (Eurocode 7 - Calcul Géotechnique)
              </p>
              <div className="text-texte-doux text-xs mt-2 space-y-0.5">
                <div>Projet : <strong>{modele.projet.nom}</strong></div>
                <div>Réf. Dossier : {modele.projet.reference} • Auteur : {modele.projet.auteur}</div>
                <div>Date : {modele.projet.date}</div>
              </div>
            </div>
            <div className="text-right text-[11px] text-texte-doux border-l border-bordure pl-4">
              <div>Approche de calcul : <strong>DA2*</strong></div>
              <div>Système altimétrique : <strong>{modele.referentiel.systeme}</strong></div>
              <div>Cote TN : <strong>{modele.referentiel.coteTerrainNaturel.toFixed(2)} m</strong></div>
            </div>
          </div>

          {/* Avertissement normatif officiel */}
          <div className="p-3 bg-alerte-fond border border-bordure rounded-rayon text-[11px] text-alerte leading-relaxed">
            <strong>Avertissement :</strong> Jeu de facteurs partiels : valeurs recommandées EN 1997-1:2004 annexe A.
            Aucune annexe nationale chargée. Ces valeurs sont des paramètres déterminés au niveau national et peuvent
            être modifiées par l'annexe nationale applicable au projet. Vérification à la charge de l'ingénieur.
          </div>

          {/* 1. Modèle Géotechnique et Traçabilité */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-texte mb-2 border-b border-bordure pb-1">
              1. Modèle de Terrain et Traçabilité des Paramètres
            </h2>
            <p className="text-texte-doux mb-2">
              Niveau d'eau caractéristique (ELS) : <strong>{modele.hydrogeologie.nappePrincipale.coteCaracteristique} m</strong> •
              Niveau défavorable (ELU) : <strong>{modele.hydrogeologie.nappePrincipale.coteDefavorableELU} m</strong> (Clause 2.4.6.1).
            </p>
            <table className="w-full border-collapse text-left border border-bordure text-[11px]">
              <thead className="bg-surface-appui text-texte-doux">
                <tr>
                  <th className="p-1.5 border border-bordure-douce">Couche</th>
                  <th className="p-1.5 border border-bordure-douce">Cote Toit (m)</th>
                  <th className="p-1.5 border border-bordure-douce">Épaisseur (m)</th>
                  <th className="p-1.5 border border-bordure-douce">γ_h / γ_sat (kN/m³)</th>
                  <th className="p-1.5 border border-bordure-douce">φ'_k (°) / c'_k (kPa)</th>
                  <th className="p-1.5 border border-bordure-douce">cu (kPa)</th>
                  <th className="p-1.5 border border-bordure-douce">Traçabilité & Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bordure-douce">
                {modele.couches.map((c) => (
                  <tr key={c.id}>
                    <td className="p-1.5 border border-bordure-douce font-semibold">{c.nom}</td>
                    <td className="p-1.5 border border-bordure-douce">{c.coteToit.toFixed(2)}</td>
                    <td className="p-1.5 border border-bordure-douce">{c.epaisseur.toFixed(2)}</td>
                    <td className="p-1.5 border border-bordure-douce">
                      {c.poidsVolumiques.gammaHumide.v} / {c.poidsVolumiques.gammaSature.v}
                    </td>
                    <td className="p-1.5 border border-bordure-douce">
                      {c.resistanceDrainee.phiPrime.v}° / {c.resistanceDrainee.cPrime.v}
                    </td>
                    <td className="p-1.5 border border-bordure-douce">{c.resistanceNonDrainee.cuTete.v}</td>
                    <td className="p-1.5 border border-bordure-douce text-texte-faible text-[10px]">
                      {c.resistanceDrainee.phiPrime.statut} ({c.resistanceDrainee.phiPrime.source})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 2. Synthèse des Ouvrages et Vérifications Normatives */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-texte mb-2 border-b border-bordure pb-1">
              2. Vérifications aux États Limites (ELU & ELS)
            </h2>

            {/* Radier */}
            {radier && resRadierELU && resRadierELS && (
              <div className="p-3 bg-surface-appui rounded-rayon border border-bordure space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-texte">
                    Ouvrage 1 : {radier.nom} (B = {radier.largeurB}m, L = {radier.longueurL}m, base = {radier.coteBase}m)
                  </span>
                  {badge(Math.max(resRadierELU.tauxExploitationGouvernant, resRadierELU.tauxGlissementDraine, resRadierELU.upl.taux), 'ELU')}
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
              <div className="p-3 bg-surface-appui rounded-rayon border border-bordure space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-texte">
                    Ouvrage 2 : {pieu.nom} (Ø {pieu.diametre}m, Tête {pieu.coteTete}m, Pointe {pieu.cotePointe}m)
                  </span>
                  {badge(resPieu.tauxExploitation, 'capacité axiale ELU')}
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
              <div className="p-3 bg-surface-appui rounded-rayon border border-bordure space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-texte">
                    Ouvrage 3 : {mur.nom} (H = {mur.hauteurTotale}m, B = {mur.largeurSemelleB}m)
                  </span>
                  {badge(Math.max(resMur.basculementEQU.taux, resMur.glissement.taux, resMur.portance.taux), 'EQU, glissement, portance')}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div>1. Basculement (EQU) : <strong>{(resMur.basculementEQU.taux * 100).toFixed(1)} %</strong></div>
                  <div>2. Glissement : <strong>{(resMur.glissement.taux * 100).toFixed(1)} %</strong></div>
                  <div>3. Portance : <strong>{(resMur.portance.taux * 100).toFixed(1)} %</strong></div>
                  <div>4. Stabilité générale : <strong>non calculée ici (onglet Stabilité)</strong></div>
                </div>
              </div>
            )}

            {/* Sol renforcé */}
            {massif && resMassif && (
              <div className="p-3 bg-surface-appui rounded-rayon border border-bordure space-y-2">
                <div className="flex justify-between items-center gap-2 flex-wrap">
                  <span className="font-semibold text-texte">
                    Ouvrage 4 : {massif.nom} (H = {massif.hauteur} m, L = {massif.longueurArmatures} m, base = {massif.coteBase.toFixed(2)} m)
                  </span>
                  {badge(
                    Math.max(...resMassif.map((r) => Math.max(r.interne.tauxMax, r.externe.tauxMax))),
                    'externe et interne'
                  )}
                </div>
                {resMassif.map(({ combinaison, interne, externe }) => (
                  <div key={combinaison.id} className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                    <div className="sm:col-span-5 font-semibold">{combinaison.libelle}</div>
                    <div>Glissement : <strong>{(externe.glissement.taux * 100).toFixed(1)} %</strong></div>
                    <div>Excentricité e/(L/6) : <strong>{(externe.excentricite.taux * 100).toFixed(1)} %</strong></div>
                    <div>Portance : <strong>{(externe.portance.taux * 100).toFixed(1)} %</strong></div>
                    <div>Interne (lit le plus sollicité) : <strong>{Number.isFinite(interne.tauxMax) ? (interne.tauxMax * 100).toFixed(1) : '∞'} %</strong></div>
                    <div>Stabilité générale : <strong>onglet Sol renforcé</strong></div>
                  </div>
                ))}
                <div className="text-[10px] text-texte-faible">
                  Méthode cohérente gravitaire simplifiée (FHWA-NHI-10-024 / AASHTO) dans le cadre EN 1997-1 ; coefficients de méthode
                  et facteurs γR des armatures à confirmer selon le référentiel du projet.
                </div>
              </div>
            )}
          </div>

          {/* Conclusion */}
          <div className="border-t-2 border-texte pt-4 flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-texte">Visa de l'Ingénieur Géotechnicien :</span>
              <p className="text-texte-doux italic">Dossier vérifié et validé pour phase projet G2 PRO.</p>
            </div>
            <div className="w-48 h-16 border border-dashed border-bordure rounded-rayon flex items-center justify-center text-texte-faible">
              Signature / Cachet
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
