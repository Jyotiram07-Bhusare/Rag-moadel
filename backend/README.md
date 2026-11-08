# LessonLoop backend (Java, Spring Boot)

Upload a **PDF or image** from the chat (＋ → Upload PDF or image) and get a simple-language RAG explanation.

## How it works (PDF)
1. PDFBox reads the text of the PDF.
2. The text is cut into chunks and each chunk is turned into numbers (embedding, 256 values).
3. Chunks + numbers are saved in the **vector database** (Postgres + pgvector, or in memory if no database is set).
4. For every section (definition, key points, note, summary, advantages, real-life examples) the question is turned into numbers too, and the closest sentences are found by cosine similarity.
5. The answer is written in simple language: RAG full form, short info, where it is used, an example story, then the sections above. If the PDF does not cover a part, easy built-in text is used and the section says so.

## Images and scanned PDFs (OCR)
The text inside an image is read with **Tesseract OCR** (Tess4J). A scanned PDF (no text layer) is also read this way (first 5 pages).
Then the file is treated like any other text:
- **About RAG, with sentences** (a RAG PDF or a screenshot of RAG text): the full simple-language RAG answer, built from the file.
- **A RAG diagram** (only labels such as Retriever, Vector Database, LLM): the labels are matched with the parts of RAG and explained in flow order.
- **A resume** (sections like Skills, Experience, Projects, Education, plus contact details): explained section by section in simple words. A resume is never explained as RAG, even if it lists RAG projects.
- **Not about RAG** (a photo of notes, any other file): it says so and gives a plain summary of what the file really contains. It does not force a RAG answer.
- RAG is treated as the topic only if the file defines RAG, names it 5+ times, or is a diagram with enough RAG parts. One or two mentions are not enough.
- **No readable text**: it says so and tells you how to get a better picture.

Language: `OCR_LANG` (default `eng`; the Docker image uses `eng+mar+hin`, so Marathi and Hindi text is read too).
Locally the English language file is in `backend/tessdata/`. Run the backend from the `backend` folder (`start-backend.bat` does this).
OCR can miss small or blurry labels, so use a clear, large picture (PNG or JPG).

## Run locally
```
mvn package -DskipTests
java -jar target/lessonloop-backend.jar        # http://localhost:8000  (GET /health, POST /api/documents)
```
With the vector database: `cd ../db && docker compose up -d`, then
`DATABASE_URL=postgres://lessonloop:lessonloop@localhost:5432/lessonloop java -jar target/lessonloop-backend.jar`.

## Deploy on Render
`render.yaml` at the repo root creates the Java backend (Docker), a Postgres database (pgvector) and the static frontend.
Then open the chat → Settings → General → Live backend and paste the backend URL.

## Staying awake on Render's free plan
`KeepAlive.java` calls the service's own public `/health` address every 5 minutes (from Render's `RENDER_EXTERNAL_URL`), so the free plan's 15-minute sleep never starts. On a laptop that variable is missing and nothing happens. `KEEP_ALIVE=off` turns it off; `KEEP_ALIVE_EVERY_MS` and `KEEP_ALIVE_FIRST_MS` change the timing.

## Not built yet
`POST /api/run` (the generate → evaluate → regenerate lesson loop) is not in this backend. The answers are built from the file's own sentences plus built-in simple text, not written by an LLM. The embedder is a local hashing embedder; swap `Embedder.embed()` for a real embedding model later (keep the size equal to `vector(256)` or change both).
