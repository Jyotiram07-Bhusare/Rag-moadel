package com.lessonloop;

import java.util.ArrayList;
import java.util.List;

final class TextTools {

    private TextTools() {}

    /** Splits text into sentences (or lines). Very short fragments such as page numbers are dropped. */
    static List<String> sentences(String text) {
        String t = text.replace('\r', '\n').replaceAll("[\\t\\u000B\\f ]+", " ");
        List<String> out = new ArrayList<>();
        for (String line : t.split("\n+")) {
            for (String s : line.trim().split("(?<=[.!?])\\s+")) {
                s = s.trim();
                if (s.length() < 20) continue;
                if (s.length() > 400) s = s.substring(0, 397).trim() + "...";
                out.add(s);
            }
        }
        return out;
    }

    /** Groups sentences into chunks of about `target` characters; the last sentence is repeated as overlap. */
    static List<String> chunk(String text, int target) {
        List<String> chunks = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        String last = null;
        for (String s : sentences(text)) {
            if (cur.length() > 0 && cur.length() + s.length() > target) {
                chunks.add(cur.toString().trim());
                cur.setLength(0);
                if (last != null) cur.append(last).append(' ');
            }
            cur.append(s).append(' ');
            last = s;
        }
        if (!cur.toString().isBlank()) chunks.add(cur.toString().trim());
        return chunks;
    }
}
