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
import {
  verifierRecouvrementPieuxSecants,
  calculerInertieCompositePieuxSecants,
  ResultatRecouvrementPieuxSecants,
} from '../../modules/soutenement/pieuxSecants';
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
  { id: 'cotesElevation', label: 'Cotes élévation', dotColor: 'bg-texte-faible', description: 'Cotes altimétriques de la paroi (axe Y)' },
  { id: 'fondFouille', label: 'Fond de fouille', dotColor: 'bg-texte-faible', description: 'Ligne et cote du fond de fouille de la phase active' },
  { id: 'appuis', label: 'Appuis', dotColor: 'bg-texte-faible', description: 'Libellés et cotes des butons et tirants' },
  { id: 'extremums', label: 'Extrémums', dotColor: 'bg-texte-faible', description: 'Valeurs numériques max et min des courbes' },
  { id: 'zones', label: 'Zones', dotColor: 'bg-texte-faible', description: 'Indications textuelles Amont et Fiche' },
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
  const [sousType, setSousType] = useState<'continue' | 'berlinoise' | 'pieuxSecants'>(
    soutenementExistant?.sousType === 'berlinoise'
      ? 'berlinoise'
      : soutenementExistant?.sousType === 'pieuxSecants'
      ? 'pieuxSecants'
      : 'continue'
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
  const [diametrePrimaire, setDiametrePrimaire] = useState<number>(
    soutenementExistant?.parametresPieuxSecants?.diametrePrimaire ?? 0.8
  ); // m
  const [diametreSecondaire, setDiametreSecondaire] = useState<number>(
    soutenementExistant?.parametresPieuxSecants?.diametreSecondaire ?? 0.8
  ); // m
  const [entraxePieux, setEntraxePieux] = useState<number>(
    soutenementExistant?.parametresPieuxSecants?.entraxe ?? 0.65
  ); // m
  const [deviationVerticaliteMax, setDeviationVerticaliteMax] = useState<number>(
    soutenementExistant?.parametresPieuxSecants?.deviationVerticaliteMax ?? 0.01
  ); // sans unité (pente), 0.01 = 1%
  const [recouvrementMinimalRequis, setRecouvrementMinimalRequis] = useState<number>(
    soutenementExistant?.parametresPieuxSecants?.recouvrementMinimalRequis ?? 0.05
  ); // m
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
  // Pieux sécants : béton comme la paroi continue (module E réutilisé), I/A composites par
  // superposition des sections primaire/secondaire (approximation documentée, cf. spec §8.5).
  const inertieCompositePieux =
    sousType === 'pieuxSecants'
      ? calculerInertieCompositePieuxSecants({
          diametrePrimaire,
          diametreSecondaire,
          entraxe: entraxePieux,
        })
      : null;
  const E_kPa = sousType === 'berlinoise' ? 210.0e6 : moduleE_GPa * 1e6; // 210 GPa acier
  const I_m4 =
    sousType === 'berlinoise'
      ? profileI / entraxeProfiles
      : sousType === 'pieuxSecants'
      ? inertieCompositePieux!.I_m4ParM
      : (1.0 * Math.pow(epaisseur, 3)) / 12;
  const A_m2 =
    sousType === 'berlinoise'
      ? profileLargeur / entraxeProfiles
      : sousType === 'pieuxSecants'
      ? inertieCompositePieux!.A_m2ParM
      : 1.0 * epaisseur;

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
    diametrePrimaire,
    diametreSecondaire,
    entraxePieux,
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

  // Surcouche Pieux Sécants (§8.5) : recouvrement géométrique (dérive de forage sur toute la
  // hauteur des pieux) — ne dépend pas du phasage d'excavation, calculé une seule fois.
  const surcouchePieuxSecants: ResultatRecouvrementPieuxSecants | null = useMemo(() => {
    if (sousType !== 'pieuxSecants') return null;
    return verifierRecouvrementPieuxSecants(
      {
        diametrePrimaire,
        diametreSecondaire,
        entraxe: entraxePieux,
        deviationVerticaliteMax,
        recouvrementMinimalRequis,
      },
      coteTete - coteBase
    );
  }, [
    sousType,
    diametrePrimaire,
    diametreSecondaire,
    entraxePieux,
    deviationVerticaliteMax,
    recouvrementMinimalRequis,
    coteTete,
    coteBase,
  ]);

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
      parametresPieuxSecants:
        sousType === 'pieuxSecants'
          ? {
              diametrePrimaire,
              diametreSecondaire,
              entraxe: entraxePieux,
              deviationVerticaliteMax,
              recouvrementMinimalRequis,
            }
          : undefined,
    };
    onUpdateSoutenement(ouvrage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- voir commentaire ci-dessus
  }, [
    coteTete, coteBase, epaisseur, moduleE_GPa, etatCalcul, phases, appuis, khParCouche,
    sousType, entraxeProfiles, profileI, profileW, profileLargeur,
    blindageHauteurPasse, blindageEpaisseur, blindageContrainteAdm, E_kPa, I_m4, A_m2,
    diametrePrimaire, diametreSecondaire, entraxePieux, deviationVerticaliteMax, recouvrementMinimalRequis,
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
      <div className="p-4 bg-surface border border-bordure rounded-rayon">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-bordure pb-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-texte uppercase tracking-wider">
                Module C Niveau 2 : Paroi Flexible Phasée (EN 1997-1 §8.4)
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-accent-doux text-accent border border-bordure">
                Poutre-ressorts non linéaires
              </span>
            </div>
            <p className="text-xs text-texte-faible mt-0.5">
              Modélisation de l'histoire de construction par chaînage des déplacements et plastification élastoplastique du sol.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-surface-appui p-0.5 rounded-rayon-petit text-xs font-semibold">
              <button
                type="button"
                onClick={() => setEtatCalcul('ELS')}
                className={`px-3 py-1 rounded-rayon-petit transition ${
                  etatCalcul === 'ELS'
                    ? 'bg-surface text-texte font-bold'
                    : 'text-texte-doux hover:text-texte'
                }`}
              >
                ELS
              </button>
              <button
                type="button"
                onClick={() => setEtatCalcul('ELU')}
                className={`px-3 py-1 rounded-rayon-petit transition ${
                  etatCalcul === 'ELU'
                    ? 'bg-surface text-refus font-bold'
                    : 'text-texte-doux hover:text-texte'
                }`}
              >
                ELU (DA2*)
              </button>
            </div>

            <button
              type="button"
              onClick={exporterCSV}
              disabled={!resultatCalcul}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-appui hover:bg-surface-appui disabled:opacity-50 text-surface rounded-rayon-petit text-xs font-semibold transition"
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
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-rayon-petit text-xs font-semibold whitespace-nowrap transition ${
                    !vueEnveloppe && phaseActiveIndex === idx
                      ? nonConverge
                        ? 'bg-refus text-surface'
                        : 'bg-ok text-surface'
                      : nonConverge
                        ? 'bg-refus-fond text-refus border border-bordure hover:bg-refus-fond'
                        : 'bg-surface-appui text-texte-doux hover:bg-surface-appui'
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
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-rayon-petit text-xs font-semibold whitespace-nowrap transition ${
                vueEnveloppe
                  ? 'bg-texte text-surface'
                  : 'bg-surface-appui text-texte-doux hover:bg-surface-appui'
              }`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Enveloppe Totale</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleAddPhase}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-ok bg-ok-fond hover:bg-ok-fond border border-bordure rounded-rayon-petit transition"
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
              className={`p-3 border rounded-rayon transition ${
                !phaseCourante.resultatSolveur.convergence.convergé
                  ? 'bg-refus-fond border-bordure text-refus'
                  : 'bg-surface border-bordure'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-texte-faible uppercase tracking-wider block">
                  Déplacement max u_max
                </span>
                {!phaseCourante.resultatSolveur.convergence.convergé && (
                  <AlertTriangle className="w-4 h-4 text-refus shrink-0" />
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
                <span
                  className={`text-xl font-black ${
                    !phaseCourante.resultatSolveur.convergence.convergé ? 'text-refus' : 'text-texte'
                  }`}
                >
                  {(phaseCourante.deplacementMaxAbsolu * 1000).toFixed(1)}
                </span>
                <span className="text-xs text-texte-faible font-semibold">mm</span>
                {!phaseCourante.resultatSolveur.convergence.convergé && (
                  <span className="text-[10px] font-bold text-refus ml-1">
                    (Non convergé)
                  </span>
                )}
              </div>
              <div className="mt-1 text-[10px] text-texte-faible">
                {!phaseCourante.resultatSolveur.convergence.convergé
                  ? 'Mécanisme / capacité passive dépassée'
                  : 'Déformée horizontale vers la fouille'}
              </div>
            </div>

          {/* Moment fléchissant max */}
          <div className="p-3 bg-surface border border-bordure rounded-rayon">
            <span className="text-[11px] font-semibold text-texte-faible uppercase tracking-wider block">
              Moment max M_max
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-ok">
                {phaseCourante.momentMaxAbsolu.toFixed(1)}
              </span>
              <span className="text-xs text-texte-faible font-semibold">kNm/m</span>
            </div>
            <div className="mt-1 text-[10px] text-texte-faible">
              Sollicitation déterminante d'armatures
            </div>
          </div>

          {/* Effort tranchant max */}
          <div className="p-3 bg-surface border border-bordure rounded-rayon">
            <span className="text-[11px] font-semibold text-texte-faible uppercase tracking-wider block">
              Effort tranchant V_max
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-xl font-black text-alerte">
                {phaseCourante.tranchantMaxAbsolu.toFixed(1)}
              </span>
              <span className="text-xs text-texte-faible font-semibold">kN/m</span>
            </div>
            <div className="mt-1 text-[10px] text-texte-faible">
              Cisaillement maximal de l'écran
            </div>
          </div>

          {/* Mobilisation butée */}
          <div
            className={`p-3 border rounded-rayon ${
              phaseCourante.mobilisationButeeMax > 0.8
                ? 'bg-refus-fond border-bordure text-refus'
                : 'bg-ok-fond border-bordure text-ok'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wider">
                Mobilisation butée
              </span>
              {phaseCourante.mobilisationButeeMax > 0.8 ? (
                <ShieldAlert className="w-4 h-4 text-refus" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-ok" />
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
              className={`p-3 border rounded-rayon ${
                verifRenard.securiteConforme
                  ? 'bg-ok-fond border-bordure text-ok'
                  : 'bg-refus-fond border-bordure text-refus'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Renard fond fouille (HYD)
                </span>
                {verifRenard.securiteConforme ? (
                  <ShieldCheck className="w-4 h-4 text-ok" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-refus" />
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
              className={`p-3 border rounded-rayon ${
                phaseBerlinoiseCourante.ficheReduite.gardeFouDeclenche
                  ? 'bg-refus-fond border-bordure text-refus'
                  : phaseBerlinoiseCourante.ficheReduite.conforme &&
                    phaseBerlinoiseCourante.stabiliteFront.stable &&
                    phaseBerlinoiseCourante.resistanceBlindage.conforme
                  ? 'bg-ok-fond border-bordure text-ok'
                  : 'bg-alerte-fond border-bordure text-alerte'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Surcouche Berlinoise
                </span>
                {phaseBerlinoiseCourante.ficheReduite.gardeFouDeclenche ? (
                  <ShieldAlert className="w-4 h-4 text-refus" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-ok" />
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
                  <div className="text-refus font-bold">
                    ⚠ {phaseBerlinoiseCourante.ficheReduite.avertissement}
                  </div>
                )}
                <div className="italic opacity-70">
                  Répartition sans effet de voûte — hypothèse conservatrice, à affiner.
                </div>
              </div>
            </div>
          )}

          {/* Surcouche Pieux Sécants (§8.5) */}
          {surcouchePieuxSecants && (
            <div
              className={`p-3 border rounded-rayon ${
                surcouchePieuxSecants.continuiteMecaniqueRompue
                  ? 'bg-refus-fond border-bordure text-refus'
                  : surcouchePieuxSecants.conforme
                  ? 'bg-ok-fond border-bordure text-ok'
                  : 'bg-alerte-fond border-bordure text-alerte'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider">
                  Surcouche Pieux Sécants
                </span>
                {surcouchePieuxSecants.continuiteMecaniqueRompue ? (
                  <ShieldAlert className="w-4 h-4 text-refus" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-ok" />
                )}
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-black">
                  {(surcouchePieuxSecants.recouvrementProfondeurMax * 1000).toFixed(0)}
                </span>
                <span className="text-xs font-semibold">mm de recouvrement (au pied)</span>
              </div>
              <div className="mt-1 text-[10px] font-medium space-y-0.5">
                <div>
                  Recouvrement en tête : {(surcouchePieuxSecants.recouvrementSurface * 1000).toFixed(0)} mm
                </div>
                <div>
                  {surcouchePieuxSecants.continuiteMecaniqueRompue
                    ? 'Continuité mécanique rompue par la dérive de forage'
                    : surcouchePieuxSecants.conforme
                    ? 'Recouvrement conforme au seuil requis'
                    : 'Recouvrement insuffisant vs. seuil requis'}
                </div>
                <div className="italic opacity-70">
                  Inertie composite par superposition des sections pleines — approximation
                  documentée, à affiner.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Bannière d'alerte explicite en cas d'instabilité, mécanisme ou avertissements solveur */}
        {(!phaseCourante.resultatSolveur.convergence.convergé ||
          phaseCourante.resultatSolveur.convergence.avertissements.length > 0) && (
          <div className="p-3.5 bg-refus-fond border border-bordure rounded-rayon text-xs text-refus flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-refus shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-refus text-sm flex items-center gap-2">
                <span>
                  {!phaseCourante.resultatSolveur.convergence.convergé
                    ? 'Alerte Géotechnique : Non-convergence ou mécanisme de rupture'
                    : 'Avertissements du solveur'}
                </span>
                {!phaseCourante.resultatSolveur.convergence.convergé && (
                  <span className="px-2 py-0.5 text-[10px] bg-refus-fond text-refus font-bold rounded-rayon-petit">
                    Mécanisme instable
                  </span>
                )}
              </div>
              <div className="mt-1 text-refus font-medium leading-relaxed">
                {phaseCourante.resultatSolveur.convergence.message}
              </div>
              {phaseCourante.resultatSolveur.convergence.avertissements.length > 0 && (
                <ul className="mt-2 list-disc list-inside space-y-1 text-refus">
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
      <div className="bg-surface border border-bordure rounded-rayon overflow-hidden">
        <div className="px-4 py-3 bg-surface-appui border-b border-bordure flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-ok" />
            <span className="font-bold text-texte">
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
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-rayon-petit text-xs transition border ${
                filtreEtiquettesOuvert
                  ? 'bg-surface-appui text-texte border-bordure font-bold'
                  : 'bg-surface text-texte-doux hover:bg-surface-appui border-bordure font-medium'
              }`}
              title="Masquer / Afficher les types d'étiquettes du diagramme"
            >
              <Tag className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Étiquettes</span>
              <span className="px-1.5 py-0.2 rounded-rayon-petit text-[10px] font-bold bg-surface-appui text-texte-doux border border-bordure">
                {nbActivesParoi}/{totalTypesParoi}
              </span>
              <ChevronDown className={`w-3 h-3 transition-transform ${filtreEtiquettesOuvert ? 'rotate-180' : ''}`} />
            </button>

            <div className="flex items-center bg-surface-appui p-0.5 rounded-rayon-petit font-medium">
              <button
                type="button"
                onClick={() => setDiagrammeAffiche('tous')}
                className={`px-2.5 py-1 rounded-rayon-petit transition ${
                  diagrammeAffiche === 'tous' ? 'bg-surface text-texte font-bold' : 'text-texte-doux'
                }`}
              >
                Vue d'ensemble
              </button>
              <button
                type="button"
                onClick={() => setDiagrammeAffiche('deformee')}
                className={`px-2.5 py-1 rounded-rayon-petit transition ${
                  diagrammeAffiche === 'deformee' ? 'bg-surface text-texte font-bold' : 'text-texte-doux'
                }`}
              >
                Déformée u(z)
              </button>
              <button
                type="button"
                onClick={() => setDiagrammeAffiche('moment')}
                className={`px-2.5 py-1 rounded-rayon-petit transition ${
                  diagrammeAffiche === 'moment' ? 'bg-surface text-texte font-bold' : 'text-texte-doux'
                }`}
              >
                Moment M(z)
              </button>
              <button
                type="button"
                onClick={() => setDiagrammeAffiche('tranchant')}
                className={`px-2.5 py-1 rounded-rayon-petit transition ${
                  diagrammeAffiche === 'tranchant' ? 'bg-surface text-texte font-bold' : 'text-texte-doux'
                }`}
              >
                Tranchant V(z)
              </button>
              <button
                type="button"
                onClick={() => setDiagrammeAffiche('pressions')}
                className={`px-2.5 py-1 rounded-rayon-petit transition ${
                  diagrammeAffiche === 'pressions' ? 'bg-surface text-texte font-bold' : 'text-texte-doux'
                }`}
              >
                Pressions Pa/Pp
              </button>
            </div>
          </div>
        </div>

        {/* Panneau de sélection des types d'étiquettes à afficher ou masquer */}
        {filtreEtiquettesOuvert && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-surface-appui border-b border-bordure text-xs animate-fadeIn">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-texte-faible mr-1">Types d'étiquettes :</span>
              {TYPES_ETIQUETTES_PAROI_CONFIG.map((cfg) => {
                const estActif = visibilitesEtiquettes[cfg.id];
                return (
                  <button
                    key={cfg.id}
                    id={`chip-etiquette-paroi-${cfg.id}`}
                    type="button"
                    onClick={() => toggleTypeEtiquette(cfg.id)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-rayon-petit text-[11px] font-medium transition border ${
                      estActif
                        ? 'bg-surface text-texte border-bordure'
                        : 'bg-surface-appui text-texte-faible border-dashed border-bordure line-through opacity-70'
                    }`}
                    title={`${estActif ? 'Masquer' : 'Afficher'} : ${cfg.description}`}
                  >
                    <span className={`w-2 h-2 rounded-full ${estActif ? cfg.dotColor : 'bg-bordure'}`} />
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
                className="text-[11px] text-texte-doux hover:text-texte px-2 py-0.5 rounded hover:bg-surface-appui transition"
              >
                Tout masquer
              </button>
              <span className="text-texte-faible">|</span>
              <button
                id="btn-afficher-toutes-etiquettes-paroi"
                type="button"
                onClick={toutAfficherEtiquettes}
                className="text-[11px] text-ok hover:text-ok font-semibold px-2 py-0.5 rounded hover:bg-ok-fond transition"
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
            <div className="py-12 text-center text-texte-faible text-xs">
              Calcul en cours ou paramètres non définis...
            </div>
          )}
        </div>
      </div>

      {/* 4. Tableau des Réactions dans les Appuis pour la phase active */}
      {phaseCourante && (
        <div className="bg-surface border border-bordure rounded-rayon overflow-hidden">
          <div className="px-4 py-3 bg-surface-appui border-b border-bordure flex items-center justify-between text-xs">
            <span className="font-bold text-texte">
              Sollicitations et Réactions des Butons / Tirants ({phaseCourante.phase.nom})
            </span>
            <span className="text-[11px] text-texte-faible">
              Loi d'appui : F = k · (u - u_ref) où u_ref est gelé à la pose
            </span>
          </div>

          {phaseCourante.reactionsAppuis.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-appui text-texte-doux border-b border-bordure">
                  <tr>
                    <th className="p-2.5 font-semibold">Repère</th>
                    <th className="p-2.5 font-semibold">Type</th>
                    <th className="p-2.5 font-semibold">Cote (m)</th>
                    <th className="p-2.5 font-semibold">Pose</th>
                    <th className="p-2.5 font-semibold text-right">u_ref gelé (mm)</th>
                    <th className="p-2.5 font-semibold text-right">u final (mm)</th>
                    <th className="p-2.5 font-semibold text-right">Δu actif (mm)</th>
                    <th className="p-2.5 font-semibold text-right">
                      Réaction F (kN/m)
                    </th>
                    <th className="p-2.5 font-semibold text-center">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bordure-douce">
                  {phaseCourante.reactionsAppuis.map((r) => {
                    const appuiConf = appuis.find((a) => a.id === r.appuiId);
                    const delta_u_mm = (r.deplacementFinal - r.deplacementReference) * 1000;
                    const capacite = appuiConf?.reactionMax ?? 1000;
                    const ratio = Math.abs(r.reaction) / capacite;

                    return (
                      <tr key={r.appuiId} className="hover:bg-surface-appui">
                        <td className="p-2.5 font-bold text-texte">{r.appuiId}</td>
                        <td className="p-2.5 capitalize">
                          <span className="px-2 py-0.5 rounded-rayon-petit text-[10px] font-bold bg-surface-appui text-texte-doux border border-bordure">
                            {r.type}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono">{r.cote.toFixed(2)}</td>
                        <td className="p-2.5 text-texte-faible">
                          Phase {appuiConf?.phaseActivation ?? 1}
                        </td>
                        <td className="p-2.5 text-right font-mono text-texte-faible">
                          {(r.deplacementReference * 1000).toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono text-texte-doux">
                          {(r.deplacementFinal * 1000).toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-texte">
                          {delta_u_mm >= 0 ? `+${delta_u_mm.toFixed(2)}` : delta_u_mm.toFixed(2)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-extrabold text-sm text-ok">
                          {r.reaction.toFixed(1)}
                        </td>
                        <td className="p-2.5 text-center">
                          {ratio <= 1.0 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ok">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {(ratio * 100).toFixed(0)}% cap.
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-refus">
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
            <div className="p-4 text-center text-xs text-texte-faible italic">
              Aucun buton ou tirant actif pour cette phase (paroi en console).
            </div>
          )}
        </div>
      )}

      {/* 5. Paramètres détaillés : Géométrie de l'écran, Appuis et Modules kh du Sol */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {/* A. Géométrie et Rigidité de l'écran */}
        <div className="p-4 bg-surface border border-bordure rounded-rayon space-y-3">
          <h3 className="font-bold text-texte uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-ok" />
            1. Propriétés de la Paroi
          </h3>

          <div className="flex items-center bg-surface-appui p-0.5 rounded-rayon-petit text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setSousType('continue')}
              className={`px-2.5 py-1 rounded-rayon-petit transition ${
                sousType === 'continue'
                  ? 'bg-surface text-texte font-bold'
                  : 'text-texte-doux hover:text-texte'
              }`}
            >
              Paroi continue
            </button>
            <button
              type="button"
              onClick={() => setSousType('berlinoise')}
              className={`px-2.5 py-1 rounded-rayon-petit transition ${
                sousType === 'berlinoise'
                  ? 'bg-surface text-texte font-bold'
                  : 'text-texte-doux hover:text-texte'
              }`}
            >
              Berlinoise
            </button>
            <button
              type="button"
              onClick={() => setSousType('pieuxSecants')}
              className={`px-2.5 py-1 rounded-rayon-petit transition ${
                sousType === 'pieuxSecants'
                  ? 'bg-surface text-texte font-bold'
                  : 'text-texte-doux hover:text-texte'
              }`}
            >
              Pieux Sécants
            </button>
          </div>

          <div>
            <label className="block text-texte-faible mb-1">Cote Tête / Crête (m NGF)</label>
            <input
              type="number"
              step="0.5"
              value={coteTete}
              onChange={(e) => setCoteTete(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 border border-bordure rounded-rayon-petit font-bold text-texte"
            />
          </div>

          <div>
            <label className="block text-texte-faible mb-1">Cote Base / Fiche (m NGF)</label>
            <input
              type="number"
              step="0.5"
              value={coteBase}
              onChange={(e) => setCoteBase(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-1.5 border border-bordure rounded-rayon-petit font-bold text-ok"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-texte-faible mb-1">Épaisseur e (m)</label>
              <input
                type="number"
                step="0.05"
                min="0.2"
                max="2.0"
                value={epaisseur}
                onChange={(e) => setEpaisseur(parseFloat(e.target.value) || 0.6)}
                className="w-full px-2.5 py-1.5 border border-bordure rounded-rayon-petit font-bold"
              />
            </div>
            <div>
              <label className="block text-texte-faible mb-1">Module E (GPa)</label>
              <input
                type="number"
                step="1.0"
                min="5.0"
                max="210.0"
                value={moduleE_GPa}
                onChange={(e) => setModuleE_GPa(parseFloat(e.target.value) || 30.0)}
                className="w-full px-2.5 py-1.5 border border-bordure rounded-rayon-petit font-bold"
              />
            </div>
          </div>

          {sousType === 'berlinoise' && (
            <div className="p-2.5 bg-surface-appui border border-bordure rounded-rayon-petit space-y-2">
              <div className="text-[11px] font-bold text-texte-doux uppercase tracking-wider">
                Profilés & Blindage
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-texte-faible mb-1">Entraxe profilés (m)</label>
                  <input
                    type="number" step="0.1" min="0.5" max="4.0"
                    value={entraxeProfiles}
                    onChange={(e) => setEntraxeProfiles(parseFloat(e.target.value) || 1.2)}
                    className="w-full px-2 py-1.5 border border-bordure rounded-rayon-petit font-bold bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-texte-faible mb-1">Largeur profilé (m)</label>
                  <input
                    type="number" step="0.05" min="0.1" max="1.0"
                    value={profileLargeur}
                    onChange={(e) => setProfileLargeur(parseFloat(e.target.value) || 0.3)}
                    className="w-full px-2 py-1.5 border border-bordure rounded-rayon-petit font-bold bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-texte-faible mb-1">I profilé (m⁴)</label>
                  <input
                    type="number" step="0.00001" min="0.00001"
                    value={profileI}
                    onChange={(e) => setProfileI(parseFloat(e.target.value) || 0.0003)}
                    className="w-full px-2 py-1.5 border border-bordure rounded-rayon-petit font-bold bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-texte-faible mb-1">W profilé (m³)</label>
                  <input
                    type="number" step="0.0001" min="0.0001"
                    value={profileW}
                    onChange={(e) => setProfileW(parseFloat(e.target.value) || 0.0017)}
                    className="w-full px-2 py-1.5 border border-bordure rounded-rayon-petit font-bold bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-texte-faible mb-1">Hauteur passe (m)</label>
                  <input
                    type="number" step="0.1" min="0.2" max="3.0"
                    value={blindageHauteurPasse}
                    onChange={(e) => setBlindageHauteurPasse(parseFloat(e.target.value) || 1.0)}
                    className="w-full px-2 py-1.5 border border-bordure rounded-rayon-petit font-bold bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-texte-faible mb-1">Épais. blindage (m)</label>
                  <input
                    type="number" step="0.01" min="0.02" max="0.2"
                    value={blindageEpaisseur}
                    onChange={(e) => setBlindageEpaisseur(parseFloat(e.target.value) || 0.05)}
                    className="w-full px-2 py-1.5 border border-bordure rounded-rayon-petit font-bold bg-surface"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-texte-faible mb-1">Contrainte admissible blindage (kPa)</label>
                  <input
                    type="number" step="500" min="1000"
                    value={blindageContrainteAdm}
                    onChange={(e) => setBlindageContrainteAdm(parseFloat(e.target.value) || 10000)}
                    className="w-full px-2 py-1.5 border border-bordure rounded-rayon-petit font-bold bg-surface"
                  />
                </div>
              </div>
            </div>
          )}

          {sousType === 'pieuxSecants' && (
            <div className="p-2.5 bg-surface-appui border border-bordure rounded-rayon-petit space-y-2">
              <div className="text-[11px] font-bold text-texte-doux uppercase tracking-wider">
                Pieux Primaires & Secondaires
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-texte-faible mb-1">Diamètre primaire (m)</label>
                  <input
                    type="number" step="0.05" min="0.3" max="2.0"
                    value={diametrePrimaire}
                    onChange={(e) => setDiametrePrimaire(parseFloat(e.target.value) || 0.8)}
                    className="w-full px-2 py-1.5 border border-bordure rounded-rayon-petit font-bold bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-texte-faible mb-1">Diamètre secondaire (m)</label>
                  <input
                    type="number" step="0.05" min="0.3" max="2.0"
                    value={diametreSecondaire}
                    onChange={(e) => setDiametreSecondaire(parseFloat(e.target.value) || 0.8)}
                    className="w-full px-2 py-1.5 border border-bordure rounded-rayon-petit font-bold bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-texte-faible mb-1">Entraxe (m)</label>
                  <input
                    type="number" step="0.05" min="0.2" max="2.0"
                    value={entraxePieux}
                    onChange={(e) => setEntraxePieux(parseFloat(e.target.value) || 0.65)}
                    className="w-full px-2 py-1.5 border border-bordure rounded-rayon-petit font-bold bg-surface"
                  />
                </div>
                <div>
                  <label className="block text-texte-faible mb-1">Déviation verticalité (-)</label>
                  <input
                    type="number" step="0.001" min="0" max="0.1"
                    value={deviationVerticaliteMax}
                    onChange={(e) => setDeviationVerticaliteMax(parseFloat(e.target.value) || 0.01)}
                    className="w-full px-2 py-1.5 border border-bordure rounded-rayon-petit font-bold bg-surface"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-texte-faible mb-1">Recouvrement minimal requis (m)</label>
                  <input
                    type="number" step="0.01" min="0" max="0.5"
                    value={recouvrementMinimalRequis}
                    onChange={(e) => setRecouvrementMinimalRequis(parseFloat(e.target.value) || 0.05)}
                    className="w-full px-2 py-1.5 border border-bordure rounded-rayon-petit font-bold bg-surface"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="p-2.5 bg-surface-appui rounded-rayon-petit space-y-1 text-texte-doux text-[11px]">
            <div>• Hauteur totale de l'écran : <strong>{(coteTete - coteBase).toFixed(2)} m</strong></div>
            <div>• Rigidité flexion EI : <strong>{(E_kPa * I_m4).toExponential(3)} kNm²/m</strong></div>
            <div>• Inertie I : <strong>{I_m4.toFixed(5)} m⁴/m</strong></div>
          </div>
        </div>

        {/* B. Appuis (Butons et Tirants) */}
        <div className="p-4 bg-surface border border-bordure rounded-rayon space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-texte uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-alerte" />
              2. Butons & Tirants
            </h3>
            <button
              type="button"
              onClick={handleAddAppui}
              className="p-1 bg-alerte-fond text-alerte hover:bg-alerte-fond rounded-rayon-petit border border-bordure"
              title="Ajouter un lit d'appuis"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {appuis.map((a) => (
              <div
                key={a.id}
                className="p-2.5 border border-bordure rounded-rayon-petit bg-surface-appui space-y-2 text-[11px]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-texte">{a.id}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteAppui(a.id)}
                    className="text-texte-faible hover:text-refus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-texte-faible block">Cote (m) :</span>
                    <input
                      type="number"
                      step="0.25"
                      value={a.cote}
                      onChange={(e) =>
                        handleUpdateAppui(a.id, 'cote', parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-2 py-1 border border-bordure rounded font-bold bg-surface"
                    />
                  </div>
                  <div>
                    <span className="text-texte-faible block">Type :</span>
                    <select
                      value={a.type}
                      onChange={(e) =>
                        handleUpdateAppui(a.id, 'type', e.target.value as 'buton' | 'tirant')
                      }
                      className="w-full px-2 py-1 border border-bordure rounded bg-surface font-medium"
                    >
                      <option value="buton">Buton</option>
                      <option value="tirant">Tirant</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-texte-faible block">k (kN/m) :</span>
                    <input
                      type="number"
                      step="10000"
                      value={a.raideur}
                      onChange={(e) =>
                        handleUpdateAppui(a.id, 'raideur', parseFloat(e.target.value) || 10000)
                      }
                      className="w-full px-2 py-1 border border-bordure rounded font-bold bg-surface"
                    />
                  </div>
                  <div>
                    <span className="text-texte-faible block">Actif dès :</span>
                    <select
                      value={a.phaseActivation}
                      onChange={(e) =>
                        handleUpdateAppui(a.id, 'phaseActivation', parseInt(e.target.value) || 1)
                      }
                      className="w-full px-2 py-1 border border-bordure rounded bg-surface font-medium"
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
        <div className="p-4 bg-surface border border-bordure rounded-rayon space-y-3">
          <h3 className="font-bold text-texte uppercase tracking-wider flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-texte-faible" />
            3. Modules de Réaction kh (Sol)
          </h3>
          <p className="text-[11px] text-texte-faible">
            Saisie directe par couche en kN/m³ (§8.4 CDC). Si non spécifié, repli sur 20 000 kN/m³.
          </p>

          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {modele.couches.map((c) => {
              const val = khParCouche[c.id];
              const estDefaut = val === undefined;

              return (
                <div
                  key={c.id}
                  className="p-2 border border-bordure rounded-rayon-petit flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: c.couleurAffichage }}
                      />
                      <span className="font-bold text-texte truncate block text-[11px]">
                        {c.nom}
                      </span>
                    </div>
                    <span className="text-[10px] text-texte-faible">
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
                          ? 'border-bordure bg-alerte-fond text-alerte'
                          : 'border-bordure bg-surface text-texte'
                      }`}
                    />
                    <span className="text-[9px] text-texte-faible block text-right">kN/m³</span>
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
        <g stroke="#eceae4" strokeDasharray="3 3">
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
                    fill="#6a6862"
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
            stroke="#9a978f"
            strokeWidth="1.5"
            strokeDasharray="4 2"
          />
          {visibilitesEtiquettes.fondFouille && (
            <text
              x={width - 25}
              y={yDeCote(coteFondActive) - 5}
              textAnchor="end"
              fill="#9a978f"
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
                fill="#1a1a1a"
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
                stroke="#c8c6c0"
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
                    fill="#e7eaee"
                    stroke="#4a4842"
                    strokeWidth="1.5"
                    rx="2"
                  />

                  {/* Côté amont (sol retenu) */}
                  <rect
                    x={centerX - 55}
                    y={yDeCote(coteTete)}
                    width={47}
                    height={plotHeight}
                    fill="#f2f1ec"
                    opacity="0.7"
                  />
                  {visibilitesEtiquettes.zones && (
                    <text
                      x={centerX - 30}
                      y={yDeCote(coteTete) + 15}
                      textAnchor="middle"
                      fill="#6a6862"
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
                    fill="#eceae4"
                    opacity="0.7"
                  />
                  {visibilitesEtiquettes.zones && (
                    <text
                      x={centerX + 30}
                      y={yDeCote(coteFondActive) + 15}
                      textAnchor="middle"
                      fill="#6a6862"
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
                    fill="#f2f1ec"
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
                        <circle cx={centerX} cy={yApp} r="4" fill="#1a1a1a" />
                        <line
                          x1={centerX}
                          y1={yApp}
                          x2={centerX + 32}
                          y2={yApp}
                          stroke="#1a1a1a"
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
                                stroke="#1a1a1a"
                                strokeWidth="1"
                                strokeDasharray="2 2"
                              />
                            )}
                            <text
                              x={centerX + 38}
                              y={yLabel}
                              fill="#1a1a1a"
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
                        stroke="#c8c6c0"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    ))}

                  {/* Phase active */}
                  <path
                    d={construireCheminUx(phaseActive, col.width, col.offset)}
                    fill="none"
                    stroke="#1a1a1a"
                    strokeWidth="2.5"
                  />

                  {/* Valeurs extrêmes */}
                  {visibilitesEtiquettes.extremums && (
                    <>
                      <text
                        x={centerX + (col.width * 0.4)}
                        y={height - 10}
                        textAnchor="end"
                        fill="#1a1a1a"
                        fontSize="9"
                        fontWeight="bold"
                      >
                        +{(maxUx * 1000).toFixed(1)} mm
                      </text>
                      <text
                        x={centerX - (col.width * 0.4)}
                        y={height - 10}
                        textAnchor="start"
                        fill="#1a1a1a"
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
                        stroke="#c8c6c0"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    ))}

                  <path
                    d={construireCheminM(phaseActive, col.width, col.offset)}
                    fill="none"
                    stroke="#1a1a1a"
                    strokeWidth="2.5"
                  />

                  {visibilitesEtiquettes.extremums && (
                    <>
                      <text
                        x={centerX + (col.width * 0.4)}
                        y={height - 10}
                        textAnchor="end"
                        fill="#1a1a1a"
                        fontSize="9"
                        fontWeight="bold"
                      >
                        +{maxM.toFixed(0)} kNm/m
                      </text>
                      <text
                        x={centerX - (col.width * 0.4)}
                        y={height - 10}
                        textAnchor="start"
                        fill="#1a1a1a"
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
                        stroke="#c8c6c0"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    ))}

                  <path
                    d={construireCheminV(phaseActive, col.width, col.offset)}
                    fill="none"
                    stroke="#1a1a1a"
                    strokeWidth="2.5"
                  />

                  {visibilitesEtiquettes.extremums && (
                    <>
                      <text
                        x={centerX + (col.width * 0.4)}
                        y={height - 10}
                        textAnchor="end"
                        fill="#1a1a1a"
                        fontSize="9"
                        fontWeight="bold"
                      >
                        +{maxV.toFixed(0)} kN/m
                      </text>
                      <text
                        x={centerX - (col.width * 0.4)}
                        y={height - 10}
                        textAnchor="start"
                        fill="#1a1a1a"
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
                    stroke="#a8442a"
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
                    stroke="#2f5d8a"
                    strokeWidth="2"
                  />

                  {visibilitesEtiquettes.extremums && (
                    <>
                      <text
                        x={centerX - (col.width * 0.35)}
                        y={30}
                        fill="#a8442a"
                        fontSize="9"
                        fontWeight="bold"
                      >
                        ← Poussée Pa
                      </text>
                      <text
                        x={centerX + 10}
                        y={30}
                        fill="#2f5d8a"
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
