package com.lessonloop;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Render's free web service goes to sleep after 15 minutes without a request, and the next visitor then waits about a
 * minute. Every few minutes this calls the service's own public /health address, which counts as a request, so it
 * stays awake. One missed ping is fine because the gap stays under 15 minutes.
 *
 * Render sets RENDER_EXTERNAL_URL on its servers. On a laptop it is missing, so nothing happens.
 * Settings (all optional): KEEP_ALIVE=off turns it off, KEEP_ALIVE_EVERY_MS (default 300000 = 5 minutes),
 * KEEP_ALIVE_FIRST_MS (default 120000 = 2 minutes after start).
 */
@Configuration
@EnableScheduling
public class KeepAlive {

    private static final HttpClient HTTP = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private boolean reported = false;

    @Scheduled(initialDelayString = "${KEEP_ALIVE_FIRST_MS:120000}", fixedRateString = "${KEEP_ALIVE_EVERY_MS:300000}")
    void ping() {
        String base = System.getenv("RENDER_EXTERNAL_URL");
        if (base == null || base.isBlank() || "off".equalsIgnoreCase(System.getenv("KEEP_ALIVE"))) return;
        String url = base.replaceAll("/+$", "") + "/health";
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url)).timeout(Duration.ofSeconds(30)).GET().build();
            int code = HTTP.send(request, HttpResponse.BodyHandlers.discarding()).statusCode();
            if (code != 200) {
                System.err.println("[lessonloop] keep-alive ping got HTTP " + code + " from " + url);
            } else if (!reported) {
                reported = true; // say it once, so the log does not fill up
                System.out.println("[lessonloop] keep-alive is working: " + url + " answered HTTP 200");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt(); // the app is shutting down
        } catch (Exception e) {
            System.err.println("[lessonloop] keep-alive ping failed: " + e.getMessage());
        }
    }
}
