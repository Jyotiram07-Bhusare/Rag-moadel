package com.lessonloop;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class StoreConfig {

    /** pgvector when DATABASE_URL is set (Render, docker-compose), otherwise an in-memory store. */
    @Bean
    VectorStore vectorStore() {
        String url = System.getenv("DATABASE_URL");
        if (url == null || url.isBlank()) {
            System.out.println("[lessonloop] DATABASE_URL not set: using the in-memory vector store");
            return new MemoryVectorStore();
        }
        try {
            PgVectorStore store = PgVectorStore.fromUrl(url);
            System.out.println("[lessonloop] connected to Postgres: using pgvector");
            return store;
        } catch (Exception e) {
            System.err.println("[lessonloop] pgvector not available (" + e.getMessage() + "): using the in-memory vector store");
            return new MemoryVectorStore();
        }
    }
}
