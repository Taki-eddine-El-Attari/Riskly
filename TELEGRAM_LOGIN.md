# Connexion Telegram — mise en route

Le login Telegram utilise le **Login Widget** officiel : l'utilisateur clique
« Se connecter avec Telegram », autorise dans son app, et le backend vérifie
cryptographiquement la réponse avant d'ouvrir la session.

Documentation : https://core.telegram.org/bots/telegram-login

## 1. Créer le bot (une fois)

1. Sur Telegram, ouvre **[@BotFather](https://t.me/BotFather)** → `/newbot`.
2. Choisis un nom + un username (finissant par `bot`). BotFather te donne un **token** :
   `8123456789:AAHdq...` → c'est le `TELEGRAM_BOT_TOKEN`.
3. Toujours dans BotFather : `/setdomain` → choisis ton bot → entre le **domaine du site**
   (ex. `riskly.app`, sans `https://`). ⚠️ Le widget **ne marche pas sur `localhost`**.

## 2. Où mettre les valeurs

**Backend** — fichier `backend/.env` :
```dotenv
TELEGRAM_BOT_TOKEN=8123456789:AAHdq...      # le token BotFather (secret, jamais commité)
SECRET_KEY=<chaîne aléatoire longue>         # signe le cookie de session
DATABASE_URL=postgresql+psycopg://...        # ta base Postgres
CORS_ORIGINS=https://ton-front.exemple       # URL du front
COOKIE_SECURE=true                           # true en prod (HTTPS)
COOKIE_SAMESITE=none                         # 'none' si front et back sont sur des domaines différents
```

**Frontend** — fichier `frontend/.env` :
```dotenv
VITE_TELEGRAM_BOT_ID=8123456789              # les chiffres AVANT le ":" du token (non secret)
VITE_TELEGRAM_BOT=MonBotRiskly               # username du bot, sans @ (informatif)
VITE_API_URL=https://ton-back.exemple        # URL du backend
```

> Le **token** reste uniquement côté serveur. Le frontend n'utilise que le
> `bot_id` (les chiffres avant `:` dans le token) : c'est public, pas secret.
> Le bouton « Se connecter avec Telegram » s'affiche toujours ; il ouvre la
> popup Telegram au clic.

## 3. Lancer

```bash
# backend
cd backend && pip install -r requirements.txt && uvicorn app.main:app

# frontend
cd frontend && npm install && npm run dev
```

Ouvre le site **via le domaine déclaré à BotFather** (pas `localhost`) → page
`/login` → bouton Telegram. Le compte est créé au premier login (clé = `telegram_id`).

## En bref

| Valeur | D'où elle vient | Où la mettre |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather (`/newbot`) | `backend/.env` |
| domaine du bot | @BotFather (`/setdomain`) | — (config Telegram) |
| `VITE_TELEGRAM_BOT_ID` | chiffres avant `:` du token (non secret) | `frontend/.env` |
| `SECRET_KEY` | tu la génères (aléatoire) | `backend/.env` |
| `DATABASE_URL` | ton hébergeur Postgres | `backend/.env` |
