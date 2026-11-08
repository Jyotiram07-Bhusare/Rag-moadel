package com.lessonloop;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

/**
 * Writes the simple-language answer for an uploaded PDF or image (the text of an image comes from OCR).
 *  - RAG text with sentences: every section is searched in the vector index (question and sentences become numbers,
 *    closest by cosine similarity wins).
 *  - RAG diagram (only short labels): the labels are matched with the building blocks of RAG and explained.
 *  - Anything else: it is NOT forced into a RAG answer; a plain summary of what the file says is returned.
 */
@Service
public class ExplainService {

    private static final double MIN_SCORE = 0.15;
    private static final Pattern RAG_WORD = Pattern.compile("\\brag\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern WORD = Pattern.compile("\\p{L}{4,}");
    private static final Set<String> COMMON = Set.of("this", "that", "with", "from", "have", "will", "your", "about", "which",
            "their", "there", "were", "been", "also", "into", "than", "then", "they", "them", "what", "when", "where", "some",
            "such", "more", "most", "other", "these", "those", "and", "for");

    private record Section(String title, String query, int max, String[] fallback) {}

    private record Scored(String text, double score) {}

    /** weight 2 = a clear sign of RAG, 1 = a weaker sign, 0 = generic word. */
    private record Term(String label, int weight, Pattern pattern, String meaning) {}

    private static Term term(String label, int weight, String regex, String meaning) {
        return new Term(label, weight, Pattern.compile(regex, Pattern.CASE_INSENSITIVE), meaning);
    }

    /** In flow order. */
    private static final List<Term> TERMS = List.of(
            term("Question (query)", 0, "\\b(user\\s+)?(query|question)\\b", "The question the user asks. Everything starts here."),
            term("Knowledge base (documents)", 0, "knowledge\\s*base|data\\s*sources?|\\bcorpus\\b|\\bdocuments?\\b", "Your documents (PDFs, web pages, notes) that hold the facts."),
            term("Chunking", 2, "\\bchunk(s|ing|ed)?\\b|text\\s*splitt", "The documents are cut into small pieces called chunks."),
            term("Embedding", 2, "\\bembedd?ings?\\b|\\bencoder\\b", "Each chunk, and the question, is turned into a list of numbers that captures its meaning."),
            term("Vector database", 2, "vector\\s*(db|database|store|index|search)|pinecone|faiss|chroma|pgvector|weaviate|milvus|qdrant", "Stores those numbers and quickly finds the ones closest to the question."),
            term("Retriever (search)", 2, "\\bretriev(er|al|e|ed)\\b|semantic\\s*search|similarity", "Finds the chunks whose meaning is closest to the question."),
            term("Re-ranker", 2, "re-?rank", "Sorts the found chunks so the best ones come first."),
            term("Augmented prompt", 1, "\\baugment(ed|ation)?\\b|\\bcontext\\b|\\bprompt\\b", "The found chunks are added to the question to make a bigger prompt."),
            term("LLM (generator)", 1, "\\bllm\\b|large\\s+language\\s+model|\\bgenerator\\b|\\bgeneration\\b|\\bgpt\\b|gemini|claude|llama", "The AI model that writes the answer using the prompt."),
            term("Answer", 0, "\\banswers?\\b|\\bresponse\\b|\\boutput\\b", "The final answer shown to the user, ideally with its source."));

    private static final List<Section> SECTIONS = List.of(
            new Section("Definition", "what is RAG retrieval augmented generation definition meaning", 2,
                    new String[] {"RAG is a method where an AI first finds useful information from a knowledge base, adds it to the question, and then writes the answer."}),
            new Section("Key points", "key points steps how it works retrieve augment generate chunks embeddings vector database", 4,
                    new String[] {
                            "Retrieve: the system finds the most useful pieces of text for the question.",
                            "Augment: those pieces are added to the question.",
                            "Generate: the AI writes the answer using those pieces.",
                            "Documents are cut into small chunks and turned into numbers (embeddings). The numbers are stored in a vector database."}),
            new Section("Important note", "important note remember limitation caution warning not always", 2,
                    new String[] {"RAG does not retrain or change the AI model. It only gives the model extra reading material for each question.",
                            "RAG reduces mistakes, but it cannot remove all of them. Always check the source."}),
            new Section("Summary", "summary overview conclusion main idea overall", 3,
                    new String[] {"RAG means find first, then write. It makes AI answers more correct, fresh and easy to check."}),
            new Section("Advantages", "advantages benefits better accurate up to date fewer mistakes private data", 3,
                    new String[] {"Fewer made-up answers, because the AI reads real text first.",
                            "Works with fresh and private information (college notes, company rules).",
                            "You can check the source of the answer.",
                            "No need to retrain the model when information changes."}),
            new Section("Real-life examples", "real life example use case chatbot customer support hospital college company search", 3,
                    new String[] {"A college helpdesk chatbot that answers from the fee notice and the exam timetable.",
                            "A company bot that answers HR and policy questions from internal documents.",
                            "A customer support bot that reads the product manual before it replies.",
                            "Doctors and lawyers searching very long documents and getting a short answer with the source."}));

    private static final Pattern RAG_MENTION = Pattern.compile("\\brag\\b|retrieval[- ]augmented", Pattern.CASE_INSENSITIVE);
    private static final Pattern RAG_DEFINES = Pattern.compile("(\\brag\\b|retrieval[- ]augmented generation)[^.\\n]{0,40}\\b(is|are|means|stands for|refers to)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern EMAIL = Pattern.compile("[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+");
    private static final Pattern PHONE = Pattern.compile("\\+?\\d[\\d\\s-]{8,}\\d");
    private static final String[] RESUME_WORDS = {"experience", "education", "skills", "project", "internship", "certification",
            "achievement", "objective", "declaration", "references", "curriculum vitae", "resume", "cgpa", "linkedin", "github"};

    /** Section headings of a resume, in the order they are shown. */
    private static final Map<String, Pattern> HEADINGS = new LinkedHashMap<>();

    static {
        String[][] defs = {
                {"Summary", "professional summary|summary|profile|career objective|objective|about me"},
                {"Skills", "technical skills|key skills|core skills|skills|tech stack|technologies"},
                {"Experience", "work experience|professional experience|internships?|experience|employment history|employment"},
                {"Projects", "academic projects|personal projects|projects?"},
                {"Education", "education|academic qualifications?|academics"},
                {"Certifications", "certifications?|courses|licenses"},
                {"Achievements", "achievements?|awards?|accomplishments"}};
        // a heading alone on its line ("Skills"), or heading + colon + text on the same line ("Skills: Java, SQL")
        for (String[] d : defs) {
            HEADINGS.put(d[0], Pattern.compile("^(?:" + d[1] + ")\\s*(?:[:\\-\\u2013]\\s*(.*)|)$", Pattern.CASE_INSENSITIVE));
        }
    }

    /**
     * True when RAG is the topic of the text: it defines RAG, names it many times, or (a diagram with only labels)
     * shows enough RAG building blocks. One or two mentions, as in a resume or a job brief, are not enough.
     */
    public boolean isAboutRag(String text) {
        int mentions = 0;
        Matcher m = RAG_MENTION.matcher(text);
        while (m.find()) mentions++;
        int weight = 0;
        for (Term t : TERMS) if (t.pattern().matcher(text).find()) weight += t.weight();
        boolean labelsOnly = text.length() < 800;
        return RAG_DEFINES.matcher(text).find() || mentions >= 5 || (labelsOnly && weight >= 4) || (weight >= 6 && mentions >= 1);
    }

    /**
     * PDFs and OCR break one sentence over several lines. Join such lines back together, but keep headings,
     * bullets and blank lines on their own lines.
     */
    public String joinWrapped(String raw) {
        String[] lines = raw.split("\\R");
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < lines.length; i++) {
            String cur = lines[i].strip();
            out.append(cur);
            if (i + 1 >= lines.length) break;
            String next = lines[i + 1].strip();
            boolean join = !cur.isEmpty() && !next.isEmpty()
                    && !cur.matches(".*[.!?:;]$")
                    && !isHeading(next)
                    && (cur.length() >= 60 || next.matches("^[a-z0-9(].*"));
            out.append(join ? " " : "\n");
        }
        return out.toString();
    }

    private static boolean isHeading(String line) {
        for (Pattern p : HEADINGS.values()) if (p.matcher(line).matches()) return true;
        return line.length() <= 40 && line.equals(line.toUpperCase(Locale.ROOT)) && line.matches(".*\\p{L}.*");
    }

    /** A resume has several typical sections plus contact details. It must never be explained as RAG. */
    public boolean isResume(String text) {
        String l = text.toLowerCase(Locale.ROOT);
        int hits = 0;
        for (String w : RESUME_WORDS) if (l.contains(w)) hits++;
        boolean contact = EMAIL.matcher(text).find() || PHONE.matcher(text).find();
        return hits >= 4 || (hits >= 3 && contact);
    }

    /** The resume explained in simple words, section by section. Null if its sections cannot be found. */
    public String summarizeResume(String fileName, String text) {
        Map<String, List<String>> sections = new LinkedHashMap<>();
        List<String> header = new ArrayList<>();
        String current = null;
        for (String raw : text.split("\\R")) {
            String line = raw.strip();
            if (line.isEmpty()) continue;
            String matched = null;
            String rest = "";
            for (Map.Entry<String, Pattern> h : HEADINGS.entrySet()) {
                Matcher hm = h.getValue().matcher(line);
                if (hm.matches()) { // "Skills" alone, or "Skills: Java, SQL ..." with the text after it
                    matched = h.getKey();
                    rest = hm.group(1) == null ? "" : hm.group(1).strip();
                    break;
                }
            }
            if (matched != null) {
                current = matched;
                sections.computeIfAbsent(current, k -> new ArrayList<>());
                if (!rest.isEmpty()) sections.get(current).add(rest);
            } else if (current == null) {
                header.add(line);
            } else {
                sections.get(current).add(line);
            }
        }
        sections.values().removeIf(List::isEmpty);
        if (sections.size() < 2) return null;

        String name = null;
        if (!header.isEmpty()) {
            String first = header.get(0);
            if (first.split("\\s+").length <= 5 && !first.contains("@") && !first.matches(".*\\d.*") && !first.toLowerCase(Locale.ROOT).matches(".*(resume|curriculum|vitae).*")) {
                name = clean(first);
            }
        }
        List<String> skills = new ArrayList<>();
        for (String line : sections.getOrDefault("Skills", List.of())) {
            for (String s : line.split("[,;|\\u2022\\u00B7]")) {
                String t = s.strip();
                if (t.length() >= 2 && t.length() <= 30 && !skills.contains(t)) skills.add(t);
            }
        }
        String topSkills = skills.stream().limit(8).map(ExplainService::clean).collect(Collectors.joining(" · "));

        StringBuilder md = new StringBuilder();
        md.append("# Your resume in simple words\n\n");
        md.append("> From your resume **").append(clean(fileName)).append("**. Here is what it says, section by section.\n\n");
        md.append("## 1. Short info\n\n");
        md.append(name != null ? "This is the resume of **" + name + "**." : "This is a resume.")
                .append(" It has these parts: ").append(String.join(", ", sections.keySet())).append(".\n\n");
        if (!topSkills.isEmpty()) md.append("**Main skills:** ").append(topSkills).append("\n\n");
        int n = 2;
        for (String title : HEADINGS.keySet()) {
            List<String> lines = sections.get(title);
            if (lines == null) continue;
            md.append("## ").append(n++).append(". ").append(title).append("\n\n");
            for (String l : lines.stream().limit(8).collect(Collectors.toList())) md.append("- ").append(tidy(l)).append("\n");
            md.append("\n");
        }
        md.append("## ").append(n).append(". In one line\n\n");
        md.append(name != null ? name : "This person");
        md.append(topSkills.isEmpty() ? " has the sections listed above." : " works with " + topSkills + ".").append("\n");
        return md.toString();
    }

    /** RAG text with sentences (a RAG PDF, or a screenshot of RAG text). */
    public String explain(String fileName, String kind, String docId, String fullText, VectorStore store, int chunkCount) {
        StringBuilder md = new StringBuilder();
        md.append("# RAG in simple words\n\n");
        md.append("> From your ").append(kind).append(" **").append(clean(fileName)).append("**. Its text was cut into ").append(chunkCount)
                .append(" parts, turned into number codes (embeddings), saved in the vector database (").append(store.name())
                .append(") and matched with each question below.\n\n");
        intro(md);
        Set<String> used = new HashSet<>();
        int n = 2;
        for (Section s : SECTIONS) {
            List<String> found = pick(store, docId, s, used);
            md.append("## ").append(n++).append(". ").append(s.title()).append("\n\n");
            if (found.isEmpty()) {
                md.append("*Basic knowledge: your ").append(kind).append(" did not cover this part clearly.*\n\n");
                for (String f : s.fallback()) md.append("- ").append(f).append("\n");
            } else {
                md.append("*From your ").append(kind).append(":*\n\n");
                for (String f : found) md.append("- ").append(f).append("\n");
            }
            md.append("\n");
        }
        return md.toString();
    }

    /** A RAG diagram: the OCR text is only labels, so match them with the building blocks of RAG. */
    public String explainDiagram(String fileName, String text) {
        List<Term> found = TERMS.stream().filter(t -> t.pattern().matcher(text).find()).collect(Collectors.toList());
        StringBuilder md = new StringBuilder();
        md.append("# Your RAG image, explained in simple words\n\n");
        md.append("> From your image **").append(clean(fileName)).append("**. I read the text inside it (OCR) and matched it with the parts of RAG.\n\n");
        intro(md);
        md.append("## 2. What your image shows\n\n");
        md.append("*Text I could read:*\n\n> ").append(oneLine(text, 300)).append("\n\n");
        md.append("## 3. The parts I found (in flow order)\n\n");
        for (Term t : found) md.append("- **").append(t.label()).append("**: ").append(t.meaning()).append("\n");
        md.append("\n## 4. The flow in simple words\n\n");
        md.append(found.stream().map(Term::label).collect(Collectors.joining(" → "))).append("\n\n");
        md.append("The question comes in, the system finds the most useful text from the documents, adds it to the question, and the AI writes the answer from that text.\n\n");
        int n = 5;
        for (String title : new String[] {"Important note", "Advantages", "Real-life examples"}) {
            Section s = SECTIONS.stream().filter(x -> x.title().equals(title)).findFirst().orElseThrow();
            md.append("## ").append(n++).append(". ").append(title).append("\n\n*Basic knowledge about RAG.*\n\n");
            for (String f : s.fallback()) md.append("- ").append(f).append("\n");
            md.append("\n");
        }
        return md.toString();
    }

    /** The file is not about RAG: do not invent a RAG answer. Say so and summarise what the file really says. */
    public String summarize(String fileName, String kind, String text) {
        List<String> sentences = TextTools.sentences(text);
        List<String> picked = new ArrayList<>();
        if (sentences.size() >= 3) {
            List<float[]> vectors = new ArrayList<>();
            float[] centroid = new float[Embedder.DIM];
            for (String s : sentences) {
                float[] v = Embedder.embed(s);
                vectors.add(v);
                for (int i = 0; i < Embedder.DIM; i++) centroid[i] += v[i];
            }
            double norm = 0;
            for (float x : centroid) norm += x * x;
            norm = Math.sqrt(norm);
            if (norm > 0) for (int i = 0; i < Embedder.DIM; i++) centroid[i] /= (float) norm;
            Integer[] order = new Integer[sentences.size()];
            for (int i = 0; i < order.length; i++) order[i] = i;
            Arrays.sort(order, Comparator.comparingDouble((Integer i) -> Embedder.cosine(centroid, vectors.get(i))).reversed());
            List<Integer> top = new ArrayList<>(Arrays.asList(order).subList(0, Math.min(6, order.length)));
            Collections.sort(top); // keep the order of the file
            for (int i : top) picked.add(tidy(sentences.get(i)));
        } else {
            for (String line : text.split("\\R+")) {
                if (line.strip().length() >= 3 && picked.size() < 10) picked.add(tidy(line));
            }
        }

        Map<String, Integer> freq = new HashMap<>();
        Matcher m = WORD.matcher(text.toLowerCase(Locale.ROOT));
        while (m.find()) if (!COMMON.contains(m.group())) freq.merge(m.group(), 1, Integer::sum);
        String words = freq.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(8).map(Map.Entry::getKey).collect(Collectors.joining(" · "));

        StringBuilder md = new StringBuilder();
        md.append("# What your ").append(kind).append(" says\n\n");
        md.append("> **").append(clean(fileName)).append("** does not talk about RAG, so I did not force a RAG explanation. Here is a simple summary of what it really contains.\n\n");
        md.append("## Summary in simple words\n\n");
        for (String p : picked) md.append("- ").append(p).append("\n");
        if (!words.isEmpty()) md.append("\n## Main words\n\n").append(words).append("\n");
        md.append("\n## Want to learn RAG?\n\nUpload a PDF or a diagram about RAG, or type **Introduction to RAG** in the chat.\n");
        return md.toString();
    }

    public String noText(String fileName, String kind) {
        return "# I could not read any text\n\n> I could not find readable text in your " + kind + " **" + clean(fileName) + "**.\n\n"
                + "- Use a clearer or bigger picture, and keep the text straight.\n"
                + "- PNG or JPG works best.\n"
                + "- Upload a RAG PDF or diagram if you want a RAG explanation.\n";
    }

    private void intro(StringBuilder md) {
        md.append("## 1. RAG: full form and quick info\n\n");
        md.append("**Full form:** **RAG** = **R**etrieval-**A**ugmented **G**eneration\n\n");
        md.append("**Short info:** RAG means an AI first *looks up* the right information from your documents, then *writes* the answer using that information. So the answer is based on real facts, not guesses.\n\n");
        md.append("**Where it is used:** college helpdesk chatbots, company support bots, hospital and legal document search, and \"chat with your PDF\" apps.\n\n");
        md.append("**Example story:** Riya studies in a college. She asks the college chatbot, \"What is the last date to pay the exam fee?\" The chatbot first finds the fee notice (retrieval). It adds the notice to her question (augmentation). Then it writes a clear answer: \"The last date is 15 March.\" (generation). Without RAG, the AI could only guess.\n\n");
    }

    private List<String> pick(VectorStore store, String docId, Section section, Set<String> used) {
        float[] q = Embedder.embed(section.query());
        List<Scored> candidates = new ArrayList<>();
        for (VectorStore.Hit hit : store.search(docId, q, 4)) {
            for (String sentence : TextTools.sentences(hit.text())) {
                candidates.add(new Scored(tidy(sentence), Embedder.cosine(q, Embedder.embed(sentence))));
            }
        }
        candidates.sort(Comparator.comparingDouble(Scored::score).reversed());
        List<String> out = new ArrayList<>();
        for (Scored c : candidates) {
            if (out.size() >= section.max() || c.score() < MIN_SCORE) break;
            if (used.add(c.text().toLowerCase(Locale.ROOT))) out.add(c.text());
        }
        return out;
    }

    private static String oneLine(String s, int max) {
        String t = s.replaceAll("\\s+", " ").trim();
        return clean(t.length() > max ? t.substring(0, max - 3).trim() + "..." : t);
    }

    private static String tidy(String s) {
        String t = s.replaceAll("^[\\u2022\\u25CF\\-*\\d.)\\s]+", "").trim();
        return clean(t.length() > 220 ? t.substring(0, 217).trim() + "..." : t);
    }

    private static String clean(String s) {
        return s == null ? "file" : s.replaceAll("[*_`<>\\[\\]]", "");
    }
}
