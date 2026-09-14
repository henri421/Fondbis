import { ModeleTerrain } from '../types/geotech';
import { PROJET_EXEMPLE_EC7 } from './projetExemple';

const DB_NAME = 'GeoTechEC7_DB';
const DB_VERSION = 1;
const STORE_NAME = 'projets';
const CURRENT_PROJECT_KEY = 'projet_courant';

export function ouvrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB non supporté'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

export async function chargerProjetCourant(): Promise<ModeleTerrain> {
  try {
    const db = await ouvrirDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(CURRENT_PROJECT_KEY);

      req.onsuccess = () => {
        if (req.result && req.result.schemaVersion === '1.0') {
          resolve(req.result as ModeleTerrain);
        } else {
          resolve(PROJET_EXEMPLE_EC7);
        }
      };

      req.onerror = () => {
        resolve(PROJET_EXEMPLE_EC7);
      };
    });
  } catch (e) {
    console.warn('Erreur ouverture IndexedDB, utilisation du modèle par défaut', e);
    return PROJET_EXEMPLE_EC7;
  }
}

export async function sauvegarderProjetCourant(projet: ModeleTerrain): Promise<void> {
  try {
    const db = await ouvrirDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(projet, CURRENT_PROJECT_KEY);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('Erreur sauvegarde IndexedDB', e);
  }
}

/**
 * Export du projet au format JSON documenté
 */
export function exporterProjetJSON(projet: ModeleTerrain): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(projet, null, 2));
  const downloadAnchor = document.createElement('a');
  const nomFichier = `${projet.projet.reference || 'Projet_EC7'}_${new Date().toISOString().slice(0, 10)}.json`;
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', nomFichier);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

/**
 * Import d'un projet JSON avec validation stricte du schéma
 */
export function importerProjetJSON(contenuTexte: string): ModeleTerrain {
  let parsed: any;
  try {
    parsed = JSON.parse(contenuTexte);
  } catch (err) {
    throw new Error('Fichier JSON invalide : syntaxe corrompue.');
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Contenu de projet invalide.');
  }

  if (parsed.schemaVersion !== '1.0') {
    throw new Error(
      `Version de schéma non supportée : "${parsed.schemaVersion}". Seule la version "1.0" est prise en charge.`
    );
  }

  if (!parsed.referentiel || !parsed.hydrogeologie || !Array.isArray(parsed.couches)) {
    throw new Error('Structure géotechnique incomplète : referentiel, hydrogeologie ou couches manquantes.');
  }

  // Vérification de la jointivité des couches (Section 4.4)
  const couches = parsed.couches as any[];
  for (let i = 0; i < couches.length - 1; i++) {
    const c1 = couches[i];
    const c2 = couches[i + 1];
    const base1 = c1.coteToit - c1.epaisseur;
    const toit2 = c2.coteToit;
    if (Math.abs(base1 - toit2) > 0.005) {
      throw new Error(
        `Discontinuité stratigraphique détectée entre "${c1.nom}" (base: ${base1.toFixed(2)}m) et "${c2.nom}" (toit: ${toit2.toFixed(2)}m). Les couches doivent être strictement jointives sans lacune ni recouvrement.`
      );
    }
  }

  return parsed as ModeleTerrain;
}
