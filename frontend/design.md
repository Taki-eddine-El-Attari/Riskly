# Riskly — Design System (Landing + App)

## Référence visuelle
Le site doit ressembler à un croisement de **Linear** (linear.app) et **Vercel** (vercel.com),
avec l'esprit "data/sécurité" de **Stripe Radar**. Sombre, dense en données, sobre.
**Anti-références** : pas de dégradés violets génériques, pas d'illustrations IA, pas de glassmorphism partout.

## Palette

### Fond & surfaces
| Token | Hex | Usage |
|---|---|---|
| `bg` | `#0A0E1A` | Fond principal (bleu-noir profond) |
| `bg-elevated` | `#111627` | Cartes, navbar, terminal démo |
| `border` | `#1E2438` | Bordures de cartes, séparateurs |
| `border-hover` | `#2E3650` | Bordure au hover |

### Texte
| Token | Hex | Usage |
|---|---|---|
| `text` | `#EDEEF2` | Titres, texte principal (blanc cassé) |
| `text-muted` | `#8A91A8` | Sous-titres, descriptions |
| `text-faint` | `#565D75` | Labels, metadata, placeholders |

### Accent & verdicts (le langage visuel du produit)
| Token | Hex | Usage |
|---|---|---|
| `accent` | `#22D3EE` (cyan) | CTA, liens, focus, bordures actives |
| `verdict-good` | `#34D399` (émeraude) | Verdict "Bon achat", scores positifs |
| `verdict-risky` | `#FBBF24` (ambre) | Verdict "Risqué" |
| `verdict-avoid` | `#F87171` (rouge) | Verdict "À éviter", veto Safe Browsing |

Règle : **ambre et rouge n'apparaissent QUE pour les verdicts**. Jamais en décoration.
Le cyan est l'unique accent marketing (boutons, hover, liens).

### Config Tailwind (v4 — @theme dans index.css)
```css
@theme {
  --color-bg: #0A0E1A;
  --color-bg-elevated: #111627;
  --color-border: #1E2438;
  --color-border-hover: #2E3650;
  --color-text: #EDEEF2;
  --color-text-muted: #8A91A8;
  --color-text-faint: #565D75;
  --color-accent: #22D3EE;
  --color-good: #34D399;
  --color-risky: #FBBF24;
  --color-avoid: #F87171;
  --font-display: "Bricolage Grotesque", sans-serif;
  --font-body: "Geist", "Inter", sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}
```

## Typographie (Google Fonts)
| Rôle | Police | Où |
|---|---|---|
| Display | **Bricolage Grotesque** (600/700) | H1 hero, titres de sections |
| Body | **Geist** (400/500) | Paragraphes, UI, boutons |
| Mono | **JetBrains Mono** (400/500) | Scores, domaines, terminal démo, badges de verdict |

Règles :
- Tout ce qui est **donnée** (nom de domaine, score 0–100, prix, date WHOIS) est en mono. C'est ça qui donne le look "data tool".
- H1 hero : ~clamp(2.5rem, 5vw, 4rem), tracking légèrement serré (`-0.02em`).
- Pas plus de 2 graisses par police.

## Spacing & layout
- Container : `max-w-6xl mx-auto px-6`
- Rythme vertical sections : `py-24` (desktop), `py-16` (mobile)
- Cartes : `rounded-xl border border-border bg-bg-elevated p-6`
- Bento grid : `grid-cols-1 md:grid-cols-3`, cartes de tailles mixtes (col-span-2 pour la carte score de risque)

## Composants signature

### Terminal démo (hero) — l'élément mémorable
- Fenêtre style terminal : barre avec 3 points, fond `bg-elevated`, bordure `border`, police mono.
- Boucle : tape `exemple-domaine.com` → lignes de checks apparaissent une à une
  (`WHOIS ✓`, `Safe Browsing ✓`, `Spamhaus ✓`, `Tranco #12 480`, `Wayback 2014→2026`)
  → compteurs Risque/Valeur montent (0→score) → badge verdict `BON ACHAT` en `verdict-good`.
- Checkmarks en `verdict-good`, valeurs en `accent`, verdict final coloré selon résultat.

### Badges de verdict
```
BON ACHAT  → bg good/10, text good, border good/30, mono uppercase
RISQUÉ     → bg risky/10, text risky, border risky/30
À ÉVITER   → bg avoid/10, text avoid, border avoid/30
```

### Matrice risque × valeur
Grille 3×3, axes en mono `text-faint`, cellules colorées good/risky/avoid à 10% d'opacité,
la cellule survolée passe à 25% + bordure pleine + tooltip du verdict.

## Animations (Framer Motion uniquement)
- Hero : `staggerChildren: 0.12` — headline → sous-titre → CTA → terminal.
- Sections : `whileInView={{ opacity: 1, y: 0 }}` depuis `{ opacity: 0, y: 24 }`, `viewport={{ once: true }}`.
- Compteurs : `animate` de 0 → score avec `useMotionValue` + `useTransform`, ~1.2s ease-out.
- Hover cartes : `translateY(-2px)` + bordure `accent/40`, transition 150ms — en CSS pur, pas Motion.
- Marquee sources : CSS `@keyframes` translate infini, pas de lib.
- Global : respecter `prefers-reduced-motion` (`useReducedMotion()` de Motion + media query CSS).

## Ton rédactionnel
- Français, direct, orienté bénéfice acheteur de domaines.
- Headline : « Sachez si un domaine vaut son prix avant de l'acheter. »
- Pas de superlatifs vides ("révolutionnaire", "propulsé par l'IA") — les sources de données réelles (Safe Browsing, Spamhaus, Tranco…) sont l'argument de crédibilité.

## Pages app (/login, /register, /app, /history)
Mêmes tokens, mais : pas d'animations d'entrée (juste transitions 150ms), densité plus forte,
shadcn/ui pour forms et tables, verdicts avec les mêmes badges que la landing.
