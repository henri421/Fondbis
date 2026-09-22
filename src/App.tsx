import React, { useState, useEffect, useRef } from 'react';
import { ModeleTerrain, OuvrageRadier, OuvragePieu, OuvrageSoutenement } from './types/geotech';
import { PROJET_EXEMPLE_EC7 } from './storage/projetExemple';
import { chargerProjetCourant, sauvegarderProjetCourant, exporterProjetJSON, importerProjetJSON } from './storage/db';
import { BandeauNormatif } from './components/BandeauNormatif';
import { CoupeDeSolCanvas } from './components/CoupeDeSolCanvas';
import { OngletSol } from './components/OngletSol';
import { OngletContraintes } from './components/OngletContraintes';
import { OngletRadier } from './components/OngletRadier';
import { OngletPieux } from './components/OngletPieux';
import { OngletSoutenement } from './components/OngletSoutenement';
import { OngletStabilite } from './components/OngletStabilite';
import { OngletValidation } from './components/OngletValidation';
import { ModalNoteDeCalcul } from './components/ModalNoteDeCalcul';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  Layers,
  LineChart,
  HardHat,
  Anchor,
  Shield,
  FileText,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Sparkles,
} from 'lucide-react';

type OngletId = 'sol' | 'contraintes' | 'radier' | 'pieux' | 'soutenement' | 'stabilite' | 'validation';

