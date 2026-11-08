package com.lessonloop;

import java.util.List;

/** Where document chunks and their embeddings live. Two implementations: pgvector (Postgres) and in-memory. */
public interface VectorStore {

    String name();

    void save(String docId, String fileName, List<String> chunks, List<float[]> vectors);

    /** The k chunks of one document whose embeddings are closest to the query. Best first. */
    List<Hit> search(String docId, float[] query, int k);

    record Hit(int index, String text, double score) {}
}
