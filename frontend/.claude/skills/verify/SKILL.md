---
name: verify
description: Vérifier un changement Riskly en le pilotant dans le vrai navigateur (build, lancement, parcours, captures).
---

# Vérifier Riskly (SPA Vite + React)

## Build & lancement

```bash
npm install          # première fois
npm run build        # tsc + vite build — doit passer avant de piloter
npm run dev          # serveur sur http://localhost:5173 (cf. .claude/launch.json)
```

## Piloter

Playwright n'est pas une dépendance du projet : l'installer dans un dossier
temporaire (scratchpad), pas ici. Chromium est préinstallé dans
l'environnement remote : `executablePath: "/opt/pw-browsers/chromium"`.

Parcours qui couvrent l'app actuelle :
- `/` landing — hero avec placeholder qui se tape tout seul, terminal démo.
- `/login`, `/register` — globe cobe à gauche (attendre `canvas.style.opacity === "1"`
  puis ~1,6 s de fondu avant capture), formulaires shadcn à droite :
  soumission vide → messages `p.text-avoid`, toggle œil du mot de passe,
  jauge de robustesse (register), OAuth simulé → navigue vers `/app`.
- Mobile 390px : le panneau globe doit disparaître (`lg:` uniquement).
- `emulateMedia({ reducedMotion: "reduce" })` : le globe ne tourne plus
  (comparer deux captures du canvas à ~1 s d'écart).

## Pièges

- Google Fonts est bloqué dans la sandbox → `ERR_CONNECTION_RESET` en console
  et polices de repli sur les captures. Bruit d'environnement, pas un bug.
- Les étiquettes flottantes du globe utilisent CSS Anchor Positioning
  (Chromium OK) ; elles sont masquées par détection de support ailleurs.
