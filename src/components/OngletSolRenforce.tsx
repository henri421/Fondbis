import React, { useMemo, useState } from 'react';
import { ModeleTerrain, OuvrageSolRenforce, TripletGrandeur, TypeArmature } from '../types/geotech';
import {
  armatureParDefaut,
  coefficientsParDefaut,
  combinaisonsELU,
  fetoileEffectifs,
  LIBELLES_ARMATURE,
  ouvrageSolRenforceParDefaut,
} from '../modules/solRenforce/parametres';
import { longueurActive, verifierStabiliteInterne } from '../modules/solRenforce/stabiliteInterne';
import { verifierStabiliteExterne } from '../modules/solRenforce/stabiliteExterne';
import { geometrieMassif, rechercherStabiliteGeneraleMassif } from '../modules/solRenforce/stabiliteGeneraleMassif';
import { ResultatRechercheCercle } from '../briques/stabiliteGenerale';
import { Search, AlertTriangle } from 'lucide-react';
import { Card } from './ui/Card';
import { Champ } from './ui/Champ';
import { Bouton } from './ui/Bouton';
import { Verdict } from './ui/Verdict';
import { CoupeTalus } from './stabilite/CoupeTalus';

interface OngletSolRenforceProps {
  modele: ModeleTerrain;
  onUpdateModele: (modele: ModeleTerrain) => void;
}

const nombre = (v: string, defaut: number) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : defaut;
};

const etat = (taux: number) => (!Number.isFinite(taux) || taux > 1 ? 'refus' : taux > 0.95 ? 'alerte' : 'ok');
const fmt = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '∞');

const LIBELLES_COEFF: Array<[keyof OuvrageSolRenforce['coefficients'], string]> = [
  ['K0_sur_Ka', 'K/Ka en tête'],
  ['Kz0_sur_Ka', 'K/Ka à z0 et au-delà'],
  ['z0', 'z0 (m)'],
  ['Fetoile0', 'F* en tête'],
  ['FetoileZ0', 'F* à z0 et au-delà'],
  ['alpha', 'α (échelle)'],
  ['C', 'C (faces)'],
  ['gamma_R_rupture', 'γR;t rupture'],
  ['gamma_R_arrachement', 'γR;a arrachement'],
];

