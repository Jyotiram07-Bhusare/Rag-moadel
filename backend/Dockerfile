# Build and run the Java backend (used by Render)
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:17-jre-noble
# Tesseract OCR (English, Marathi, Hindi) for reading images and scanned PDFs
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-eng tesseract-ocr-mar tesseract-ocr-hin libtesseract-dev \
 && rm -rf /var/lib/apt/lists/*
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata
ENV OCR_LANG=eng+mar+hin
# Render's free plan has 512 MB: let Java use about 60% for its heap and leave the rest for Tesseract
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60"
WORKDIR /app
COPY --from=build /app/target/lessonloop-backend.jar app.jar
ENV PORT=8000
EXPOSE 8000
CMD ["java", "-jar", "app.jar"]
