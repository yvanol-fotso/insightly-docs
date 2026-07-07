# POC Chatbot RAG

Proof of Concept du chatbot RAG permettant d'uploader des documents PDF (1 à 5 fichiers, 500 pages cumulées max) et de poser des questions dessus en langage naturel.

## Stack technique

- **Backend** : Node.js / TypeScript, Express
- **Frontend** : React (Vite) / TypeScript
- **Embeddings** : `@xenova/transformers` (modèle `Xenova/all-MiniLM-L6-v2`, local, gratuit)
- **Vector Database** : Chroma (persistance sur disque)
- **LLM** : Groq (modèle `llama-3.3-70b-versatile`, gratuit)
- **Base de données** : PostgreSQL (historique des conversations et documents par session)

## Fonctionnalités

- Upload de plusieurs PDF (1 à 5, max 500 pages cumulées)
- Extraction et nettoyage du texte
- Découpage en chunks avec chevauchement (overlap)
- Génération d'embeddings locaux
- Stockage vectoriel persistant via Chroma, scopé par conversation (sessionId)
- Recherche par similarité (retrieval)
- Génération de réponse contextualisée via LLM (Groq)
- Historique de conversation persistant par session, navigable depuis la sidebar
- Chaque conversation garde son propre lot de documents indexés

> **Historique de conversation et documents**
>
> L'historique des messages ainsi que la liste des documents indexés par conversation sont stockés dans PostgreSQL (tables `messages` et `documents`, associées par `session_id`). Cela permet de retrouver et recharger une conversation passée, avec ses documents, même après un redémarrage du serveur.
>
> Les vecteurs d'embeddings restent stockés dans Chroma, filtrés eux aussi par `sessionId` afin que chaque conversation n'interroge que ses propres documents.

## Prérequis

- Node.js (v18+)
- Python (pour faire tourner Chroma)
- PostgreSQL (v14+)
- Une clé API Groq (gratuite)

## Installation

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

puis lire la variable de `.env.example` et créer le fichier `.env` à la racine de `backend/` avec la clé Groq fournie et les identifiants PostgreSQL :

```
GROQ_API_KEY=groq_xxxxx
DATABASE_URL=postgresql://postgres:ton_mot_de_passe@localhost:5432/rag_poc
```

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

## Utilisation

1. Ouvre `http://localhost:5173` dans ton navigateur
2. Crée une nouvelle conversation, uploade un ou plusieurs PDF via la zone de saisie
3. Pose tes questions dans la zone de chat
4. Les réponses s'affichent avec les sources (documents) utilisées
5. Retrouve et reprends une conversation passée depuis la liste dans la sidebar

## Architecture du projet

```
poc-chatbot-rag/
├── backend/
│   ├── src/
│   │   ├── routes/         # Routes API (upload, chat, sessions)
│   │   ├── services/       # Logique métier (extraction, chunking, embeddings, vectorStore, llm, conversationStore, db)
│   │   └── server.ts
│   └── uploads/             # PDF uploadés
├── frontend/
│   └── src/
│       ├── api/             # Appels au backend
│       └── components/      # FileUpload, ChatBox, Sidebar
```

## Test de l'API avec Postman ou cURL

### URL du backend

```
http://localhost:3000
```

### 1. Upload d'un ou plusieurs PDF

**Endpoint**

```
POST /api/upload
```

**URL complète**

```
http://localhost:3000/api/upload
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

**URL complète**

```
http://localhost:3000/api/chat
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
  - URL : `http://localhost:3000/api/upload`
  - Body → `form-data`
  - Clé : `files` (type **File**, sélectionner un ou plusieurs PDF)
  - Clé : `sessionId` (type **Text**)

- **Chat**
  - Méthode : `POST`
  - URL : `http://localhost:3000/api/chat`
  - Header :
    ```
    Content-Type: application/json
    ```
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