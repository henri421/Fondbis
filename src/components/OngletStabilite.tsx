import React, { useState, useMemo } from 'react';
import { ModeleTerrain, SurchargeTalus } from '../types/geotech';
import {
  analyserCercleBishop,
  CercleRupture,
  combinaisonsStabilite,
  rechercherCercleCritique,
  ResultatCercleBishop,
  ResultatRechercheCercle,
  COMBINAISON_CARACTERISTIQUE,
} from '../briques/stabiliteGenerale';
import { analyserSensibiliteStabiliteCercle } from '../core/sensibilite';
import { Sliders, Search, Activity, Plus, Trash2 } from 'lucide-react';
import { Card } from './ui/Card';
import { Verdict } from './ui/Verdict';
import { Bouton } from './ui/Bouton';
import { Champ } from './ui/Champ';
import { CoupeTalus } from './stabilite/CoupeTalus';

interface OngletStabiliteProps {
  modele: ModeleTerrain;
  onUpdateModele: (modele: ModeleTerrain) => void;
}

type Valide = Extract<ResultatCercleBishop, { valide: true }>;

const profilParDefaut = (ctn: number) => [
  { x: -10, y: ctn },
  { x: 5, y: ctn },
  { x: 15, y: ctn - 4 },
  { x: 35, y: ctn - 4 },
];

const nombre = (v: string, defaut = 0) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : defaut;
};

const motifInvalide = (r: ResultatCercleBishop) => ('motif' in r ? r.motif : '');

