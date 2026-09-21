import React, { useState, useMemo, useEffect } from 'react';
import {
  ModeleTerrain,
  OuvrageSoutenement,
  PhaseParoi,
  AppuiPhase,
  CoucheGeotechnique,
} from '../../types/geotech';
import {
  calculerParoiPhasee,
  ParametresParoiPhasee,
  ResultatCalculParoiPhasee,
  ResultatPhaseParoi,
} from '../../modules/soutenement/paroiPhasee';
import { verifierRenardFondDeFouille } from '../../briques/hydraulique';
import {
  calculerSurcoucheBerlinoise,
  ParametresProfileBerlinoise,
  ResultatSurcoucheBerlinoisePhase,
} from '../../modules/soutenement/berlinoise';
import { trouverCoucheACote } from '../../core/profilContraintes';
import {
  Layers,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  Plus,
  Trash2,
  AlertTriangle,
  Info,
  Maximize2,
  Activity,
  CheckCircle2,
  Download,
  Tag,
  ChevronDown,
} from 'lucide-react';
import { BoiteEtiquette1D, BoiteEtiquetteResolue, resoudreAntiCollision1D } from '../../core/antiCollisionEtiquettes';

export type TypeEtiquetteParoi =
  | 'cotesElevation'
  | 'fondFouille'
  | 'appuis'
  | 'extremums'
  | 'zones';

const TYPES_ETIQUETTES_PAROI_CONFIG: {
  id: TypeEtiquetteParoi;
  label: string;
  dotColor: string;
  description: string;
}[] = [
  { id: 'cotesElevation', label: 'Cotes élévation', dotColor: 'bg-slate-500', description: 'Cotes altimétriques de la paroi (axe Y)' },
  { id: 'fondFouille', label: 'Fond de fouille', dotColor: 'bg-rose-500', description: 'Ligne et cote du fond de fouille de la phase active' },
  { id: 'appuis', label: 'Appuis', dotColor: 'bg-amber-500', description: 'Libellés et cotes des butons et tirants' },
  { id: 'extremums', label: 'Extrémums', dotColor: 'bg-sky-500', description: 'Valeurs numériques max et min des courbes' },
  { id: 'zones', label: 'Zones', dotColor: 'bg-indigo-500', description: 'Indications textuelles Amont et Fiche' },
];

interface OngletParoiPhaseeProps {
  modele: ModeleTerrain;
  onUpdateSoutenement?: (soutenement: OuvrageSoutenement) => void;
}

