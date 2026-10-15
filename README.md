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
| OCR (PDF scannés) | [Google Cloud Vision](https://cloud.google.com/vision) (fallback automatique) | Identique |
| Rasterisation PDF→image | Poppler (`pdftoppm`, via `pdf-poppler`) | Identique (nécessite un déploiement Docker sur Render) |

Le vector store bascule automatiquement entre Chroma (local) et Qdrant (production) selon la présence de `QDRANT_URL` — aucune modification de code nécessaire pour changer d'environnement.

## Les deux moteurs RAG

### Naive RAG
Pipeline classique : recherche vectorielle par similarité (Chroma/Qdrant) → injection du contexte dans le prompt → génération de réponse par le LLM. Rapide, simple, efficace pour la majorité des questions ponctuelles.

### GraphRAG
Construit un **graphe de connaissances** (entités + relations) à partir des documents, stocké dans Neo4j. Permet de répondre à des questions qui s'appuient sur les relations entre concepts plutôt que sur la seule similarité textuelle. Ce mode est plus lent à l'ingestion mais plus riche à l'interrogation.

Le choix du moteur se fait par requête (`ragStrategy: "naive" | "graph"`), avec repli sur la variable d'environnement `RAG_STRATEGY` si rien n'est précisé.

## Le pipeline d'ingestion — conçu pour la production

L'ingestion d'un document se fait en deux étapes asynchrones distinctes, chacune avec sa propre file d'attente et son propre suivi de statut. L'upload répond **immédiatement**, quel que soit le contenu du document (y compris un PDF scanné nécessitant de l'OCR) :

```
upload.ts (répond immédiatement, ne fait que la vérification du nombre de pages)
    ↓ enqueue
documentQueue → documentWorker.ts (extraction/OCR, chunking, embeddings, vector store)
    ↓ enqueue (uniquement si mode Graph)
graphQueue → graphWorker.ts (extraction d'entités/relations)
    ↓ appel direct, sérialisé par session
communityDetection.ts (Louvain + résumés de communautés)
```

Chaque étape a un statut consultable en temps réel via `GET /api/indexing-status/:sessionId`, distingué par un champ `job_type` (`"document"` ou `"graph"`) sur chaque job.

### Étape 1 — Extraction du document (`document-worker`)

1. **File d'attente asynchrone** (BullMQ + Redis) — l'upload ne fait qu'une vérification rapide du nombre de pages, puis enfile chaque fichier ; extraction, chunking et embeddings tournent en arrière-plan.
2. **Extraction de texte avec bascule OCR automatique** — le texte natif du PDF est d'abord extrait (`pdf-parse`). Si le nombre moyen de caractères par page est en dessous d'un seuil (signe d'un PDF scanné sans couche de texte), le document est automatiquement rasterisé page par page puis envoyé à **Google Cloud Vision** (`DOCUMENT_TEXT_DETECTION`) pour l'OCR — voir la section dédiée ci-dessous.
3. **Statut d'indexation visible** — le nombre total de chunks n'est connu qu'après extraction + découpage ; le job est mis à jour en conséquence (`total_chunks` initialement à 0, puis fixé dès que connu).
4. Une fois les embeddings générés et le vector store alimenté, l'ingestion graphe est enfilée séparément si le mode Graph est actif.

### Étape 2 — Ingestion graphe (`graph-worker`)

1. **Rate limiting + backoff exponentiel** sur les appels Groq — concurrence plafonnée, retry automatique avec attente croissante en cas de `429`, abandon immédiat sur les erreurs définitives (pas de retry inutile).
2. **Validation de schéma (Zod)** — tout JSON retourné par le LLM est validé avant d'atteindre Neo4j ; une entité individuellement invalide est filtrée sans faire échouer tout le chunk.
3. **Normalisation des entités** — les noms sont fusionnés par une clé normalisée (minuscules, sans accents, sans article), pour éviter que "Réducteur" / "réducteur" / "le réducteur" ne créent des nœuds distincts, tout en conservant un nom d'affichage propre.
4. **Batching des chunks par budget de tokens** — plusieurs chunks sont regroupés par appel LLM selon une estimation de taille (et non un nombre fixe), ce qui réduit le nombre de requêtes d'environ 80 % pour un document typique et limite le risque de dépassement de limite par minute.
5. **Statut d'indexation visible** — remontée claire des échecs éventuels (statut `completed_with_errors` si des chunks ont échoué, ex: limite de quota LLM atteinte).

### Détection de communautés

Une fois le graphe construit, un algorithme de clustering ([Louvain](https://github.com/graphology/graphology-communities-louvain)) regroupe les entités en communautés thématiques. Pour chaque communauté significative (3 entités liées ou plus), un résumé est généré par le LLM et stocké dans Neo4j (nœuds `:Community`, reliés à leurs entités membres via `HAS_MEMBER`).

Les questions globales ("quels sont les grands thèmes de ce document ?", "de quoi ça parle en général ?") sont automatiquement détectées et redirigées vers ces résumés de communautés, plutôt que vers une recherche par entité isolée — ce qui permet de répondre à des questions qui portent sur l'ensemble d'un document, pas uniquement sur un concept précis.

Cette étape se déclenche automatiquement en arrière-plan à la fin de chaque indexation graphe (recalculée sur l'ensemble du graphe de la session à chaque nouveau document, les communautés précédentes étant nettoyées avant réécriture), et est sérialisée par session pour éviter toute exécution concurrente sur le même graphe.

## OCR des documents scannés

Certains PDF n'ont pas de couche de texte exploitable (documents scannés, photocopies). Dans ce cas, `pdf-parse` seul ne suffit pas : Insightly Docs bascule automatiquement sur un pipeline d'OCR cloud.

**Fonctionnement :**
1. Le texte natif est extrait via `pdf-parse`. Si la moyenne de caractères par page est trop faible, le document est considéré comme un scan.
2. Chaque page est rasterisée en image PNG via **Poppler** (`pdftoppm`, appelé par `pdf-poppler`) — nécessaire car l'API Google Vision, en mode synchrone, ne traite pas un PDF multi-pages directement au-delà de 5 pages.
3. Les images sont envoyées par lots de 16 à l'API **Google Cloud Vision** (`images:annotate`, feature `DOCUMENT_TEXT_DETECTION`), avec retry/backoff exponentiel sur les erreurs transitoires (429, 5xx).
4. Le texte de chaque page est recomposé dans l'ordre, puis suit le pipeline normal (chunking, embeddings, etc.).

**Garde-fous :**
- `OCR_MAX_PAGES` (défaut : 30) refuse le traitement des documents scannés anormalement longs, pour éviter un temps de traitement excessif ou une facture imprévue.
- Le quota gratuit de Google Cloud Vision couvre 1 000 pages/mois ; au-delà, facturation à l'usage (environ 1,50 $ pour 1 000 pages).

**Pourquoi pas Tesseract.js (local, gratuit) ?** Retenu comme option, mais écarté au profit de Google Vision pour la fiabilité en production : Tesseract est lourd en CPU (risque de timeout sur les plans d'hébergement gratuits) et moins précis sur des documents de qualité variable, ce qui n'était pas acceptable pour un usage où les scans sont fréquents.

## Prérequis

### Pour un lancement en local

- Node.js (v18+)
- Python (pour Chroma, si utilisé en mode Naive)
- PostgreSQL (v14+) ou un compte [Neon](https://neon.tech) gratuit
- Redis (local via Docker, ou managé)
- Neo4j (local via Docker/Desktop, ou [Aura](https://neo4j.com/cloud/aura/) gratuit) — requis uniquement pour le mode GraphRAG
- Une clé API [Groq](https://console.groq.com) (gratuite)
- **Poppler** installé localement (fournit `pdftoppm`, nécessaire à l'OCR) :
  - macOS : `brew install poppler`
  - Ubuntu/Debian : `sudo apt-get install poppler-utils`
  - Windows : binaires disponibles sur le [dépôt officiel Poppler pour Windows](https://github.com/oschwartz10612/poppler-windows), à ajouter au PATH
- Un projet [Google Cloud](https://console.cloud.google.com) avec l'**API Cloud Vision** activée et une clé API restreinte à cette API — requis pour l'OCR des PDF scannés

### Pour un déploiement en production

- [Qdrant Cloud](https://cloud.qdrant.io) (gratuit)
- [Neon](https://neon.tech) (PostgreSQL serverless, gratuit)
- Redis managé (ex: [Upstash](https://upstash.com), gratuit)
- [Neo4j Aura](https://neo4j.com/cloud/aura/) (gratuit) — pour le mode GraphRAG
- [Render](https://render.com) (backend, gratuit) — **déploiement Docker requis** pour disposer de Poppler (`poppler-utils`), non installé par défaut sur l'environnement Node natif de Render
- [Vercel](https://vercel.com) (frontend, gratuit)
- Une clé API [Groq](https://console.groq.com) (gratuite)
- Un projet Google Cloud avec l'API Cloud Vision activée et une clé API restreinte à cette API

## Installation en local

### 1. Cloner le projet

```bash
git clone <url-du-repo>
cd insightly-docs
```

### 2. Services annexes (Docker recommandé)

Pour simplifier l'installation, je recommande d'utiliser Docker pour lancer les services nécessaires. Aucune installation manuelle de Chroma, Redis, Neo4j ou PostgreSQL n'est alors requise : il suffit de télécharger les images Docker.

```bash
# Chroma (mode Naive)
docker run -d --name chroma -p 8000:8000 chromadb/chroma

# Redis (nécessaire au mode Graph)
docker run -d --name redis -p 6379:6379 redis:7-alpine

# Neo4j (nécessaire au mode Graph)
docker run -d --name neo4j \
  -p 7474:7474 \
  -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/motdepasse \
  neo4j:5

# PostgreSQL
docker run -d --name postgres \
  -p 5432:5432 \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=motdepasse \
  -e POSTGRES_DB=rag_poc \
  postgres:16
```

Une fois les conteneurs lancés, leur état peut être vérifié avec :

```bash
docker ps
```

Poppler, lui, ne se lance pas en conteneur : c'est un binaire système utilisé directement par le backend (voir la section Prérequis pour l'installation locale).

### 3. PostgreSQL

```bash
psql -U postgres
```
```sql
CREATE DATABASE rag_poc;
```
Les tables (`messages`, `documents`, `indexing_jobs`) sont créées automatiquement au démarrage du backend. La colonne `job_type` sur `indexing_jobs` (distinguant les jobs `"document"` des jobs `"graph"`) est ajoutée automatiquement si absente, sans perte de données sur une base existante.

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

# OCR des PDF scannés (Google Cloud Vision)
GOOGLE_VISION_API_KEY=xxxxx
OCR_MAX_PAGES=30
```

```bash
npm run dev
```
Le backend tourne sur `http://localhost:3000`. Le worker d'extraction/OCR (`document-worker`) démarre systématiquement ; le worker d'ingestion graphe (`graph-worker`) ne démarre qu'en mode `RAG_STRATEGY=graph`.

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

### OCR — Google Cloud Vision
Sur [console.cloud.google.com](https://console.cloud.google.com) : crée un projet, active l'**API Cloud Vision**, crée une clé API restreinte à cette seule API, active la facturation (obligatoire même dans le quota gratuit).

### Backend — Render
- New Web Service → Root Directory : `backend`
- **Déploiement Docker requis** (et non le buildpack Node natif), afin d'installer `poppler-utils` au build — nécessaire à l'OCR
- Build/Start Command : définis dans le `Dockerfile`
- Variables d'environnement : toutes celles listées ci-dessus, plus `QDRANT_URL` / `QDRANT_API_KEY`, `GOOGLE_VISION_API_KEY`, `OCR_MAX_PAGES`

### Frontend — Vercel
- Root Directory : `frontend`
- Variable : `VITE_API_URL=https://xxxxx.onrender.com/api`

## Architecture du backend

```
backend/
└── src/
    ├── server.ts                          # point d'entrée, démarre l'API + document-worker (toujours) + graph-worker (mode graph)
    │
    ├── routes/
    │   ├── upload.ts                      # upload PDF, vérifie le nombre de pages, enfile l'extraction (répond immédiatement)
    │   ├── chat.ts                        # pose une question, route vers Naive ou GraphRAG
    │   ├── sessions.ts                     # liste / recharge les conversations
    │   └── indexingStatus.ts               # statut des jobs (document + graph) en temps réel
    │
    ├── queue/
    │   ├── redis.ts                       # connexion Redis (BullMQ)
    │   ├── documentQueue.ts               # définition de la queue d'extraction/OCR
    │   ├── documentWorker.ts              # worker : extraction/OCR, chunking, embeddings, vector store
    │   ├── graphQueue.ts                  # définition de la queue d'ingestion graphe
    │   └── graphWorker.ts                 # worker qui consomme la queue et indexe dans Neo4j
    │
    └── services/
        ├── db.ts                          # connexion PostgreSQL, schéma des tables
        ├── conversationStore.ts            # historique des messages par session
        ├── jobStore.ts                     # suivi des jobs d'indexation (statut, progression, job_type)
        ├── pdfLoader.ts                    # extraction de texte natif, bascule automatique vers l'OCR si scan détecté
        ├── chunker.ts                      # découpage en chunks avec overlap
        ├── embeddings.ts                   # génération des embeddings locaux
        ├── llm.ts                          # appel Groq pour la génération de réponse
        ├── groqLimiter.ts                  # rate limiting + retry/backoff pour tous les appels Groq
        │
        ├── ocr/
        │   ├── pdfRasterizer.ts            # conversion des pages PDF en images PNG (via Poppler)
        │   └── visionOcr.ts                # appel à Google Cloud Vision (batching, retry/backoff)
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
            ├── graphStore.ts                # couche Neo4j (ingestion + interrogation du graphe)
            └── communityDetection.ts        # clustering Louvain + résumés de communautés
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
        ├── Sidebar.tsx                     # historique des conversations, documents (avec statut de traitement), menu utilisateur
        ├── UserMenu.tsx                     # profil, switch Naive/Graph, accès à la page billing
        ├── PlanCard.tsx                     # carte de plan tarifaire
        ├── IndexingProgress.tsx             # barre de progression des jobs document + graphe, en temps réel
        ├── ThemeToggle.tsx                  # bouton clair/sombre
        └── Icons.tsx                        # icônes SVG partagées
```

Un document affiché dans la Sidebar passe par les statuts `processing` → `ready` (ou `partial` / `failed` en cas de problème), mis à jour dès que le job d'extraction correspondant se termine — sans bloquer la requête d'upload initiale.

## Test de l'API

### Upload

```bash
curl -X POST http://localhost:3000/api/upload \
  -F "files=@/chemin-vers-document.pdf" \
  -F "sessionId=session-test"
```

Réponse immédiate (le traitement se poursuit en arrière-plan) :
```json
{
  "message": "1 fichier(s) reçu(s), traitement en cours en arrière-plan",
  "totalPages": 12,
  "files": [{ "filename": "...", "documentJobId": 42 }],
  "graphIngestion": false
}
```

### Question (Naive ou Graph)

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"question":"Quelle est la durée de la formation ?","sessionId":"session-test","ragStrategy":"graph"}'
```

### Statut d'indexation (document + graphe)

```bash
curl http://localhost:3000/api/indexing-status/session-test
```
Chaque job retourné inclut désormais `job_type` (`"document"` ou `"graph"`), en plus du statut et de la progression.

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
![Capture 8](Screenshots/8.png)
![Capture 9](Screenshots/9.png)
![Capture 10](Screenshots/10.png)
![Capture 11](Screenshots/11.png)
![Capture 12](Screenshots/12.png)
![Capture 13](Screenshots/13.png)
![Capture 14](Screenshots/14.png)