export default function App() {
  const [modele, setModele] = useState<ModeleTerrain>(PROJET_EXEMPLE_EC7);
  const [ongletActif, setOngletActif] = useState<OngletId>('radier');
  const [noteDeCalculOuverte, setNoteDeCalculOuverte] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chargement initial depuis IndexedDB
  useEffect(() => {
    chargerProjetCourant().then((proj) => {
      if (proj) setModele(proj);
    });
  }, []);

  // Sauvegarde automatique lors des modifications
  const handleUpdateModele = (nouveauModele: ModeleTerrain) => {
    setModele(nouveauModele);
    sauvegarderProjetCourant(nouveauModele);
  };

  const afficherNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleExport = () => {
    exporterProjetJSON(modele);
    afficherNotification('Projet exporté avec succès au format JSON.', 'success');
  };

  const handleImportFichier = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const contenu = evt.target?.result as string;
        const projetImporte = importerProjetJSON(contenu);
        handleUpdateModele(projetImporte);
        afficherNotification(`Projet "${projetImporte.projet.nom}" importé avec succès !`, 'success');
      } catch (err: any) {
        afficherNotification(err.message || "Erreur lors de l'import du fichier.", 'error');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  // Mise à jour spécifique des ouvrages
  const handleUpdateRadier = (radier: OuvrageRadier) => {
    handleUpdateModele({
      ...modele,
      ouvrages: {
        ...modele.ouvrages,
        radiers: [radier],
      },
    });
  };

  const handleUpdatePieu = (pieu: OuvragePieu) => {
    handleUpdateModele({
      ...modele,
      ouvrages: {
        ...modele.ouvrages,
        pieux: [pieu],
      },
    });
  };

  // Upsert par type : murEnL et paroiFlexible persistent chacun indépendamment sans
  // s'écraser l'un l'autre (avant : soutenements: [mur] remplaçait tout le tableau).
  const handleUpdateSoutenement = (ouvrage: OuvrageSoutenement) => {
    const autres = modele.ouvrages.soutenements.filter((s) => s.type !== ouvrage.type);
    handleUpdateModele({
      ...modele,
      ouvrages: {
        ...modele.ouvrages,
        soutenements: [...autres, ouvrage],
      },
    });
  };

  // Détermination de l'ouvrage actif pour la coupe
  const getOuvrageActifPourCoupe = () => {
    if (ongletActif === 'pieux') {
      return { type: 'pieu' as const, pieu: modele.ouvrages.pieux[0] };
    }
    if (ongletActif === 'soutenement') {
      const soutenementPourCoupe =
        modele.ouvrages.soutenements.find((s) => s.type === 'murEnL') ??
        modele.ouvrages.soutenements[0];
      return { type: 'soutenement' as const, soutenement: soutenementPourCoupe };
    }
    // Par défaut ou si 'radier' / 'sol' / 'contraintes'
    return { type: 'radier' as const, radier: modele.ouvrages.radiers[0] };
  };

  return (
    <div className="min-h-screen flex flex-col bg-fond text-texte font-sans">
      {/* 1. Bandeau Normatif Permanent Obligatoire */}
      <BandeauNormatif />

      {/* 2. Barre d'entête principale */}
      <header className="bg-surface text-texte px-4 py-3 border-b border-bordure">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-rayon bg-accent-doux text-accent flex items-center justify-center font-semibold text-base">
              EC7
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-normal tracking-wide text-texte">GeoTech EC7</h1>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-rayon-petit bg-surface-appui text-texte-doux border border-bordure">
                  EN 1997-1:2004 • DA2*
                </span>
              </div>
              <p className="text-xs text-texte-doux truncate max-w-md">
                {modele.projet.nom} ({modele.projet.reference})
              </p>
            </div>
          </div>

          {/* Boutons d'actions rapides */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFichier}
              accept=".json"
              className="hidden"
            />
            <button
              id="btn-importer-json"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-appui hover:bg-[#e8e7e1] text-texte rounded-rayon-petit text-xs font-semibold border border-bordure transition-colors"
              title="Importer un projet JSON"
            >
              <Upload className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Importer JSON</span>
            </button>

            <button
              id="btn-exporter-json"
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-appui hover:bg-[#e8e7e1] text-texte rounded-rayon-petit text-xs font-semibold border border-bordure transition-colors"
              title="Exporter le projet au format JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exporter JSON</span>
            </button>

            <PWAInstallButton />

            <button
              id="btn-note-calcul"
              onClick={() => setNoteDeCalculOuverte(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-surface-appui hover:bg-[#e8e7e1] text-texte rounded-rayon-petit text-xs font-semibold border border-bordure transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Note de Calcul
            </button>
          </div>
        </div>
      </header>

      {/* Indicateur de statut Hors-ligne */}
      <OfflineIndicator />

      {/* Toast de notification */}
      {notification && (
        <div
          className={`fixed top-16 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-xs font-semibold flex items-center gap-2 border transition-all duration-300 ${
            notification.type === 'success'
              ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
              : 'bg-rose-50 text-rose-950 border-rose-300'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* 3. Barre des onglets de calcul */}
      <nav className="bg-surface border-b border-bordure sticky top-0 z-20 relative">
        {/* Fondu indiquant que la barre défile horizontalement (les onglets peuvent dépasser
            la largeur visible) — sans lui, un onglet tronqué en bord de fenêtre ressemble à
            un bug plutôt qu'à une invitation à faire défiler. */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-surface to-transparent z-10" />
        <div className="max-w-7xl mx-auto px-4 flex space-x-1 overflow-x-auto py-1">
          <button
            id="tab-btn-radier"
            onClick={() => setOngletActif('radier')}
            className={`flex items-center gap-2 px-3 py-2 rounded-rayon-petit text-xs font-semibold whitespace-nowrap transition-colors ${
              ongletActif === 'radier'
                ? 'bg-surface-appui text-texte border border-bordure'
                : 'text-texte-doux hover:bg-surface-appui'
            }`}
          >
            <HardHat className="w-4 h-4" />
            <span>Module A : Radiers & Semelles</span>
          </button>

          <button
            id="tab-btn-pieux"
            onClick={() => setOngletActif('pieux')}
            className={`flex items-center gap-2 px-3 py-2 rounded-rayon-petit text-xs font-semibold whitespace-nowrap transition-colors ${
              ongletActif === 'pieux'
                ? 'bg-surface-appui text-texte border border-bordure'
                : 'text-texte-doux hover:bg-surface-appui'
            }`}
          >
            <Anchor className="w-4 h-4" />
            <span>Module B : Fondations Profondes</span>
          </button>

          <button
            id="tab-btn-soutenement"
            onClick={() => setOngletActif('soutenement')}
            className={`flex items-center gap-2 px-3 py-2 rounded-rayon-petit text-xs font-semibold whitespace-nowrap transition-colors ${
              ongletActif === 'soutenement'
                ? 'bg-surface-appui text-texte border border-bordure'
                : 'text-texte-doux hover:bg-surface-appui'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Module C : Soutènements (Mur & Paroi)</span>
          </button>

          <button
            id="tab-btn-stabilite"
            onClick={() => setOngletActif('stabilite')}
            className={`flex items-center gap-2 px-3 py-2 rounded-rayon-petit text-xs font-semibold whitespace-nowrap transition-colors ${
              ongletActif === 'stabilite'
                ? 'bg-surface-appui text-texte border border-bordure'
                : 'text-texte-doux hover:bg-surface-appui'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Stabilité Pentes (Bishop)</span>
          </button>

          <div className="w-px h-5 bg-bordure my-auto mx-1 shrink-0" />

          <button
            id="tab-btn-sol"
            onClick={() => setOngletActif('sol')}
            className={`flex items-center gap-2 px-3 py-2 rounded-rayon-petit text-xs font-semibold whitespace-nowrap transition-colors ${
              ongletActif === 'sol'
                ? 'bg-surface-appui text-texte border border-bordure'
                : 'text-texte-doux hover:bg-surface-appui'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Stratigraphie & Sol</span>
          </button>

          <button
            id="tab-btn-contraintes"
            onClick={() => setOngletActif('contraintes')}
            className={`flex items-center gap-2 px-3 py-2 rounded-rayon-petit text-xs font-semibold whitespace-nowrap transition-colors ${
              ongletActif === 'contraintes'
                ? 'bg-surface-appui text-texte border border-bordure'
                : 'text-texte-doux hover:bg-surface-appui'
            }`}
          >
            <LineChart className="w-4 h-4" />
            <span>Profil Contraintes</span>
          </button>

          <button
            id="tab-btn-validation"
            onClick={() => setOngletActif('validation')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-rayon-petit text-xs font-semibold whitespace-nowrap transition-colors ${
              ongletActif === 'validation'
                ? 'bg-surface-appui text-texte border border-bordure'
                : 'text-texte-doux hover:bg-surface-appui'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Recette Normative (7 Tests)</span>
          </button>
        </div>
      </nav>

      {/* 4. Corps principal : Coupe de sol verticale + Formulaires & Résultats */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Colonne GAUCHE : Coupe de sol interactive (4 colonnes en desktop) */}
        <div className="lg:col-span-4 h-[420px] lg:h-[720px] sticky top-20">
          <CoupeDeSolCanvas
            coteTerrainNaturel={modele.referentiel.coteTerrainNaturel}
            couches={modele.couches}
            hydrogeologie={modele.hydrogeologie}
            ouvrageActif={getOuvrageActifPourCoupe()}
          />
        </div>

        {/* Colonne DROITE : Contenu des onglets métiers (8 colonnes en desktop) */}
        <div className="lg:col-span-8 space-y-6">
          {ongletActif === 'sol' && (
            <OngletSol modele={modele} onUpdateModele={handleUpdateModele} />
          )}

          {ongletActif === 'contraintes' && (
            <OngletContraintes modele={modele} />
          )}

          {ongletActif === 'radier' && (
            <OngletRadier modele={modele} onUpdateRadier={handleUpdateRadier} />
          )}

          {ongletActif === 'pieux' && (
            <OngletPieux modele={modele} onUpdatePieu={handleUpdatePieu} />
          )}

          {ongletActif === 'soutenement' && (
            <OngletSoutenement modele={modele} onUpdateSoutenement={handleUpdateSoutenement} />
          )}

          {ongletActif === 'stabilite' && (
            <OngletStabilite modele={modele} />
          )}

          {ongletActif === 'validation' && (
            <OngletValidation />
          )}
        </div>
      </main>

      {/* 5. Modal de Note de Calcul officielle exportable */}
      {noteDeCalculOuverte && (
        <ModalNoteDeCalcul
          modele={modele}
          onClose={() => setNoteDeCalculOuverte(false)}
        />
      )}

      {/* 6. Pied de page discret */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-3 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>
            Application de Calcul Géotechnique Eurocode 7 (EN 1997-1:2004) • Modèle PWA Client-Side
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            Schéma v1.0 • Approche DA2* • Données persistées IndexedDB
          </span>
        </div>
      </footer>
    </div>
  );
}