export const OngletSolRenforce: React.FC<OngletSolRenforceProps> = ({ modele, onUpdateModele }) => {
  const enregistre = modele.ouvrages.solsRenforces?.[0];
  const o: OuvrageSolRenforce = useMemo(
    () => enregistre ?? ouvrageSolRenforceParDefaut(modele.referentiel.coteTerrainNaturel),
    [enregistre, modele.referentiel.coteTerrainNaturel]
  );
  const [generale, setGenerale] = useState<Record<string, ResultatRechercheCercle | null> | null>(null);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [combAffichee, setCombAffichee] = useState<string | null>(null);

  const maj = (patch: Partial<OuvrageSolRenforce>) => {
    setGenerale(null);
    onUpdateModele({ ...modele, ouvrages: { ...modele.ouvrages, solsRenforces: [{ ...o, ...patch }] } });
  };
  const majCoeff = (cle: keyof OuvrageSolRenforce['coefficients'], v: number) => {
    const ancien = o.coefficients[cle] as TripletGrandeur<number>;
    maj({ coefficients: { ...o.coefficients, [cle]: { ...ancien, v, statut: 'choix', source: 'Saisie de l’ingénieur' } } });
  };
  const changerType = (type: TypeArmature) =>
    maj({ armature: armatureParDefaut(type), coefficients: coefficientsParDefaut(type, o.remblai.phiPrime) });

  const combinaisons = useMemo(() => combinaisonsELU(modele.configurationNormative), [modele.configurationNormative]);
  const resultats = useMemo(
    () =>
      combinaisons.map((c) => ({
        combinaison: c,
        interne: verifierStabiliteInterne(o, c),
        externe: verifierStabiliteExterne(o, c, modele.couches, modele.hydrogeologie, modele.configurationNormative),
      })),
    [combinaisons, o, modele.couches, modele.hydrogeologie, modele.configurationNormative]
  );

  const lancerGenerale = () => {
    setRechercheEnCours(true);
    setTimeout(() => {
      try {
        const sortie: Record<string, ResultatRechercheCercle | null> = {};
        for (const c of combinaisons) sortie[c.id] = rechercherStabiliteGeneraleMassif(o, c, modele.couches, modele.hydrogeologie);
        setGenerale(sortie);
      } finally {
        setRechercheEnCours(false);
      }
    }, 30);
  };

  // Combinaison affichée : la plus défavorable en interne par défaut
  const gouvInterne = resultats.reduce((a, b) => (b.interne.tauxMax > a.interne.tauxMax ? b : a), resultats[0]);
  const affiche = resultats.find((r) => r.combinaison.id === combAffichee) ?? gouvInterne;
  const cercleAffiche = generale ? generale[affiche.combinaison.id] : null;

  const tauxInterne = Math.max(...resultats.map((r) => r.interne.tauxMax));
  const tauxExterne = Math.max(...resultats.map((r) => r.externe.tauxMax));
  const tauxGeneral = generale
    ? Math.max(...combinaisons.map((c) => (generale[c.id] ? generale[c.id]!.resultat.taux : Infinity)))
    : null;

  const g = geometrieMassif(o);
  const ligneTraction = Array.from({ length: 21 }, (_, k) => {
    const h = (o.hauteur * k) / 20;
    return { x: o.xParement + longueurActive(o, h, o.remblai.phiPrime), y: o.coteBase + h };
  });
  const coteNappe = modele.hydrogeologie.nappePrincipale.coteDefavorableELU;
  const { F0, Fz0 } = fetoileEffectifs(o);
  const acier = o.armature.type !== 'geosynthetique';
  const avertissementsInternes = Array.from(
    new Set(resultats.flatMap((r) => [...r.externe.avertissements, ...r.interne.avertissements]))
  );

  return (
    <div className="space-y-5">
      {!enregistre && (
        <div className="rounded-rayon bg-surface-appui p-3 text-xs text-texte-doux">
          Massif d'exemple (H = 6 m, feuillards) fondé au terrain naturel avec 0,6 m d'encastrement : toute modification
          l'enregistre dans le projet. Au-dessus des couches du projet, le sol retenu prend les caractéristiques de la première couche.
        </div>
      )}

      {/* Synthèse */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Verdict etat={etat(tauxExterne)}>
          <div className="text-xs">Stabilité externe (glissement, excentricité, portance)</div>
          <div className="text-3xl font-mono tabular-nums my-1">{fmt(tauxExterne, 3)}</div>
        </Verdict>
        <Verdict etat={etat(tauxInterne)}>
          <div className="text-xs">Stabilité interne (arrachement, rupture)</div>
          <div className="text-3xl font-mono tabular-nums my-1">{fmt(tauxInterne, 3)}</div>
        </Verdict>
        {tauxGeneral === null ? (
          <div className="rounded-rayon bg-surface-appui p-3 text-xs text-texte-doux flex flex-col gap-2 justify-center">
            <span>Stabilité générale et mixte : recherche des cercles critiques à lancer.</span>
            <Bouton id="btn-mse-generale" onClick={lancerGenerale} disabled={rechercheEnCours}>
              <Search className={`w-3.5 h-3.5 ${rechercheEnCours ? 'animate-spin' : ''}`} />
              {rechercheEnCours ? 'Recherche...' : 'Rechercher les cercles critiques'}
            </Bouton>
          </div>
        ) : (
          <Verdict etat={etat(tauxGeneral)}>
            <div className="text-xs">Stabilité générale et mixte (Bishop, cercles critiques)</div>
            <div className="text-3xl font-mono tabular-nums my-1">{fmt(tauxGeneral, 3)}</div>
          </Verdict>
        )}
      </div>

      {/* Coupe */}
      <Card className="!p-2">
        <CoupeTalus
          profil={g.profil}
          couches={modele.couches}
          coteNappe={coteNappe}
          surcharges={g.surcharges}
          cercle={cercleAffiche ? cercleAffiche.cercle : null}
          resultat={cercleAffiche ? cercleAffiche.resultat : null}
          zones={[g.zone]}
          renforcements={g.renforcements}
          traces={[{ points: ligneTraction, couleur: 'var(--accent)', tirets: true }]}
        />
        <p className="px-2 pb-1 text-[11px] text-texte-faible">
          Hachures : massif renforcé. Rouge : lits d'armatures et cercle critique de la combinaison affichée. Tirets bleus :
          ligne des tractions maximales ({o.coefficients.ligne === 'bilineaire' ? 'bilinéaire, armatures inextensibles' : 'Rankine, armatures extensibles'}).
        </p>
      </Card>

      {/* Saisie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <h3 className="text-xs font-semibold text-texte-faible uppercase tracking-wide mb-3">Géométrie et remblai</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Champ label="Hauteur H (m)" type="number" step="0.25" min="1" value={o.hauteur}
              onChange={(e) => maj({ hauteur: Math.max(1, nombre(e.target.value, o.hauteur)) })} />
            <Champ label="Longueur L (m)" type="number" step="0.25" min="0.5" value={o.longueurArmatures}
              onChange={(e) => maj({ longueurArmatures: Math.max(0.5, nombre(e.target.value, o.longueurArmatures)) })} />
            <Champ label="Cote de base (m)" type="number" step="0.1" value={o.coteBase}
              onChange={(e) => maj({ coteBase: nombre(e.target.value, o.coteBase) })} />
            <Champ label="Encastrement D (m)" type="number" step="0.1" min="0" value={o.encastrement}
              onChange={(e) => maj({ encastrement: Math.max(0, nombre(e.target.value, o.encastrement)) })} />
            <Champ label="γ remblai (kN/m³)" type="number" step="0.5" value={o.remblai.gamma}
              onChange={(e) => maj({ remblai: { ...o.remblai, gamma: nombre(e.target.value, o.remblai.gamma) } })} />
            <Champ label="φ' remblai (°)" type="number" step="1" value={o.remblai.phiPrime}
              onChange={(e) => maj({ remblai: { ...o.remblai, phiPrime: nombre(e.target.value, o.remblai.phiPrime) } })} />
            <Champ label="qG en tête (kPa)" type="number" step="1" min="0" value={o.surchargeG}
              onChange={(e) => maj({ surchargeG: Math.max(0, nombre(e.target.value, o.surchargeG)) })} />
            <Champ label="qQ en tête (kPa)" type="number" step="1" min="0" value={o.surchargeQ}
              onChange={(e) => maj({ surchargeQ: Math.max(0, nombre(e.target.value, o.surchargeQ)) })} />
            <Champ label="1er lit (m)" type="number" step="0.025" min="0.05" value={o.premierLit}
              onChange={(e) => maj({ premierLit: Math.max(0.05, nombre(e.target.value, o.premierLit)) })} />
            <Champ label="Espacement Sv (m)" type="number" step="0.025" min="0.1" value={o.espacementSv}
              onChange={(e) => maj({ espacementSv: Math.max(0.1, nombre(e.target.value, o.espacementSv)) })} />
          </div>
          <p className="mt-2 text-[11px] text-texte-faible">
            Sol retenu et sol de fondation : couches du projet (onglet Stratigraphie). Nappe ELU : {coteNappe.toFixed(2)} m.
          </p>
        </Card>

        <Card>
          <h3 className="text-xs font-semibold text-texte-faible uppercase tracking-wide mb-3">Armatures</h3>
          <label className="block text-texte-faible text-[11px] uppercase tracking-wide mb-1">Type</label>
          <select
            aria-label="Type d'armature"
            className="w-full mb-3 px-2 py-1.5 bg-surface border border-bordure rounded-rayon-petit text-xs"
            value={o.armature.type}
            onChange={(e) => changerType(e.target.value as TypeArmature)}
          >
            {(Object.keys(LIBELLES_ARMATURE) as TypeArmature[]).map((t) => (
              <option key={t} value={t}>{LIBELLES_ARMATURE[t]}</option>
            ))}
          </select>
          {acier ? (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Champ label="Largeur b (mm)" type="number" step="1" value={o.armature.largeur_mm}
                onChange={(e) => maj({ armature: { ...o.armature, largeur_mm: nombre(e.target.value, o.armature.largeur_mm) } })} />
              <Champ label="Épaisseur e (mm)" type="number" step="0.5" value={o.armature.epaisseur_mm}
                onChange={(e) => maj({ armature: { ...o.armature, epaisseur_mm: nombre(e.target.value, o.armature.epaisseur_mm) } })} />
              <Champ label="fy (MPa)" type="number" step="5" value={o.armature.fy_MPa}
                onChange={(e) => maj({ armature: { ...o.armature, fy_MPa: nombre(e.target.value, o.armature.fy_MPa) } })} />
              <Champ label="Armatures / m / lit" type="number" step="0.1" value={o.armature.nbParMetre}
                onChange={(e) => maj({ armature: { ...o.armature, nbParMetre: nombre(e.target.value, o.armature.nbParMetre) } })} />
              <Champ label="Perte Δe / face (mm)" type="number" step="0.01" value={o.armature.perteEpaisseurParFace_mm.v}
                onChange={(e) =>
                  maj({
                    armature: {
                      ...o.armature,
                      perteEpaisseurParFace_mm: { ...o.armature.perteEpaisseurParFace_mm, v: nombre(e.target.value, 0), statut: 'choix', source: 'Saisie de l’ingénieur' },
                    },
                  })
                } />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 text-xs">
              <Champ label="T_ult (kN/m)" type="number" step="5" value={o.armature.resistanceUltime_kNm}
                onChange={(e) => maj({ armature: { ...o.armature, resistanceUltime_kNm: nombre(e.target.value, o.armature.resistanceUltime_kNm) } })} />
              <Champ label="Couverture Rc (m/m)" type="number" step="0.05" value={o.armature.tauxCouverture}
                onChange={(e) => maj({ armature: { ...o.armature, tauxCouverture: nombre(e.target.value, o.armature.tauxCouverture) } })} />
              <Champ label="RF fluage" type="number" step="0.05" value={o.armature.RF_fluage}
                onChange={(e) => maj({ armature: { ...o.armature, RF_fluage: nombre(e.target.value, o.armature.RF_fluage) } })} />
              <Champ label="RF endommagement" type="number" step="0.05" value={o.armature.RF_endommagement}
                onChange={(e) => maj({ armature: { ...o.armature, RF_endommagement: nombre(e.target.value, o.armature.RF_endommagement) } })} />
              <Champ label="RF vieillissement" type="number" step="0.05" value={o.armature.RF_vieillissement}
                onChange={(e) => maj({ armature: { ...o.armature, RF_vieillissement: nombre(e.target.value, o.armature.RF_vieillissement) } })} />
            </div>
          )}
          {acier && (
            <p className="mt-2 text-[11px] text-texte-faible">Δe : {o.armature.perteEpaisseurParFace_mm.source}</p>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-texte-faible uppercase tracking-wide">Coefficients de méthode</h3>
            <Bouton onClick={() => maj({ coefficients: coefficientsParDefaut(o.armature.type, o.remblai.phiPrime) })}>Valeurs par défaut</Bouton>
          </div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-bordure-douce">
              {LIBELLES_COEFF.map(([cle, libelle]) => {
                const c = o.coefficients[cle] as TripletGrandeur<number>;
                const valeur = cle === 'Fetoile0' ? F0 : cle === 'FetoileZ0' ? Fz0 : c.v;
                return (
                  <tr key={cle} title={c.source}>
                    <td className="py-1 pr-2">
                      {libelle}
                      {c.statut === 'defaut' && <AlertTriangle className="inline w-3 h-3 ml-1 text-alerte" aria-label="valeur par défaut à confirmer" />}
                      {c.statut === 'derive' && <span className="ml-1 text-[10px] text-texte-faible">(suit φ')</span>}
                    </td>
                    <td className="py-1 w-20">
                      <input
                        aria-label={libelle}
                        type="number"
                        step="0.01"
                        className="w-full px-2 py-0.5 bg-surface border border-bordure rounded-rayon-petit text-right font-mono tabular-nums"
                        value={Number(valeur.toFixed(3))}
                        onChange={(e) => majCoeff(cle, nombre(e.target.value, valeur))}
                      />
                    </td>
                  </tr>
                );
              })}
              <tr>
                <td className="py-1 pr-2">Ligne des tractions max.</td>
                <td className="py-1">
                  <select
                    aria-label="Ligne des tractions maximales"
                    className="w-full px-1 py-0.5 bg-surface border border-bordure rounded-rayon-petit"
                    value={o.coefficients.ligne}
                    onChange={(e) => maj({ coefficients: { ...o.coefficients, ligne: e.target.value === 'rankine' ? 'rankine' : 'bilineaire' } })}
                  >
                    <option value="bilineaire">Bilinéaire</option>
                    <option value="rankine">Rankine</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-texte-faible">
            <AlertTriangle className="inline w-3 h-3 text-alerte" /> valeur par défaut à confirmer (survoler pour la source). Méthode
            cohérente gravitaire simplifiée (FHWA-NHI-10-024 / AASHTO). Les coefficients de la NF P 94-270 ne sont pas repris : à saisir
            s'ils diffèrent.
          </p>
        </Card>
      </div>

      {avertissementsInternes.map((a, i) => (
        <p key={i} className="px-3 py-2 text-[11px] text-alerte bg-alerte-fond rounded-rayon">{a}</p>
      ))}

      {/* Combinaisons */}
      <div className="bg-surface border border-bordure rounded-rayon overflow-x-auto">
        <div className="px-4 py-3 bg-surface-appui border-b border-bordure text-xs font-semibold text-texte">
          Vérifications par combinaison — {modele.configurationNormative.approcheCalcul}
        </div>
        <table className="w-full text-xs border-collapse">
          <thead className="text-texte-doux border-b border-bordure">
            <tr>
              <th className="p-2 font-normal text-left">Combinaison</th>
              <th className="p-2 font-normal text-right">Glissement</th>
              <th className="p-2 font-normal text-right">e / (L/6)</th>
              <th className="p-2 font-normal text-right">Portance</th>
              <th className="p-2 font-normal text-right">Interne</th>
              <th className="p-2 font-normal text-right">Générale (F_d / taux)</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-bordure-douce font-mono">
            {resultats.map(({ combinaison: c, interne, externe }) => {
              const gen = generale ? generale[c.id] : undefined;
              const cellule = (t: number) => <span className={t > 1 ? 'text-refus font-semibold' : ''}>{fmt(t, 3)}</span>;
              return (
                <tr key={c.id} className={c.id === affiche.combinaison.id ? 'bg-accent-doux' : ''}>
                  <td className="p-2 font-sans">{c.libelle}</td>
                  <td className="p-2 text-right">{cellule(externe.glissement.taux)}</td>
                  <td className="p-2 text-right">{cellule(externe.excentricite.taux)}</td>
                  <td className="p-2 text-right">{cellule(externe.portance.taux)}</td>
                  <td className="p-2 text-right">{cellule(interne.tauxMax)}</td>
                  <td className="p-2 text-right">
                    {gen ? <>{gen.resultat.F.toFixed(3)} / {cellule(gen.resultat.taux)}</> : gen === null ? 'aucun cercle valide' : '—'}
                  </td>
                  <td className="p-2 text-right font-sans">
                    <button type="button" className="text-accent hover:underline" onClick={() => setCombAffichee(c.id)}>Détailler</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-4 py-2 text-[11px] text-texte-faible border-t border-bordure-douce">
          Externe : massif traité en mur poids de largeur L, poussée de Rankine du sol retenu (δ = 0), Q ignorée sur le massif
          quand elle stabilise ; excentricité sur valeurs caractéristiques (critère e ≤ L/6 de l'outil) ; portance EN 1997-1 annexe D.
          Générale : Bishop avec le massif en zone de matériau, chaque lit coupé reprenant min(rupture ; arrachement au-delà du
          cercle) en déduction du moment moteur ; seuls les cercles passant sous le pied du parement sont retenus.
        </p>
      </div>

      {/* Détail externe */}
      <Card>
        <h3 className="text-xs font-semibold text-texte-faible uppercase tracking-wide mb-2">Stabilité externe — {affiche.combinaison.libelle}</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
          <div>
            <div className="font-sans font-semibold mb-1">Poussées (caract., kN/m)</div>
            <div>Ka,b = {affiche.externe.Ka_b.toFixed(3)} (φ'd = {affiche.externe.phi_b_d.toFixed(1)}°)</div>
            <div>P_sol = {affiche.externe.P_sol.toFixed(1)}</div>
            <div>P_qG = {affiche.externe.P_qG.toFixed(1)} · P_qQ = {affiche.externe.P_qQ.toFixed(1)}</div>
            <div>W = {affiche.externe.W.toFixed(1)}</div>
          </div>
          <div>
            <div className="font-sans font-semibold mb-1">Glissement et excentricité</div>
            <div>H_d = {affiche.externe.glissement.H_d.toFixed(1)} kN/m</div>
            <div>R_h,d = {affiche.externe.glissement.R_hd.toFixed(1)} kN/m (tan δd = {affiche.externe.glissement.tanDelta_d.toFixed(3)})</div>
            <div>e = {affiche.externe.excentricite.e.toFixed(3)} m ≤ L/6 = {affiche.externe.excentricite.limite.toFixed(3)} m</div>
          </div>
          <div>
            <div className="font-sans font-semibold mb-1">Portance ({affiche.externe.jeuResistance})</div>
            <div>V_d = {affiche.externe.portance.V_d.toFixed(1)} kN/m</div>
            <div>e_d = {affiche.externe.portance.e_d.toFixed(3)} m · B' = {affiche.externe.portance.B_prime.toFixed(2)} m</div>
            <div>R_v,d drainé = {affiche.externe.portance.R_vd.toFixed(1)} kN/m</div>
            {affiche.externe.portance.R_vd_nonDraine !== null && (
              <div>R_v,d non drainé = {affiche.externe.portance.R_vd_nonDraine.toFixed(1)} kN/m</div>
            )}
          </div>
        </div>
      </Card>

      {/* Détail interne */}
      <div className="bg-surface border border-bordure rounded-rayon overflow-hidden">
        <div className="px-4 py-3 bg-surface-appui border-b border-bordure text-xs font-semibold text-texte flex justify-between flex-wrap gap-2">
          <span>Stabilité interne par lit — {affiche.combinaison.libelle}</span>
          <span className="font-mono font-normal text-texte-doux">Ka = {affiche.interne.Ka.toFixed(3)} · R_t,d = {fmt(affiche.interne.lits[0]?.R_d ?? NaN, 1)} kN/m</span>
        </div>
        <div className="max-h-80 overflow-auto">
          <table className="w-full text-xs border-collapse font-mono">
            <thead className="bg-surface-appui text-texte-doux border-b border-bordure sticky top-0">
              <tr>
                <th className="p-2 font-normal text-left">Lit</th>
                <th className="p-2 font-normal text-right">h (m)</th>
                <th className="p-2 font-normal text-right">z (m)</th>
                <th className="p-2 font-normal text-right">Sv (m)</th>
                <th className="p-2 font-normal text-right">K/Ka</th>
                <th className="p-2 font-normal text-right">σv,d (kPa)</th>
                <th className="p-2 font-normal text-right">T_d (kN/m)</th>
                <th className="p-2 font-normal text-right">La / Le (m)</th>
                <th className="p-2 font-normal text-right">F*</th>
                <th className="p-2 font-normal text-right">P_d (kN/m)</th>
                <th className="p-2 font-normal text-right">T/P</th>
                <th className="p-2 font-normal text-right">T/R</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-bordure-douce">
              {[...affiche.interne.lits].reverse().map((l) => (
                <tr key={l.index}>
                  <td className="p-2 text-texte-faible">{l.index + 1}</td>
                  <td className="p-2 text-right">{l.hauteur.toFixed(3)}</td>
                  <td className="p-2 text-right">{l.z.toFixed(3)}</td>
                  <td className="p-2 text-right">{l.Sv.toFixed(3)}</td>
                  <td className="p-2 text-right">{l.K_sur_Ka.toFixed(3)}</td>
                  <td className="p-2 text-right">{l.sigmaV_d.toFixed(1)}</td>
                  <td className="p-2 text-right">{l.T_d.toFixed(1)}</td>
                  <td className="p-2 text-right">{l.longueurActive.toFixed(2)} / {l.longueurAncrage.toFixed(2)}</td>
                  <td className="p-2 text-right">{l.Fetoile.toFixed(3)}</td>
                  <td className="p-2 text-right">{l.P_d.toFixed(1)}</td>
                  <td className={`p-2 text-right ${l.tauxArrachement > 1 ? 'text-refus font-semibold' : ''}`}>{fmt(l.tauxArrachement, 3)}</td>
                  <td className={`p-2 text-right ${l.tauxRupture > 1 ? 'text-refus font-semibold' : ''}`}>{fmt(l.tauxRupture, 3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2 text-[11px] text-texte-faible border-t border-bordure-douce">
          T_d = K(z)·σv,d·Sv avec σv,d = γG·(γr·z + qG) + γQ·qQ. Arrachement : P_d = C·F*·α·(γr·z + qG)·B_c·Le / γR;a (Q exclue,
          favorable). Rupture : acier n·b·(e − 2Δe)·fy / γR;t ; géosynthétique T_ult / (RF_fl·RF_end·RF_v) / γR;t.
        </p>
      </div>

      {generale && (
        <Bouton onClick={lancerGenerale} disabled={rechercheEnCours}>
          <Search className={`w-3.5 h-3.5 ${rechercheEnCours ? 'animate-spin' : ''}`} />
          Relancer la recherche des cercles critiques
        </Bouton>
      )}

      <p className="text-[11px] text-texte-faible">
        Hors périmètre : parement et attaches, sismique, talus en tête du massif (β ≠ 0), murs dos à dos, nappe dans le massif,
        surfaces de rupture non circulaires, déformations du massif.
      </p>
    </div>
  );
};
