# Fondation — identité visuelle

Rattachement à `WebAedificium/section-uls/poinçonnement/STM` (voir
`../Structura/DESIGN.md`, le fichier de référence de la suite). Même `:root`, copié tel quel
— pas de dépendance partagée entre dépôts, chaque outil garde sa pile.

## Le bloc à copier

Identique à `Structura/DESIGN.md`, sans modification :

```css
:root {
  /* ---- Châssis ---- */
  --fond: #f7f7f6;
  --surface: #ffffff;
  --surface-appui: #f2f1ec;
  --texte: #1a1a1a;
  --texte-doux: #4a4842;
  --texte-faible: #6a6862;
  --bordure: #c8c6c0;
  --bordure-douce: #eceae4;

  /* ---- Interface ---- */
  --accent: #1e5aa8;
  --accent-doux: #eaf1f9;

  /* ---- Couleurs de sens ---- */
  --compression: #2f5d8a;
  --traction: #a8442a;
  --beton: #e7eaee;
  --neutre: #9a978f;

  /* ---- Verdicts ---- */
  --ok: #1f6f3f;      --ok-fond: #eaf4ee;
  --alerte: #8a6d00;  --alerte-fond: #fdf6e3;
  --refus: #a52121;   --refus-fond: #f8ecec;

  /* ---- Typographie ---- */
  --sans: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  /* ---- Rayons ---- */
  --rayon: 4px;
  --rayon-petit: 3px;

  color-scheme: light;
}
```

## Extensions Fondation : aucune

Fondation a des concepts que les trois autres outils n'ont pas (poussée/butée, nappe,
terrain naturel). Après audit des couleurs réellement utilisées aujourd'hui dans
`CoupeDeSolCanvas.tsx` (une douzaine de hex codés en dur, jamais décidés), **aucun nouveau
jeton n'est nécessaire** — chaque concept se rattache à un jeton existant en suivant la même
logique de généralisation que la suite applique déjà ailleurs :

| Concept Fondation | Jeton | Justification |
|---|---|---|
| Butée Pp (réaction du sol, stabilisant) | `--compression` | même axe sémantique que bielle/effort résistant dans STM — « la compression est bleue... partout » |
| Poussée Pa (action déstabilisante) | `--traction` | même axe, le pendant « point sollicitant » |
| Nappe ELS (niveau caractéristique, informationnel) | `--accent` | précédent poinçonnement : « un périmètre est une construction géométrique, pas un effort » — la nappe ELS est un niveau de référence, pas un verdict |
| Nappe ELU défavorable | `--alerte` | c'est littéralement l'hypothèse défavorable retenue pour le dimensionnement |
| Terrain Naturel (TN) | `--neutre` | ligne de référence pure — exactement la définition de `--neutre` (« repères de cotation ») |
| Béton armé (remplissage de coupe) | `--beton` | déjà le jeton prévu pour un aplat de matière dans les tracés |
| Conforme / Alerte / Non conforme (tous les onglets) | `--ok` / `--alerte` / `--refus` | verdicts à 3 états, forme unique (liséré 3px + fond `*-fond`) |

Si un besoin réel apparaît en travaillant les fichiers de diagramme (`CoupeDeSolCanvas.tsx`,
les diagrammes de la paroi phasée) sans correspondance honnête, il sera ajouté ici avec sa
justification — jamais un hex de plus sans raison documentée (règle du fichier de référence).

## Intégration technique (Tailwind v4)

Fondation utilise Tailwind v4 (`@tailwindcss/vite`, pas de `tailwind.config.js`, thème posé en
CSS). Le bloc `:root` ci-dessus est collé tel quel dans `src/index.css` (portable, copiable
dans un autre dépôt de la suite sans changement), puis un bloc `@theme` séparé fait le pont
vers les classes utilitaires Tailwind (`--color-fond: var(--fond)` → génère `bg-fond`,
`text-fond`, etc.). Le `:root` reste la source de vérité ; `@theme` n'est qu'un miroir.

## Primitives partagées

`src/components/ui/` — composants React minimaux, pas de classes CSS globales de composants
(cohérent avec le reste du dépôt, qui n'a jamais eu de couche de classes partagées) :
- `Card` — conteneur `--surface` + `--bordure` + `--rayon`, un seul niveau, jamais d'ombre.
- `Verdict` — les 3 états `ok`/`alerte`/`refus`, liséré gauche 3px, forme unique dans tout
  le dépôt (remplace les dizaines de variantes `bg-emerald-50/70 border-emerald-200...`
  actuellement recopiées à la main dans chaque onglet).
- `Bouton` — un seul niveau, pas de bouton « primaire » coloré (le résultat se recalcule en
  continu, comme dans les 3 autres outils — cf. Structura/DESIGN.md).
- `Champ` — label + input, nombres en `--mono` alignés à droite.

## Densité et typographie

Base `14px/1.5`, nombres et valeurs de champ en `--mono` avec `tabular-nums`, surtitres en
`--sans` majuscules `.08em` (jamais en mono — erreur observée dans le hub d'origine, cf.
Structura/DESIGN.md). `h1` 1.1rem, `h2` 0.95rem, corps 0.85rem.

## Ordre de la passe

1. Poser le `:root` + `@theme` dans `src/index.css`, primitives dans `src/components/ui/`.
2. Preuve sur un onglet petit et sans risque de calcul : `OngletValidation.tsx` (pas de
   moteur normatif, juste de l'affichage — zéro risque sur la responsabilité réglementaire
   de l'outil pendant qu'on valide la direction visuelle).
3. Validation par Henri avant de dérouler sur le reste (15 fichiers, ~8000 lignes, dont
   `OngletParoiPhasee.tsx` à 2145 lignes et `CoupeDeSolCanvas.tsx` à 993 lignes — les deux
   plus gros chantiers, traités en dernier et chacun sur son propre commit/revue).
4. Purger les hex en dur, notamment dans les fonctions de dessin SVG.
5. Barre commune / lien vers le hub : **pas dans cette passe**. Rester aligné avec la
   décision déjà actée dans `DEVPLAN.md` (« Wiring restant ») — le lien sortant vers le hub
   n'expose rien tant que Fondation n'est pas listé *dans* le hub, mais l'inscription au hub
   lui-même reste conditionnée à la validation de la phase 4 (responsabilité réglementaire).
6. Vérifier l'impression (déjà une exigence de la suite : barre masquée, fond blanc, filets
   conservés) une fois les onglets concernés migrés.
