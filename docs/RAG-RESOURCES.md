# RAG resources: info, examples and YouTube videos

This is the written copy of the RAG library that the chat uses (`frontend/js/rag-kb.js`). In the chat, ask for
"RAG in Marathi", "RAG in Hindi", "Best RAG examples", "RAG YouTube videos", "hindi videos" and so on.

- Video details (title, channel, length and spoken language) were checked on 2026-11-08.
- Facts come from [NVIDIA blog](https://blogs.nvidia.com/blog/what-is-retrieval-augmented-generation/) and [AWS](https://aws.amazon.com/what-is/retrieval-augmented-generation/).
- To add a video, add one line to `VIDEOS` in `frontend/js/rag-kb.js`, then run `node docs/make-rag-resources.js`.

## YouTube videos

### English

- [What is Retrieval-Augmented Generation (RAG)?](https://www.youtube.com/watch?v=T-D1OfcDW1M) — IBM Technology · 7 min · Good first video
- [RAG Explained | All about RAG - Retrieval Augmented Generation](https://www.youtube.com/watch?v=dDkynerzV-Q) — codebasics · 15 min · Good first video
- [What Is RAG? Retrieval-Augmented Generation Explained Simply](https://www.youtube.com/watch?v=xPMQ2cVbUTI) — Redis · 17 min · Good first video
- [Introduction To Understanding RAG (Retrieval-Augmented Generation)](https://www.youtube.com/watch?v=fZM3oX4xEyg) — Krish Naik · 21 min · Good first video
- [Complete RAG Crash Course With Langchain In 2 Hours](https://www.youtube.com/watch?v=o126p1QN_RI) — Krish Naik · 2 h 8 min · Hands-on course
- [Learn RAG From Scratch – Python AI Tutorial from a LangChain Engineer](https://www.youtube.com/watch?v=sVcwVQRHIc8) — freeCodeCamp.org · 2 h 33 min · Hands-on course

### Hindi (हिंदी)

- [What is RAG ? | Completely Explained in 15 Minutes](https://www.youtube.com/watch?v=Ty8gcCKuwNI) — Apna College · 17 min · Good first video
- [LLMs — How ChatGPT works & What is RAG? | Retrieval-Augmented Generation Explained](https://www.youtube.com/watch?v=hYZKrPOyEYk) — CodeWithHarry · 15 min · Good first video
- [RAG क्या है? AI hallucination ka solution? | RAG Explained](https://www.youtube.com/watch?v=_0i9Q5R23u4) — Analytics India Guru | AIM Network · 5 min · Quick intro
- [RAG Explained in 5 Minutes | Retrieval Augmented Generation Explained in Hindi](https://www.youtube.com/watch?v=JK-z9Lptx60) — 5 Minutes Engineering · 5 min · Quick intro
- [Introduction to RAG (Retrieval Augmented Generation) | Deep Learning](https://www.youtube.com/watch?v=cXcgyzuljyY) — Gate Smashers · 9 min · Good first video
- [7-Introduction To RAG (Retrieval-Augmented Generation?) In Hindi](https://www.youtube.com/watch?v=DKg6XUnclm8) — Krish Naik Hindi · 23 min · Good first video
- [RAG क्या है? Retrieval Augmented Generation को आसान भाषा में समझिए | Generative AI](https://www.youtube.com/watch?v=VgL5ux2bs9Q) — Pankaj Shukla · 36 min · In depth
- [Retrieval Augmented Generation | What is RAG | How does RAG Work | RAG Explained](https://www.youtube.com/watch?v=X0btK9X0Xnk) — CampusX · 59 min · In depth
- [RAG Crash Course | Explained with Detailed Practical Implementation in Hindi](https://www.youtube.com/watch?v=Q8ZdeUpXp1I) — 5 Minutes Engineering · 56 min · Hands-on course
- [Retrieval Augmented Generation (RAG) LangGraph Crash Course In Hindi](https://www.youtube.com/watch?v=kcGQlZw1b6Q) — Krish Naik Hindi · 2 h 3 min · Hands-on course

### Marathi (मराठी)

- [What is RAG? | RAG Explained in Marathi in 7 Minutes](https://www.youtube.com/watch?v=eFquATXNADM) — Tech IT Easy With Akash · 7 min · Quick intro
- [RAG म्हणजे काय? | Retrieval-Augmented Generation | Prompt Engineering for Developers Ep 10](https://www.youtube.com/watch?v=AWTs_8jc7Q0) — My Digital Diaries - मराठी · 15 min · Good first video

---

## English: RAG in simple words

**Full form:** RAG = Retrieval-Augmented Generation

**Short info:** RAG means an AI first looks up the right information from your documents (or the web), and then writes the answer using that information. So the answer is based on real facts, not guesses.

**Think of it like this:** An open-book exam. You do not have to remember everything. You find the right page, then you write a clear answer.

### How RAG works, step by step

1. **Prepare the data.** Documents (PDFs, web pages, policies) are cut into small chunks. Each chunk is turned into a list of numbers (an embedding) and stored in a vector database.
2. **The user asks a question.** The question is also turned into numbers.
3. **Retrieve.** The system finds the chunks whose numbers are closest to the question.
4. **Augment.** Those chunks are added to the question to make a bigger prompt.
5. **Generate.** The LLM writes the answer from that prompt, and it can show its sources.
6. **Keep the data fresh.** When a document changes, its chunks and numbers are updated.

### Advantages

- Fewer made-up answers (hallucinations), because the AI reads real text first.
- Works with fresh and private information (college notes, company rules) without training the model again.
- You can check the source: the answer can say where it came from.
- Cheaper and faster than training the model again on new data.
- You stay in control: change or remove sources whenever you want.

### Important note

- RAG does not retrain or change the AI model. It only gives the model extra reading material for each question.
- RAG reduces mistakes, but it cannot remove all of them. If the documents are wrong, or the search finds the wrong chunk, the answer can still be wrong. Always check the source.

> **Fun fact:** The name RAG comes from a 2020 research paper led by Patrick Lewis. He later apologized for the “unflattering acronym” and said they would have put more thought into the name had they known the work would become so widespread.

### Best real-life examples of RAG

- **College helpdesk bot**: Answers from the fee notice and the exam timetable: “What is the last date to pay the exam fee?”
- **Customer support bot**: Answers from product manuals, FAQs and past tickets, so the reply matches the company’s real rules.
- **HR helpdesk**: An employee asks “How much annual leave do I have?”. The system finds the leave policy and that employee’s own leave record, then writes the answer.
- **Company knowledge search**: One chat box over wikis, policy manuals, shared drives and reports, instead of ten different tools.
- **Medical assistant for doctors and nurses**: An AI linked to a medical index can fetch the right guideline or research before it answers. The final decision always stays with the doctor.
- **Finance analyst assistant**: An assistant linked to market data and reports, so the answers use the latest numbers.
- **Legal and compliance search**: Finds the related cases, rules or contract clauses and summarizes them, with the source.
- **Chat with your own files**: Link an AI to your PDFs, notes or emails and ask questions. The data can stay private on your own computer.
- **Developer help and training**: Manuals, logs and code documents become a knowledge base for developers and for training new employees.
- **AI search with sources**: Perplexity searches the web and then writes an answer with numbered sources. Google’s NotebookLM answers from the documents you upload and shows citations.

Companies such as AWS, IBM, Glean, Google, Microsoft, NVIDIA, Oracle and Pinecone offer RAG tools and services.

---

## हिंदी: RAG आसान भाषा में

**पूरा नाम:** RAG = Retrieval-Augmented Generation

**छोटी जानकारी:** RAG का मतलब है कि AI पहले आपके दस्तावेज़ों (या इंटरनेट) से सही जानकारी ढूँढता है, फिर उसी जानकारी के आधार पर जवाब लिखता है। इसलिए जवाब असली तथ्यों पर टिका होता है, अंदाज़े पर नहीं।

**ऐसे समझिए:** ओपन-बुक परीक्षा की तरह। सब कुछ याद रखने की ज़रूरत नहीं है। बस सही पन्ना ढूँढिए और साफ़ जवाब लिखिए।

### RAG कैसे काम करता है, कदम दर कदम

1. **डेटा तैयार करें।** PDF, वेब पेज, पॉलिसी जैसे दस्तावेज़ों को छोटे टुकड़ों (chunks) में काटा जाता है। हर टुकड़े को संख्याओं की सूची (embedding) में बदलकर vector database में रखा जाता है।
2. **यूज़र सवाल पूछता है।** सवाल को भी संख्याओं में बदला जाता है।
3. **Retrieve (खोज)।** सिस्टम वे टुकड़े ढूँढता है जिनकी संख्याएँ सवाल से सबसे ज़्यादा मिलती हैं।
4. **Augment (जोड़ना)।** वे टुकड़े सवाल के साथ जोड़कर एक बड़ा prompt बनाया जाता है।
5. **Generate (जवाब)।** LLM उस prompt से जवाब लिखता है, और चाहे तो स्रोत (source) भी दिखाता है।
6. **डेटा ताज़ा रखें।** दस्तावेज़ बदलें तो उनके टुकड़े और संख्याएँ भी अपडेट की जाती हैं।

### फ़ायदे

- झूठे या मनगढ़ंत जवाब (hallucination) कम होते हैं, क्योंकि AI पहले असली text पढ़ता है।
- नई और निजी जानकारी (कॉलेज के नोट्स, कंपनी के नियम) पर काम करता है, model को दोबारा train किए बिना।
- आप स्रोत जाँच सकते हैं: जवाब बता सकता है कि जानकारी कहाँ से आई।
- नए डेटा पर model को दोबारा train करने से सस्ता और तेज़ है।
- कंट्रोल आपके हाथ में रहता है: स्रोत कभी भी बदलें या हटाएँ।

### ज़रूरी बात

- RAG AI model को दोबारा train नहीं करता और उसे बदलता भी नहीं। वह सिर्फ़ हर सवाल के लिए अतिरिक्त पढ़ने की सामग्री देता है।
- RAG ग़लतियाँ कम करता है, पर पूरी तरह ख़त्म नहीं करता। दस्तावेज़ ग़लत हों या search ग़लत टुकड़ा ढूँढे, तो जवाब ग़लत हो सकता है। हमेशा स्रोत जाँचें।

> **रोचक बात:** RAG नाम 2020 के एक शोध-पत्र से आया, जिसके मुख्य लेखक Patrick Lewis थे। उन्होंने बाद में इस “अटपटे संक्षिप्त नाम” (acronym) के लिए माफ़ी माँगी और कहा कि अगर पता होता कि काम इतना फैलेगा, तो नाम पर और सोचते।

### RAG के सबसे अच्छे असली उदाहरण

- **कॉलेज हेल्पडेस्क बॉट**: फीस नोटिस और परीक्षा टाइमटेबल से जवाब देता है: “परीक्षा फीस की आख़िरी तारीख़ क्या है?”
- **कस्टमर सपोर्ट बॉट**: प्रोडक्ट मैनुअल, FAQ और पुराने टिकट से जवाब देता है, इसलिए जवाब कंपनी के असली नियमों से मेल खाता है।
- **HR हेल्पडेस्क**: कर्मचारी पूछता है “मेरी कितनी छुट्टियाँ बची हैं?”। सिस्टम छुट्टी की पॉलिसी और उस कर्मचारी का अपना रिकॉर्ड ढूँढकर जवाब लिखता है।
- **कंपनी की जानकारी की खोज**: wiki, पॉलिसी मैनुअल, शेयर्ड ड्राइव और रिपोर्ट पर एक ही चैट बॉक्स से सवाल पूछिए, दस अलग-अलग टूल की जगह।
- **डॉक्टर और नर्स के लिए मेडिकल असिस्टेंट**: मेडिकल इंडेक्स से जुड़ा AI जवाब देने से पहले सही गाइडलाइन या रिसर्च ढूँढ सकता है। अंतिम फ़ैसला हमेशा डॉक्टर का ही रहता है।
- **फ़ाइनेंस एनालिस्ट असिस्टेंट**: मार्केट डेटा और रिपोर्ट से जुड़ा असिस्टेंट, ताकि जवाब में ताज़ा आँकड़े हों।
- **लीगल और कंप्लायंस सर्च**: संबंधित केस, नियम या कॉन्ट्रैक्ट की धाराएँ ढूँढकर स्रोत के साथ सार बताता है।
- **अपनी फ़ाइलों से चैट**: PDF, नोट्स या ईमेल से AI को जोड़कर सवाल पूछिए। डेटा आपके अपने कंप्यूटर पर निजी रह सकता है।
- **डेवलपर की मदद और ट्रेनिंग**: मैनुअल, लॉग और कोड के दस्तावेज़ डेवलपर और नए कर्मचारियों के लिए knowledge base बन जाते हैं।
- **स्रोत के साथ AI सर्च**: Perplexity वेब पर खोजकर नंबर वाले स्रोतों के साथ जवाब लिखता है। Google का NotebookLM आपके अपलोड किए दस्तावेज़ों से जवाब देता है और संदर्भ (citations) दिखाता है।

AWS, IBM, Glean, Google, Microsoft, NVIDIA, Oracle और Pinecone जैसी कंपनियाँ RAG के टूल और सेवाएँ देती हैं।

---

## मराठी: RAG सोप्या भाषेत

**पूर्ण रूप:** RAG = Retrieval-Augmented Generation

**थोडक्यात माहिती:** RAG म्हणजे AI आधी तुमच्या कागदपत्रांतून (किंवा इंटरनेटवरून) योग्य माहिती शोधतो, आणि मग त्याच माहितीच्या आधारे उत्तर लिहितो. त्यामुळे उत्तर खऱ्या तथ्यांवर आधारित असते, अंदाजावर नाही.

**असे समजा:** ओपन-बुक परीक्षेसारखे. सगळे लक्षात ठेवायची गरज नाही. फक्त योग्य पान शोधा आणि स्पष्ट उत्तर लिहा.

### RAG कसे काम करते, पायरी पायरीने

1. **डेटा तयार करा.** PDF, वेब पेज, पॉलिसी अशा कागदपत्रांचे लहान तुकडे (chunks) केले जातात. प्रत्येक तुकड्याला संख्यांच्या यादीत (embedding) बदलून vector database मध्ये ठेवतात.
2. **वापरकर्ता प्रश्न विचारतो.** प्रश्नालाही संख्यांमध्ये बदलले जाते.
3. **Retrieve (शोध).** प्रश्नाशी सर्वात जास्त जुळणाऱ्या संख्यांचे तुकडे शोधले जातात.
4. **Augment (जोडणे).** ते तुकडे प्रश्नाला जोडून मोठा prompt बनवला जातो.
5. **Generate (उत्तर).** LLM त्या prompt वरून उत्तर लिहितो आणि हवे असल्यास स्रोत (source) दाखवतो.
6. **डेटा ताजा ठेवा.** कागदपत्रे बदलली की त्यांचे तुकडे आणि संख्याही अपडेट केल्या जातात.

### फायदे

- खोटी किंवा मनाने रचलेली उत्तरे (hallucination) कमी होतात, कारण AI आधी खरा मजकूर वाचतो.
- नवीन आणि खाजगी माहितीवर (कॉलेजच्या नोट्स, कंपनीचे नियम) काम करते, model ला पुन्हा train न करता.
- स्रोत तपासता येतो: उत्तर कुठून आले ते सांगता येते.
- नवीन डेटावर model ला पुन्हा train करण्यापेक्षा स्वस्त आणि वेगवान.
- नियंत्रण तुमच्या हातात: स्रोत कधीही बदला किंवा काढा.

### महत्त्वाची सूचना

- RAG AI model ला पुन्हा train करत नाही आणि बदलतही नाही. तो फक्त प्रत्येक प्रश्नासाठी अतिरिक्त वाचनसामग्री देतो.
- RAG चुका कमी करतो, पण पूर्णपणे संपवत नाही. कागदपत्रे चुकीची असतील किंवा search ने चुकीचा तुकडा शोधला, तर उत्तर चुकू शकते. नेहमी स्रोत तपासा.

> **रंजक गोष्ट:** RAG हे नाव 2020 मधील एका संशोधन-पेपरमधून आले; त्याचे मुख्य लेखक Patrick Lewis होते. नंतर त्यांनी या “विचित्र संक्षिप्त नावाबद्दल” (acronym) दिलगिरी व्यक्त केली आणि सांगितले की काम इतके पसरेल हे माहीत असते तर नावावर अधिक विचार केला असता.

### RAG ची सर्वोत्तम खरी उदाहरणे

- **कॉलेज हेल्पडेस्क बॉट**: फी नोटीस आणि परीक्षा वेळापत्रकावरून उत्तर देतो: “परीक्षा फी भरण्याची शेवटची तारीख कोणती?”
- **कस्टमर सपोर्ट बॉट**: प्रॉडक्ट मॅन्युअल, FAQ आणि जुन्या तिकिटांवरून उत्तर देतो, त्यामुळे उत्तर कंपनीच्या खऱ्या नियमांशी जुळते.
- **HR हेल्पडेस्क**: कर्मचारी विचारतो “माझ्या किती रजा शिल्लक आहेत?”. सिस्टम रजा-धोरण आणि त्या कर्मचाऱ्याची स्वतःची नोंद शोधून उत्तर लिहिते.
- **कंपनीतील माहितीचा शोध**: wiki, पॉलिसी मॅन्युअल, शेअर्ड ड्राइव्ह आणि अहवाल यांवर एकाच चॅट बॉक्समधून प्रश्न विचारा, दहा वेगवेगळ्या टूलऐवजी.
- **डॉक्टर आणि नर्ससाठी वैद्यकीय सहाय्यक**: मेडिकल इंडेक्सशी जोडलेला AI उत्तर देण्यापूर्वी योग्य मार्गदर्शक तत्त्वे किंवा संशोधन शोधू शकतो. अंतिम निर्णय नेहमी डॉक्टरांचाच असतो.
- **फायनान्स विश्लेषकासाठी सहाय्यक**: मार्केट डेटा आणि अहवालांशी जोडलेला सहाय्यक, म्हणजे उत्तरात ताजे आकडे येतात.
- **कायदेशीर आणि कंप्लायन्स शोध**: संबंधित खटले, नियम किंवा करारातील कलमे शोधून स्रोतासह सारांश देतो.
- **स्वतःच्या फाईल्सशी चॅट**: PDF, नोट्स किंवा ईमेलशी AI जोडून प्रश्न विचारा. डेटा तुमच्या स्वतःच्या कॉम्प्युटरवर खाजगी राहू शकतो.
- **डेव्हलपरला मदत आणि प्रशिक्षण**: मॅन्युअल, लॉग आणि कोडचे दस्तऐवज डेव्हलपर आणि नवीन कर्मचाऱ्यांसाठी knowledge base बनतात.
- **स्रोतांसह AI शोध**: Perplexity वेबवर शोधून क्रमांकित स्रोतांसह उत्तर लिहितो. Google चा NotebookLM तुम्ही अपलोड केलेल्या कागदपत्रांवरून उत्तर देतो आणि संदर्भ (citations) दाखवतो.

AWS, IBM, Glean, Google, Microsoft, NVIDIA, Oracle आणि Pinecone अशा कंपन्या RAG चे टूल आणि सेवा देतात.
