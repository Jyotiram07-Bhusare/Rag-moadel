# Rag-moadel

LessonLoop: a ChatGPT-style chat that writes and checks beginner lessons, and explains your own PDF or image in simple words (RAG, OCR and a vector database).

| Folder | What it is |
|---|---|
| `frontend/` | The chat page (plain HTML, CSS, JavaScript). Open `index.html`. |
| `backend/` | Java Spring Boot API: PDF/image upload, OCR (Tesseract), embeddings, vector search. See `backend/README.md`. |
| `db/` | Postgres + pgvector schema and a local `docker-compose.yml`. |
| `render.yaml` | Render Blueprint that creates the database, the backend and the frontend. |

Host it on Render: see [DEPLOY-RENDER.md](DEPLOY-RENDER.md).
