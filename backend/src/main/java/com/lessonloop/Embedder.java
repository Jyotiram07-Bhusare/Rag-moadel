package com.lessonloop;

import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns text into a vector of numbers (an "embedding") so that similar texts get similar numbers.
 * This is a local feature-hashing embedder: no API key and no download. Words and word pairs are hashed
 * into DIM buckets and the vector is length-normalised, so a plain dot product is the cosine similarity.
 * To use a real embedding model later, replace embed() and keep DIM equal to the pgvector column size.
 */
public final class Embedder {
    public static final int DIM = 256;

    private static final Set<String> STOP = Set.of("the", "an", "and", "or", "of", "to", "in", "is", "are", "it",
            "that", "this", "for", "on", "with", "as", "by", "be", "at", "from", "was", "were", "you", "your", "can", "will");
    private static final Pattern TOKEN = Pattern.compile("[\\p{L}\\p{N}]+");

    private Embedder() {}

    public static float[] embed(String text) {
        float[] v = new float[DIM];
        String prev = null;
        Matcher m = TOKEN.matcher(text.toLowerCase(Locale.ROOT));
        while (m.find()) {
            String t = m.group();
            if (t.length() < 2 || STOP.contains(t)) continue;
            add(v, t, 1f);
            if (prev != null) add(v, prev + "_" + t, 0.5f);
            prev = t;
        }
        double norm = 0;
        for (float x : v) norm += x * x;
        norm = Math.sqrt(norm);
        if (norm > 0) for (int i = 0; i < DIM; i++) v[i] /= (float) norm;
        return v;
    }

    /** Both vectors are normalised, so the dot product is the cosine similarity (1 = same meaning words). */
    public static double cosine(float[] a, float[] b) {
        double dot = 0;
        for (int i = 0; i < DIM; i++) dot += a[i] * b[i];
        return dot;
    }

    private static void add(float[] v, String feature, float weight) {
        int h = mix(feature.hashCode());
        int sign = (mix(h ^ 0x9e3779b9) & 1) == 0 ? 1 : -1;
        v[(h & 0x7fffffff) % DIM] += sign * weight;
    }

    private static int mix(int h) {
        h ^= h >>> 16;
        h *= 0x85ebca6b;
        h ^= h >>> 13;
        h *= 0xc2b2ae35;
        h ^= h >>> 16;
        return h;
    }
}
