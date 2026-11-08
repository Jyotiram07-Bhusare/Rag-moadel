package com.lessonloop;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Used when no DATABASE_URL is set (local quick start). Data is lost when the server stops. */
public class MemoryVectorStore implements VectorStore {

    private record Doc(List<String> chunks, List<float[]> vectors) {}

    private final Map<String, Doc> docs = new LinkedHashMap<>();

    @Override
    public String name() {
        return "memory";
    }

    @Override
    public synchronized void save(String docId, String fileName, List<String> chunks, List<float[]> vectors) {
        docs.put(docId, new Doc(chunks, vectors));
        while (docs.size() > 50) { // keep the newest 50 documents
            Iterator<String> it = docs.keySet().iterator();
            it.next();
            it.remove();
        }
    }

    @Override
    public synchronized List<Hit> search(String docId, float[] query, int k) {
        Doc doc = docs.get(docId);
        if (doc == null) return List.of();
        List<Hit> hits = new ArrayList<>();
        for (int i = 0; i < doc.chunks().size(); i++) {
            hits.add(new Hit(i, doc.chunks().get(i), Embedder.cosine(query, doc.vectors().get(i))));
        }
        hits.sort(Comparator.comparingDouble(Hit::score).reversed());
        return hits.subList(0, Math.min(k, hits.size()));
    }
}
