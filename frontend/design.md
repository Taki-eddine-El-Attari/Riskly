# Riskly — Design System

Source de vérité visuelle du projet (landing **et** application).
Ce document décrit **ce qui existe déjà dans le code** et **ce qui reste à construire**,
pour servir de base au design system de l'app.

**Légende de statut**
- `✅ Implémenté` — présent et utilisé dans le code.
- `◐ Partiel` — présent mais incomplet, statique, ou pas encore monté (composant « en réserve »).
- `🚧 À construire` — spécifié ici, pas encore dans le code. Sert de cahier des charges pour l'app.

---

## Sommaire

1. [Principes & référence visuelle](#1-principes--référence-visuelle)
2. [Fondations — Couleurs](#2-fondations--couleurs)
3. [Fondations — Typographie](#3-fondations--typographie)
4. [Fondations — Espacement, rayons, ombres, élévation](#4-fondations--espacement-rayons-ombres-élévation)
5. [Config Tailwind v4 (`@theme`)](#5-config-tailwind-v4-theme)
6. [Utilitaires & styles globaux (CSS custom)](#6-utilitaires--styles-globaux-css-custom)
7. [Motion & animations](#7-motion--animations)
8. [Primitives UI (shadcn)](#8-primitives-ui-shadcn)
9. [Composants signature](#9-composants-signature)
10. [Patterns d'authentification](#10-patterns-dauthentification)
11. [Landing — inventaire des sections](#11-landing--inventaire-des-sections)
12. [Application — le design system produit (à construire)](#12-application--le-design-system-produit-à-construire)
13. [Ton rédactionnel](#13-ton-rédactionnel)
14. [Accessibilité](#14-accessibilité)
15. [Conventions de code](#15-conventions-de-code)

---

## 1. Principes & référence visuelle

Le produit doit ressembler à un croisement de **Linear** (linear.app) et **Vercel** (vercel.com),
avec l'esprit « data / sécurité » de **Stripe Radar**. Sombre, dense en données, sobre.

**Anti-références** : pas de dégradés violets génériques, pas d'illustrations IA, pas de glassmorphism partout.

**Principes directeurs**
1. **Dark-first, clair disponible.** Le sombre reste le thème de référence et le défaut (l'échelle de gris part de `#0A0E1A`). Un **thème clair** l'accompagne, activé par la classe `.light` sur `<html>` et une **bascule dans la navbar / le header auth** (bouton soleil/lune). Le choix est mémorisé (`localStorage: riskly-theme`) et posé avant le rendu (script anti-FOUC). Voir §2 pour la palette claire. *(Historiquement le produit était « dark-only » ; le clair a été ajouté sans toucher à l'identité sombre.)*
2. **La donnée est en mono.** Tout ce qui est chiffre, domaine, date, rang, score s'affiche en `JetBrains Mono`. C'est ce qui donne le look « outil de data ».
3. **La couleur porte du sens, jamais de la décoration.** Ambre et rouge ne servent QU'aux verdicts et au risque. Le cyan est l'unique accent d'interaction (CTA, liens, focus).
4. **Les bordures font le travail, pas les ombres.** Séparation par `border` + surface `bg-elevated`. Ombres réservées aux éléments flottants (2 seulement dans tout le code).
5. **Sobriété du mouvement.** Animations d'entrée sur la landing (marketing) ; l'app est calme — transitions 150 ms, aucune entrée animée. `prefers-reduced-motion` respecté partout.
6. **Densité côté app, respiration côté landing.** La vitrine aère (`py-24`) ; l'app resserre (tableaux, formulaires, cartes compactes).

---

## 2. Fondations — Couleurs `✅ Implémenté`

Onze tokens, définis dans `src/index.css` via `@theme`. Aucune couleur en dur hors de ces tokens
(exception documentée : le globe cobe et le BorderBeam, qui prennent des RGB/hex bruts, dérivés de `accent`).

### Fond & surfaces
| Token | Hex | Usage |
|---|---|---|
| `bg` | `#0A0E1A` | Fond principal (bleu-noir profond) |
| `bg-elevated` | `#111627` | Cartes, navbar, terminal, panneaux, inputs |
| `border` | `#1E2438` | Bordures de cartes, séparateurs, grilles |
| `border-hover` | `#2E3650` | Bordure au survol |

### Texte
| Token | Hex | Usage |
|---|---|---|
| `text` | `#EDEEF2` | Titres, texte principal (blanc cassé) |
| `text-muted` | `#8A91A8` | Sous-titres, descriptions, corps secondaire |
| `text-faint` | `#565D75` | Labels, metadata, placeholders, valeurs mono discrètes |

### Accent & verdicts — le langage visuel du produit
| Token | Hex | Rôle sémantique | Usage |
|---|---|---|---|
| `accent` | `#22D3EE` (cyan) | Interaction / info | CTA, liens, focus, bordures actives, score d'autorité |
| `good` | `#34D399` (émeraude) | Succès / verdict positif | « Bon achat », risque faible, mot de passe fort |
| `risky` | `#FBBF24` (ambre) | Avertissement | « Risqué », risque modéré |
| `avoid` | `#F87171` (rouge) | Danger / erreur | « À éviter », risque élevé, erreurs de formulaire |

**Règles de couleur**
- **Ambre (`risky`) et rouge (`avoid`) n'apparaissent QUE pour le risque et les verdicts.** Jamais en décoration.
- **Le cyan (`accent`) est l'unique accent marketing** (boutons, hover, liens, focus).
- Les erreurs de formulaire réutilisent `avoid` (cohérence : une erreur *est* un « à éviter »).
- Il n'y a pas de token `info`/`warning`/`error`/`success` séparé : **les verdicts SONT le système sémantique.** `good` = succès, `risky` = warning, `avoid` = danger, `accent` = info/interactif.

### Conventions d'opacité (pattern `/NN` de Tailwind)
Les couleurs pleines sont rarement posées telles quelles ; on les décline en opacité selon un barème constant.

| Opacité | Usage type | Exemple dans le code |
|---|---|---|
| `/10` | Fond teinté d'un badge/état | `bg-good/10`, `bg-avoid/10` |
| `/20` | Anneau de focus doux, hover destructif | `ring-accent/20`, `hover:bg-avoid/20` |
| `/25` | Fond teinté au survol (cellule matrice) | `hover:bg-good/25` |
| `/30` | Bordure d'un badge, anneau de focus fort | `border-good/30`, `ring-accent/30` |
| `/40` | Bordure de carte au survol | `hover:border-accent/40` |
| `/60` | Points de statut, bordure focus input | `bg-avoid/60`, `focus:border-accent/60` |

Badge type = `bg-{token}/10  text-{token}  border-{token}/30`, hover = `bg-{token}/25  border-{token}`.

### Thème clair `✅ Implémenté`

Le clair **ne remplace pas** un simple fond blanc : les teintes néon calibrées pour le sombre deviennent illisibles sur blanc (échec du contraste AA). On redéfinit donc **les mêmes 11 tokens** sous `.light` (dans `@layer base` de `src/index.css`), selon deux règles :

1. **Élévation inversée.** Le fond passe en gris froid léger et les surfaces élevées (cartes, navbar, inputs) en **blanc** : elles « flottent » en étant plus lumineuses que la base — l'inverse du sombre.
2. **Accents & verdicts approfondis.** Cyan / vert / ambre / rouge sont assombris pour tenir le contraste AA sur clair. **La sémantique est identique** : cyan = interaction, vert/ambre/rouge = verdicts uniquement.

| Token | Sombre (défaut) | Clair (`.light`) | Note |
|---|---|---|---|
| `bg` | `#0A0E1A` | `#F7F8FA` | gris froid léger, pas blanc pur |
| `bg-elevated` | `#111627` | `#FFFFFF` | surfaces élevées en blanc (élévation inversée) |
| `border` | `#1E2438` | `#E4E7EC` | |
| `border-hover` | `#2E3650` | `#D0D5DD` | |
| `text` | `#EDEEF2` | `#0D1220` | réutilise le bleu-noir de marque |
| `text-muted` | `#8A91A8` | `#565D73` | |
| `text-faint` | `#565D75` | `#868DA0` | metadata / placeholders uniquement |
| `accent` | `#22D3EE` | `#0E7490` | cyan-700 : lisible sur blanc, reste « cyan » |
| `good` | `#34D399` | `#047857` | émeraude-700 |
| `risky` | `#FBBF24` | `#B45309` | ambre-700 (l'ambre vif est illisible sur blanc) |
| `avoid` | `#F87171` | `#DC2626` | rouge-600 |

Le motif de badge (`bg/10 · text · border/30`) fonctionne à l'identique : le lavis /10 reste pâle sur blanc et la teinte approfondie reste lisible dessus. `color-scheme` suit le thème (contrôles natifs, barres de défilement). Composants en hex brut (globe cobe, `BorderBeam`) : inchangés — le globe sombre sur panneau clair se lit comme une « terre de nuit », effet volontaire.

**Infra** : `src/lib/theme.ts` (hook `useTheme` — état, persistance, synchro multi-onglets), `src/components/ThemeToggle.tsx` (bouton soleil/lune), script anti-FOUC dans `index.html`. Le sombre est le défaut absolu (aucune classe = sombre).

---

## 3. Fondations — Typographie `✅ Implémenté`

Trois familles, chargées via Google Fonts dans `index.html`. **Deux graisses maximum par police.**

| Rôle | Police | Graisses chargées | Où |
|---|---|---|---|
| Display | **Bricolage Grotesque** | 600 / 700 | H1 hero, titres de sections, wordmark |
| Body | **Geist** (fallback Inter) | 400 / 500 | Paragraphes, UI, boutons, labels |
| Mono | **JetBrains Mono** | 400 / 500 | Scores, domaines, rangs, dates, badges, terminal, metadata |

**Règles**
- Tout ce qui est **donnée** (domaine, score 0–100, prix, rang, date RDAP, TLD) est en **mono**.
- Titres display : `tracking-[-0.02em]` (léger resserrement). Wordmark géant : `tracking-[-0.03em]`.
- Corps : `text-text-muted` par défaut pour le secondaire, `text-text` pour le primaire.

### Échelle typographique (dérivée de l'usage réel)
| Niveau | Classes | Emploi |
|---|---|---|
| Display XXL | `text-[22vw]` / `text-[21vw]` font-display bold | RISKLY hero (outline), wordmark footer |
| H1 hero | `text-4xl md:text-6xl` · `tracking-[-0.02em]` · leading-tight | Accroche landing |
| H1 auth | `text-2xl font-bold` · `tracking-[-0.02em]` | Titres pages login/register |
| H2 section | `text-3xl md:text-4xl` (CTA footer : `md:text-5xl`) | Titres de sections |
| H2 panneau | `text-3xl` | Panneau branding auth |
| H3 carte | `text-lg` / `text-xl font-semibold` | Titres de cartes |
| Body large | `text-lg text-text-muted` | Sous-titre hero |
| Body | `text-sm` / base · `text-text-muted` | Corps courant, descriptions |
| Meta / data | `font-mono text-xs text-text-faint` | Specs, rangs, horodatage |
| Micro-label | `text-[10px]` / `text-[11px]` · uppercase · tracking-wider/widest | Labels de badges, bandes « OU », niveaux |

---

## 4. Fondations — Espacement, rayons, ombres, élévation

### Espacement & layout `✅ Implémenté`
- **Container landing** : `max-w-6xl mx-auto px-6`.
- **Containers de contenu** : `max-w-3xl` (FAQ, CTA), `max-w-2xl` (matrice), `max-w-xl` (sous-titres), `max-w-sm` (formulaire auth).
- **Rythme vertical sections** : `py-24` (desktop). Bandes fines : `py-10`. Pieds : `py-8`.
- **Gaps de grille** : `gap-5` (bento features), `gap-6` (étapes), `gap-2/3` (matrice, données).
- **Padding cartes** : `p-6` (standard), `p-5` (FAQ, terminal), `p-3` (mini-cartes de score).

### Rayons `✅ Implémenté`
| Rayon | Emploi |
|---|---|
| `rounded-[4px]` | Checkbox |
| `rounded-md` | Petits boutons (`sm`), badges |
| `rounded-lg` | Boutons, inputs, cellules de matrice, cartes de score |
| `rounded-xl` | Cartes standard, terminal, panneaux, FAQ |
| `rounded-2xl` | Coque du champ hero |
| `rounded-full` | Points de statut, pastilles, barres de robustesse |

### Ombres `✅ Implémenté`
Usage minimal — la profondeur vient des bordures et surfaces.
- `shadow-sm` : étiquettes flottantes du globe.
- `shadow-2xl` : coque du champ hero, terminal (éléments qui « flottent » au-dessus du fond).

### Élévation / z-index `✅ Implémenté`
- Navbar sticky : `z-50`.
- Couches de fond hero (grille, halo, RISKLY outline) : `absolute inset-0` sous le contenu (`relative`).
- Le reste s'appuie sur l'ordre du flux. À formaliser si l'app introduit overlays/modales (voir §12).

---

## 5. Config Tailwind v4 (`@theme`) `✅ Implémenté`

Tailwind v4, sans fichier `tailwind.config`. Tokens déclarés dans `src/index.css`.
shadcn est configuré en `style: new-york`, `cssVariables: false` : les classes utilitaires
référencent directement les noms de tokens (`bg-bg-elevated`, `text-accent`…), pas des variables CSS shadcn.

```css
@import "tailwindcss";

@theme {
  --color-bg: #0a0e1a;
  --color-bg-elevated: #111627;
  --color-border: #1e2438;
  --color-border-hover: #2e3650;
  --color-text: #edeef2;
  --color-text-muted: #8a91a8;
  --color-text-faint: #565d75;
  --color-accent: #22d3ee;
  --color-good: #34d399;
  --color-risky: #fbbf24;
  --color-avoid: #f87171;
  --font-display: "Bricolage Grotesque", sans-serif;
  --font-body: "Geist", "Inter", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
```

`body` applique `bg`, `text`, `font-body` et `-webkit-font-smoothing: antialiased`.
`::selection` = `accent` à 30 %.

---

## 6. Utilitaires & styles globaux (CSS custom) `✅ Implémenté`

Classes maison définies dans `index.css`, au-delà des utilitaires Tailwind.

| Classe / règle | Effet | Où |
|---|---|---|
| `html { scroll-behavior: smooth; scroll-padding-top: 5rem }` | Défilement ancré sous la navbar sticky (h-16) | Global |
| `::selection` | Surlignage cyan à 30 % | Global |
| `.text-outline` | Texte transparent, contour `1.5px text-faint` | RISKLY géant du hero |
| `.hero-grid` | Grille 56×56 px masquée en ellipse radiale | Fond hero, panneau auth |
| `.hero-glow` + `@keyframes glow-pulse` | Halo cyan (12 %) qui respire (5 s) | Fond hero, panneau auth, CTA footer |
| `.typing-caret` + `@keyframes caret-blink` | Curseur clignotant (1 s) | Placeholder qui se tape (hero) |
| `.globe-pyramid` + `@keyframes pyramid-spin` | Pyramide 3D en rotation (4 s) | Marqueurs du globe (auth) |
| `.marquee` / `.marquee-track` + `@keyframes marquee` | Défilement horizontal infini (32 s), masqué aux bords | Bande des sources |
| `.border-beam-layer` + `@keyframes border-beam` | Lueur qui parcourt la bordure d'un conteneur | Champ hero (composant `BorderBeam`) |

**Toutes** ces animations sont coupées sous `@media (prefers-reduced-motion: reduce)`
(`hero-glow`, `typing-caret`, `marquee-track`, `globe-pyramid`, `border-beam`, `scroll-behavior`).

---

## 7. Motion & animations

Deux moteurs : **Framer Motion** (`motion/react`) pour l'orchestration, **CSS** pour les boucles simples.
`prefers-reduced-motion` est respecté des deux côtés (`useReducedMotion()` + media query).

### Composants d'effets (bibliothèque interne, adaptée de magicui / 21st.dev)
| Composant | Statut | Rôle |
|---|---|---|
| `BlurFade` | `✅` | Apparition fondu + flou + translation Y. `inView` déclenche au scroll (`once: true`, marge -50px). Params : `delay`, `duration`, `yOffset`, `blur`. |
| `BorderBeam` | `✅` | Lueur cyan (`#22d3ee → #0891b2`) qui court le long d'une bordure. Params : `size`, `duration`, `anchor`, `colorFrom/To`. |
| `TiltCard` | `✅` | Inclinaison 3D suivant la souris (`useSpring` sur rotateX/Y ±8°, perspective 1000). Dégrade en `div` simple si reduced-motion. |
| `AnimatedGridPattern` | `✅` | Grille SVG dont des cases s'allument aléatoirement. Utilisé au CTA footer (`fill-accent`, opacity 0.12). |
| `Globe` | `✅` | Globe cobe interactif (drag), marqueurs TLD + arcs sources, étiquettes accrochées via CSS Anchor Positioning. Voir §9. |
| `BlurredStagger` | `◐` | Révèle un texte lettre par lettre (flou → net, stagger 0.015 s). **Construit mais monté nulle part.** |

### Patterns d'orchestration
- **Hero** : cascade `BlurFade` — headline → sous-titre → champ → ligne de réassurance (`delay` 0 → 0.2 → 0.35 → 0.5).
- **Sections** : `BlurFade inView` sur les titres, puis `delay` incrémental sur les items (`i * 0.1` / `i * 0.15` / `i * 0.08`).
- **Compteurs** *(cible)* : score de 0 → valeur avec `useMotionValue` + `useTransform`, ~1.2 s ease-out. `🚧 À construire` (voir `ScoreGauge`, §12).
- **Hover cartes** : `translateY(-2px)` + bordure `accent/40`, transition 150 ms — en CSS pur (via classes), pas Motion.
- **Marquee sources** : CSS `@keyframes`, pas de lib.

> **Règle app** : sur les pages `/app`, `/history`, `/report`, **pas d'animations d'entrée**. Seulement des transitions d'état 150 ms (hover, focus, ouverture d'accordéon). Le mouvement marketing reste sur la landing.

---

## 8. Primitives UI (shadcn) `✅ Implémenté`

Style **new-york**, thémé aux tokens Riskly. Variantes via `class-variance-authority` (CVA), fusion via `cn()` (`clsx` + `tailwind-merge`).

**État de focus standard (toute l'UI interactive)**
```
focus-visible:border-accent  focus-visible:ring-[3px]  focus-visible:ring-accent/30
```
Inputs légèrement plus doux : `focus-visible:border-accent/60 ring-accent/20`.
**État invalide** : `aria-invalid:border-avoid` (+ `ring-avoid/20` sur les inputs).

### Composants disponibles
| Composant | Fichier | Notes |
|---|---|---|
| `Button` | `ui/button.tsx` | 6 variantes × 4 tailles (voir ci-dessous) |
| `Input` | `ui/input.tsx` | `h-11`, `bg-bg-elevated/50`, placeholder `text-faint` |
| `Label` | `ui/label.tsx` | `text-sm font-medium`, gère `peer-disabled` |
| `Checkbox` | `ui/checkbox.tsx` | `size-4`, coché = `bg-accent text-bg`, icône `Check` strokeWidth 3 |
| `Separator` | `ui/separator.tsx` | Radix, `bg-border`, horizontal/vertical |

### Variantes de `Button`
| Variante | Rendu |
|---|---|
| `default` | `bg-accent text-bg` · hover opacity-90 — **CTA primaire** |
| `outline` | `border-border bg-bg-elevated text-text` · hover `border-border-hover` — secondaire |
| `secondary` | `bg-bg-elevated text-text-muted` · hover `text-text` |
| `ghost` | transparent · hover `bg-bg-elevated text-text` |
| `destructive` | `bg-avoid/10 text-avoid border-avoid/30` · hover `bg-avoid/20` |
| `link` | `text-accent underline-offset-4` · hover underline |

| Taille | Dimensions |
|---|---|
| `default` | `h-10 px-4 py-2` |
| `sm` | `h-8 px-3 text-xs` |
| `lg` | `h-11 px-6` |
| `icon` | `size-10` |

### Primitives shadcn à ajouter pour l'app `🚧 À construire`
L'app aura besoin de : **table** (historique), **dialog / alert-dialog** (confirmation de suppression),
**dropdown-menu** (menu utilisateur), **sonner / toast** (retours d'action), **tooltip** (explications de score),
**skeleton** (chargement), **badge** (verdict réutilisable), **card** (conteneur standardisé).
Toutes à thémer aux tokens ci-dessus, mêmes états focus/invalid.

---

## 9. Composants signature

Éléments mémorables qui portent l'identité Riskly.

### Logo `RisklyLogo` `✅ Implémenté`
Bouclier « stencil » en fragments anguleux, pièce accent cyan au coin haut-droit, hachures « data ».
Couleurs branchées sur les tokens (`fill-text` / `fill-accent` / `stroke-text-muted`) → suit le thème. ViewBox `0 0 100 112`.

### RISKLY géant (hero) `✅ Implémenté`
Wordmark `text-[22vw]` en `.text-outline` (contour seul), opacity 70 %, centré derrière le contenu du hero.

### Wordmark footer `✅ Implémenté`
« Riskly » en `text-[21vw]`, dégradé vertical `from-text/20 to-text/[0.02]` (bg-clip-text), façon Komta.

### Globe `Globe` (cobe) `✅ Implémenté`
Globe 3D interactif (drag, auto-rotation), fond des pages auth.
- Base `[0.28,0.38,0.58]`, marqueurs & arcs en cyan `#22D3EE`.
- Marqueurs = TLD analysés (`.com`, `.io`, `.fr`, `.ma`…), arcs = requêtes vers les sources (RDAP, PhishTank…).
- Étiquettes flottantes (pastille mono + pyramide 3D CSS) accrochées via **CSS Anchor Positioning** ; si non supporté, le globe reste seul (dégradation propre).

### `TerminalDemo` `◐ Partiel`
Fenêtre terminal (3 points `avoid/risky/good`, barre `riskly · analyse`) listant des checks
(`RDAP`, `Bases de menaces`, `Blacklists DNS`, `Tranco`, `Open PageRank`, `DNS`), deux mini-scores
(risque en `good`, autorité en `accent`) et un badge `Bon achat`.
**Statique et monté nulle part.** Le hero a finalement adopté un **champ de saisie** (voir §11).
Cible : la boucle animée (frappe → checks un à un → compteurs qui montent → verdict) reste à faire —
c'est aussi la base visuelle de `AnalysisLoader` (§12).

### Badges de verdict `✅ Implémenté` (dans DecisionMatrix / TerminalDemo / PasswordStrength)
Motif réutilisable, **à extraire en composant `VerdictBadge`** (§12) :
```
BON ACHAT  → bg-good/10   text-good   border-good/30    (hover bg-good/25  border-good)
RISQUÉ     → bg-risky/10  text-risky  border-risky/30   (hover bg-risky/25 border-risky)
À ÉVITER   → bg-avoid/10  text-avoid  border-avoid/30   (hover bg-avoid/25 border-avoid)
```
Toujours en `font-mono uppercase tracking-wider`, `rounded-md`.

### Matrice risque × autorité `✅ Implémenté` (`DecisionMatrix`)
Grille 3×3 : **lignes = risque** (faible → élevé), **colonnes = autorité** (forte → faible).
Axes en mono `text-faint` avec bandes de score. Cellules teintées `good/risky/avoid` à 10 %,
survol → 25 % + bordure pleine. **Le risque prime** : risque élevé ⇒ « À éviter » quelle que soit l'autorité.

Table de décision (référence PRD) :
| Risque ↓ \ Autorité → | Forte (66–100) | Correcte (31–65) | Faible (0–30) |
|---|---|---|---|
| **Faible (0–25)** | Bon achat | Bon achat | Risqué |
| **Modéré (26–60)** | Risqué | Risqué | À éviter |
| **Élevé (61–100)** | À éviter | À éviter | À éviter |

### Marquee des sources `✅ Implémenté` (`Sources`)
Bande défilante infinie des 8 sources (RDAP, Tranco, Open PageRank, PhishTank, URLhaus, OpenPhish, Résolution DNS, ip-api),
icône lucide + nom en mono, masquée en fondu aux bords.

---

## 10. Patterns d'authentification `✅ Implémenté`

### `AuthLayout`
Écran scindé : **panneau branding globe à gauche** (desktop `lg` uniquement) + **formulaire à droite**.
- Gauche : `border-r`, `bg-elevated/30`, fond `hero-grid` + `hero-glow`, logo en haut, titre + `Globe`, ligne de sources en mono en bas.
- Droite : `max-w-sm` centré, logo mobile en tête, mention légale mono en pied.
- `AuthDivider` : séparateur « OU » (mono, uppercase, `text-faint`) entre OAuth et formulaire.

### `OAuthButtons`
Bouton **Telegram** (`variant="outline"`, icône Telegram `#229ED9`), pleine largeur, état `pending` avec spinner.
*(Auth simulée pour l'instant — `setTimeout` → `/app` ; à brancher sur le widget Telegram.)*

### `PasswordInput`
`Input` + bouton afficher/masquer (icônes `Eye`/`EyeOff`, `text-faint` → `text` au survol), `pr-11`.

### `PasswordStrength`
Robustesse affichée **comme un verdict** : 4 barres (`rounded-full`) + label mono uppercase.
Barème `scorePassword` (longueur, casse mixte, chiffre, symbole → 0–4) mappé sur
`avoid` (trop faible/faible) → `risky` (moyen) → `good` (bon/excellent).

### Formulaires (Login / Register)
- `space-y-5` entre champs, `space-y-2` label→input.
- Validation à la soumission, erreurs en `text-xs text-avoid` avec `aria-invalid` + `aria-describedby`.
- Bouton pleine largeur `size="lg"`, spinner `Loader2` en `pending`.
- Register recueille : nom d'utilisateur, **entité**, mot de passe (+ jauge), confirmation.

---

## 11. Landing — inventaire des sections `✅ Implémenté`

Empilées dans `pages/Landing.tsx`.

| Section | Rôle | Détails visuels |
|---|---|---|
| `Navbar` | Nav sticky | `z-50`, `bg/80 backdrop-blur`, logo + liens ancres + Se connecter / Créer un compte |
| `Hero` | Accroche | Champ de saisie mono avec **placeholder qui se tape en boucle** + curseur, `BorderBeam`, fonds grille/halo/RISKLY outline, cascade `BlurFade` |
| `Sources` | Preuve | Marquee des 8 sources, bandeaux `border-y` |
| `HowItWorks` | 3 étapes | Cartes `TiltCard`, numéros mono `accent`, hover `border-border-hover` |
| `Features` | Bento 5 cartes | Grille `md:grid-cols-3`, 1 carte large (`col-span-2`), spec mono `accent` + trait, `TiltCard`, hover `border-accent/40` |
| `DecisionMatrix` | Pédagogie | Matrice 3×3 (voir §9) |
| `FAQ` | Objections | `<details>`/`<summary>` natifs, chevron qui pivote, hover/open `border-border-hover` |
| `Footer` | CTA + pied | CTA sur `AnimatedGridPattern` + `hero-glow`, liens, wordmark géant, mention légale mono |

> Le hero **réel** est un champ de saisie (pas le `TerminalDemo`). Voir §9 pour la réserve terminal.

---

## 12. Application — le design system produit (à construire)

> **Toute l'app est `🚧 À construire`.** `App.tsx` route `/app`, `/history`, `/forgot-password` vers des placeholders.
> Les couches `types/`, `api/`, `hooks/`, `context/`, `routes/` décrites dans `ARCHITECTURE.md` n'existent pas encore
> (`src/lib` ne contient que `utils.ts`). Cette section fixe la **direction de design** pour ces écrans,
> ancrée dans le modèle de données réel du backend.

### 12.1 Modèle de données → vocabulaire visuel
Le backend (`collect_features.py`) collecte, par domaine :
- **RDAP** : date d'enregistrement, expiration → *âge du domaine*.
- **Open PageRank** : rang 0–10, backlinks (referring domains).
- **Tranco** : rang dans le top 1M, présence.
- **DNS** : nombre de serveurs de noms, MX/SPF/DMARC.
- **Blacklist DNS** (pydnsbl), **PhishTank**, **URLhaus**, **OpenPhish** → `in_threat_database` (booléen consolidé).
- **ip-api** : pays d'hébergement, IP.
- **Lexical** : longueur, nombre de tirets, TLD.

Deux scores en sortent :
- **Score de risque 0–100** (inversé : bas = bon), modèle **XGBoost** expliqué par **SHAP**.
- **Score d'autorité 0–100** (haut = bon), formule ouverte `0,5 × rang + 0,3 × backlinks + 0,2 × âge`.

### 12.2 Bandes de scores (à centraliser dans `lib/constants.ts`)
| Score de risque | Bande | Couleur |
|---|---|---|
| 0–25 | Risque faible | `good` |
| 26–60 | Risque modéré | `risky` |
| 61–100 | Risque élevé | `avoid` |

| Score d'autorité | Bande | Couleur |
|---|---|---|
| 66–100 | Autorité forte | `accent` (fort) |
| 31–65 | Autorité correcte | `accent` (moyen) |
| 0–30 | Autorité faible | `text-faint` / `accent` (faible) |

> **Règle de couleur des scores** (issue de `TerminalDemo`) : le **risque** se colore par sa bande (`good/risky/avoid`) — c'est lui qui porte l'alarme. L'**autorité** reste en **cyan** (`accent`), l'intensité seule traduisant la force. **On ne teinte jamais l'autorité en ambre/rouge** — ce serait violer la règle « ambre/rouge = verdict uniquement ». Une autorité faible se lit en `text-faint`, pas en `avoid`.

### 12.3 Verdicts
Trois verdicts, issus de la matrice risque × autorité (§9) : **Bon achat** (`good`), **Risqué** (`risky`), **À éviter** (`avoid`).

### 12.4 Alertes de transparence (4 signaux)
Affichées **à part**, elles **ne modifient ni le score ni le verdict** :
1. **Domaine très récent** (âge RDAP faible).
2. **Aucune autorité** (absent de Tranco + PageRank ~0).
3. **Historique discontinu**.
4. **Présence dans une base de menaces** (`in_threat_database`).

### 12.5 Composants produit à construire
| Composant | Rôle | Direction de design |
|---|---|---|
| `DomainInput` | Saisie 1–5 domaines | Champ **mono**, validation de format au fil de l'eau, ajout/suppression de lignes, limite 5, bouton « Analyser » primaire |
| `AnalysisLoader` | Chargement long (jusqu'à 90 s) | Réemploi de l'esthétique terminal : checks par source qui s'allument un à un ; respecter reduced-motion (liste statique + spinner) |
| `ScoreGauge` | Score 0–100 + bande | Jauge circulaire ou barre ; risque coloré par bande, autorité en `accent` ; chiffre en **mono** ; compteur animé 0→score (sauf reduced-motion) |
| `VerdictBadge` | Bon achat / Risqué / À éviter | Extraction du motif §9 : `bg/10 text border/30`, mono uppercase |
| `ReportCard` | Résumé d'un domaine | `rounded-xl border bg-elevated p-6` ; domaine mono, deux `ScoreGauge`, `VerdictBadge`, alertes clés |
| `ReportList` | Liste comparative | **Groupée par verdict**, triée par risque croissant ; cartes côte à côte |
| `ReportDetail` / `ReportPage` | Rapport complet | Scores + verdict en tête, `FactorList` (SHAP), `AlertList`, tableau des données brutes (RDAP, DNS, pays, Tranco, PageRank, TLD), `MissingDataNotice` |
| `FactorList` | Facteurs SHAP | Chaque facteur : libellé en français courant + sens (augmente/diminue le risque) + barre de magnitude ; hausse-risque en `avoid`, baisse-risque en `good` |
| `AlertList` | Les 4 alertes | Lignes icône + libellé + explication courte ; informatives (bordure gauche accent), la menace en `avoid` ; jamais alarmiste sur le reste |
| `MissingDataNotice` | Données non collectées | Neutre, `text-faint`, icône info ; liste les sources en échec sans dramatiser (« donnée indisponible », pas « erreur ») |

### 12.6 Shell applicatif (proposition)
Deux vues principales (**Analyser**, **Historique**) → **barre supérieure fine** plutôt qu'une sidebar (esprit Vercel) :
- Logo + `Riskly` à gauche ; liens **Analyser** / **Historique** au centre ; **menu utilisateur** à droite (entité + rôle, déconnexion).
- Fond `bg`, barre `border-b bg-bg/80 backdrop-blur` (comme la navbar landing, sans les CTA marketing).
- **Densité supérieure** à la landing, **aucune animation d'entrée**.

### 12.7 Historique (`/history`)
- **Table** shadcn (à ajouter) : Date (mono) · Domaine (mono) · Risque · Autorité · Verdict (`VerdictBadge`) · Actions (ouvrir / supprimer).
- Suppression → **alert-dialog** de confirmation + toast, invalidation du cache TanStack Query.
- **Empty state** : illustration sobre + « Aucune analyse pour l'instant » + CTA « Analyser un domaine ».

### 12.8 États systémiques (à standardiser)
- **Chargement** : `AnalysisLoader` (long) ; `skeleton` pour les vues rapides (historique).
- **Vide** : titre `text-muted` + sous-texte `text-faint` + CTA `default` ; icône lucide discrète.
- **Erreur** : encart `destructive` (`bg-avoid/10 border-avoid/30`), message clair, action « Réessayer ».
- **Donnée manquante** : `MissingDataNotice`, ton neutre — jamais confondu avec une erreur.

### 12.9 Rôles & routes protégées
`user` / `admin` / `super_admin` (l'utilisateur porte un **rôle** + une **entité**).
`ProtectedRoute` exige une session et, en option, un rôle. Les écrans admin sont **hors périmètre actuel** ;
réserver le pattern de gating, ne pas concevoir ces vues pour l'instant.

---

## 13. Ton rédactionnel

- Français, direct, orienté bénéfice **acheteur de domaines**.
- Headline landing : « Sachez si un domaine vaut son prix avant de l'acheter. »
- Pas de superlatifs vides (« révolutionnaire », « propulsé par l'IA »). La crédibilité vient des **sources de données réelles** (RDAP, Tranco, Open PageRank, PhishTank, URLhaus, OpenPhish, DNS, ip-api).
- **Transparence assumée** : si une source ne répond pas, on le dit (`MissingDataNotice`). On n'invente jamais une donnée.
- Vocabulaire de données en mono, prose en français courant — y compris pour expliquer les facteurs SHAP.

---

## 14. Accessibilité

- **Focus visible** partout : `focus-visible:ring-[3px] ring-accent/30` (voir §8). Ne jamais retirer l'outline sans anneau de remplacement.
- **`prefers-reduced-motion`** respecté par CSS **et** Motion (`useReducedMotion()`), sur toutes les animations (§6, §7). Le globe s'immobilise, les placeholders cessent de se taper, les cartes ne s'inclinent plus.
- **Champs de formulaire** : `Label` associé, `aria-invalid` + `aria-describedby` sur erreur, messages en `text-avoid`.
- **Contraste** : `text` sur `bg` et `text-muted` sur `bg`/`bg-elevated` visent AA. **`text-faint` est réservé aux éléments non essentiels** (metadata, placeholders) — jamais pour du texte porteur de sens seul.
- **Sémantique native** privilégiée : `<details>`/`<summary>` pour la FAQ, `<button>`/`<a>` corrects, `role="separator"` sur les diviseurs.
- **Cibles tactiles** : boutons `h-10`/`h-11`, zones cliquables ≥ 40 px.
- **La couleur n'est jamais le seul signal** : les verdicts portent un **libellé** (mono uppercase) en plus de la teinte.

---

## 15. Conventions de code

- **Tokens uniquement.** Aucune couleur/police en dur hors `@theme` (exceptions documentées : cobe, BorderBeam).
- **`cn()`** (`clsx` + `tailwind-merge`) pour composer les classes ; **CVA** pour les variantes (cf. `Button`).
- **Primitives** en kebab-case sous `components/ui/` (convention shadcn) ; **composants** en PascalCase.
- **Alias** : `@/` → `src/`.
- **Données = mono.** Réflexe : tout chiffre/domaine/date/rang passe en `font-mono`.
- **Motion** : effets réutilisables encapsulés en composants (`BlurFade`, `TiltCard`…), pas de `motion.div` dispersés dans les pages.
- Architecture cible détaillée dans **`ARCHITECTURE.md`** (couches api → hooks → composants, session par cookie HttpOnly, TanStack Query).
