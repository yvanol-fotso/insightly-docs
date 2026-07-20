# Insightly Docs

Assistant documentaire intelligent permettant d'uploader des documents PDF et de les interroger en langage naturel, avec deux moteurs de recherche interchangeables : un **RAG vectoriel classique (Naive)** et un **RAG par graphe de connaissances (GraphRAG)**.

##  Démo en ligne

- **Frontend** : [https://poc-chatbot-rag.vercel.app](https://poc-chatbot-rag.vercel.app)
- **Backend (API)** : [https://poc-chatbot-rag.onrender.com](https://poc-chatbot-rag.onrender.com)

> Le backend est hébergé sur le plan gratuit de Render, qui met le service en veille après quelques minutes d'inactivité. Le premier appel après une période d'inactivité peut donc prendre 30 à 60 secondes le temps que le service redémarre.

## Stack technique

| Composant | Local (développement) | Production (déployé) |
|---|---|---|
| Backend | Node.js / TypeScript, Express | Node.js / TypeScript, Express — [Render](https://render.com) |
| Frontend | React (Vite) / TypeScript | React (Vite) / TypeScript — [Vercel](https://vercel.com) |
| Embeddings | `@xenova/transformers` (`Xenova/all-MiniLM-L6-v2`, local, gratuit) | Identique |
| Vector Database | [Chroma](https://www.trychroma.com/) (disque local) | [Qdrant Cloud](https://qdrant.tech/) |
| Graphe de connaissances | [Neo4j](https://neo4j.com/) local ou Aura | Neo4j Aura (managé) |
| File d'attente | Redis local + [BullMQ](https://docs.bullmq.io/) | Redis managé (ex: Upstash) + BullMQ |
| Base de données relationnelle | PostgreSQL local | [Neon](https://neon.tech) (PostgreSQL serverless, gratuit) |
| LLM | Groq (`llama-3.3-70b-versatile`, gratuit) | Identique |

Le vector store bascule automatiquement entre Chroma (local) et Qdrant (production) selon la présence de `QDRANT_URL` — aucune modification de code nécessaire pour changer d'environnement.

## Les deux moteurs RAG

### Naive RAG
Pipeline classique : recherche vectorielle par similarité (Chroma/Qdrant) → injection du contexte dans le prompt → génération de réponse par le LLM. Rapide, simple, efficace pour la majorité des questions ponctuelles.

### GraphRAG
Construit un **graphe de connaissances** (entités + relations) à partir des documents, stocké dans Neo4j. Permet de répondre à des questions qui s'appuient sur les relations entre concepts plutôt que sur la seule similarité textuelle. Ce mode est plus lent à l'ingestion mais plus riche à l'interrogation.

Le choix du moteur se fait par requête (`ragStrategy: "naive" | "graph"`), avec repli sur la variable d'environnement `RAG_STRATEGY` si rien n'est précisé.

## Le pipeline GraphRAG en détail — conçu pour la production

L'ingestion GraphRAG est bâtie comme un pipeline robuste, pas un prototype : chaque étape a été ajoutée pour résoudre un problème concret de fiabilité à l'échelle.

1. **File d'attente asynchrone** (BullMQ + Redis) — l'upload répond immédiatement ; l'extraction d'entités/relations tourne en arrière-plan, avec un statut consultable en temps réel (`processed_chunks / total_chunks`) via `GET /api/indexing-status/:sessionId`.
2. **Rate limiting + backoff exponentiel** sur les appels Groq — concurrence plafonnée, retry automatique avec attente croissante en cas de `429`, abandon immédiat sur les erreurs définitives (pas de retry inutile).
3. **Validation de schéma (Zod)** — tout JSON retourné par le LLM est validé avant d'atteindre Neo4j ; une entité individuellement invalide est filtrée sans faire échouer tout le chunk.
4. **Normalisation des entités** — les noms sont fusionnés par une clé normalisée (minuscules, sans accents, sans article), pour éviter que "Réducteur" / "réducteur" / "le réducteur" ne créent des nœuds distincts, tout en conservant un nom d'affichage propre.
5. **Batching des chunks** — plusieurs chunks sont regroupés par appel LLM (au lieu d'un appel par chunk), ce qui réduit le nombre de requêtes d'environ 80 % pour un document typique.
6. **Statut d'indexation visible** — le frontend affiche une barre de progression en temps réel pendant l'indexation graphe, avec remontée claire des échecs éventuels.

### Chantier à venir : détection de communautés
Une fois le graphe construit, l'étape suivante consiste à appliquer un algorithme de clustering (type Leiden) pour regrouper les entités en communautés thématiques et générer un résumé par communauté — ce qui permettra de répondre à des questions globales ("quels sont les grands thèmes de ce document ?"), pas uniquement des questions ciblées sur une entité précise. Cette fonctionnalité n'est pas encore implémentée.

## Prérequis

### Pour un lancement en local

- Node.js (v18+)
- Python (pour Chroma, si utilisé en mode Naive)
- PostgreSQL (v14+) ou un compte [Neon](https://neon.tech) gratuit
- Redis (local via Docker, ou managé)
- Neo4j (local via Docker/Desktop, ou [Aura](https://neo4j.com/cloud/aura/) gratuit) — requis uniquement pour le mode GraphRAG
- Une clé API [Groq](https://console.groq.com) (gratuite)

### Pour un déploiement en production

- [Qdrant Cloud](https://cloud.qdrant.io) (gratuit)
- [Neon](https://neon.tech) (PostgreSQL serverless, gratuit)
- Redis managé (ex: [Upstash](https://upstash.com), gratuit)
- [Neo4j Aura](https://neo4j.com/cloud/aura/) (gratuit) — pour le mode GraphRAG
- [Render](https://render.com) (backend, gratuit)
- [Vercel](https://vercel.com) (frontend, gratuit)
- Une clé API [Groq](https://console.groq.com) (gratuite)

## Installation en local

### 1. Cloner le projet

```bash
git clone <url-du-repo>
cd insightly-docs
```

### 2. Services annexes

```bash
# Chroma (mode Naive)
pip install chromadb
chroma run --path ./chroma_data

# Redis (nécessaire au mode Graph)
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Neo4j (nécessaire au mode Graph)
docker run -d --name neo4j -p 7474:7474 -p 7687:7687 -e NEO4J_AUTH=neo4j/motdepasse neo4j:5
```

### 3. PostgreSQL

```bash
psql -U postgres
```
```sql
CREATE DATABASE rag_poc;
```
Les tables (`messages`, `documents`, `indexing_jobs`) sont créées automatiquement au démarrage du backend.

### 4. Backend

```bash
cd backend
npm install
```

Crée `backend/.env` :

```
GROQ_API_KEY=groq_xxxxx
DATABASE_URL=postgresql://postgres:motdepasse@localhost:5432/rag_poc

# Mode RAG par défaut : "naive" ou "graph"
RAG_STRATEGY=naive

# Requis uniquement en mode graph :
REDIS_URL=redis://localhost:6379
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=motdepasse

# Laisser vide en local pour utiliser Chroma automatiquement :
# QDRANT_URL=
# QDRANT_API_KEY=
```

```bash
npm run dev
```
Le backend tourne sur `http://localhost:3000`.

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
```
Le frontend tourne sur `http://localhost:5173`.

## Déploiement en production

### Base de données — Neon
Crée un projet et une base `rag_poc` sur [neon.tech](https://neon.tech), récupère `DATABASE_URL`.

### Vector store — Qdrant Cloud
Crée un cluster sur [cloud.qdrant.io](https://cloud.qdrant.io), récupère `QDRANT_URL` et `QDRANT_API_KEY`.

### Graphe — Neo4j Aura
Crée une instance sur [neo4j.com/cloud/aura](https://neo4j.com/cloud/aura/), récupère `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`.

### File d'attente — Redis managé
Ex: [Upstash](https://upstash.com), récupère `REDIS_URL`.

### Backend — Render
- New Web Service → Root Directory : `backend`
- Build Command : `npm install && npm run build`
- Start Command : `npm start`
- Variables d'environnement : toutes celles listées ci-dessus, plus `QDRANT_URL` / `QDRANT_API_KEY`

### Frontend — Vercel
- Root Directory : `frontend`
- Variable : `VITE_API_URL=https://xxxxx.onrender.com/api`

## Architecture du backend

```
backend/
└── src/
    ├── server.ts                          # point d'entrée, démarre l'API + le worker graphe
    │
    ├── routes/
    │   ├── upload.ts                      # upload PDF, embeddings, enfile l'ingestion graphe
    │   ├── chat.ts                        # pose une question, route vers Naive ou GraphRAG
    │   ├── sessions.ts                     # liste / recharge les conversations
    │   └── indexingStatus.ts               # statut d'indexation graphe en temps réel
    │
    ├── queue/
    │   ├── redis.ts                       # connexion Redis (BullMQ)
    │   ├── graphQueue.ts                  # définition de la queue d'ingestion graphe
    │   └── graphWorker.ts                 # worker qui consomme la queue et indexe dans Neo4j
    │
    └── services/
        ├── db.ts                          # connexion PostgreSQL, schéma des tables
        ├── conversationStore.ts            # historique des messages par session
        ├── jobStore.ts                     # suivi des jobs d'indexation (statut, progression)
        ├── pdfLoader.ts                    # extraction de texte depuis les PDF
        ├── chunker.ts                      # découpage en chunks avec overlap
        ├── embeddings.ts                   # génération des embeddings locaux
        ├── llm.ts                          # appel Groq pour la génération de réponse
        ├── groqLimiter.ts                  # rate limiting + retry/backoff pour tous les appels Groq
        │
        ├── vectorStore.ts                  # point d'entrée, bascule Chroma <-> Qdrant
        ├── vectorStore.chroma.ts           # implémentation Chroma (local)
        ├── vectorStore.qdrant.ts           # implémentation Qdrant (production)
        │
        └── rag/
            ├── types.ts                    # types partagés (RagResult, RagSource, Message)
            ├── ragEngine.ts                # point d'entrée, choisit Naive ou Graph
            ├── naiveRag.ts                 # implémentation du RAG vectoriel classique
            ├── graphRag.ts                 # implémentation de l'interrogation du graphe
            ├── graphExtraction.ts           # extraction d'entités/relations via LLM (batché)
            ├── graphSchema.ts               # validation Zod du JSON retourné par le LLM
            ├── entityNormalization.ts       # normalisation des noms d'entités pour la fusion
            └── graphStore.ts                # couche Neo4j (ingestion + interrogation du graphe)
```

## Architecture du frontend

```
frontend/
└── src/
    ├── App.tsx                             # état global (session, plan, mode RAG, thème), navigation chat/billing
    ├── api/ragApi.ts                       # client API centralisé
    ├── hooks/useTheme.ts                   # thème clair/sombre avec persistance locale
    ├── pages/Billing.tsx                   # page des plans tarifaires + FAQ
    └── components/
        ├── ChatBox.tsx                     # zone de conversation, upload, envoi de questions
        ├── Sidebar.tsx                     # historique des conversations, documents, menu utilisateur
        ├── UserMenu.tsx                     # profil, switch Naive/Graph, accès à la page billing
        ├── PlanCard.tsx                     # carte de plan tarifaire
        ├── IndexingProgress.tsx             # barre de progression de l'indexation graphe
        ├── ThemeToggle.tsx                  # bouton clair/sombre
        └── Icons.tsx                        # icônes SVG partagées
```

## Test de l'API

### Upload

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "files=@/chemin-vers-document.pdf" \
  -F "sessionId=session-test"
```

### Question (Naive ou Graph)

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"Quelle est la durée de la formation ?","sessionId":"session-test","ragStrategy":"graph"}'
```

### Statut d'indexation graphe

```bash
curl http://localhost:3000/api/indexing-status/session-test
```

### Conversations

```bash
curl http://localhost:3000/api/sessions
curl http://localhost:3000/api/sessions/session-test
```

## Screenshots

![Capture 1](Screenshots/1.png)
![Capture 2](Screenshots/2.png)
![Capture 3](Screenshots/3.png)
![Capture 4](Screenshots/4.png)
![Capture 6](Screenshots/6.png)
![Capture 7](Screenshots/7.png)