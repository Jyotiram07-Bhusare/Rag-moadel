-- Vector database schema (Postgres + pgvector).
-- The backend runs these statements itself on start-up; this file is for manual setup.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS doc_chunks (
    id          BIGSERIAL PRIMARY KEY,
    doc_id      TEXT NOT NULL,
    file_name   TEXT,
    chunk_index INT  NOT NULL,
    content     TEXT NOT NULL,
    embedding   vector(256) NOT NULL   -- must equal Embedder.DIM in the backend
);

CREATE INDEX IF NOT EXISTS doc_chunks_doc_idx ON doc_chunks (doc_id);