export const OngletStabilite: React.FC<OngletStabiliteProps> = ({ modele, onUpdateModele }) => {
  const ctn = modele.referentiel.coteTerrainNaturel;
  const profil = useMemo(
    () =>
      modele.profilTerrainNaturel && modele.profilTerrainNaturel.length >= 2
        ? modele.profilTerrainNaturel
        : profilParDefaut(ctn),
    [modele.profilTerrainNaturel, ctn]
  );
  const surcharges = useMemo(() => modele.surchargesTalus ?? [], [modele.surchargesTalus]);

  const [cercle, setCercle] = useState<CercleRupture>({ centreX: 10, centreY: ctn + 8, rayon: 12 });
  const [Fcible, setFcible] = useState<number>(1.5);
  const [nbTranches, setNbTranches] = useState<number>(40);
  const [rechercheEnCours, setRechercheEnCours] = useState(false);
  const [critiques, setCritiques] = useState<Record<string, ResultatRechercheCercle | null> | null>(null);
  const [combinaisonAffichee, setCombinaisonAffichee] = useState<string>('caracteristique');

  const combinaisons = useMemo(
    () => combinaisonsStabilite(modele.configurationNormative, Fcible),
    [modele.configurationNormative, Fcible]
  );

  const base = useMemo(
    () => ({
      profilTN: profil,
      couches: modele.couches,
      hydrogeologie: modele.hydrogeologie,
      surcharges,
      nbTranches,
    }),
    [profil, modele.couches, modele.hydrogeologie, surcharges, nbTranches]
  );

  // Le cercle saisi, analysé pour chaque combinaison
  const resultatsCercle = useMemo(
    () => combinaisons.map((c) => ({ combinaison: c, resultat: analyserCercleBishop({ ...base, cercle, combinaison: c }) })),
    [combinaisons, base, cercle]
  );

  // Toute modification des données rend les cercles critiques obsolètes
  const majModele = (m: ModeleTerrain) => {
    setCritiques(null);
    onUpdateModele(m);
  };
  const majProfil = (p: Array<{ x: number; y: number }>) => majModele({ ...modele, profilTerrainNaturel: p });
  const majSurcharges = (s: SurchargeTalus[]) => majModele({ ...modele, surchargesTalus: s });

  const lancerRecherche = () => {
    setRechercheEnCours(true);
    setTimeout(() => {
      try {
        const sortie: Record<string, ResultatRechercheCercle | null> = {};
        for (const c of combinaisons) sortie[c.id] = rechercherCercleCritique({ ...base, combinaison: c });
        setCritiques(sortie);
        // Combinaison gouvernante (taux le plus élevé) affichée par défaut
        let gouv: string = combinaisons[combinaisons.length - 1].id;
        let tauxMax = -1;
        for (const c of combinaisons) {
          const r = sortie[c.id];
          if (c.id !== 'caracteristique' && r && r.resultat.taux > tauxMax) {
            tauxMax = r.resultat.taux;
            gouv = c.id;
          }
        }
        setCombinaisonAffichee(gouv);
        const rg = sortie[gouv];
        if (rg) setCercle(rg.cercle);
      } finally {
        setRechercheEnCours(false);
      }
    }, 30);
  };

  // Résultat dessiné : cercle saisi, pour la combinaison choisie
  const affiche = resultatsCercle.find((r) => r.combinaison.id === combinaisonAffichee) ?? resultatsCercle[0];
  const resAffiche: Valide | null = affiche.resultat.valide ? (affiche.resultat as Valide) : null;

  // Sensibilité du F caractéristique aux paramètres de sol (CDC §12.1), sur le cercle saisi
  const sensibilite = useMemo(() => {
    const copie = JSON.parse(JSON.stringify(modele.couches));
    return analyserSensibiliteStabiliteCercle((couchesTest) => {
      const r = analyserCercleBishop({ ...base, couches: couchesTest, cercle, combinaison: COMBINAISON_CARACTERISTIQUE });
      return r.valide ? r.F : NaN;
    }, copie);
  }, [base, cercle, modele.couches]);

  // Taux gouvernant (cercles critiques si recherchés)
  let gouvernant: { libelle: string; taux: number; F: number } | null = null;
  if (critiques) {
    for (const c of combinaisons) {
      if (c.id === 'caracteristique') continue;
      const r = critiques[c.id];
      if (r && (!gouvernant || r.resultat.taux > gouvernant.taux)) {
        gouvernant = { libelle: c.libelle, taux: r.resultat.taux, F: r.resultat.F };
      }
    }
  }

  const etatTaux = (taux: number) => (taux <= 0.95 ? 'ok' : taux <= 1.0 ? 'alerte' : 'refus');
  const classeSaisie = 'w-full px-2 py-1 bg-surface border border-bordure rounded-rayon-petit text-right tabular-nums';

  return (
    <div className="space-y-5">
      {/* Géométrie : profil et surcharges */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-texte-faible uppercase tracking-wide">Profil du talus (x, cote)</h3>
            <Bouton
              id="btn-profil-ajouter-point"
              onClick={() => {
                const dernier = profil[profil.length - 1];
                majProfil([...profil, { x: dernier.x + 5, y: dernier.y }]);
              }}
            >
              <Plus className="w-3.5 h-3.5" /> Point
            </Bouton>
          </div>
          {!modele.profilTerrainNaturel && (
            <p className="text-[11px] text-texte-faible mb-2">
              Profil par défaut (talus de 4 m sous le terrain naturel) : toute modification l'enregistre dans le projet.
            </p>
          )}
          <table className="w-full text-xs font-mono">
            <thead className="text-texte-faible">
              <tr>
                <th className="text-left font-normal pb-1">#</th>
                <th className="text-right font-normal pb-1">x (m)</th>
                <th className="text-right font-normal pb-1">cote (m)</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {profil.map((p, i) => (
                <tr key={i}>
                  <td className="text-texte-faible pr-2">{i + 1}</td>
                  <td className="py-0.5 pl-2">
                    <input
                      aria-label={`x du point ${i + 1}`}
                      type="number"
                      step="0.5"
                      className={classeSaisie}
                      value={p.x}
                      onChange={(e) => majProfil(profil.map((q, j) => (j === i ? { ...q, x: nombre(e.target.value, q.x) } : q)))}
                    />
                  </td>
                  <td className="py-0.5 pl-2">
                    <input
                      aria-label={`cote du point ${i + 1}`}
                      type="number"
                      step="0.5"
                      className={classeSaisie}
                      value={p.y}
                      onChange={(e) => majProfil(profil.map((q, j) => (j === i ? { ...q, y: nombre(e.target.value, q.y) } : q)))}
                    />
                  </td>
                  <td className="pl-2 text-right">
                    <button
                      type="button"
                      aria-label={`Supprimer le point ${i + 1}`}
                      disabled={profil.length <= 2}
                      className="text-texte-faible hover:text-refus disabled:opacity-30"
                      onClick={() => majProfil(profil.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[11px] text-texte-faible mt-2">
            Les x doivent être croissants. Prolonger le profil de part et d'autre du talus : un cercle qui sort du profil est rejeté.
          </p>
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-texte-faible uppercase tracking-wide">Surcharges en bande</h3>
            <Bouton
              id="btn-surcharge-ajouter"
              onClick={() =>
                majSurcharges([
                  ...surcharges,
                  {
                    id: `S${Date.now()}`,
                    nom: `Surcharge ${surcharges.length + 1}`,
                    xDebut: profil[0].x,
                    xFin: profil[0].x + 3,
                    q: 10,
                    nature: 'Q',
                  },
                ])
              }
            >
              <Plus className="w-3.5 h-3.5" /> Surcharge
            </Bouton>
          </div>
          {surcharges.length === 0 ? (
            <p className="text-xs text-texte-faible">
              Aucune surcharge. Une semelle en tête de talus se saisit comme une bande permanente (G) de la largeur de la semelle.
            </p>
          ) : (
            <div className="space-y-2">
              {surcharges.map((s, i) => {
                const maj = (patch: Partial<SurchargeTalus>) =>
                  majSurcharges(surcharges.map((t, j) => (j === i ? { ...t, ...patch } : t)));
                return (
                  <div key={s.id} className="grid grid-cols-[1fr_4.5rem_4.5rem_4.5rem_3.5rem_auto] gap-2 items-end text-xs">
                    <Champ label="Nom" type="text" value={s.nom} onChange={(e) => maj({ nom: e.target.value })} />
                    <Champ label="x début" type="number" step="0.5" value={s.xDebut} onChange={(e) => maj({ xDebut: nombre(e.target.value, s.xDebut) })} />
                    <Champ label="x fin" type="number" step="0.5" value={s.xFin} onChange={(e) => maj({ xFin: nombre(e.target.value, s.xFin) })} />
                    <Champ label="q (kPa)" type="number" step="1" min="0" value={s.q} onChange={(e) => maj({ q: Math.max(0, nombre(e.target.value, s.q)) })} />
                    <div>
                      <label className="block text-texte-faible text-[11px] uppercase tracking-wide mb-1">Nature</label>
                      <select
                        aria-label="Nature de la surcharge"
                        className="w-full px-1.5 py-1.5 bg-surface border border-bordure rounded-rayon-petit"
                        value={s.nature}
                        onChange={(e) => maj({ nature: e.target.value === 'G' ? 'G' : 'Q' })}
                      >
                        <option value="G">G</option>
                        <option value="Q">Q</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      aria-label={`Supprimer ${s.nom}`}
                      className="pb-2 text-texte-faible hover:text-refus"
                      onClick={() => majSurcharges(surcharges.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
              <p className="text-[11px] text-texte-faible">
                G : permanente (γG, même facteur que le poids du sol). Q : variable, ignorée sur les tranches où elle stabilise (γQ;stb = 0).
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Coupe */}
      <Card className="!p-2">
        <CoupeTalus
          profil={profil}
          couches={modele.couches}
          coteNappe={
            affiche.combinaison.etatNappe === 'ELU'
              ? modele.hydrogeologie.nappePrincipale.coteDefavorableELU
              : modele.hydrogeologie.nappePrincipale.coteCaracteristique
          }
          surcharges={surcharges}
          cercle={cercle}
          resultat={resAffiche}
        />
      </Card>

      {/* Cercle et recherche */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <h3 className="text-xs font-semibold text-texte-faible uppercase tracking-wide flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5" />
              Cercle de rupture (Bishop simplifié)
            </h3>
            <Bouton id="btn-rechercher-cercle-critique" onClick={lancerRecherche} disabled={rechercheEnCours}>
              <Search className={`w-3.5 h-3.5 ${rechercheEnCours ? 'animate-spin' : ''}`} />
              {rechercheEnCours ? 'Recherche...' : 'Rechercher les cercles critiques'}
            </Bouton>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <Champ id="input-bishop-xc" label="Centre x (m)" type="number" step="0.5" value={Number(cercle.centreX.toFixed(2))}
              onChange={(e) => setCercle({ ...cercle, centreX: nombre(e.target.value, cercle.centreX) })} />
            <Champ id="input-bishop-yc" label="Centre cote (m)" type="number" step="0.5" value={Number(cercle.centreY.toFixed(2))}
              onChange={(e) => setCercle({ ...cercle, centreY: nombre(e.target.value, cercle.centreY) })} />
            <Champ id="input-bishop-r" label="Rayon R (m)" type="number" step="0.5" min="0.5" value={Number(cercle.rayon.toFixed(2))}
              onChange={(e) => setCercle({ ...cercle, rayon: Math.max(0.5, nombre(e.target.value, cercle.rayon)) })} />
            <Champ id="input-bishop-tranches" label="Tranches" type="number" step="5" min="10" value={nbTranches}
              onChange={(e) => setNbTranches(Math.min(200, Math.max(10, Math.round(nombre(e.target.value, 40)))))} />
            <Champ id="input-bishop-fcible" label="F cible (caract.)" type="number" step="0.05" min="1" value={Fcible}
              onChange={(e) => setFcible(Math.max(1, nombre(e.target.value, 1.5)))} />
          </div>
          <p className="mt-3 text-[11px] text-texte-faible">
            La recherche balaie une grille de centres et de rayons puis raffine localement, pour chaque combinaison : le cercle
            critique n'est pas forcément le même d'une combinaison à l'autre. Le cercle gouvernant est ensuite chargé ci-dessus.
          </p>
        </Card>

        {gouvernant ? (
          <Verdict etat={etatTaux(gouvernant.taux)} className="flex flex-col justify-between">
            <span className="text-xs">Combinaison gouvernante (cercles critiques)</span>
            <span className="text-4xl font-mono tabular-nums my-2">{gouvernant.taux.toFixed(3)}</span>
            <span className="text-[11px] font-normal">
              {gouvernant.libelle} : F_d = {gouvernant.F.toFixed(3)}. Taux = γR;e / F_d.
            </span>
          </Verdict>
        ) : (
          <div className="rounded-rayon bg-surface-appui p-3 text-xs text-texte-doux flex items-center">
            Lancer la recherche des cercles critiques pour obtenir le verdict de stabilité générale. Le tableau ci-dessous
            analyse le cercle saisi.
          </div>
        )}
      </div>

      {/* Combinaisons */}
      <div className="bg-surface border border-bordure rounded-rayon overflow-x-auto">
        <div className="px-4 py-3 bg-surface-appui border-b border-bordure text-xs font-semibold text-texte">
          Combinaisons — {modele.configurationNormative.approcheCalcul} (EN 1997-1 §11.5.1, annexe A)
        </div>
        <table className="w-full text-left text-xs border-collapse">
          <thead className="text-texte-doux border-b border-bordure">
            <tr>
              <th className="p-2 font-normal">Combinaison</th>
              <th className="p-2 font-normal text-right">γG / γQ</th>
              <th className="p-2 font-normal text-right">γφ / γc</th>
              <th className="p-2 font-normal text-right">γR;e</th>
              <th className="p-2 font-normal text-right">F (cercle saisi)</th>
              <th className="p-2 font-normal text-right">F critique</th>
              <th className="p-2 font-normal text-right">Taux</th>
              <th className="p-2 font-normal" />
            </tr>
          </thead>
          <tbody className="divide-y divide-bordure-douce font-mono">
            {resultatsCercle.map(({ combinaison: c, resultat: r }) => {
              const crit = critiques ? critiques[c.id] : undefined;
              const taux = crit ? crit.resultat.taux : r.valide ? (r as Valide).taux : NaN;
              return (
                <tr key={c.id} className={c.id === combinaisonAffichee ? 'bg-accent-doux' : ''}>
                  <td className="p-2 font-sans">{c.libelle}</td>
                  <td className="p-2 text-right">{c.gamma_G.toFixed(2)} / {c.gamma_Q.toFixed(2)}</td>
                  <td className="p-2 text-right">{c.gamma_phi.toFixed(2)} / {c.gamma_c.toFixed(2)}</td>
                  <td className="p-2 text-right">{c.gamma_Re.toFixed(2)}{c.id === 'caracteristique' ? ' (cible)' : ''}</td>
                  <td className="p-2 text-right">
                    {r.valide ? (r as Valide).F.toFixed(3) : <span className="font-sans text-texte-faible">{motifInvalide(r)}</span>}
                  </td>
                  <td className="p-2 text-right">{crit ? crit.resultat.F.toFixed(3) : crit === null ? 'aucun cercle valide' : '—'}</td>
                  <td className={`p-2 text-right ${Number.isFinite(taux) && taux > 1 ? 'text-refus font-semibold' : ''}`}>
                    {Number.isFinite(taux) ? taux.toFixed(3) : '—'}
                  </td>
                  <td className="p-2 text-right font-sans">
                    <button
                      type="button"
                      className="text-accent hover:underline"
                      onClick={() => {
                        setCombinaisonAffichee(c.id);
                        if (crit) setCercle(crit.cercle);
                      }}
                    >
                      {crit ? 'Voir le cercle critique' : 'Détailler'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-4 py-2 text-[11px] text-texte-faible border-t border-bordure-douce">
          DA1-C1 et DA2 : facteurs d'actions appliqués aux effets (moment moteur), poids caractéristiques dans la résistance.
          DA1-C2 et DA3 : facteurs appliqués aux charges (A2). Nappe : cote caractéristique pour le calcul caractéristique,
          cote défavorable ELU pour les combinaisons ELU. Taux = γR;e / F_d (≤ 1 : vérifié).
        </p>
      </div>

      {/* Sensibilité */}
      <Card className="!p-3.5 flex items-center justify-between text-xs gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-texte-faible shrink-0" />
          <span className="font-semibold text-texte-doux">Sensibilité du F caractéristique (§12.1) :</span>
          <span className="text-texte-doux">{sensibilite.resumeCourt}</span>
        </div>
        {sensibilite.parametres.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            {sensibilite.parametres.map((p, i) => (
              <span key={i} className="px-2 py-0.5 bg-surface-appui border border-bordure rounded-rayon-petit text-[11px] font-mono text-texte-doux">
                {p.label}: {p.impactPourcentPour1Pourcent >= 0 ? '+' : ''}{p.impactPourcentPour1Pourcent.toFixed(1)}%/+1%
              </span>
            ))}
          </div>
        )}
      </Card>

      {/* Détail des tranches */}
      <div className="bg-surface border border-bordure rounded-rayon overflow-hidden">
        <div className="px-4 py-3 bg-surface-appui border-b border-bordure text-xs font-semibold text-texte flex justify-between flex-wrap gap-2">
          <span>Tranches — {affiche.combinaison.libelle}</span>
          {resAffiche && (
            <span className="font-mono font-normal text-texte-doux">
              F = {resAffiche.F.toFixed(3)} · M_mot,d = {resAffiche.momentMoteur_d.toFixed(0)} kNm/m · {resAffiche.iterations} itérations
            </span>
          )}
        </div>
        {!resAffiche ? (
          <p className="p-4 text-xs text-refus">Cercle invalide : {motifInvalide(affiche.resultat)}</p>
        ) : (
          <>
            {resAffiche.avertissements.map((a, i) => (
              <p key={i} className="px-4 py-2 text-[11px] text-alerte bg-alerte-fond border-b border-bordure-douce">{a}</p>
            ))}
            <div className="max-h-72 overflow-auto">
              <table className="w-full text-left text-xs border-collapse font-mono">
                <thead className="bg-surface-appui text-texte-doux border-b border-bordure sticky top-0">
                  <tr>
                    <th className="p-2 font-normal">#</th>
                    <th className="p-2 font-normal text-right">x (m)</th>
                    <th className="p-2 font-normal text-right">b (m)</th>
                    <th className="p-2 font-normal text-right">W sol (kN/m)</th>
                    <th className="p-2 font-normal text-right">G (kN/m)</th>
                    <th className="p-2 font-normal text-right">Q (kN/m)</th>
                    <th className="p-2 font-normal text-right">u (kPa)</th>
                    <th className="p-2 font-normal text-right">α (°)</th>
                    <th className="p-2 font-normal text-right">φ'd / c'd</th>
                    <th className="p-2 font-normal text-right">m_α</th>
                    <th className="p-2 font-normal text-right">R (kN/m)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bordure-douce">
                  {resAffiche.tranches.map((t) => (
                    <tr key={t.index}>
                      <td className="p-2 text-texte-faible">{t.index + 1}</td>
                      <td className="p-2 text-right">{t.x.toFixed(2)}</td>
                      <td className="p-2 text-right">{t.largeur.toFixed(2)}</td>
                      <td className="p-2 text-right">{t.poidsSol.toFixed(1)}</td>
                      <td className="p-2 text-right">{t.surchargeG.toFixed(1)}</td>
                      <td className={`p-2 text-right ${t.surchargeQ > 0 && !t.qRetenue ? 'text-texte-faible line-through' : ''}`}>{t.surchargeQ.toFixed(1)}</td>
                      <td className="p-2 text-right">{t.pression_u.toFixed(1)}</td>
                      <td className="p-2 text-right">{t.alphaDeg.toFixed(1)}</td>
                      <td className="p-2 text-right">{t.phiPrime_d.toFixed(1)} / {t.cPrime_d.toFixed(1)}</td>
                      <td className="p-2 text-right">{t.mAlpha.toFixed(3)}</td>
                      <td className="p-2 text-right">{t.forceResistante.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <p className="text-[11px] text-texte-faible">
        Hors périmètre : surfaces non circulaires, sismique, eau libre au-dessus du terrain, nappe non horizontale,
        comportement non drainé (c_u). Couches horizontales prolongées sous le profil.
      </p>
    </div>
  );
};
