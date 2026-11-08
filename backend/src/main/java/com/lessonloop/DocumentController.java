package com.lessonloop;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class DocumentController {

    private static final int MAX_TEXT = 200_000;
    private static final int MAX_OCR_PAGES = 5;

    private final VectorStore store;
    private final ExplainService explain;
    private final OcrService ocr;

    public DocumentController(VectorStore store, ExplainService explain, OcrService ocr) {
        this.store = store;
        this.explain = explain;
        this.ocr = ocr;
    }

    @GetMapping("/health")
    public String health() {
        return "ok";
    }

    /**
     * POST multipart "file" (PDF or image).
     * PDF: text is read with PDFBox (scanned PDFs fall back to OCR). Image: text is read with OCR.
     * The text is chunked, embedded and saved in the vector store, then the answer is written from it.
     * Returns { kind, fileName, aboutRag, docId, chunks, store, markdown }.
     */
    @PostMapping("/api/documents")
    public ResponseEntity<Map<String, Object>> upload(@RequestParam("file") MultipartFile file) throws Exception {
        String name = file.getOriginalFilename() == null ? "file" : file.getOriginalFilename();
        String type = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        boolean pdf = type.equals("application/pdf") || name.toLowerCase(Locale.ROOT).endsWith(".pdf");
        boolean image = type.startsWith("image/");
        if (!pdf && !image) return fail(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Please upload a PDF or an image.");

        byte[] bytes = file.getBytes();
        String kind;
        String text;
        boolean usedOcr = false;
        try {
            if (image) {
                kind = "image";
                text = ocr.read(bytes);
                usedOcr = true;
            } else {
                kind = "PDF";
                try (PDDocument doc = Loader.loadPDF(bytes)) {
                    text = new PDFTextStripper().getText(doc);
                } catch (IOException e) {
                    return fail(HttpStatus.UNPROCESSABLE_ENTITY, "This PDF could not be opened: " + e.getMessage());
                }
                if (text.strip().length() < 50) { // a scanned PDF has no text layer: read the pages with OCR
                    text = ocrPdf(bytes);
                    usedOcr = true;
                }
            }
        } catch (IllegalArgumentException e) {
            return fail(HttpStatus.UNPROCESSABLE_ENTITY, e.getMessage());
        } catch (Throwable e) {
            return fail(HttpStatus.SERVICE_UNAVAILABLE, "The OCR engine is not available on this server: " + e);
        }

        text = explain.joinWrapped(text.replace('\u0000', ' ').strip());
        if (text.length() > MAX_TEXT) text = text.substring(0, MAX_TEXT);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("fileName", name);
        body.put("kind", image ? "image" : "pdf");
        body.put("ocr", usedOcr);

        if (text.length() < 15) {
            body.put("aboutRag", false);
            body.put("markdown", explain.noText(name, kind));
            return ResponseEntity.ok(body);
        }

        List<String> chunks = TextTools.chunk(text, 600);
        String docId = null;
        if (!chunks.isEmpty()) {
            List<float[]> vectors = new ArrayList<>();
            for (String c : chunks) vectors.add(Embedder.embed(c));
            docId = UUID.randomUUID().toString().substring(0, 8);
            store.save(docId, name, chunks, vectors);
            body.put("docId", docId);
            body.put("chunks", chunks.size());
            body.put("store", store.name());
        }

        // Decide what the file is. A resume is never explained as RAG, even if it lists RAG projects.
        String docType = "other";
        String markdown = null;
        boolean resume = explain.isResume(text);
        if (resume) {
            markdown = explain.summarizeResume(name, text);
            if (markdown != null) docType = "resume";
        }
        if (markdown == null) {
            if (!resume && explain.isAboutRag(text)) {
                docType = "rag";
                markdown = docId != null && TextTools.sentences(text).size() >= 3
                        ? explain.explain(name, kind, docId, text, store, chunks.size())
                        : explain.explainDiagram(name, text);
            } else {
                markdown = explain.summarize(name, kind, text);
            }
        }
        body.put("docType", docType);
        body.put("aboutRag", docType.equals("rag"));
        body.put("markdown", markdown);
        return ResponseEntity.ok(body);
    }

    private String ocrPdf(byte[] bytes) throws Exception {
        StringBuilder sb = new StringBuilder();
        try (PDDocument doc = Loader.loadPDF(bytes)) {
            PDFRenderer renderer = new PDFRenderer(doc);
            int pages = Math.min(doc.getNumberOfPages(), MAX_OCR_PAGES);
            for (int i = 0; i < pages; i++) sb.append(ocr.read(renderer.renderImageWithDPI(i, 200))).append('\n');
        }
        return sb.toString();
    }

    private static ResponseEntity<Map<String, Object>> fail(HttpStatus status, String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("error", message);
        return ResponseEntity.status(status).body(m);
    }
}