export const OngletParoiPhasee: React.FC<OngletParoiPhaseeProps> = ({
  modele,
  onUpdateSoutenement,
}) => {
  // 1. Définition ou extraction de la paroi active
  const soutenementExistant = modele.ouvrages.soutenements.find(
    (s) => s.type === 'paroiFlexible'
  );

  // Valeurs par défaut si non initialisé : dérivées du terrain naturel RÉEL du projet, jamais
  // de cotes absolues codées en dur — un écran de tête à 100/88 sans rapport avec la
  // stratigraphie réelle (souvent à une tout autre altitude, ex. 245 m) produit un profil de
  // pression limite nul partout (aucune couche ne recoupe cette plage), donc des ressorts de
  // sol sans capacité et une paroi numériquement instable (voir revue Claude 2026-09-17).
  const coteTNReelle = modele.referentiel.coteTerrainNaturel;
  const [coteTete, setCoteTete] = useState<number>(
    soutenementExistant?.coteTete ?? coteTNReelle
  );
  const [coteBase, setCoteBase] = useState<number>(
    soutenementExistant?.coteBase ??
      (soutenementExistant?.coteFondFouille
        ? soutenementExistant.coteFondFouille - 6.0
        : coteTNReelle - 12.0)
  );
  const [epaisseur, setEpaisseur] = useState<number>(
    soutenementExistant?.epaisseurVoile ?? 0.6
  );
  const [sousType, setSousType] = useState<'continue' | 'berlinoise'>(
    soutenementExistant?.sousType === 'berlinoise' ? 'berlinoise' : 'continue'
  );
  const [entraxeProfiles, setEntraxeProfiles] = useState<number>(
    soutenementExistant?.parametresBerlinoise?.entraxeProfiles ?? 1.2
  );
  const [profileI, setProfileI] = useState<number>(
    soutenementExistant?.parametresBerlinoise?.profile.I ?? 0.0003
  ); // m⁴, ex HEB 300 ~ 2.5e-4 m⁴
  const [profileW, setProfileW] = useState<number>(
    soutenementExistant?.parametresBerlinoise?.profile.W ?? 0.0017
  ); // m³
  const [profileLargeur, setProfileLargeur] = useState<number>(
    soutenementExistant?.parametresBerlinoise?.profile.largeur ?? 0.3
  ); // m
  const [blindageHauteurPasse, setBlindageHauteurPasse] = useState<number>(
    soutenementExistant?.parametresBerlinoise?.blindage.hauteurPasse ?? 1.0
  ); // m
  const [blindageEpaisseur, setBlindageEpaisseur] = useState<number>(
    soutenementExistant?.parametresBerlinoise?.blindage.epaisseur ?? 0.05
  ); // m
  const [blindageContrainteAdm, setBlindageContrainteAdm] = useState<number>(
    soutenementExistant?.parametresBerlinoise?.blindage.contrainteAdmissible ?? 10000
  ); // kPa
  const [moduleE_GPa, setModuleE_GPa] = useState<number>(soutenementExistant?.moduleE_GPa ?? 30.0); // 30 GPa béton
  const [etatCalcul, setEtatCalcul] = useState<'ELS' | 'ELU'>(soutenementExistant?.etatCalcul ?? 'ELS');
  const [phaseActiveIndex, setPhaseActiveIndex] = useState<number>(0);
  const [vueEnveloppe, setVueEnveloppe] = useState<boolean>(false);
  const [diagrammeAffiche, setDiagrammeAffiche] = useState<
    'tous' | 'deformee' | 'moment' | 'tranchant' | 'pressions'
  >('tous');

  // Filtrage et masquage des types d'étiquettes du diagramme
  const [filtreEtiquettesOuvert, setFiltreEtiquettesOuvert] = useState(false);
  const [visibilitesEtiquettes, setVisibilitesEtiquettes] = useState<Record<TypeEtiquetteParoi, boolean>>({
    cotesElevation: true,
    fondFouille: true,
    appuis: true,
    extremums: true,
    zones: true,
  });

  const toggleTypeEtiquette = (type: TypeEtiquetteParoi) => {
    setVisibilitesEtiquettes((prev) => ({ ...prev, [type]: !prev[type] }));
  };

  const toutMasquerEtiquettes = () => {
    setVisibilitesEtiquettes({
      cotesElevation: false,
      fondFouille: false,
      appuis: false,
      extremums: false,
      zones: false,
    });
  };

  const toutAfficherEtiquettes = () => {
    setVisibilitesEtiquettes({
      cotesElevation: true,
      fondFouille: true,
      appuis: true,
      extremums: true,
      zones: true,
    });
  };

  const nbActivesParoi = Object.values(visibilitesEtiquettes).filter(Boolean).length;
  const totalTypesParoi = TYPES_ETIQUETTES_PAROI_CONFIG.length;

  // Phases d'excavation configurables
  const [phases, setPhases] = useState<PhaseParoi[]>(() => {
    if (soutenementExistant?.phases && soutenementExistant.phases.length > 0) {
      return soutenementExistant.phases;
    }
    return [
      {
        numero: 1,
        nom: 'Phase 1 : Terrassement provisoire (-3.0 m)',
        coteFondFouille: coteTNReelle - 3.0,
      },
      {
        numero: 2,
        nom: 'Phase 2 : Pose Buton lit 1 + Fouille intermédiaire (-6.0 m)',
        coteFondFouille: coteTNReelle - 6.0,
      },
      {
        numero: 3,
        nom: 'Phase 3 : Terrassement final fond de fouille (-8.0 m)',
        coteFondFouille: coteTNReelle - 8.0,
      },
    ];
  });

  // Appuis configurables (butons / tirants)
  const [appuis, setAppuis] = useState<AppuiPhase[]>(() => {
    if (soutenementExistant?.appuisPhases) {
      return soutenementExistant.appuisPhases;
    }
    return [
      {
        id: 'BUTON-01',
        cote: coteTNReelle - 2.0,
        type: 'buton',
        raideur: 100000, // 100 MN/m = 100 000 kN/m
        reactionMax: 500, // 500 kN/m
        phaseActivation: 2,
      },
    ];
  });

  // Saisie directe de kh (kN/m³) par couche
  const [khParCouche, setKhParCouche] = useState<Record<string, number>>(() => {
    // Reprendre les valeurs persistées si elles couvrent bien toutes les couches actuelles
    // (un projet dont les couches ont changé depuis la dernière sauvegarde retombe sur
    // l'heuristique par nature de sol plutôt que d'utiliser des kh partiels/obsolètes).
    if (
      soutenementExistant?.khParCouche &&
      modele.couches.every((c) => soutenementExistant.khParCouche![c.id] !== undefined)
    ) {
      return soutenementExistant.khParCouche;
    }
    const initial: Record<string, number> = {};
    for (const c of modele.couches) {
      // Valeurs représentatives indicatives selon la lithologie
      if (c.nature === 'sable' || c.nature === 'grave') {
        initial[c.id] = 40000;
      } else if (c.nature === 'argile' || c.nature === 'limon') {
        initial[c.id] = 15000;
      } else if (c.nature === 'roche') {
        initial[c.id] = 120000;
      } else {
        initial[c.id] = 20000;
      }
    }
    return initial;
  });

  // Inertie et section calculées par mètre linéaire.
  // Berlinoise : rigidité "lissée" = rigidité du profilé isolé répartie sur son entraxe
  // (le solveur Niveau 2 travaille par mètre linéaire de paroi, pas par profilé).
  const E_kPa = sousType === 'berlinoise' ? 210.0e6 : moduleE_GPa * 1e6; // 210 GPa acier
  const I_m4 = sousType === 'berlinoise' ? profileI / entraxeProfiles : (1.0 * Math.pow(epaisseur, 3)) / 12;
  const A_m2 = sousType === 'berlinoise' ? profileLargeur / entraxeProfiles : 1.0 * epaisseur;

  // 2. Calcul par éléments finis phasé
  const resultatCalcul: ResultatCalculParoiPhasee | null = useMemo(() => {
    try {
      const params: ParametresParoiPhasee = {
        coteTete,
        coteBase,
        E: E_kPa,
        I: I_m4,
        A: A_m2,
        couches: modele.couches,
        hydrogeologie: modele.hydrogeologie,
        configurationNormative: modele.configurationNormative,
        etat: etatCalcul,
        phases,
        appuis,
        khParCouche,
        pasMaillage: 0.25,
      };
      return calculerParoiPhasee(params);
    } catch (e) {
      console.error('Erreur lors du calcul de paroi phasée :', e);
      return null;
    }
  }, [
    coteTete,
    coteBase,
    E_kPa,
    I_m4,
    A_m2,
    sousType,
    entraxeProfiles,
    modele.couches,
    modele.hydrogeologie,
    modele.configurationNormative,
    etatCalcul,
    phases,
    appuis,
    khParCouche,
  ]);

  // Phase couramment visualisée
  const phaseIndexEffectif = Math.min(phaseActiveIndex, (resultatCalcul?.phases.length ?? 1) - 1);
  const phaseCourante: ResultatPhaseParoi | null =
    resultatCalcul && resultatCalcul.phases.length > 0
      ? resultatCalcul.phases[phaseIndexEffectif]
      : null;

  // Vérification de la sécurité au Renard Hydraulique en fond de fouille (CDC §9.2 / EC7 UPL/HYD)
  const verifRenard = useMemo(() => {
    if (!phaseCourante) return null;
    const coteFouille = phaseCourante.phase.coteFondFouille;
    const ficheT = coteFouille - coteBase;
    if (ficheT <= 0.1) return null;

    const coteNappeAmont =
      phaseCourante.phase.hydrogeologieAmont?.nappePrincipale.coteCaracteristique ??
      modele.hydrogeologie.nappePrincipale.coteCaracteristique;

    if (coteNappeAmont <= coteFouille) return null;

    const coucheFond = trouverCoucheACote(modele.couches, coteFouille - 0.1) || modele.couches[0];
    const gammaSat = coucheFond?.poidsVolumiques.gammaSature.v ?? 20.0;
    const gammaEau = modele.hydrogeologie.poidsVolumiqueEau || 9.81;

    return verifierRenardFondDeFouille(gammaSat, coteNappeAmont, coteFouille, ficheT, gammaEau);
  }, [phaseCourante, coteBase, modele.hydrogeologie, modele.couches]);

  // Surcouche Berlinoise (§8.5) : répartition profilé/blindage, stabilité front non soutenu,
  // résistance blindage posé, fiche réduite + garde-fou local (cf. DEVPLAN)
  const surcoucheBerlinoise: ResultatSurcoucheBerlinoisePhase[] | null = useMemo(() => {
    if (sousType !== 'berlinoise' || !resultatCalcul) return null;
    const parametres: ParametresProfileBerlinoise = {
      entraxeProfiles,
      profile: { I: profileI, W: profileW, largeur: profileLargeur },
      blindage: {
        hauteurPasse: blindageHauteurPasse,
        epaisseur: blindageEpaisseur,
        contrainteAdmissible: blindageContrainteAdm,
      },
    };
    try {
      return calculerSurcoucheBerlinoise(
        resultatCalcul,
        parametres,
        modele.couches,
        modele.configurationNormative
      );
    } catch (e) {
      console.error('Erreur lors du calcul de la surcouche Berlinoise :', e);
      return null;
    }
  }, [
    sousType,
    resultatCalcul,
    entraxeProfiles,
    profileI,
    profileW,
    profileLargeur,
    blindageHauteurPasse,
    blindageEpaisseur,
    blindageContrainteAdm,
    modele.couches,
    modele.configurationNormative,
  ]);

  const phaseBerlinoiseCourante: ResultatSurcoucheBerlinoisePhase | null =
    surcoucheBerlinoise && surcoucheBerlinoise.length > 0
      ? surcoucheBerlinoise[phaseIndexEffectif] ?? null
      : null;

  // Synchronisation vers le modèle persisté (IndexedDB via App.tsx). Ne PAS ajouter modele,
  // soutenementExistant ou onUpdateSoutenement aux dépendances : onUpdateSoutenement n'est
  // pas mémoïsée côté App.tsx, une nouvelle référence est créée à chaque sauvegarde, ce qui
  // bouclerait à l'infini si elle déclenchait elle-même cet effet.
  useEffect(() => {
    if (!onUpdateSoutenement) return;
    const ouvrage: OuvrageSoutenement = {
      id: soutenementExistant?.id ?? 'PAROI-01',
      nom: soutenementExistant?.nom ?? 'Paroi phasée',
      type: 'paroiFlexible',
      hauteurTotale: coteTete - coteBase,
      coteTete,
      coteFondFouille: phases[phases.length - 1]?.coteFondFouille ?? coteTete,
      coteBase,
      epaisseurVoile: epaisseur,
      surchargeQ: soutenementExistant?.surchargeQ ?? 0,
      inclinaisonTerrePlein: soutenementExistant?.inclinaisonTerrePlein ?? 0,
      frottementDeltaSurPhi: soutenementExistant?.frottementDeltaSurPhi ?? 0.667,
      butons: [],
      phases,
      appuisPhases: appuis,
      EI: E_kPa * I_m4,
      EA: E_kPa * A_m2,
      moduleE_GPa,
      etatCalcul,
      khParCouche,
      sousType,
      parametresBerlinoise:
        sousType === 'berlinoise'
          ? {
              entraxeProfiles,
              profile: { I: profileI, W: profileW, largeur: profileLargeur },
              blindage: {
                hauteurPasse: blindageHauteurPasse,
                epaisseur: blindageEpaisseur,
                contrainteAdmissible: blindageContrainteAdm,
              },
            }
          : undefined,
    };
    onUpdateSoutenement(ouvrage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- voir commentaire ci-dessus
  }, [
    coteTete, coteBase, epaisseur, moduleE_GPa, etatCalcul, phases, appuis, khParCouche,
    sousType, entraxeProfiles, profileI, profileW, profileLargeur,
    blindageHauteurPasse, blindageEpaisseur, blindageContrainteAdm, E_kPa, I_m4, A_m2,
  ]);

  // Gestion des modifications de phases
  const handleAddPhase = () => {
    const nouveauNum = phases.length + 1;
    const cotePrecedente = phases[phases.length - 1]?.coteFondFouille ?? coteTete - 2;
    const nouvellePhase: PhaseParoi = {
      numero: nouveauNum,
      nom: `Phase ${nouveauNum} : Approfondissement (-${(coteTete - (cotePrecedente - 1.5)).toFixed(1)} m)`,
      coteFondFouille: Math.max(coteBase + 1.0, cotePrecedente - 1.5),
    };
    setPhases([...phases, nouvellePhase]);
    setPhaseActiveIndex(phases.length);
  };

  const handleDeletePhase = (index: number) => {
    if (phases.length <= 1) return;
    const nouvellesPhases = phases
      .filter((_, i) => i !== index)
      .map((p, idx) => ({ ...p, numero: idx + 1 }));
    setPhases(nouvellesPhases);
    setPhaseActiveIndex(Math.max(0, index - 1));
  };

  const handleUpdatePhase = (index: number, champ: keyof PhaseParoi, val: any) => {
    const copie = [...phases];
    copie[index] = { ...copie[index], [champ]: val };
    setPhases(copie);
  };

  // Gestion des appuis
  const handleAddAppui = () => {
    const nouvelAppui: AppuiPhase = {
      id: `APPUI-${appuis.length + 1}`,
      cote: coteTete - 2.0,
      type: 'buton',
      raideur: 100000,
      reactionMax: 600,
      phaseActivation: Math.min(2, phases.length),
    };
    setAppuis([...appuis, nouvelAppui]);
  };

  const handleDeleteAppui = (id: string) => {
    setAppuis(appuis.filter((a) => a.id !== id));
  };

  const handleUpdateAppui = (id: string, champ: keyof AppuiPhase, val: any) => {
    setAppuis(
      appuis.map((a) => (a.id === id ? { ...a, [champ]: val } : a))
    );
  };

  // Export CSV des résultats
  const exporterCSV = () => {
    if (!resultatCalcul || !phaseCourante) return;
    let csv = 'Cote (m);Profondeur (m);Deplacement ux (mm);Moment M (kNm/m);Tranchant V (kN/m);Pa (kPa);Pp (kPa)\n';
    const cotes = resultatCalcul.cotes;
    const depl = phaseCourante.resultatSolveur.deplacements;
    const eff = phaseCourante.resultatSolveur.effortsInternes;
    const prof = phaseCourante.profilPressionLimite;

    for (let i = 0; i < cotes.length; i++) {
      const cote = cotes[i];
      const profPt = prof.find((p) => Math.abs(p.cote - cote) < 1e-3);
      const d = depl[i]?.ux ?? 0;
      const m = eff[i]?.M ?? 0;
      const v = eff[i]?.V ?? 0;
      csv += `${cote.toFixed(2)};${(coteTete - cote).toFixed(2)};${(d * 1000).toFixed(3)};${m.toFixed(2)};${v.toFixed(2)};${(profPt?.Pa ?? 0).toFixed(2)};${(profPt?.Pp ?? 0).toFixed(2)}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Paroi_Phasee_${phaseCourante.phase.nom.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 1. Entête et Sélecteur de Phases */}
      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Module C Niveau 2 : Paroi Flexible Phasée (EN 1997-1 §8.4)
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                Poutre-ressorts non linéaires
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Modélisation de l'histoire de construction par chaînage des déplacements et plastification élastoplastique du sol.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setEtatCalcul('ELS')}
                className={`px-3 py-1 rounded-md transition ${
                  etatCalcul === 'ELS'
                    ? 'bg-white text-sky-950 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ELS
              </button>
              <button
                type="button"
                onClick={() => setEtatCalcul('ELU')}
                className={`px-3 py-1 rounded-md transition ${
                  etatCalcul === 'ELU'
                    ? 'bg-white text-rose-950 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                ELU (DA2*)
              </button>
            </div>

            <button
              type="button"
              onClick={exporterCSV}
              disabled={!resultatCalcul}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exporter CSV</span>
            </button>
          </div>
        </div>

        {/* Barre de navigation des phases */}
        <div className="mt-3 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {phases.map((p, idx) => {
              const resP = resultatCalcul?.phases[idx];
              const nonConverge = resP && !resP.resultatSolveur.convergence.convergé;
              return (
                <button
                  key={p.numero}
                  type="button"
                  onClick={() => {
                    setVueEnveloppe(false);
                    setPhaseActiveIndex(idx);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    !vueEnveloppe && phaseActiveIndex === idx
                      ? nonConverge
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-emerald-600 text-white shadow-xs'
                      : nonConverge
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {nonConverge && <AlertTriangle className="w-3.5 h-3.5 text-current shrink-0" />}
                  <span>Phase {p.numero}</span>
                  <span className="text-[10px] opacity-80">
                    (fond {p.coteFondFouille.toFixed(1)}m)
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setVueEnveloppe(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                vueEnveloppe
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 text-purple-700 hover:bg-purple-50'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Enveloppe Totale</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleAddPhase}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter une phase</span>
          </button>
        </div>
      </div>

      {/* 2. Métriques clés et alertes de la phase visualisée */}
      {resultatCalcul && phaseCourante && (
        <div className="space-y-3">
          <div className={`grid grid-cols-2 ${verifRenard ? 'sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-4'} gap-3`}>
            {/* Déplacement max */}
            <div
              className={`p-3 border rounded-xl shadow-xs transition ${
                !phaseCourante.resultatSolveur.convergence.convergé
                  ? 'bg-rose-50/90 border-rose-300 text-rose-950'
                  : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Déplacement max u_max
                </span>
                {!phaseCourante.resultatSolveur.convergence.convergé && (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                <span
                  className={`text-xl font-black ${
                    !phaseCourante.resultatSolveur.convergence.convergé ? 'text-rose-700' : 'text-sky-900'
                  }`}
                >
                  {(phaseCourante.deplacementMaxAbsolu * 1000).toFixed(1)}
                </span>
                <span className="text-xs text-slate-500 font-semibold">mm</span>
                {!phaseCourante.resultatSolveur.convergence.convergé && (
                  <span className="text-[10px] font-bold text-rose-600 ml-1">
                    (Non convergé)
                  </span>
                )}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">
                {!phaseCourante.resultatSolveur.convergence.convergé
                  ? 'Mécanisme / capacité passive dépassée'
                  : 'Déformée horizontale vers la fouille'}
              </div>
            </div>

          {/* Moment fléchissant max */}
          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Moment max M_max
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-emerald-900">
                {phaseCourante.momentMaxAbsolu.toFixed(1)}
              </span>
              <span className="text-xs text-slate-500 font-semibold">kNm/m</span>
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              Sollicitation déterminante d'armatures
            </div>
          </div>

          {/* Effort tranchant max */}
          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Effort tranchant V_max
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-amber-900">
                {phaseCourante.tranchantMaxAbsolu.toFixed(1)}
              </span>
              <span className="text-xs text-slate-500 font-semibold">kN/m</span>
            </div>
            <div className="mt-1 text-[10px] text-slate-500">
              Cisaillement maximal de l'écran
            </div>
          </div>

          {/* Mobilisation butée */}
          <div
            className={`p-3 border rounded-xl shadow-xs ${
              phaseCourante.mobilisationButeeMax > 0.8
                ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                Mobilisation butée
              </span>
              {phaseCourante.mobilisationButeeMax > 0.8 ? (
                <ShieldAlert className="w-4 h-4 text-rose-600" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              )}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black">
                {(phaseCourante.mobilisationButeeMax * 100).toFixed(1)} %
              </span>
              <span className="text-xs font-semibold">Pp</span>
            </div>
            <div className="mt-1 text-[10px] font-medium">
              {phaseCourante.mobilisationButeeMax < 0.7
                ? 'Fiche largement stable'
                : phaseCourante.mobilisationButeeMax < 0.95
                ? 'Fiche mobilisée (butée sollicitée)'
                : 'Attention : plastification limite !'}
            </div>
          </div>

          {/* Renard de fond de fouille (HYD / Renard) */}
          {verifRenard && (
            <div
              className={`p-3 border rounded-xl shadow-xs ${
                verifRenard.securiteConforme
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-rose-50/70 border-rose-200 text-rose-950'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Renard fond fouille (HYD)
                </span>
                {verifRenard.securiteConforme ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-black">
                  F = {verifRenard.facteurSecuriteRenard.toFixed(2)}
                </span>
                <span className="text-xs font-semibold">
                  {verifRenard.securiteConforme ? '≥ 1.5 OK' : '< 1.5 Risque'}
                </span>
              </div>
              <div className="mt-1 text-[10px] font-medium">
                i_crit = {verifRenard.i_critique.toFixed(2)} / i = {verifRenard.i_ecoulement.toFixed(2)} (ΔH = {verifRenard.perteDeChargeDeltaH.toFixed(1)}m)
              </div>
            </div>
          )}

          {/* Surcouche Berlinoise (§8.5) */}
          {phaseBerlinoiseCourante && (
            <div
              className={`p-3 border rounded-xl shadow-xs ${
                phaseBerlinoiseCourante.ficheReduite.gardeFouDeclenche
                  ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                  : phaseBerlinoiseCourante.ficheReduite.conforme &&
                    phaseBerlinoiseCourante.stabiliteFront.stable &&
                    phaseBerlinoiseCourante.resistanceBlindage.conforme
                  ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/70 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Surcouche Berlinoise
                </span>
                {phaseBerlinoiseCourante.ficheReduite.gardeFouDeclenche ? (
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-black">
                  {phaseBerlinoiseCourante.repartition.momentProfile.toFixed(1)}
                </span>
                <span className="text-xs font-semibold">kNm / profilé</span>
              </div>
              <div className="mt-1 text-[10px] font-medium space-y-0.5">
                <div>
                  Front non soutenu : FS = {phaseBerlinoiseCourante.stabiliteFront.facteurSecurite.toFixed(2)}
                  {phaseBerlinoiseCourante.stabiliteFront.stable ? ' OK' : ' Risque'}
                </div>
                <div>
                  Blindage posé : {phaseBerlinoiseCourante.resistanceBlindage.conforme ? 'OK' : 'Non conforme'}
                  {' '}({phaseBerlinoiseCourante.resistanceBlindage.momentDemande.toFixed(1)} / {phaseBerlinoiseCourante.resistanceBlindage.momentResistant.toFixed(1)} kNm/m)
                </div>
                <div>
                  Fiche réduite : {phaseBerlinoiseCourante.ficheReduite.conforme ? 'OK' : 'Non conforme'}
                </div>
                {phaseBerlinoiseCourante.ficheReduite.avertissement && (
                  <div className="text-rose-700 font-bold">
                    ⚠ {phaseBerlinoiseCourante.ficheReduite.avertissement}
                  </div>
                )}
                <div className="italic opacity-70">
                  Répartition sans effet de voûte — hypothèse conservatrice, à affiner.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bannière d'alerte explicite en cas d'instabilité, mécanisme ou avertissements solveur */}
        {(!phaseCourante.resultatSolveur.convergence.convergé ||
          phaseCourante.resultatSolveur.convergence.avertissements.length > 0) && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-rose-950 text-sm flex items-center gap-2">
                <span>
                  {!phaseCourante.resultatSolveur.convergence.convergé
                    ? 'Alerte Géotechnique : Non-convergence ou mécanisme de rupture'
                    : 'Avertissements du solveur'}
                </span>
                {!phaseCourante.resultatSolveur.convergence.convergé && (
                  <span className="px-2 py-0.5 text-[10px] bg-rose-200 text-rose-800 font-bold rounded-full">
                    Mécanisme instable
                  </span>
                )}
              </div>
              <div className="mt-1 text-rose-800 font-medium leading-relaxed">
                {phaseCourante.resultatSolveur.convergence.message}
              </div>
              {phaseCourante.resultatSolveur.convergence.avertissements.length > 0 && (
                <ul className="mt-2 list-disc list-inside space-y-1 text-rose-800">
                  {phaseCourante.resultatSolveur.convergence.avertissements.map((av, idx) => (
                    <li key={idx} className="font-medium">
                      {av}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    )}

      {/* 3. Zone de Graphiques et Diagrammes Verticaux */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span className="font-bold text-slate-900">
              {vueEnveloppe
                ? 'Profils et Enveloppe Globale Multi-Phases'
                : `Profils de la ${phaseCourante?.phase.nom ?? ''}`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Bouton de filtrage des étiquettes */}
            <button
              id="btn-toggle-etiquettes-paroi"
              type="button"
              onClick={() => setFiltreEtiquettesOuvert((v) => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition border ${
                filtreEtiquettesOuvert
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold shadow-2xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200 font-medium'
              }`}
              title="Masquer / Afficher les types d'étiquettes du diagramme"
            >
              <Tag className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Étiquettes</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                {nbActivesParoi}/{totalTypesParoi}
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform ${filtreEtiquettesOuvert ? 'rotate-180' : ''}`} />
            </button>

            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg font-medium">
              <button
                type="button"
                onClick={() => setDiagrammeAffiche('tous')}
                className={`px-2.5 py-1 rounded-md transition ${
                  diagrammeAffiche === 'tous' ? 'bg-white text-slate-900 font-bold shadow-xs' : 'text-slate-600'
                }`}
              >
                Vue d'ensemble
              </button>
              <button
                type="button"
                onClick={() => setDiagrammeAffiche('deformee')}
                className={`px-2.5 py-1 rounded-md transition ${
                  diagrammeAffiche === 'deformee' ? 'bg-white text-sky-900 font-bold shadow-xs' : 'text-slate-600'
                }`}
              >
                Déformée u(z)
              </button>
              <button
                type="button"
                onClick={() => setDiagrammeAffiche('moment')}
                className={`px-2.5 py-1 rounded-md transition ${
                  diagrammeAffiche === 'moment' ? 'bg-white text-emerald-900 font-bold shadow-xs' : 'text-slate-600'
                }`}
              >
                Moment M(z)
              </button>
              <button
                type="button"
                onClick={() => setDiagrammeAffiche('tranchant')}
                className={`px-2.5 py-1 rounded-md transition ${
                  diagrammeAffiche === 'tranchant' ? 'bg-white text-amber-900 font-bold shadow-xs' : 'text-slate-600'
                }`}
              >
                Tranchant V(z)
              </button>
              <button
                type="button"
                onClick={() => setDiagrammeAffiche('pressions')}
                className={`px-2.5 py-1 rounded-md transition ${
                  diagrammeAffiche === 'pressions' ? 'bg-white text-purple-900 font-bold shadow-xs' : 'text-slate-600'
                }`}
              >
                Pressions Pa/Pp
              </button>
            </div>
          </div>
        </div>

        {/* Panneau de sélection des types d'étiquettes à afficher ou masquer */}
        {filtreEtiquettesOuvert && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-slate-100/90 border-b border-slate-200 text-xs animate-fadeIn">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 mr-1">Types d'étiquettes :</span>
              {TYPES_ETIQUETTES_PAROI_CONFIG.map((cfg) => {
                const estActif = visibilitesEtiquettes[cfg.id];
                return (
                  <button
                    key={cfg.id}
                    id={`chip-etiquette-paroi-${cfg.id}`}
                    type="button"
                    onClick={() => toggleTypeEtiquette(cfg.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition border ${
                      estActif
                        ? 'bg-white text-slate-800 border-slate-300 shadow-2xs'
                        : 'bg-slate-200/70 text-slate-400 border-dashed border-slate-300 line-through opacity-70'
                    }`}
                    title={`${estActif ? 'Masquer' : 'Afficher'} : ${cfg.description}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${estActif ? cfg.dotColor : 'bg-slate-300'}`} />
                    <span>{cfg.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-1.5 ml-auto">
              <button
                id="btn-masquer-toutes-etiquettes-paroi"
                type="button"
                onClick={toutMasquerEtiquettes}
                className="text-[11px] text-slate-600 hover:text-slate-900 px-2 py-0.5 rounded hover:bg-slate-200 transition"
              >
                Tout masquer
              </button>
              <span className="text-slate-300">|</span>
              <button
                id="btn-afficher-toutes-etiquettes-paroi"
                type="button"
                onClick={toutAfficherEtiquettes}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 font-semibold px-2 py-0.5 rounded hover:bg-emerald-50 transition"
              >
                Tout afficher
              </button>
            </div>
          </div>
        )}

        <div className="p-4">
          {resultatCalcul && phaseCourante ? (
            <RenduDiagrammesParoi
              resultat={resultatCalcul}
              phaseActive={phaseCourante}
              vueEnveloppe={vueEnveloppe}
              modeAffichage={diagrammeAffiche}
              coteTete={coteTete}
              coteBase={coteBase}
              appuis={appuis}
              couches={modele.couches}
              visibilitesEtiquettes={visibilitesEtiquettes}
            />
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              Calcul en cours ou paramètres non définis...
            </div>
          )}
        </div>
      </div>

      {/* 4. Tableau des Réactions dans les Appuis pour la phase active */}
      {phaseCourante && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-900">
              Sollicitations et Réactions des Butons / Tirants ({phaseCourante.phase.nom})
            </span>
            <span className="text-[11px] text-slate-500">
              Loi d'appui : F = k · (u - u_ref) où u_ref est gelé à la pose
            </span>
          </div>

          {phaseCourante.reactionsAppuis.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 font-semibold">Repère</th>
                    <th className="p-2.5 font-semibold">Type</th>
                    <th className="p-2.5 font-semibold">Cote (m)</th>
                    <th className="p-2.5 font-semibold">Pose</th>
                    <th className="p-2.5 font-semibold text-right">u_ref gelé (mm)</th>
                    <th className="p-2.5 font-semibold text-right">u final (mm)</th>
                    <th className="p-2.5 font-semibold text-right">Δu actif (mm)</th>
                    <th className="p-2.5 font-semibold text-right font-bold text-emerald-900">
                      Réaction F (kN/m)
                    </th>
                    <th className="p-2.5 font-semibold text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {phaseCourante.reactionsAppuis.map((r) => {
                    const appuiConf = appuis.find((a) => a.id === r.appuiId);
                    const delta_u_mm = (r.deplacementFinal - r.deplacementReference) * 1000;
                    const capacite = appuiConf?.reactionMax ?? 1000;
                    const ratio = Math.abs(r.reaction) / capacite;

                    return (
                      <tr key={r.appuiId} className="hover:bg-slate-50/80">
                        <td className="p-2.5 font-bold text-slate-900">{r.appuiId}</td>
                        <td className="p-2.5 capitalize">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.type === 'buton'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            {r.type}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono">{r.cote.toFixed(2)}</td>
                        <td className="p-2.5 text-slate-500">
                          Phase {appuiConf?.phaseActivation ?? 1}
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-500">
                          {(r.deplacementReference * 1000).toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-700">
                          {(r.deplacementFinal * 1000).toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-sky-900">
                          {delta_u_mm >= 0 ? `+${delta_u_mm.toFixed(2)}` : delta_u_mm.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-extrabold text-sm text-emerald-900">
                          {r.reaction.toFixed(1)}
                        </td>
                        <td className="p-2.5 text-center">
                          {ratio <= 1.0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {(ratio * 100).toFixed(0)}% cap.
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Surchargé ({(ratio * 100).toFixed(0)}%)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-slate-500 italic">
              Aucun buton ou tirant actif pour cette phase (paroi en console).
            </div>
          )}
        </div>
      )}

      {/* 5. Paramètres détaillés : Géométrie de l'écran, Appuis et Modules kh du Sol */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* A. Géométrie et Rigidité de l'écran */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-emerald-600" />
            1. Propriétés de la Paroi
          </h3>

          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setSousType('continue')}
              className={`px-2.5 py-1 rounded-md transition ${
                sousType === 'continue'
                  ? 'bg-white text-slate-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Paroi continue
            </button>
            <button
              type="button"
              onClick={() => setSousType('berlinoise')}
              className={`px-2.5 py-1 rounded-md transition ${
                sousType === 'berlinoise'
                  ? 'bg-white text-amber-900 font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Berlinoise
            </button>
          </div>

          <div>
            <label className="block text-slate-500 mb-1">Cote Tête / Crête (m NGF)</label>
            <input
              type="number"
              step="0.5"
              value={coteTete}
              onChange={(e) => setCoteTete(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-sky-900"
            />
          </div>

          <div>
            <label className="block text-slate-500 mb-1">Cote Base / Fiche (m NGF)</label>
            <input
              type="number"
              step="0.5"
              value={coteBase}
              onChange={(e) => setCoteBase(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold text-emerald-900"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-500 mb-1">Épaisseur e (m)</label>
              <input
                type="number"
                step="0.05"
                min="0.2"
                max="2.0"
                value={epaisseur}
                onChange={(e) => setEpaisseur(parseFloat(e.target.value) || 0.6)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">Module E (GPa)</label>
              <input
                type="number"
                step="1.0"
                min="5.0"
                max="210.0"
                value={moduleE_GPa}
                onChange={(e) => setModuleE_GPa(parseFloat(e.target.value) || 30.0)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-bold"
              />
            </div>
          </div>

          {sousType === 'berlinoise' && (
            <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-lg space-y-2">
              <div className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
                Profilés & Blindage
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-500 mb-1">Entraxe profilés (m)</label>
                  <input
                    type="number" step="0.1" min="0.5" max="4.0"
                    value={entraxeProfiles}
                    onChange={(e) => setEntraxeProfiles(parseFloat(e.target.value) || 1.2)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Largeur profilé (m)</label>
                  <input
                    type="number" step="0.05" min="0.1" max="1.0"
                    value={profileLargeur}
                    onChange={(e) => setProfileLargeur(parseFloat(e.target.value) || 0.3)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">I profilé (m⁴)</label>
                  <input
                    type="number" step="0.00001" min="0.00001"
                    value={profileI}
                    onChange={(e) => setProfileI(parseFloat(e.target.value) || 0.0003)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">W profilé (m³)</label>
                  <input
                    type="number" step="0.0001" min="0.0001"
                    value={profileW}
                    onChange={(e) => setProfileW(parseFloat(e.target.value) || 0.0017)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Hauteur passe (m)</label>
                  <input
                    type="number" step="0.1" min="0.2" max="3.0"
                    value={blindageHauteurPasse}
                    onChange={(e) => setBlindageHauteurPasse(parseFloat(e.target.value) || 1.0)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-bold bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 mb-1">Épais. blindage (m)</label>
                  <input
                    type="number" step="0.01" min="0.02" max="0.2"
                    value={blindageEpaisseur}
                    onChange={(e) => setBlindageEpaisseur(parseFloat(e.target.value) || 0.05)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-bold bg-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-slate-500 mb-1">Contrainte admissible blindage (kPa)</label>
                  <input
                    type="number" step="500" min="1000"
                    value={blindageContrainteAdm}
                    onChange={(e) => setBlindageContrainteAdm(parseFloat(e.target.value) || 10000)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded-lg font-bold bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="p-2.5 bg-slate-50 rounded-lg space-y-1 text-slate-600 text-[11px]">
            <div>• Hauteur totale de l'écran : <strong>{(coteTete - coteBase).toFixed(2)} m</strong></div>
            <div>• Rigidité flexion EI : <strong>{(E_kPa * I_m4).toExponential(3)} kNm²/m</strong></div>
            <div>• Inertie I : <strong>{I_m4.toFixed(5)} m⁴/m</strong></div>
          </div>
        </div>

        {/* B. Appuis (Butons et Tirants) */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              2. Butons & Tirants
            </h3>
            <button
              type="button"
              onClick={handleAddAppui}
              className="p-1 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded-md border border-amber-200"
              title="Ajouter un lit d'appuis"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {appuis.map((a) => (
              <div
                key={a.id}
                className="p-2.5 border border-slate-200 rounded-lg bg-slate-50/60 space-y-2 text-[11px]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{a.id}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteAppui(a.id)}
                    className="text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 block">Cote (m) :</span>
                    <input
                      type="number"
                      step="0.25"
                      value={a.cote}
                      onChange={(e) =>
                        handleUpdateAppui(a.id, 'cote', parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded font-bold bg-white"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500 block">Type :</span>
                    <select
                      value={a.type}
                      onChange={(e) =>
                        handleUpdateAppui(a.id, 'type', e.target.value as 'buton' | 'tirant')
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded bg-white font-medium"
                    >
                      <option value="buton">Buton</option>
                      <option value="tirant">Tirant</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-slate-500 block">k (kN/m) :</span>
                    <input
                      type="number"
                      step="10000"
                      value={a.raideur}
                      onChange={(e) =>
                        handleUpdateAppui(a.id, 'raideur', parseFloat(e.target.value) || 10000)
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded font-bold bg-white"
                    />
                  </div>
                  <div>
                    <span className="text-slate-500 block">Actif dès :</span>
                    <select
                      value={a.phaseActivation}
                      onChange={(e) =>
                        handleUpdateAppui(a.id, 'phaseActivation', parseInt(e.target.value) || 1)
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded bg-white font-medium"
                    >
                      {phases.map((p) => (
                        <option key={p.numero} value={p.numero}>
                          Phase {p.numero}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* C. Modules de réaction du sol kh par couche */}
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs space-y-3">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-sky-600" />
            3. Modules de Réaction kh (Sol)
          </h3>
          <p className="text-[11px] text-slate-500">
            Saisie directe par couche en kN/m³ (§8.4 CDC). Si non spécifié, repli sur 20 000 kN/m³.
          </p>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {modele.couches.map((c) => {
              const val = khParCouche[c.id];
              const estDefaut = val === undefined;

              return (
                <div
                  key={c.id}
                  className="p-2 border border-slate-200 rounded-lg flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: c.couleurAffichage }}
                      />
                      <span className="font-bold text-slate-800 truncate block text-[11px]">
                        {c.nom}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Toit {c.coteToit} m • {c.nature}
                    </span>
                  </div>

                  <div className="w-28 shrink-0">
                    <input
                      type="number"
                      step="5000"
                      min="1000"
                      max="500000"
                      value={val ?? 20000}
                      onChange={(e) => {
                        const n = parseFloat(e.target.value) || 20000;
                        setKhParCouche((prev) => ({ ...prev, [c.id]: n }));
                      }}
                      className={`w-full px-2 py-1 text-right border rounded font-mono font-bold text-[11px] ${
                        estDefaut
                          ? 'border-amber-300 bg-amber-50/50 text-amber-900'
                          : 'border-slate-300 bg-white text-slate-900'
                      }`}
                    />
                    <span className="text-[9px] text-slate-400 block text-right">kN/m³</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Composant de rendu graphique vectoriel SVG des diagrammes verticaux
 */
interface RenduDiagrammesParoiProps {
  resultat: ResultatCalculParoiPhasee;
  phaseActive: ResultatPhaseParoi;
  vueEnveloppe: boolean;
  modeAffichage: 'tous' | 'deformee' | 'moment' | 'tranchant' | 'pressions';
  coteTete: number;
  coteBase: number;
  appuis: AppuiPhase[];
  couches: CoucheGeotechnique[];
  visibilitesEtiquettes: Record<TypeEtiquetteParoi, boolean>;
}

const RenduDiagrammesParoi: React.FC<RenduDiagrammesParoiProps> = ({
  resultat,
  phaseActive,
  vueEnveloppe,
  modeAffichage,
  coteTete,
  coteBase,
  appuis,
  couches,
  visibilitesEtiquettes,
}) => {
  // Dimensions du canvas SVG
  const width = 800;
  const height = 480;
  const marginTop = 30;
  const marginBottom = 30;
  const plotHeight = height - marginTop - marginBottom;

  const hauteurTotale = Math.max(1.0, coteTete - coteBase);
  const coteFondActive = phaseActive.phase.coteFondFouille;

  // Échelle verticale : cote Y vers coordonnée SVG Y
  const yDeCote = (cote: number) => {
    return marginTop + ((coteTete - cote) / hauteurTotale) * plotHeight;
  };

  // Calcul de la résolution anti-collision des étiquettes d'appuis (butons / tirants)
  const appuisActifs = useMemo(() => {
    return appuis.filter((app) => app.phaseActivation <= phaseActive.phase.numero);
  }, [appuis, phaseActive.phase.numero]);

  const appuisResolusMap = useMemo(() => {
    const boites: BoiteEtiquette1D[] = appuisActifs.map((app) => {
      const yApp = yDeCote(app.cote);
      return {
        id: app.id,
        yIdeal: yApp - 7,
        hauteur: 14,
        yAnchor: yApp,
        donnees: app,
      };
    });
    const resolues = resoudreAntiCollision1D(
      boites,
      marginTop + 5,
      height - marginBottom - 15,
      4
    );
    const map = new Map<string, BoiteEtiquetteResolue>();
    for (const b of resolues) {
      map.set(b.id, b);
    }
    return map;
  }, [appuisActifs, coteTete, hauteurTotale, plotHeight]);

  // Nœuds et cotes
  const cotes = resultat.cotes;
  const deplacementsCourants = phaseActive.resultatSolveur.deplacements;
  const effortsCourants = phaseActive.resultatSolveur.effortsInternes;
  const pressionsCourantes = phaseActive.profilPressionLimite;

  // Calcul des extrémums pour les échelles horizontales
  const maxUx = Math.max(
    0.005,
    ...resultat.phases.flatMap((p) =>
      p.resultatSolveur.deplacements.map((d) => Math.abs(d.ux))
    )
  );
  const maxM = Math.max(
    10,
    ...resultat.phases.flatMap((p) =>
      p.resultatSolveur.effortsInternes.map((e) => Math.abs(e.M))
    )
  );
  const maxV = Math.max(
    10,
    ...resultat.phases.flatMap((p) =>
      p.resultatSolveur.effortsInternes.map((e) => Math.abs(e.V))
    )
  );
  const maxP = Math.max(
    50,
    ...resultat.phases.flatMap((p) =>
      p.profilPressionLimite.map((pt) => Math.max(pt.Pa, pt.Pp))
    )
  );

  // Définition des sous-colonnes selon le mode d'affichage
  const colonnes = useMemo(() => {
    if (modeAffichage === 'deformee') {
      return [{ id: 'deformee', label: 'Déformée horizontale u(z) (mm)', width: 650, offset: 90 }];
    }
    if (modeAffichage === 'moment') {
      return [{ id: 'moment', label: 'Moment fléchissant M(z) (kNm/m)', width: 650, offset: 90 }];
    }
    if (modeAffichage === 'tranchant') {
      return [{ id: 'tranchant', label: 'Effort tranchant V(z) (kN/m)', width: 650, offset: 90 }];
    }
    if (modeAffichage === 'pressions') {
      return [{ id: 'pressions', label: 'Pressions limites Pa / Pp (kPa)', width: 650, offset: 90 }];
    }
    // Tous côte à côte
    return [
      { id: 'coupe', label: 'Schéma & fouille', width: 140, offset: 60 },
      { id: 'deformee', label: 'Déformée u (mm)', width: 160, offset: 230 },
      { id: 'moment', label: 'Moment M (kNm/m)', width: 160, offset: 420 },
      { id: 'tranchant', label: 'Tranchant V (kN/m)', width: 160, offset: 610 },
    ];
  }, [modeAffichage]);

  // Construction des chemins SVG (path)
  const construireCheminUx = (p: ResultatPhaseParoi, colWidth: number, colOffset: number) => {
    const pts = p.resultatSolveur.deplacements.map((d, i) => {
      const cote = cotes[i];
      const y = yDeCote(cote);
      const mm = d.ux * 1000;
      const x = colOffset + colWidth / 2 + (d.ux / maxUx) * (colWidth * 0.4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${pts.join(' L ')}`;
  };

  const construireCheminM = (p: ResultatPhaseParoi, colWidth: number, colOffset: number) => {
    const pts = p.resultatSolveur.effortsInternes.map((eff, i) => {
      const cote = cotes[i];
      const y = yDeCote(cote);
      const x = colOffset + colWidth / 2 + (eff.M / maxM) * (colWidth * 0.4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${pts.join(' L ')}`;
  };

  const construireCheminV = (p: ResultatPhaseParoi, colWidth: number, colOffset: number) => {
    const pts = p.resultatSolveur.effortsInternes.map((eff, i) => {
      const cote = cotes[i];
      const y = yDeCote(cote);
      const x = colOffset + colWidth / 2 + (eff.V / maxV) * (colWidth * 0.4);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${pts.join(' L ')}`;
  };

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none font-sans">
        {/* Grille de fond et cotes d'élévation */}
        <g stroke="#e2e8f0" strokeDasharray="3 3">
          {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
            const cote = coteTete - frac * hauteurTotale;
            const y = yDeCote(cote);
            return (
              <g key={frac}>
                <line x1={40} y1={y} x2={width - 20} y2={y} />
                {visibilitesEtiquettes.cotesElevation && (
                  <text
                    x={36}
                    y={y + 3}
                    textAnchor="end"
                    fill="#64748b"
                    fontSize="10"
                    fontFamily="monospace"
                  >
                    {cote.toFixed(1)}m
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Ligne du fond de fouille de la phase active */}
        <g>
          <line
            x1={50}
            y1={yDeCote(coteFondActive)}
            x2={width - 20}
            y2={yDeCote(coteFondActive)}
            stroke="#e11d48"
            strokeWidth="1.5"
            strokeDasharray="4 2"
          />
          {visibilitesEtiquettes.fondFouille && (
            <text
              x={width - 25}
              y={yDeCote(coteFondActive) - 5}
              textAnchor="end"
              fill="#e11d48"
              fontSize="10"
              fontWeight="bold"
            >
              Fond de fouille ({coteFondActive.toFixed(1)} m)
            </text>
          )}
        </g>

        {/* Rendu par colonne */}
        {colonnes.map((col) => {
          const centerX = col.offset + col.width / 2;

          return (
            <g key={col.id}>
              {/* Titre de la colonne */}
              <text
                x={centerX}
                y={18}
                textAnchor="middle"
                fill="#1e293b"
                fontSize="11"
                fontWeight="bold"
              >
                {col.label}
              </text>

              {/* Axe central zéro */}
              <line
                x1={centerX}
                y1={marginTop}
                x2={centerX}
                y2={height - marginBottom}
                stroke="#94a3b8"
                strokeWidth="1"
              />

              {/* Colonne Schéma & Fouille */}
              {col.id === 'coupe' && (
                <g>
                  {/* Corps de la paroi */}
                  <rect
                    x={centerX - 8}
                    y={yDeCote(coteTete)}
                    width={16}
                    height={plotHeight}
                    fill="#cbd5e1"
                    stroke="#475569"
                    strokeWidth="1.5"
                    rx="2"
                  />

                  {/* Côté amont (sol retenu) */}
                  <rect
                    x={centerX - 55}
                    y={yDeCote(coteTete)}
                    width={47}
                    height={plotHeight}
                    fill="#f1f5f9"
                    opacity="0.7"
                  />
                  {visibilitesEtiquettes.zones && (
                    <text
                      x={centerX - 30}
                      y={yDeCote(coteTete) + 15}
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      AMONT
                    </text>
                  )}

                  {/* Côté aval (sol en fiche sous fond de fouille) */}
                  <rect
                    x={centerX + 8}
                    y={yDeCote(coteFondActive)}
                    width={47}
                    height={yDeCote(coteBase) - yDeCote(coteFondActive)}
                    fill="#e2e8f0"
                    opacity="0.7"
                  />
                  {visibilitesEtiquettes.zones && (
                    <text
                      x={centerX + 30}
                      y={yDeCote(coteFondActive) + 15}
                      textAnchor="middle"
                      fill="#64748b"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      FICHE
                    </text>
                  )}

                  {/* Fouille excavée */}
                  <rect
                    x={centerX + 8}
                    y={yDeCote(coteTete)}
                    width={47}
                    height={yDeCote(coteFondActive) - yDeCote(coteTete)}
                    fill="#fff1f2"
                    opacity="0.5"
                  />

                  {/* Butons / Tirants actifs avec anti-collision et ligne guide */}
                  {appuisActifs.map((app) => {
                    const yApp = yDeCote(app.cote);
                    const resolue = appuisResolusMap.get(app.id);
                    const yLabel = resolue ? resolue.yCalcule + 10 : yApp + 3;
                    const decalee = resolue?.decalee ?? false;

                    return (
                      <g key={app.id}>
                        <circle cx={centerX} cy={yApp} r="4" fill="#d97706" />
                        <line
                          x1={centerX}
                          y1={yApp}
                          x2={centerX + 32}
                          y2={yApp}
                          stroke="#d97706"
                          strokeWidth="2"
                        />
                        {visibilitesEtiquettes.appuis && (
                          <g>
                            {decalee && (
                              <line
                                x1={centerX + 32}
                                y1={yApp}
                                x2={centerX + 36}
                                y2={yLabel - 3}
                                stroke="#d97706"
                                strokeWidth="1"
                                strokeDasharray="2 2"
                              />
                            )}
                            <text
                              x={centerX + 38}
                              y={yLabel}
                              fill="#d97706"
                              fontSize="9"
                              fontWeight="bold"
                            >
                              {app.type === 'buton' ? 'Buton' : 'Tirant'} ({app.cote.toFixed(1)} m)
                            </text>
                          </g>
                        )}
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Colonne Déformée */}
              {col.id === 'deformee' && (
                <g>
                  {/* Toutes les phases en fond si vue enveloppe */}
                  {vueEnveloppe &&
                    resultat.phases.map((ph, idx) => (
                      <path
                        key={idx}
                        d={construireCheminUx(ph, col.width, col.offset)}
                        fill="none"
                        stroke="#93c5fd"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    ))}

                  {/* Phase active */}
                  <path
                    d={construireCheminUx(phaseActive, col.width, col.offset)}
                    fill="none"
                    stroke="#0284c7"
                    strokeWidth="2.5"
                  />

                  {/* Valeurs extrêmes */}
                  {visibilitesEtiquettes.extremums && (
                    <>
                      <text
                        x={centerX + (col.width * 0.4)}
                        y={height - 10}
                        textAnchor="end"
                        fill="#0284c7"
                        fontSize="9"
                        fontWeight="bold"
                      >
                        +{(maxUx * 1000).toFixed(1)} mm
                      </text>
                      <text
                        x={centerX - (col.width * 0.4)}
                        y={height - 10}
                        textAnchor="start"
                        fill="#0284c7"
                        fontSize="9"
                        fontWeight="bold"
                      >
                        -{(maxUx * 1000).toFixed(1)} mm
                      </text>
                    </>
                  )}
                </g>
              )}

              {/* Colonne Moment Fléchissant */}
              {col.id === 'moment' && (
                <g>
                  {vueEnveloppe &&
                    resultat.phases.map((ph, idx) => (
                      <path
                        key={idx}
                        d={construireCheminM(ph, col.width, col.offset)}
                        fill="none"
                        stroke="#86efac"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    ))}

                  <path
                    d={construireCheminM(phaseActive, col.width, col.offset)}
                    fill="none"
                    stroke="#16a34a"
                    strokeWidth="2.5"
                  />

                  {visibilitesEtiquettes.extremums && (
                    <>
                      <text
                        x={centerX + (col.width * 0.4)}
                        y={height - 10}
                        textAnchor="end"
                        fill="#16a34a"
                        fontSize="9"
                        fontWeight="bold"
                      >
                        +{maxM.toFixed(0)} kNm/m
                      </text>
                      <text
                        x={centerX - (col.width * 0.4)}
                        y={height - 10}
                        textAnchor="start"
                        fill="#16a34a"
                        fontSize="9"
                        fontWeight="bold"
                      >
                        -{maxM.toFixed(0)}
                      </text>
                    </>
                  )}
                </g>
              )}

              {/* Colonne Effort Tranchant */}
              {col.id === 'tranchant' && (
                <g>
                  {vueEnveloppe &&
                    resultat.phases.map((ph, idx) => (
                      <path
                        key={idx}
                        d={construireCheminV(ph, col.width, col.offset)}
                        fill="none"
                        stroke="#fde047"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    ))}

                  <path
                    d={construireCheminV(phaseActive, col.width, col.offset)}
                    fill="none"
                    stroke="#d97706"
                    strokeWidth="2.5"
                  />

                  {visibilitesEtiquettes.extremums && (
                    <>
                      <text
                        x={centerX + (col.width * 0.4)}
                        y={height - 10}
                        textAnchor="end"
                        fill="#d97706"
                        fontSize="9"
                        fontWeight="bold"
                      >
                        +{maxV.toFixed(0)} kN/m
                      </text>
                      <text
                        x={centerX - (col.width * 0.4)}
                        y={height - 10}
                        textAnchor="start"
                        fill="#d97706"
                        fontSize="9"
                        fontWeight="bold"
                      >
                        -{maxV.toFixed(0)}
                      </text>
                    </>
                  )}
                </g>
              )}

              {/* Colonne Pressions Limites (si sélectionnée) */}
              {col.id === 'pressions' && (
                <g>
                  {/* Profil Pa (amont, vers la gauche) */}
                  <path
                    d={`M ${pressionsCourantes
                      .map((pt) => {
                        const y = yDeCote(pt.cote);
                        const x = centerX - (pt.Pa / maxP) * (col.width * 0.4);
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      })
                      .join(' L ')}`}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2"
                  />

                  {/* Profil Pp (aval, vers la droite) */}
                  <path
                    d={`M ${pressionsCourantes
                      .map((pt) => {
                        const y = yDeCote(pt.cote);
                        const x = centerX + (pt.Pp / maxP) * (col.width * 0.4);
                        return `${x.toFixed(1)},${y.toFixed(1)}`;
                      })
                      .join(' L ')}`}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                  />

                  {visibilitesEtiquettes.extremums && (
                    <>
                      <text
                        x={centerX - (col.width * 0.35)}
                        y={30}
                        fill="#3b82f6"
                        fontSize="9"
                        fontWeight="bold"
                      >
                        ← Poussée Pa
                      </text>
                      <text
                        x={centerX + 10}
                        y={30}
                        fill="#ef4444"
                        fontSize="9"
                        fontWeight="bold"
                      >
                        Butée Pp →
                      </text>
                    </>
                  )}
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
