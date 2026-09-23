import React, { useState } from 'react';
import { CoucheGeotechnique, Hydrogeologie, ModeleTerrain, Referentiel, StatutGrandeur, TripletGrandeur } from '../types/geotech';
import { Plus, Trash2, AlertTriangle, ShieldCheck, Droplets, Info } from 'lucide-react';
import { Card } from './ui/Card';
import { Champ } from './ui/Champ';
import { Bouton } from './ui/Bouton';

interface OngletSolProps {
  modele: ModeleTerrain;
  onUpdateModele: (nouveauModele: ModeleTerrain) => void;
}

export const OngletSol: React.FC<OngletSolProps> = ({ modele, onUpdateModele }) => {
  const [coucheSelectionneeId, setCoucheSelectionneeId] = useState<string>(
    modele.couches.length > 0 ? modele.couches[0].id : ''
  );

  // Vérification de la jointivité des couches (Section 4.4)
  const erreursJointivite: string[] = [];
  for (let i = 0; i < modele.couches.length - 1; i++) {
    const c1 = modele.couches[i];
    const c2 = modele.couches[i + 1];
    const base1 = c1.coteToit - c1.epaisseur;
    const toit2 = c2.coteToit;
    if (Math.abs(base1 - toit2) > 0.005) {
      erreursJointivite.push(
        `Discontinuité entre "${c1.nom}" (base: ${base1.toFixed(2)}m) et "${c2.nom}" (toit: ${toit2.toFixed(2)}m)`
      );
    }
  }

  const coucheActive = modele.couches.find((c) => c.id === coucheSelectionneeId) || modele.couches[0];

  const updateReferentiel = (field: keyof Referentiel, val: any) => {
    onUpdateModele({
      ...modele,
      referentiel: {
        ...modele.referentiel,
        [field]: val,
      },
    });
  };

  const updateHydro = (champ: 'coteCaracteristique' | 'coteDefavorableELU', val: number) => {
    onUpdateModele({
      ...modele,
      hydrogeologie: {
        ...modele.hydrogeologie,
        nappePrincipale: {
          ...modele.hydrogeologie.nappePrincipale,
          [champ]: val,
        },
      },
    });
  };

  const updateCoucheChamp = (id: string, updates: Partial<CoucheGeotechnique>) => {
    const newCouches = modele.couches.map((c) => (c.id === id ? { ...c, ...updates } : c));
    onUpdateModele({
      ...modele,
      couches: newCouches,
    });
  };

  const updateTriplet = <T extends number | null>(
    id: string,
    categorie: 'poidsVolumiques' | 'resistanceDrainee' | 'resistanceNonDrainee' | 'deformation',
    clef: string,
    valeur: Partial<TripletGrandeur<T>>
  ) => {
    const newCouches = modele.couches.map((c) => {
      if (c.id !== id) return c;
      const sousObj = (c as any)[categorie];
      const tripletCourant = sousObj[clef] as TripletGrandeur<T>;
      return {
        ...c,
        [categorie]: {
          ...sousObj,
          [clef]: {
            ...tripletCourant,
            ...valeur,
          },
        },
      };
    });
    onUpdateModele({
      ...modele,
      couches: newCouches,
    });
  };

  const badgeStatut = (statut: StatutGrandeur) => {
    switch (statut) {
      case 'mesure':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">Mesure</span>;
      case 'correle':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-800">Corrélé</span>;
      case 'derive':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-100 text-purple-800">Dérivé</span>;
      case 'choix':
        return <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800">Choix ingé.</span>;
      case 'defaut':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-200 text-amber-900 border border-amber-400">
            Défaut (à confirmer)
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      {/* 1. Référentiel & Hydrogéologie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Référentiel */}
        <Card>
          <h3 className="text-sm font-semibold text-texte flex items-center gap-2 mb-3">
            Référentiel Altimétrique
          </h3>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <Champ
              id="input-ref-systeme"
              label="Système"
              type="text"
              value={modele.referentiel.systeme}
              onChange={(e) => updateReferentiel('systeme', e.target.value)}
            />
            <Champ
              id="input-ref-tn"
              label="Terrain Naturel (m)"
              type="number"
              step="0.05"
              value={modele.referentiel.coteTerrainNaturel}
              onChange={(e) => updateReferentiel('coteTerrainNaturel', parseFloat(e.target.value) || 0)}
            />
            <Champ
              id="input-ref-p0"
              label="Réf. Projet 0.00 (m)"
              type="number"
              step="0.05"
              value={modele.referentiel.coteReferenceProjet}
              onChange={(e) => updateReferentiel('coteReferenceProjet', parseFloat(e.target.value) || 0)}
            />
          </div>
          <p className="mt-2 text-[11px] text-texte-faible italic">
            Convention : altitudes absolues croissantes vers le haut (jamais de profondeurs relatives).
          </p>
        </Card>

        {/* Hydrogéologie : ELS/ELU neutres, pas de code couleur — les deux chaînes ont la
            même importance (cf. README, "jamais mélangées"). */}
        <Card>
          <h3 className="text-sm font-semibold text-texte flex items-center gap-2 mb-2">
            <Droplets className="w-4 h-4 text-texte-faible" />
            Hydrogéologie (Nappe phréatique)
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs mb-2">
            <Champ
              id="input-nappe-els"
              label="Cote Caractéristique ELS (m)"
              type="number"
              step="0.05"
              value={modele.hydrogeologie.nappePrincipale.coteCaracteristique}
              onChange={(e) => updateHydro('coteCaracteristique', parseFloat(e.target.value) || 0)}
            />
            <Champ
              id="input-nappe-elu"
              label="Cote Défavorable ELU (m)"
              type="number"
              step="0.05"
              value={modele.hydrogeologie.nappePrincipale.coteDefavorableELU}
              onChange={(e) => updateHydro('coteDefavorableELU', parseFloat(e.target.value) || 0)}
            />
          </div>
          <div className="p-2 bg-surface-appui border border-bordure rounded-rayon-petit text-[11px] text-texte-doux leading-snug">
            <span className="font-semibold text-texte">Point critique (clause 2.4.6.1) :</span> Les deux cotes,
            caractéristique (tassements) et défavorable (pressions ELU), sont physiquement distinctes et obligatoires.
          </div>
        </Card>
      </div>

      {/* Alerte si rupture de jointivité — erreur structurelle réelle, refus justifié */}
      {erreursJointivite.length > 0 && (
        <div className="p-3 bg-refus-fond border border-bordure rounded-rayon text-refus text-xs flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Erreur de stratigraphie (Section 4.4) :</span>
            <ul className="list-disc pl-4 mt-1 space-y-0.5 font-mono">
              {erreursJointivite.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* 2. Liste des Couches Géotechniques */}
      <div className="bg-surface border border-bordure rounded-rayon overflow-hidden">
        <div className="px-4 py-3 bg-surface-appui border-b border-bordure flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-texte">Stratigraphie Géotechnique du Sol</h3>
            <span className="text-xs bg-surface text-texte-doux border border-bordure px-2 py-0.5 rounded-rayon-petit font-medium">
              {modele.couches.length} couche(s) ordonnée(s)
            </span>
          </div>
          <Bouton
            id="btn-ajouter-couche"
            onClick={() => {
              const derniere = modele.couches[modele.couches.length - 1];
              const nouveauToit = derniere ? derniere.coteToit - derniere.epaisseur : modele.referentiel.coteTerrainNaturel;
              const nouvelleCouche: CoucheGeotechnique = {
                id: `C${modele.couches.length + 1}`,
                nom: `Nouvelle Couche ${modele.couches.length + 1}`,
                coteToit: Number(nouveauToit.toFixed(2)),
                epaisseur: 3.0,
                nature: 'argile',
                couleurAffichage: '#6b7280',
                poidsVolumiques: {
                  gammaHumide: { v: 19.0, u: 'kN/m3', statut: 'defaut', source: 'Prédimensionnement' },
                  gammaSature: { v: 20.0, u: 'kN/m3', statut: 'defaut', source: 'Prédimensionnement' },
                },
                resistanceDrainee: {
                  phiPrime: { v: 25.0, u: 'deg', statut: 'defaut', source: 'Prédimensionnement' },
                  phiCritique: { v: 24.0, u: 'deg', statut: 'defaut', source: 'Prédimensionnement' },
                  cPrime: { v: 5.0, u: 'kPa', statut: 'defaut', source: 'Prédimensionnement' },
                  psiDilatance: { v: 0.0, u: 'deg', statut: 'defaut', source: 'Prédimensionnement' },
                  deltaInterface: { v: 20.0, u: 'deg', statut: 'derive', source: '2/3 phi' },
                },
                resistanceNonDrainee: {
                  cuTete: { v: 50.0, u: 'kPa', statut: 'defaut', source: 'Prédimensionnement' },
                  gradientCu: { v: 1.0, u: 'kPa/m', statut: 'defaut', source: 'Prédimensionnement' },
                },
                deformation: {
                  Echargement: { v: 15.0, u: 'MPa', statut: 'defaut', source: 'Prédimensionnement' },
                  EdechargeRech: { v: 45.0, u: 'MPa', statut: 'defaut', source: 'Prédimensionnement' },
                  nu: { v: 0.3, u: '-', statut: 'choix', source: 'Standard' },
                  Eoed: { v: 18.0, u: 'MPa', statut: 'defaut', source: 'Prédimensionnement' },
                  Cc: { v: 0.18, u: '-', statut: 'defaut', source: 'Prédimensionnement' },
                  Cs: { v: 0.03, u: '-', statut: 'defaut', source: 'Prédimensionnement' },
                  e0: { v: 0.75, u: '-', statut: 'defaut', source: 'Prédimensionnement' },
                  sigmaPrecons: { v: 150.0, u: 'kPa', statut: 'defaut', source: 'Prédimensionnement' },
                  OCR: { v: null, u: '-', statut: 'derive', source: '-' },
                  Calpha: { v: 0.003, u: '-', statut: 'choix', source: 'Standard' },
                  cv: { v: 2.0e-7, u: 'm2/s', statut: 'defaut', source: 'Standard' },
                  k: { v: 1.0e-9, u: 'm/s', statut: 'defaut', source: 'Standard' },
                },
              };
              onUpdateModele({
                ...modele,
                couches: [...modele.couches, nouvelleCouche],
              });
              setCoucheSelectionneeId(nouvelleCouche.id);
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Ajouter une couche
          </Bouton>
        </div>

        {/* Onglets de sélection des couches */}
        <div className="flex border-b border-bordure overflow-x-auto bg-surface-appui/50 p-1.5 gap-1.5">
          {modele.couches.map((c) => (
            <button
              key={c.id}
              id={`tab-couche-${c.id}`}
              onClick={() => setCoucheSelectionneeId(c.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-rayon-petit text-xs font-medium transition-colors whitespace-nowrap ${
                c.id === coucheSelectionneeId
                  ? 'bg-surface text-texte border border-bordure font-semibold'
                  : 'text-texte-doux hover:bg-surface-appui'
              }`}
            >
              <span className="w-3 h-3 rounded-full border border-black/10" style={{ backgroundColor: c.couleurAffichage }}></span>
              <span>{c.id} : {c.nom}</span>
              <span className="text-[11px] text-texte-faible">({c.epaisseur}m)</span>
            </button>
          ))}
        </div>

        {/* Détail complet de la couche sélectionnée avec le TRIPLET (Valeur / Statut / Source) */}
        {coucheActive && (
          <div className="p-4 space-y-4">
            {/* Entête de couche */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-surface-appui rounded-rayon border border-bordure text-xs">
              <div>
                <label className="block text-texte-doux mb-1">Identifiant</label>
                <input
                  type="text"
                  value={coucheActive.id}
                  onChange={(e) => updateCoucheChamp(coucheActive.id, { id: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-bordure rounded-rayon-petit bg-surface font-mono font-semibold"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-texte-doux mb-1">Nom géologique</label>
                <input
                  type="text"
                  value={coucheActive.nom}
                  onChange={(e) => updateCoucheChamp(coucheActive.id, { nom: e.target.value })}
                  className="w-full px-2.5 py-1.5 border border-bordure rounded-rayon-petit bg-surface font-semibold"
                />
              </div>
              <div>
                <label className="block text-texte-doux mb-1">Nature de sol</label>
                <select
                  value={coucheActive.nature}
                  onChange={(e) => updateCoucheChamp(coucheActive.id, { nature: e.target.value as any })}
                  className="w-full px-2.5 py-1.5 border border-bordure rounded-rayon-petit bg-surface"
                >
                  <option value="sable">Sable (grenu)</option>
                  <option value="argile">Argile (fin)</option>
                  <option value="limon">Limon</option>
                  <option value="remblai">Remblai</option>
                  <option value="roche">Roche / Substratum</option>
                  <option value="tourbe">Tourbe</option>
                </select>
              </div>
              <Champ
                label="Cote Toit (m)"
                type="number"
                step="0.05"
                value={coucheActive.coteToit}
                onChange={(e) => updateCoucheChamp(coucheActive.id, { coteToit: parseFloat(e.target.value) || 0 })}
              />
              <Champ
                label="Épaisseur (m)"
                type="number"
                step="0.05"
                min="0.1"
                value={coucheActive.epaisseur}
                onChange={(e) => updateCoucheChamp(coucheActive.id, { epaisseur: parseFloat(e.target.value) || 0.1 })}
              />
              <div>
                <label className="block text-texte-doux mb-1">Cote Base calculée</label>
                <div className="px-2.5 py-1.5 bg-surface-appui rounded-rayon-petit font-mono text-texte-doux font-semibold">
                  {(coucheActive.coteToit - coucheActive.epaisseur).toFixed(2)} m
                </div>
              </div>
              <div>
                <label className="block text-texte-doux mb-1">Couleur d'affichage</label>
                <input
                  type="color"
                  value={coucheActive.couleurAffichage}
                  onChange={(e) => updateCoucheChamp(coucheActive.id, { couleurAffichage: e.target.value })}
                  className="w-full h-8 px-1 py-0.5 border border-bordure rounded-rayon-petit cursor-pointer"
                />
              </div>
            </div>

            {/* TABLEAU DES TRIPLET VALEUR / STATUT / SOURCE */}
            <div className="space-y-4">
              <div className="border border-bordure rounded-rayon overflow-hidden">
                <div className="px-3 py-2 bg-surface-appui border-b border-bordure text-xs font-semibold text-texte-doux flex items-center justify-between">
                  <span>Paramètres Mécaniques & Triplet de Traçabilité</span>
                  <span className="text-[11px] font-normal text-texte-doux">
                    Triplet obligatoire : Valeur • Statut • Source
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-surface-appui text-texte-doux border-b border-bordure">
                        <th className="p-2.5 font-medium">Grandeur</th>
                        <th className="p-2.5 font-medium w-28">Valeur</th>
                        <th className="p-2.5 font-medium w-16">Unité</th>
                        <th className="p-2.5 font-medium w-32">Statut normatif</th>
                        <th className="p-2.5 font-medium">Source / Référence d'essai</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bordure-douce">
                      {/* Poids volumique humide */}
                      <tr>
                        <td className="p-2.5 font-medium text-texte-doux">Poids volumique humide (γ_h)</td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.1"
                            value={coucheActive.poidsVolumiques.gammaHumide.v}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'poidsVolumiques', 'gammaHumide', {
                                v: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-2 py-1 border border-bordure rounded-rayon-petit font-semibold text-texte bg-surface"
                          />
                        </td>
                        <td className="p-2 text-texte-doux font-mono">kN/m³</td>
                        <td className="p-2">
                          <select
                            value={coucheActive.poidsVolumiques.gammaHumide.statut}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'poidsVolumiques', 'gammaHumide', {
                                statut: e.target.value as any,
                              })
                            }
                            className="w-full text-xs p-1 border border-bordure rounded-rayon-petit bg-surface"
                          >
                            <option value="mesure">Mesure</option>
                            <option value="correle">Corrélé</option>
                            <option value="derive">Dérivé</option>
                            <option value="choix">Choix</option>
                            <option value="defaut">Défaut</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={coucheActive.poidsVolumiques.gammaHumide.source}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'poidsVolumiques', 'gammaHumide', {
                                source: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 border border-bordure rounded-rayon-petit text-texte-doux text-xs bg-surface"
                          />
                        </td>
                      </tr>

                      {/* Poids volumique saturé */}
                      <tr>
                        <td className="p-2.5 font-medium text-texte-doux">Poids volumique saturé (γ_sat)</td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.1"
                            value={coucheActive.poidsVolumiques.gammaSature.v}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'poidsVolumiques', 'gammaSature', {
                                v: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-2 py-1 border border-bordure rounded-rayon-petit font-semibold text-texte bg-surface"
                          />
                        </td>
                        <td className="p-2 text-texte-doux font-mono">kN/m³</td>
                        <td className="p-2">
                          <select
                            value={coucheActive.poidsVolumiques.gammaSature.statut}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'poidsVolumiques', 'gammaSature', {
                                statut: e.target.value as any,
                              })
                            }
                            className="w-full text-xs p-1 border border-bordure rounded-rayon-petit bg-surface"
                          >
                            <option value="mesure">Mesure</option>
                            <option value="correle">Corrélé</option>
                            <option value="derive">Dérivé</option>
                            <option value="choix">Choix</option>
                            <option value="defaut">Défaut</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={coucheActive.poidsVolumiques.gammaSature.source}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'poidsVolumiques', 'gammaSature', {
                                source: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 border border-bordure rounded-rayon-petit text-texte-doux text-xs bg-surface"
                          />
                        </td>
                      </tr>

                      {/* Angle de frottement effectif phi' */}
                      <tr>
                        <td className="p-2.5 font-semibold text-texte">Angle frottement effectif (φ'_k)</td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.5"
                            value={coucheActive.resistanceDrainee.phiPrime.v}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'resistanceDrainee', 'phiPrime', {
                                v: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-2 py-1 border border-bordure rounded-rayon-petit font-semibold text-texte bg-surface"
                          />
                        </td>
                        <td className="p-2 text-texte-doux font-mono">deg (°)</td>
                        <td className="p-2">
                          <select
                            value={coucheActive.resistanceDrainee.phiPrime.statut}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'resistanceDrainee', 'phiPrime', {
                                statut: e.target.value as any,
                              })
                            }
                            className="w-full text-xs p-1 border border-bordure rounded-rayon-petit bg-surface"
                          >
                            <option value="mesure">Mesure</option>
                            <option value="correle">Corrélé</option>
                            <option value="derive">Dérivé</option>
                            <option value="choix">Choix</option>
                            <option value="defaut">Défaut</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={coucheActive.resistanceDrainee.phiPrime.source}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'resistanceDrainee', 'phiPrime', {
                                source: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 border border-bordure rounded-rayon-petit text-texte-doux text-xs bg-surface"
                          />
                        </td>
                      </tr>

                      {/* Cohésion effective c' */}
                      <tr>
                        <td className="p-2.5 font-semibold text-texte">Cohésion effective (c'_k)</td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.5"
                            value={coucheActive.resistanceDrainee.cPrime.v}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'resistanceDrainee', 'cPrime', {
                                v: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-2 py-1 border border-bordure rounded-rayon-petit font-semibold text-texte bg-surface"
                          />
                        </td>
                        <td className="p-2 text-texte-doux font-mono">kPa</td>
                        <td className="p-2">
                          <select
                            value={coucheActive.resistanceDrainee.cPrime.statut}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'resistanceDrainee', 'cPrime', {
                                statut: e.target.value as any,
                              })
                            }
                            className="w-full text-xs p-1 border border-bordure rounded-rayon-petit bg-surface"
                          >
                            <option value="mesure">Mesure</option>
                            <option value="correle">Corrélé</option>
                            <option value="derive">Dérivé</option>
                            <option value="choix">Choix</option>
                            <option value="defaut">Défaut</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={coucheActive.resistanceDrainee.cPrime.source}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'resistanceDrainee', 'cPrime', {
                                source: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 border border-bordure rounded-rayon-petit text-texte-doux text-xs bg-surface"
                          />
                        </td>
                      </tr>

                      {/* Cohésion non drainée cu */}
                      <tr>
                        <td className="p-2.5 font-medium text-texte-doux">Cohésion non drainée (cu)</td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="1"
                            value={coucheActive.resistanceNonDrainee.cuTete.v}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'resistanceNonDrainee', 'cuTete', {
                                v: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-2 py-1 border border-bordure rounded-rayon-petit font-semibold text-texte bg-surface"
                          />
                        </td>
                        <td className="p-2 text-texte-doux font-mono">kPa</td>
                        <td className="p-2">
                          <select
                            value={coucheActive.resistanceNonDrainee.cuTete.statut}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'resistanceNonDrainee', 'cuTete', {
                                statut: e.target.value as any,
                              })
                            }
                            className="w-full text-xs p-1 border border-bordure rounded-rayon-petit bg-surface"
                          >
                            <option value="mesure">Mesure</option>
                            <option value="correle">Corrélé</option>
                            <option value="derive">Dérivé</option>
                            <option value="choix">Choix</option>
                            <option value="defaut">Défaut</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={coucheActive.resistanceNonDrainee.cuTete.source}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'resistanceNonDrainee', 'cuTete', {
                                source: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 border border-bordure rounded-rayon-petit text-texte-doux text-xs bg-surface"
                          />
                        </td>
                      </tr>

                      {/* Indice de compression Cc */}
                      <tr>
                        <td className="p-2.5 font-semibold text-texte">Indice de compression (Cc)</td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            value={coucheActive.deformation.Cc.v}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'deformation', 'Cc', {
                                v: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-2 py-1 border border-bordure rounded-rayon-petit font-semibold text-texte bg-surface"
                          />
                        </td>
                        <td className="p-2 text-texte-doux font-mono">-</td>
                        <td className="p-2">
                          <select
                            value={coucheActive.deformation.Cc.statut}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'deformation', 'Cc', {
                                statut: e.target.value as any,
                              })
                            }
                            className="w-full text-xs p-1 border border-bordure rounded-rayon-petit bg-surface"
                          >
                            <option value="mesure">Mesure</option>
                            <option value="correle">Corrélé</option>
                            <option value="derive">Dérivé</option>
                            <option value="choix">Choix</option>
                            <option value="defaut">Défaut</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={coucheActive.deformation.Cc.source}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'deformation', 'Cc', {
                                source: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 border border-bordure rounded-rayon-petit text-texte-doux text-xs bg-surface"
                          />
                        </td>
                      </tr>

                      {/* Indice de gonflement Cs */}
                      <tr>
                        <td className="p-2.5 font-semibold text-texte">Indice de recompression (Cs)</td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.005"
                            value={coucheActive.deformation.Cs.v}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'deformation', 'Cs', {
                                v: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-2 py-1 border border-bordure rounded-rayon-petit font-semibold text-texte bg-surface"
                          />
                        </td>
                        <td className="p-2 text-texte-doux font-mono">-</td>
                        <td className="p-2">
                          <select
                            value={coucheActive.deformation.Cs.statut}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'deformation', 'Cs', {
                                statut: e.target.value as any,
                              })
                            }
                            className="w-full text-xs p-1 border border-bordure rounded-rayon-petit bg-surface"
                          >
                            <option value="mesure">Mesure</option>
                            <option value="correle">Corrélé</option>
                            <option value="derive">Dérivé</option>
                            <option value="choix">Choix</option>
                            <option value="defaut">Défaut</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={coucheActive.deformation.Cs.source}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'deformation', 'Cs', {
                                source: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 border border-bordure rounded-rayon-petit text-texte-doux text-xs bg-surface"
                          />
                        </td>
                      </tr>

                      {/* Indice des vides e0 */}
                      <tr>
                        <td className="p-2.5 font-semibold text-texte">Indice des vides initial (e0)</td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            value={coucheActive.deformation.e0.v}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'deformation', 'e0', {
                                v: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-2 py-1 border border-bordure rounded-rayon-petit font-semibold text-texte bg-surface"
                          />
                        </td>
                        <td className="p-2 text-texte-doux font-mono">-</td>
                        <td className="p-2">
                          <select
                            value={coucheActive.deformation.e0.statut}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'deformation', 'e0', {
                                statut: e.target.value as any,
                              })
                            }
                            className="w-full text-xs p-1 border border-bordure rounded-rayon-petit bg-surface"
                          >
                            <option value="mesure">Mesure</option>
                            <option value="correle">Corrélé</option>
                            <option value="derive">Dérivé</option>
                            <option value="choix">Choix</option>
                            <option value="defaut">Défaut</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={coucheActive.deformation.e0.source}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'deformation', 'e0', {
                                source: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 border border-bordure rounded-rayon-petit text-texte-doux text-xs bg-surface"
                          />
                        </td>
                      </tr>

                      {/* Pression de préconsolidation sigma_p */}
                      <tr>
                        <td className="p-2.5 font-semibold text-texte">Pression préconsolidation (σ'p)</td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="10"
                            value={coucheActive.deformation.sigmaPrecons.v}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'deformation', 'sigmaPrecons', {
                                v: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-2 py-1 border border-bordure rounded-rayon-petit font-semibold text-texte bg-surface"
                          />
                        </td>
                        <td className="p-2 text-texte-doux font-mono">kPa</td>
                        <td className="p-2">
                          <select
                            value={coucheActive.deformation.sigmaPrecons.statut}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'deformation', 'sigmaPrecons', {
                                statut: e.target.value as any,
                              })
                            }
                            className="w-full text-xs p-1 border border-bordure rounded-rayon-petit bg-surface"
                          >
                            <option value="mesure">Mesure</option>
                            <option value="correle">Corrélé</option>
                            <option value="derive">Dérivé</option>
                            <option value="choix">Choix</option>
                            <option value="defaut">Défaut</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="text"
                            value={coucheActive.deformation.sigmaPrecons.source}
                            onChange={(e) =>
                              updateTriplet(coucheActive.id, 'deformation', 'sigmaPrecons', {
                                source: e.target.value,
                              })
                            }
                            className="w-full px-2 py-1 border border-bordure rounded-rayon-petit text-texte-doux text-xs bg-surface"
                          />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
