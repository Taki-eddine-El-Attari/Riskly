riskly-frontend/
├── src/
│   ├── main.tsx                    # point d'entrée : monte Router + QueryClient + AuthProvider
│   ├── App.tsx                     # définition des routes UNIQUEMENT (zéro logique)
│   ├── index.css                   # styles globaux + directives Tailwind
│   │
│   ├── lib/                        # TRANSVERSAL — utilitaires, zéro logique métier
│   │   ├── utils.ts                #   cn() shadcn
│   │   ├── api-client.ts           #   instance HTTP : baseURL, withCredentials: true, timeout 90s, aucune injection JWT
│   │   └── constants.ts            #   bandes de scores, couleurs verdicts, limite 5 domaines
│   │
│   ├── types/                      # LE CONTRAT — miroir exact des schemas Pydantic backend
│   │   ├── auth.ts                 #   User (role + entité), Role, LoginRequest, RegisterRequest, AuthResponse
│   │   ├── analysis.ts             #   AnalysisReport, Score, Verdict, Factor, Alert
│   │   └── index.ts                #   ré-exporte tout
│   │
│   ├── api/                        # COUCHE 1 — ACCÈS
│   │   ├── auth.api.ts             #   register(), login(), loginTelegram(), getCurrentUser(), logout()
│   │   └── analyses.api.ts         #   createAnalyses(), getHistory(), getAnalysis(id), deleteAnalysis(id)
│   │
│   ├── hooks/                      # COUCHE 2 — LOGIQUE  (TanStack Query : pont api ↔ UI)
│   │   ├── useAuth.ts              #   accès au AuthContext
│   │   ├── useAnalyses.ts          #   useMutation POST — gère le chargement long synchrone
│   │   ├── useHistory.ts           #   useQuery GET /analyses + cache
│   │   └── useDeleteAnalysis.ts    #   useMutation DELETE + invalidation du cache historique
│   │
│   ├── context/
│   │   └── AuthContext.tsx         #   user (dont role), statut de session, login/logout/refreshUser, aucun token stocké
│   │
│   ├── routes/
│   │   └── ProtectedRoute.tsx      #   protège une route : exige un utilisateur authentifié, et optionnellement un rôle
│   │                                #   (user / admin / super_admin définis plus tard).
│   │
│   ├── components/                 # COUCHE 3 — PRÉSENTATION (reçoit des données prêtes, affiche)
│   │   ├── ui/                     #   shadcn primitives : button, input, card, label...
│   │   │
│   │   ├── auth/                   #   briques partagées par les pages Login et Register
│   │   │   ├── AuthLayout.tsx      #     cadre commun aux 2 pages (colonne visuelle + formulaire)
│   │   │   ├── PasswordInput.tsx   #     champ mot de passe avec bouton afficher/masquer
│   │   │   ├── PasswordStrength.tsx #    jauge de robustesse du mot de passe à la saisie (Register)
│   │   │   └── TelegramLogin.tsx   #     bouton de connexion Telegram
│   │   │
│   │   ├── landing/                #   sections de la page vitrine — séparées de l'app pour ne pas alourdir son bundle   
│   │   │   ├── Navbar.tsx          #     barre de navigation haute + liens vers Login/Register
│   │   │   ├── Hero.tsx            #     section d'accroche en haut de page (titre + call-to-action)
│   │   │   ├── Features.tsx        #     présentation des atouts de l'outil (gain de temps, transparence...)
│   │   │   ├── HowItWorks.tsx      #     explication du fonctionnement en étapes (saisie → collecte → verdict)
│   │   │   ├── DecisionMatrix.tsx  #     illustration de la matrice risque × autorité
│   │   │   ├── Sources.tsx         #     logos/liste des sources de données utilisées
│   │   │   ├── FAQ.tsx             #     questions fréquentes
│   │   │   ├── Footer.tsx          #     pied de page
│   │   │   ├── RisklyLogo.tsx      #     logo réutilisé dans la navbar et le footer
│   │   │   └── effects/            #     habillage visuel pur, sans logique : arrière-plans animés,
│   │   │                            #    bordures lumineuses, effets d'apparition... 
│   │   │
│   │   └── analysis/               #    CŒUR PRODUIT
│   │       ├── DomainInput.tsx     #     saisie 1–5, validation format au fil de l'eau
│   │       ├── AnalysisLoader.tsx  #     état de chargement long (jusqu'à 90s)
│   │       ├── ReportList.tsx      #     liste comparative : groupée par verdict, triée par risque
│   │       ├── ReportCard.tsx      #     carte résumée d'un domaine 
│   │       ├── ReportDetail.tsx    #     rapport complet 
│   │       ├── ScoreGauge.tsx      #     score 0–100 + bande d'interprétation
│   │       ├── VerdictBadge.tsx    #     Bon achat / Risqué / À éviter
│   │       ├── FactorList.tsx      #     facteurs explicatifs en langage courant
│   │       ├── AlertList.tsx       #     alertes caractéristiques (récent, blacklist, historique...)
│   │       └── MissingDataNotice.tsx #   données non collectées
│   │
│   └── pages/                      #   les fichier qui assemblent les composants et branche les hooks
│       ├── Landing.tsx             #   page vitrine publique — empile les sections de landing/
│       ├── Login.tsx               #   formulaire de connexion (identifiant + mot de passe)
│       ├── Register.tsx            #   formulaire d'inscription (identifiant, email, mot de passe)
│       ├── Analyze.tsx             #   écran principal après connexion : saisie des domaines,
│       │                            #    puis affichage groupé de tous les rapports en fin d'analyse
│       ├── History.tsx             #   liste horodatée des analyses passées de l'utilisateur
│       ├── ReportPage.tsx          #   rapport détaillé d'une analyse ouverte depuis l'historique
│       └── TelegramCallback.tsx    #   reçoit les données Telegram, les transmet au backend
│                                    #   qui valide, crée le cookie HttpOnly et renvoie l’utilisateur
│
├── public/                         # fichiers statiques servis tels quels (favicon, images, robots.txt)
├── components.json                 # config shadcn/ui : chemins des composants, alias, thème
├── eslint.config.js
├── index.html
├── tsconfig.json
├── tsconfig.app.json               # règles TypeScript du code de l'app (src/)
├── tsconfig.node.json
├── vite.config.ts                  # config du bundler : plugins, alias @/ → src/, options de build
├── package.json                    # dépendances + scripts (dev, build, lint)
└── package-lock.json




─────────────────────────────────────────────────────────────────────
STACK
─────────────────────────────────────────────────────────────────────
  React + Vite + TypeScript · Tailwind CSS · shadcn/ui
  React Router (navigation) · Context (auth : session par cookie HttpOnly, aucun token côté JS)
  TanStack Query (cache historique, invalidation après suppression)
