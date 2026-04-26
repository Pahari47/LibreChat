# LibreChat Contacts + Chat Integration

This project extends LibreChat with:

- A Contacts workspace (CRUD + CSV import + arbitrary attributes)
- Chat-time contact retrieval so the assistant can answer contact-based questions

---

## Setup Instructions

### 1) Prerequisites

- Node.js `>=20.19.0` (or `>=22.12.0`)
- MongoDB running locally (or accessible URI)

### 2) Install dependencies

From project root:

```bash
npm run smart-reinstall
```

### 3) Configure environment

Edit `.env`:

- `MONGO_URI=mongodb://127.0.0.1:27017/LibreChat`
- `GOOGLE_KEY=<your_gemini_api_key>` (for Gemini chat)

Optional:

- `GEMINI_API_KEY=<key>` if using Gemini image tooling separately

### 4) Start backend and frontend

Backend:

```bash
npm run backend:dev
```

Frontend:

```bash
npm run frontend:dev
```

Open:

- Frontend: `http://localhost:3090`
- Backend: `http://localhost:3080`

---

## Architecture

### High-level flow

1. Contacts are stored in MongoDB.
2. Contacts APIs are exposed.
3. Frontend uses React Query hooks.
4. During chat request construction, relevant contacts are retrieved and injected as compact context.
5. Gemini answers using that injected contact context.

<img width="753" height="536" alt="image" src="https://github.com/user-attachments/assets/c4ff8910-39d2-4a9d-a55a-6987bd74df65" />


## ui preview

<img width="1359" height="562" alt="Screenshot 2026-04-26 203425" src="https://github.com/user-attachments/assets/d8cde0a2-4771-4583-9a61-7cd547765368" />




## Design Questions

### 1) If the system needed to support 1,000,000 contacts, how would you redesign it?

Honestly, the current approach wouldn’t scale well because it relies too much on scanning and simple matching. I’d start by moving towards a more index-driven system instead of regex-heavy searches.

First, I’d make sure all important fields like name, company, role, email, and tags are properly normalized and indexed. Then I’d either use MongoDB text indexes for a simpler setup or bring in something like Elasticsearch or Meilisearch for better performance and search quality.

For data ingestion, I wouldn’t keep it tied to the request cycle. I’d introduce a background job system (like a queue) to handle large CSV imports. That way, uploads can be processed asynchronously with progress tracking, retries, and resumability. Also, I’d make the process idempotent so we don’t accidentally duplicate data.

To scale horizontally, I’d scope everything by user or tenant and consider sharding based on that. That way, even if the data grows massively, it stays manageable.

On the API side, I’d replace page-based pagination with cursor-based pagination since it performs much better at scale. Also, instead of returning full records, I’d only return lightweight summaries in list views.

Finally, I’d add caching something like Redis for frequently searched queries (like common names or companies), and even cache retrieval results for chat queries.

### 2) How would you ensure the assistant retrieves the most relevant contacts for a query?

I’d approach this as a multi step retrieval problem rather than a single query.

First, I’d generate a set of candidates using indexed search. Then I’d re-rank those results using a scoring system for example, exact name or company matches should rank higher than partial or fuzzy matches.

I’d also make the system aware of user intent. For example, if someone searches for a full name, the system should prioritize exact matches in the name field rather than loosely matching across other attributes.

Normalization is really important here both the stored data and the incoming query should go through the same process (like lowercasing, removing punctuation, handling stop words) to keep things consistent.

When passing data to the LLM, I’d limit it to the top few most relevant contacts (top K) and format them cleanly like name, company, role, email so the model doesn’t get confused.

### 3) What are the limitations of your current implementation?

Right now, the system is mostly heuristic-based, so it works but isn’t very smart. It doesn’t use semantic search or embeddings, so it can struggle with more natural or ambiguous queries.

The ranking logic is also somewhat basic, so it might not always pick the best results if the query is complex.

Since we rely on prompt based injection into the LLM, there’s always a chance of hallucination or the model making assumptions beyond the provided data.

Also, the import process isn’t fully decoupled yet large uploads are still somewhat tied to the request lifecycle, which isn’t ideal for scalability.

Observability is another gap. We don’t have a proper system to track how a query turns into results like what candidates were retrieved and why certain ones were chosen..

