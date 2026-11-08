package com.lessonloop;

import java.net.URI;
import java.util.List;
import java.util.StringJoiner;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/** Postgres + the pgvector extension. Works on Render's managed Postgres. Schema is also in /db/init.sql. */
public class PgVectorStore implements VectorStore {

    private final JdbcTemplate jdbc;

    PgVectorStore(String jdbcUrl, String user, String password) {
        DriverManagerDataSource ds = new DriverManagerDataSource(jdbcUrl, user, password);
        ds.setDriverClassName("org.postgresql.Driver");
        this.jdbc = new JdbcTemplate(ds);
        jdbc.execute("CREATE EXTENSION IF NOT EXISTS vector");
        jdbc.execute("CREATE TABLE IF NOT EXISTS doc_chunks ("
                + "id BIGSERIAL PRIMARY KEY, doc_id TEXT NOT NULL, file_name TEXT, chunk_index INT NOT NULL, "
                + "content TEXT NOT NULL, embedding vector(" + Embedder.DIM + ") NOT NULL)");
        jdbc.execute("CREATE INDEX IF NOT EXISTS doc_chunks_doc_idx ON doc_chunks (doc_id)");
    }

    /** Accepts Render's postgres://user:pass@host:port/db or a ready jdbc:postgresql:// URL (+ DB_USER, DB_PASSWORD). */
    static PgVectorStore fromUrl(String raw) throws Exception {
        if (raw.startsWith("jdbc:")) {
            return new PgVectorStore(raw, System.getenv("DB_USER"), System.getenv("DB_PASSWORD"));
        }
        URI u = new URI(raw.replaceFirst("^postgres(ql)?://", "http://"));
        String[] userInfo = u.getUserInfo() == null ? new String[] {"", ""} : u.getUserInfo().split(":", 2);
        int port = u.getPort() == -1 ? 5432 : u.getPort();
        String jdbcUrl = "jdbc:postgresql://" + u.getHost() + ":" + port + u.getPath() + "?sslmode=prefer";
        return new PgVectorStore(jdbcUrl, userInfo[0], userInfo.length > 1 ? userInfo[1] : "");
    }

    @Override
    public String name() {
        return "pgvector";
    }

    @Override
    public void save(String docId, String fileName, List<String> chunks, List<float[]> vectors) {
        for (int i = 0; i < chunks.size(); i++) {
            jdbc.update("INSERT INTO doc_chunks (doc_id, file_name, chunk_index, content, embedding) VALUES (?, ?, ?, ?, ?::vector)",
                    docId, fileName, i, chunks.get(i), literal(vectors.get(i)));
        }
    }

    @Override
    public List<Hit> search(String docId, float[] query, int k) {
        String q = literal(query);
        // <=> is pgvector's cosine distance, so 1 - distance is the cosine similarity
        return jdbc.query(
                "SELECT chunk_index, content, 1 - (embedding <=> ?::vector) AS score FROM doc_chunks "
                        + "WHERE doc_id = ? ORDER BY embedding <=> ?::vector LIMIT ?",
                (rs, n) -> new Hit(rs.getInt(1), rs.getString(2), rs.getDouble(3)), q, docId, q, k);
    }

    private static String literal(float[] v) {
        StringJoiner j = new StringJoiner(",", "[", "]");
        for (float x : v) j.add(Float.toString(x));
        return j.toString();
    }
}
