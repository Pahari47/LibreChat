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

Right now the system uses simple scanning and matching, which won’t scale well for large data like 1 million contacts.
To improve it, I would first move to an index-based search instead of regex or full scans. I would make sure fields like name, company, role, and email are properly stored and indexed. For search, I could use MongoDB text indexes initially, and if needed, switch to tools like Elasticsearch for better performance.

For handling large uploads like CSV files, I would not process them directly in the request. Instead, I would use background jobs so the upload can happen asynchronously, with progress tracking and retry support.
To manage scaling, I would organize data based on users (user scoped data), so queries remain efficient.

For APIs, I would replace page-based pagination with cursor-based pagination because it works better with large datasets. Also, I would return only required fields instead of full data to reduce load.
Finally, I would add caching (like Redis) for frequently searched queries to improve performance.

### 2) How would you ensure the assistant retrieves the most relevant contacts for a query?

First, I would fetch a set of possible matches using indexed search. Then I would rank them based on relevance for example, exact name matches should rank higher than partial matches.
I would also normalize both the stored data and user queries (like lowercase, remove punctuation) so matching is more consistent.

Understanding user intent is also important. For example, if a user searches a full name, the system should prioritize name matches instead of matching other fields.
When sending data to the AI model, I would only include the top few relevant contacts and keep the format clean and structured so the model can respond correctly.

### 3) What are the limitations of your current implementation?

Currently, the system is mostly based on simple rules, so it may not handle complex or natural language queries very well.
It doesn’t use semantic search (like embeddings), so it might miss relevant results if the wording is different.
The ranking logic is basic, so sometimes results may not be perfectly ordered.
Also, since we pass data through prompts to the AI, there is a small chance of incorrect or assumed responses.

The file upload process is not fully optimized yet, as large uploads are still somewhat tied to the request instead of being fully handled in the background.
Finally, we don’t have proper monitoring or tracking to see how search results are generated, which makes debugging harder.
Observability is another gap. We don’t have a proper system to track how a query turns into results like what candidates were retrieved and why certain ones were chosen, i dont know this one posible or not maybe posthog like tool though i never used it.

