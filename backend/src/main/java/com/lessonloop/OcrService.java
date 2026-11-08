package com.lessonloop;

import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import javax.imageio.ImageIO;

import net.sourceforge.tess4j.Tesseract;

import org.springframework.stereotype.Service;

/**
 * Reads the text inside an image with Tesseract OCR (through Tess4J).
 * Language: OCR_LANG (default "eng"; Docker uses eng+mar+hin). Language files: TESSDATA_PREFIX, ./tessdata, or the system folder.
 */
@Service
public class OcrService {

    private final String lang = System.getenv("OCR_LANG") == null || System.getenv("OCR_LANG").isBlank() ? "eng" : System.getenv("OCR_LANG");
    private final String dataPath = findDataPath();

    public String read(byte[] imageBytes) throws Exception {
        BufferedImage img = ImageIO.read(new ByteArrayInputStream(imageBytes));
        if (img == null) {
            throw new IllegalArgumentException("This image format is not supported. Please use PNG or JPG.");
        }
        return read(img);
    }

    public String read(BufferedImage img) throws Exception {
        BufferedImage prepared = prepare(img);
        String best = run(prepared, 3); // 3 = automatic page layout: good for paragraphs
        if (best.strip().length() < 200) {
            // Little text found: probably a diagram with boxes and arrows. 11 = sparse text, finds words anywhere on the page.
            String sparse = run(prepared, 11);
            if (sparse.strip().length() > best.strip().length() * 1.2) best = sparse;
        }
        return best; // line breaks are kept; ExplainService.joinWrapped() joins wrapped sentences later
    }

    private String run(BufferedImage img, int pageSegMode) throws Exception {
        Tesseract t = new Tesseract(); // not thread-safe, so one per call
        t.setDatapath(dataPath);
        t.setLanguage(lang);
        t.setPageSegMode(pageSegMode);
        return t.doOCR(img);
    }

    /** Tesseract reads best at about 300 dpi on a white background: grey-scale it and enlarge small images. */
    private static BufferedImage prepare(BufferedImage src) {
        int w = src.getWidth(), h = src.getHeight();
        double scale = w < 1600 ? Math.min(3.0, 1600.0 / w) : 1.0;
        int nw = (int) Math.round(w * scale), nh = (int) Math.round(h * scale);
        BufferedImage out = new BufferedImage(nw, nh, BufferedImage.TYPE_BYTE_GRAY);
        Graphics2D g = out.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, nw, nh); // transparent PNGs become white
        g.drawImage(src, 0, 0, nw, nh, null);
        g.dispose();
        return out;
    }

    private static String findDataPath() {
        String env = System.getenv("TESSDATA_PREFIX");
        List<String> candidates = new java.util.ArrayList<>();
        if (env != null && !env.isBlank()) candidates.add(env);
        candidates.addAll(List.of("tessdata", "/usr/share/tesseract-ocr/5/tessdata", "/usr/share/tesseract-ocr/4.00/tessdata", "/usr/share/tessdata"));
        for (String c : candidates) {
            if (Files.exists(Path.of(c, "eng.traineddata"))) return c;
        }
        return "tessdata";
    }
}
