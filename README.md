# POC Chatbot RAG

Proof of Concept du chatbot RAG permettant d'uploader des documents PDF (1 à 5 fichiers, 500 pages cumulées max) et de poser des questions dessus en langage naturel.

##  Démo en ligne

- **Frontend** : [https://poc-chatbot-rag.vercel.app](https://poc-chatbot-rag.vercel.app)
- **Backend (API)** : [https://poc-chatbot-rag.onrender.com](https://poc-chatbot-rag.onrender.com)

>  Le backend est hébergé sur le plan gratuit de Render, qui met le service en veille après quelques minutes d'inactivité. Le premier appel après une période d'inactivité peut donc prendre 30 à 60 secondes le temps que le service redémarre.

## Stack technique

| Composant | Local (développement) | Production (déployé) |
|---|---|---|
| Backend | Node.js / TypeScript, Express | Node.js / TypeScript, Express — [Render](https://render.com) |
| Frontend | React (Vite) / TypeScript | React (Vite) / TypeScript — [Vercel](https://vercel.com) |
| Embeddings | `@xenova/transformers` (`Xenova/all-MiniLM-L6-v2`, local, gratuit) | Identique |
| Vector Database | [Chroma](https://www.trychroma.com/) (persistance sur disque local) | [Qdrant Cloud](https://qdrant.tech/) |
| Base de données | PostgreSQL local | [Neon](https://neon.tech) (PostgreSQL serverless, gratuit) |
| LLM | Groq (modèle `llama-3.3-70b-versatile`, gratuit) | Identique |

Le projet est conçu pour tourner **soit en local avec Chroma, soit en production avec Qdrant**, sans aucune modification de code : le backend bascule automatiquement entre les deux selon la présence de la variable d'environnement `QDRANT_URL` (voir la section [Configuration du vector store](#configuration-du-vector-store)).

## Fonctionnalités

- Upload de plusieurs PDF (1 à 5, max 500 pages cumulées)
- Extraction et nettoyage du texte
- Découpage en chunks avec chevauchement (overlap)
- Génération d'embeddings locaux
- Stockage vectoriel persistant (Chroma en local, Qdrant Cloud en production), scopé par conversation (`sessionId`)
- Recherche par similarité (retrieval)
- Génération de réponse contextualisée via LLM (Groq)
- Historique de conversation persistant par session, navigable depuis la sidebar
- Chaque conversation garde son propre lot de documents indexés

> **Historique de conversation et documents**
>
> L'historique des messages ainsi que la liste des documents indexés par conversation sont stockés dans PostgreSQL (tables `messages` et `documents`, associées par `session_id`). Cela permet de retrouver et recharger une conversation passée, avec ses documents, même après un redémarrage du serveur.
>
> Les vecteurs d'embeddings restent stockés séparément (Chroma ou Qdrant selon l'environnement), filtrés eux aussi par `sessionId` afin que chaque conversation n'interroge que ses propres documents.

## Configuration du vector store

Le backend détecte automatiquement quel vector store utiliser :

- Si la variable d'environnement `QDRANT_URL` **n'est pas définie** → utilisation de **Chroma en local** (`http://localhost:8000`)
- Si `QDRANT_URL` **est définie** → utilisation de **Qdrant Cloud**

Cette bascule est gérée dans `backend/src/services/vectorStore.ts`, qui redirige vers `vectorStore.chroma.ts` ou `vectorStore.qdrant.ts` selon le cas. Aucun autre fichier du projet n'a besoin d'être modifié.

## Prérequis

### Pour un lancement en local (Chroma)

- Node.js (v18+)
- Python (pour faire tourner Chroma)
- PostgreSQL (v14+) — ou un compte [Neon](https://neon.tech) gratuit
- Une clé API [Groq](https://console.groq.com) (gratuite)

### Pour un déploiement en production (Qdrant)

- Un compte [Qdrant Cloud](https://cloud.qdrant.io) (gratuit)
- Un compte [Neon](https://neon.tech) (PostgreSQL serverless, gratuit)
- Un compte [Render](https://render.com) (backend, gratuit)
- Un compte [Vercel](https://vercel.com) (frontend, gratuit)
- Une clé API [Groq](https://console.groq.com) (gratuite)

## Installation en local (avec Chroma)

### 1. Cloner le projet

```bash
git clone <url-du-repo>
cd poc-chatbot-rag
```

### 2. Installer et lancer Chroma (base vectorielle)

```bash
pip install chromadb
chroma run --path ./chroma_data
```

Laisse ce terminal ouvert. Chroma tourne sur `http://localhost:8000`.

### 3. Configurer PostgreSQL

Crée la base de données

```bash
psql -U postgres
```

Puis dans `psql` :

```sql
CREATE DATABASE rag_poc;
```

La table `messages` et la table `documents` sont créées automatiquement au démarrage du backend si elles n'existent pas.

### 4. Configurer et lancer le backend

```bash
cd backend
npm install
```

Puis lire la variable de `.env.example` et créer le fichier `.env` à la racine de `backend/` :

```
GROQ_API_KEY=groq_xxxxx
DATABASE_URL=postgresql://postgres:ton_mot_de_passe@localhost:5432/rag_poc
```

Ne pas définir `QDRANT_URL` ni `QDRANT_API_KEY` en local - leur absence est ce qui déclenche automatiquement l'utilisation de Chroma.

Lance le serveur

```bash
npm run dev
```

Le backend tourne sur `http://localhost:3000`.

### 5. Lancer le frontend

Dans un nouveau terminal :

```bash
cd frontend
npm install
npm run dev
```

Le frontend tourne sur `http://localhost:5173`.

## Déploiement en production (avec Qdrant, Neon, Render, Vercel)

### 1. Base de données — Neon

1. Crée un compte sur [neon.tech](https://neon.tech)
2. Crée un projet et une base de données (ex: `rag_poc`)
3. Récupère l'URL de connexion (`DATABASE_URL`)

### 2. Vector store — Qdrant Cloud

1. Crée un compte sur [cloud.qdrant.io](https://cloud.qdrant.io)
2. Crée un cluster gratuit
3. Récupère l'URL du cluster (`QDRANT_URL`) et la clé API (`QDRANT_API_KEY`)

### 3. Backend — Render

1. Crée un compte sur [render.com](https://render.com)
2. New Web Service → connecte le dépôt GitHub → Root Directory : `backend`
3. Build Command : `npm install && npm run build`
4. Start Command : `npm start`
5. Ajoute les variables d'environnement :

```
GROQ_API_KEY=groq_xxxxx
DATABASE_URL=postgresql://...neon.tech/rag_poc?sslmode=require
QDRANT_URL=https://xxxxx.aws.cloud.qdrant.io
QDRANT_API_KEY=xxxxx
```

6. Déploie → tu obtiens une URL du type `https://xxxxx.onrender.com`

### 4. Frontend — Vercel

1. Crée un compte sur [vercel.com](https://vercel.com)
2. Import Project → Root Directory : `frontend`
3. Ajoute la variable d'environnement :

```
VITE_API_URL=https://xxxxx.onrender.com/api
```

4. Déploie → tu obtiens une URL du type `https://xxxxx.vercel.app`

## Utilisation

1. Ouvre le frontend (local ou en ligne) dans ton navigateur
2. Crée une nouvelle conversation, uploade un ou plusieurs PDF via la zone de saisie
3. Pose tes questions dans la zone de chat
4. Les réponses s'affichent avec les sources (documents) utilisées
5. Retrouve et reprends une conversation passée depuis la liste dans la sidebar

## Architecture du projet

```
poc-chatbot-rag/
├── backend/
│   ├── src/
│   │   ├── routes/                    # Routes API (upload, chat, sessions)
│   │   ├── services/
│   │   │   ├── vectorStore.ts         # Point d'entrée : bascule Chroma <-> Qdrant
│   │   │   ├── vectorStore.chroma.ts   # Implémentation Chroma (local)
│   │   │   ├── vectorStore.qdrant.ts   # Implémentation Qdrant (production)
│   │   │   ├── db.ts                  # Connexion PostgreSQL / Neon
│   │   │   ├── conversationStore.ts   # Historique des messages
│   │   │   ├── embeddings.ts
│   │   │   ├── chunker.ts
│   │   │   └── llm.ts
│   │   └── server.ts
│   └── uploads/                        # PDF uploadés (temporaire, non persistant en production)
├── frontend/
│   └── src/
│       ├── api/                        # Appels au backend
│       └── components/                 # FileUpload, ChatBox, Sidebar
```

## Test de l'API avec Postman ou cURL

### URL du backend

- Local : `http://localhost:3000`
- Production : `https://poc-chatbot-rag.onrender.com`

### 1. Upload d'un ou plusieurs PDF

**Endpoint**

```
POST /api/upload
```

Le body doit contenir plusieurs fichiers sous la clé `files`, ainsi qu'un champ `sessionId`.

#### Exemple avec cURL

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "files=@/chemin-vers-document.pdf" \
  -F "sessionId=session-test"
```

### 2. Poser une question au chatbot

**Endpoint**

```
POST /api/chat
```

#### Exemple avec cURL

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d "{\"question\":\"Quelle est la durée de la formation ?\",\"sessionId\":\"session-test\"}"
```

### 3. Lister les conversations

**Endpoint**

```
GET /api/sessions
```

### 4. Charger une conversation précise

**Endpoint**

```
GET /api/sessions/:sessionId
```

### Avec Postman

- **Upload**
  - Méthode : `POST`
  - URL : `{BASE_URL}/api/upload`
  - Body → `form-data`
  - Clé : `files` (type **File**, sélectionner un ou plusieurs PDF)
  - Clé : `sessionId` (type **Text**)

- **Chat**
  - Méthode : `POST`
  - URL : `{BASE_URL}/api/chat`
  - Header : `Content-Type: application/json`
  - Body → `raw` → `JSON`

```json
{
  "question": "Quelle est la durée de la formation ?",
  "sessionId": "session-test"
}
```

## Screenshots

![Capture 1](Screenshots/1.png)
![Capture 2](Screenshots/2.png)
![Capture 3](Screenshots/3.png)
![Capture 4](Screenshots/4.png)
![Capture 5](Screenshots/5.png)
![Capture 6](Screenshots/6.png)
![Capture 7](Screenshots/7.png)
![Capture 8](Screenshots/8.png)
![Capture 9](Screenshots/9.png)
![Capture 10](Screenshots/10.png)
![Capture 11](Screenshots/11.png)
![Capture 12](Screenshots/12.png)
![Capture 13](Screenshots/13.png)
![Capture 14](Screenshots/14.png)
![Capture 15](Screenshots/15.png)
![Capture 16](Screenshots/16.png)
![Capture 17](Screenshots/17.png)
![Capture 18](Screenshots/18.png)
![Capture 19](Screenshots/19.png)
![Capture 20](Screenshots/20.png)
![Capture 21](Screenshots/21.png)
![Capture 22](Screenshots/22.png)
![Capture 23](Screenshots/23.png)
![Capture 24](Screenshots/24.png)
![Capture 25](Screenshots/25.png)
![Capture 26](Screenshots/26.png)
![Capture 27](Screenshots/27.png)
