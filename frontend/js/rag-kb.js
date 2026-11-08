/* ------------------------------------------------------------------
   rag-kb.js — the RAG library: simple explanations, real-life examples and YouTube videos
   about RAG, in English, Hindi and Marathi. The chat answers from here when someone asks for
   RAG info, examples or videos ("RAG in Marathi", "RAG examples in Hindi", "RAG YouTube videos").
   Everything is stored in this file: no server and no network call. Links open YouTube.

   To add a video: add one line to VIDEOS. The id is the text after "v=" in the YouTube link.
   Facts come from NVIDIA's "What Is Retrieval-Augmented Generation" blog and AWS's "What is RAG"
   page (see SOURCES). The videos were checked on 2026-11-08: title, channel, length and spoken language.
------------------------------------------------------------------- */
(function (LL) {
  'use strict';

  const CHECKED = '2026-11-08';

  const SOURCES = [
    { name: 'NVIDIA blog', url: 'https://blogs.nvidia.com/blog/what-is-retrieval-augmented-generation/' },
    { name: 'AWS', url: 'https://aws.amazon.com/what-is/retrieval-augmented-generation/' },
  ];

  /* kind: start = good first video, short = about 5 minutes, deep = longer explanation, course = hands-on coding */
  const VIDEOS = [
    // English
    { id: 'T-D1OfcDW1M', lang: 'en', kind: 'start', min: 7, channel: 'IBM Technology', title: 'What is Retrieval-Augmented Generation (RAG)?' },
    { id: 'dDkynerzV-Q', lang: 'en', kind: 'start', min: 15, channel: 'codebasics', title: 'RAG Explained | All about RAG - Retrieval Augmented Generation' },
    { id: 'xPMQ2cVbUTI', lang: 'en', kind: 'start', min: 17, channel: 'Redis', title: 'What Is RAG? Retrieval-Augmented Generation Explained Simply' },
    { id: 'fZM3oX4xEyg', lang: 'en', kind: 'start', min: 21, channel: 'Krish Naik', title: 'Introduction To Understanding RAG (Retrieval-Augmented Generation)' },
    { id: 'o126p1QN_RI', lang: 'en', kind: 'course', min: 128, channel: 'Krish Naik', title: 'Complete RAG Crash Course With Langchain In 2 Hours' },
    { id: 'sVcwVQRHIc8', lang: 'en', kind: 'course', min: 153, channel: 'freeCodeCamp.org', title: 'Learn RAG From Scratch – Python AI Tutorial from a LangChain Engineer' },
    // Hindi
    { id: 'Ty8gcCKuwNI', lang: 'hi', kind: 'start', min: 17, channel: 'Apna College', title: 'What is RAG ? | Completely Explained in 15 Minutes' },
    { id: 'hYZKrPOyEYk', lang: 'hi', kind: 'start', min: 15, channel: 'CodeWithHarry', title: 'LLMs — How ChatGPT works & What is RAG? | Retrieval-Augmented Generation Explained' },
    { id: '_0i9Q5R23u4', lang: 'hi', kind: 'short', min: 5, channel: 'Analytics India Guru | AIM Network', title: 'RAG क्या है? AI hallucination ka solution? | RAG Explained' },
    { id: 'JK-z9Lptx60', lang: 'hi', kind: 'short', min: 5, channel: '5 Minutes Engineering', title: 'RAG Explained in 5 Minutes | Retrieval Augmented Generation Explained in Hindi' },
    { id: 'cXcgyzuljyY', lang: 'hi', kind: 'start', min: 9, channel: 'Gate Smashers', title: 'Introduction to RAG (Retrieval Augmented Generation) | Deep Learning' },
    { id: 'DKg6XUnclm8', lang: 'hi', kind: 'start', min: 23, channel: 'Krish Naik Hindi', title: '7-Introduction To RAG (Retrieval-Augmented Generation?) In Hindi' },
    { id: 'VgL5ux2bs9Q', lang: 'hi', kind: 'deep', min: 36, channel: 'Pankaj Shukla', title: 'RAG क्या है? Retrieval Augmented Generation को आसान भाषा में समझिए | Generative AI' },
    { id: 'X0btK9X0Xnk', lang: 'hi', kind: 'deep', min: 59, channel: 'CampusX', title: 'Retrieval Augmented Generation | What is RAG | How does RAG Work | RAG Explained' },
    { id: 'Q8ZdeUpXp1I', lang: 'hi', kind: 'course', min: 56, channel: '5 Minutes Engineering', title: 'RAG Crash Course | Explained with Detailed Practical Implementation in Hindi' },
    { id: 'kcGQlZw1b6Q', lang: 'hi', kind: 'course', min: 123, channel: 'Krish Naik Hindi', title: 'Retrieval Augmented Generation (RAG) LangGraph Crash Course In Hindi' },
    // Marathi
    { id: 'eFquATXNADM', lang: 'mr', kind: 'short', min: 7, channel: 'Tech IT Easy With Akash', title: 'What is RAG? | RAG Explained in Marathi in 7 Minutes' },
    { id: 'AWTs_8jc7Q0', lang: 'mr', kind: 'start', min: 15, channel: 'My Digital Diaries - मराठी', title: 'RAG म्हणजे काय? | Retrieval-Augmented Generation | Prompt Engineering for Developers Ep 10' },
  ];

  /* ---------- the words, per language ---------- */
  const T = {
    en: {
      name: 'English',
      infoTitle: 'RAG in simple words',
      fullLabel: 'Full form',
      shortLabel: 'Short info',
      shortText: 'RAG means an AI first *looks up* the right information from your documents (or the web), and then *writes* the answer using that information. So the answer is based on real facts, not guesses.',
      thinkLabel: 'Think of it like this',
      thinkText: 'An open-book exam. You do not have to remember everything. You find the right page, then you write a clear answer.',
      howTitle: 'How RAG works, step by step',
      how: [
        '**Prepare the data.** Documents (PDFs, web pages, policies) are cut into small chunks. Each chunk is turned into a list of numbers (an embedding) and stored in a vector database.',
        '**The user asks a question.** The question is also turned into numbers.',
        '**Retrieve.** The system finds the chunks whose numbers are closest to the question.',
        '**Augment.** Those chunks are added to the question to make a bigger prompt.',
        '**Generate.** The LLM writes the answer from that prompt, and it can show its sources.',
        '**Keep the data fresh.** When a document changes, its chunks and numbers are updated.',
      ],
      advTitle: 'Advantages',
      adv: [
        'Fewer made-up answers (hallucinations), because the AI reads real text first.',
        'Works with fresh and private information (college notes, company rules) without training the model again.',
        'You can check the source: the answer can say where it came from.',
        'Cheaper and faster than training the model again on new data.',
        'You stay in control: change or remove sources whenever you want.',
      ],
      noteTitle: 'Important note',
      note: [
        'RAG does not retrain or change the AI model. It only gives the model extra reading material for each question.',
        'RAG reduces mistakes, but it cannot remove all of them. If the documents are wrong, or the search finds the wrong chunk, the answer can still be wrong. Always check the source.',
      ],
      funLabel: 'Fun fact',
      funText: 'The name RAG comes from a 2020 research paper led by Patrick Lewis. He later apologized for the “unflattering acronym” and said they would have put more thought into the name had they known the work would become so widespread.',
      exTitle: 'Best real-life examples of RAG',
      ex: [
        ['College helpdesk bot', 'Answers from the fee notice and the exam timetable: “What is the last date to pay the exam fee?”'],
        ['Customer support bot', 'Answers from product manuals, FAQs and past tickets, so the reply matches the company’s real rules.'],
        ['HR helpdesk', 'An employee asks “How much annual leave do I have?”. The system finds the leave policy and that employee’s own leave record, then writes the answer.'],
        ['Company knowledge search', 'One chat box over wikis, policy manuals, shared drives and reports, instead of ten different tools.'],
        ['Medical assistant for doctors and nurses', 'An AI linked to a medical index can fetch the right guideline or research before it answers. The final decision always stays with the doctor.'],
        ['Finance analyst assistant', 'An assistant linked to market data and reports, so the answers use the latest numbers.'],
        ['Legal and compliance search', 'Finds the related cases, rules or contract clauses and summarizes them, with the source.'],
        ['Chat with your own files', 'Link an AI to your PDFs, notes or emails and ask questions. The data can stay private on your own computer.'],
        ['Developer help and training', 'Manuals, logs and code documents become a knowledge base for developers and for training new employees.'],
        ['AI search with sources', 'Perplexity searches the web and then writes an answer with numbered sources. Google’s NotebookLM answers from the documents you upload and shows citations.'],
      ],
      companies: 'Companies such as AWS, IBM, Glean, Google, Microsoft, NVIDIA, Oracle and Pinecone offer RAG tools and services.',
      vidTitle: 'YouTube videos to learn RAG',
      vidLang: { en: 'English videos', hi: 'Hindi videos', mr: 'Marathi videos' },
      vidChecked: 'These links were checked on 8 November 2026 (title, channel, length and spoken language).',
      vidMore: 'Want more? Ask for “Hindi videos”, “English videos” or “Marathi videos” to see the full list.',
      kinds: { start: 'Good first video', short: 'Quick intro', deep: 'In depth', course: 'Hands-on course' },
      min: 'min', hr: 'h',
      srcLabel: 'Sources',
      chips: ['RAG in Marathi', 'RAG in Hindi', 'Best RAG examples', 'RAG YouTube videos'],
    },

    hi: {
      name: 'हिंदी',
      infoTitle: 'RAG आसान भाषा में',
      fullLabel: 'पूरा नाम',
      shortLabel: 'छोटी जानकारी',
      shortText: 'RAG का मतलब है कि AI पहले आपके दस्तावेज़ों (या इंटरनेट) से सही जानकारी *ढूँढता* है, फिर उसी जानकारी के आधार पर जवाब *लिखता* है। इसलिए जवाब असली तथ्यों पर टिका होता है, अंदाज़े पर नहीं।',
      thinkLabel: 'ऐसे समझिए',
      thinkText: 'ओपन-बुक परीक्षा की तरह। सब कुछ याद रखने की ज़रूरत नहीं है। बस सही पन्ना ढूँढिए और साफ़ जवाब लिखिए।',
      howTitle: 'RAG कैसे काम करता है, कदम दर कदम',
      how: [
        '**डेटा तैयार करें।** PDF, वेब पेज, पॉलिसी जैसे दस्तावेज़ों को छोटे टुकड़ों (chunks) में काटा जाता है। हर टुकड़े को संख्याओं की सूची (embedding) में बदलकर vector database में रखा जाता है।',
        '**यूज़र सवाल पूछता है।** सवाल को भी संख्याओं में बदला जाता है।',
        '**Retrieve (खोज)।** सिस्टम वे टुकड़े ढूँढता है जिनकी संख्याएँ सवाल से सबसे ज़्यादा मिलती हैं।',
        '**Augment (जोड़ना)।** वे टुकड़े सवाल के साथ जोड़कर एक बड़ा prompt बनाया जाता है।',
        '**Generate (जवाब)।** LLM उस prompt से जवाब लिखता है, और चाहे तो स्रोत (source) भी दिखाता है।',
        '**डेटा ताज़ा रखें।** दस्तावेज़ बदलें तो उनके टुकड़े और संख्याएँ भी अपडेट की जाती हैं।',
      ],
      advTitle: 'फ़ायदे',
      adv: [
        'झूठे या मनगढ़ंत जवाब (hallucination) कम होते हैं, क्योंकि AI पहले असली text पढ़ता है।',
        'नई और निजी जानकारी (कॉलेज के नोट्स, कंपनी के नियम) पर काम करता है, model को दोबारा train किए बिना।',
        'आप स्रोत जाँच सकते हैं: जवाब बता सकता है कि जानकारी कहाँ से आई।',
        'नए डेटा पर model को दोबारा train करने से सस्ता और तेज़ है।',
        'कंट्रोल आपके हाथ में रहता है: स्रोत कभी भी बदलें या हटाएँ।',
      ],
      noteTitle: 'ज़रूरी बात',
      note: [
        'RAG AI model को दोबारा train नहीं करता और उसे बदलता भी नहीं। वह सिर्फ़ हर सवाल के लिए अतिरिक्त पढ़ने की सामग्री देता है।',
        'RAG ग़लतियाँ कम करता है, पर पूरी तरह ख़त्म नहीं करता। दस्तावेज़ ग़लत हों या search ग़लत टुकड़ा ढूँढे, तो जवाब ग़लत हो सकता है। हमेशा स्रोत जाँचें।',
      ],
      funLabel: 'रोचक बात',
      funText: 'RAG नाम 2020 के एक शोध-पत्र से आया, जिसके मुख्य लेखक Patrick Lewis थे। उन्होंने बाद में इस “अटपटे संक्षिप्त नाम” (acronym) के लिए माफ़ी माँगी और कहा कि अगर पता होता कि काम इतना फैलेगा, तो नाम पर और सोचते।',
      exTitle: 'RAG के सबसे अच्छे असली उदाहरण',
      ex: [
        ['कॉलेज हेल्पडेस्क बॉट', 'फीस नोटिस और परीक्षा टाइमटेबल से जवाब देता है: “परीक्षा फीस की आख़िरी तारीख़ क्या है?”'],
        ['कस्टमर सपोर्ट बॉट', 'प्रोडक्ट मैनुअल, FAQ और पुराने टिकट से जवाब देता है, इसलिए जवाब कंपनी के असली नियमों से मेल खाता है।'],
        ['HR हेल्पडेस्क', 'कर्मचारी पूछता है “मेरी कितनी छुट्टियाँ बची हैं?”। सिस्टम छुट्टी की पॉलिसी और उस कर्मचारी का अपना रिकॉर्ड ढूँढकर जवाब लिखता है।'],
        ['कंपनी की जानकारी की खोज', 'wiki, पॉलिसी मैनुअल, शेयर्ड ड्राइव और रिपोर्ट पर एक ही चैट बॉक्स से सवाल पूछिए, दस अलग-अलग टूल की जगह।'],
        ['डॉक्टर और नर्स के लिए मेडिकल असिस्टेंट', 'मेडिकल इंडेक्स से जुड़ा AI जवाब देने से पहले सही गाइडलाइन या रिसर्च ढूँढ सकता है। अंतिम फ़ैसला हमेशा डॉक्टर का ही रहता है।'],
        ['फ़ाइनेंस एनालिस्ट असिस्टेंट', 'मार्केट डेटा और रिपोर्ट से जुड़ा असिस्टेंट, ताकि जवाब में ताज़ा आँकड़े हों।'],
        ['लीगल और कंप्लायंस सर्च', 'संबंधित केस, नियम या कॉन्ट्रैक्ट की धाराएँ ढूँढकर स्रोत के साथ सार बताता है।'],
        ['अपनी फ़ाइलों से चैट', 'PDF, नोट्स या ईमेल से AI को जोड़कर सवाल पूछिए। डेटा आपके अपने कंप्यूटर पर निजी रह सकता है।'],
        ['डेवलपर की मदद और ट्रेनिंग', 'मैनुअल, लॉग और कोड के दस्तावेज़ डेवलपर और नए कर्मचारियों के लिए knowledge base बन जाते हैं।'],
        ['स्रोत के साथ AI सर्च', 'Perplexity वेब पर खोजकर नंबर वाले स्रोतों के साथ जवाब लिखता है। Google का NotebookLM आपके अपलोड किए दस्तावेज़ों से जवाब देता है और संदर्भ (citations) दिखाता है।'],
      ],
      companies: 'AWS, IBM, Glean, Google, Microsoft, NVIDIA, Oracle और Pinecone जैसी कंपनियाँ RAG के टूल और सेवाएँ देती हैं।',
      vidTitle: 'RAG सीखने के लिए YouTube वीडियो',
      vidLang: { en: 'अंग्रेज़ी वीडियो', hi: 'हिंदी वीडियो', mr: 'मराठी वीडियो' },
      vidChecked: 'ये लिंक 8 नवंबर 2026 को जाँचे गए (शीर्षक, चैनल, लंबाई और बोली जाने वाली भाषा)।',
      vidMore: 'और चाहिए? पूरी सूची के लिए “हिंदी वीडियो”, “English videos” या “मराठी वीडियो” लिखिए।',
      kinds: { start: 'पहला वीडियो', short: 'छोटा परिचय', deep: 'विस्तार से', course: 'प्रैक्टिकल कोर्स' },
      min: 'मिनट', hr: 'घंटे',
      srcLabel: 'स्रोत',
      chips: ['RAG उदाहरण हिंदी में', 'RAG YouTube वीडियो हिंदी', 'RAG in Marathi', 'RAG in English'],
    },

    mr: {
      name: 'मराठी',
      infoTitle: 'RAG सोप्या भाषेत',
      fullLabel: 'पूर्ण रूप',
      shortLabel: 'थोडक्यात माहिती',
      shortText: 'RAG म्हणजे AI आधी तुमच्या कागदपत्रांतून (किंवा इंटरनेटवरून) योग्य माहिती *शोधतो*, आणि मग त्याच माहितीच्या आधारे उत्तर *लिहितो*. त्यामुळे उत्तर खऱ्या तथ्यांवर आधारित असते, अंदाजावर नाही.',
      thinkLabel: 'असे समजा',
      thinkText: 'ओपन-बुक परीक्षेसारखे. सगळे लक्षात ठेवायची गरज नाही. फक्त योग्य पान शोधा आणि स्पष्ट उत्तर लिहा.',
      howTitle: 'RAG कसे काम करते, पायरी पायरीने',
      how: [
        '**डेटा तयार करा.** PDF, वेब पेज, पॉलिसी अशा कागदपत्रांचे लहान तुकडे (chunks) केले जातात. प्रत्येक तुकड्याला संख्यांच्या यादीत (embedding) बदलून vector database मध्ये ठेवतात.',
        '**वापरकर्ता प्रश्न विचारतो.** प्रश्नालाही संख्यांमध्ये बदलले जाते.',
        '**Retrieve (शोध).** प्रश्नाशी सर्वात जास्त जुळणाऱ्या संख्यांचे तुकडे शोधले जातात.',
        '**Augment (जोडणे).** ते तुकडे प्रश्नाला जोडून मोठा prompt बनवला जातो.',
        '**Generate (उत्तर).** LLM त्या prompt वरून उत्तर लिहितो आणि हवे असल्यास स्रोत (source) दाखवतो.',
        '**डेटा ताजा ठेवा.** कागदपत्रे बदलली की त्यांचे तुकडे आणि संख्याही अपडेट केल्या जातात.',
      ],
      advTitle: 'फायदे',
      adv: [
        'खोटी किंवा मनाने रचलेली उत्तरे (hallucination) कमी होतात, कारण AI आधी खरा मजकूर वाचतो.',
        'नवीन आणि खाजगी माहितीवर (कॉलेजच्या नोट्स, कंपनीचे नियम) काम करते, model ला पुन्हा train न करता.',
        'स्रोत तपासता येतो: उत्तर कुठून आले ते सांगता येते.',
        'नवीन डेटावर model ला पुन्हा train करण्यापेक्षा स्वस्त आणि वेगवान.',
        'नियंत्रण तुमच्या हातात: स्रोत कधीही बदला किंवा काढा.',
      ],
      noteTitle: 'महत्त्वाची सूचना',
      note: [
        'RAG AI model ला पुन्हा train करत नाही आणि बदलतही नाही. तो फक्त प्रत्येक प्रश्नासाठी अतिरिक्त वाचनसामग्री देतो.',
        'RAG चुका कमी करतो, पण पूर्णपणे संपवत नाही. कागदपत्रे चुकीची असतील किंवा search ने चुकीचा तुकडा शोधला, तर उत्तर चुकू शकते. नेहमी स्रोत तपासा.',
      ],
      funLabel: 'रंजक गोष्ट',
      funText: 'RAG हे नाव 2020 मधील एका संशोधन-पेपरमधून आले; त्याचे मुख्य लेखक Patrick Lewis होते. नंतर त्यांनी या “विचित्र संक्षिप्त नावाबद्दल” (acronym) दिलगिरी व्यक्त केली आणि सांगितले की काम इतके पसरेल हे माहीत असते तर नावावर अधिक विचार केला असता.',
      exTitle: 'RAG ची सर्वोत्तम खरी उदाहरणे',
      ex: [
        ['कॉलेज हेल्पडेस्क बॉट', 'फी नोटीस आणि परीक्षा वेळापत्रकावरून उत्तर देतो: “परीक्षा फी भरण्याची शेवटची तारीख कोणती?”'],
        ['कस्टमर सपोर्ट बॉट', 'प्रॉडक्ट मॅन्युअल, FAQ आणि जुन्या तिकिटांवरून उत्तर देतो, त्यामुळे उत्तर कंपनीच्या खऱ्या नियमांशी जुळते.'],
        ['HR हेल्पडेस्क', 'कर्मचारी विचारतो “माझ्या किती रजा शिल्लक आहेत?”. सिस्टम रजा-धोरण आणि त्या कर्मचाऱ्याची स्वतःची नोंद शोधून उत्तर लिहिते.'],
        ['कंपनीतील माहितीचा शोध', 'wiki, पॉलिसी मॅन्युअल, शेअर्ड ड्राइव्ह आणि अहवाल यांवर एकाच चॅट बॉक्समधून प्रश्न विचारा, दहा वेगवेगळ्या टूलऐवजी.'],
        ['डॉक्टर आणि नर्ससाठी वैद्यकीय सहाय्यक', 'मेडिकल इंडेक्सशी जोडलेला AI उत्तर देण्यापूर्वी योग्य मार्गदर्शक तत्त्वे किंवा संशोधन शोधू शकतो. अंतिम निर्णय नेहमी डॉक्टरांचाच असतो.'],
        ['फायनान्स विश्लेषकासाठी सहाय्यक', 'मार्केट डेटा आणि अहवालांशी जोडलेला सहाय्यक, म्हणजे उत्तरात ताजे आकडे येतात.'],
        ['कायदेशीर आणि कंप्लायन्स शोध', 'संबंधित खटले, नियम किंवा करारातील कलमे शोधून स्रोतासह सारांश देतो.'],
        ['स्वतःच्या फाईल्सशी चॅट', 'PDF, नोट्स किंवा ईमेलशी AI जोडून प्रश्न विचारा. डेटा तुमच्या स्वतःच्या कॉम्प्युटरवर खाजगी राहू शकतो.'],
        ['डेव्हलपरला मदत आणि प्रशिक्षण', 'मॅन्युअल, लॉग आणि कोडचे दस्तऐवज डेव्हलपर आणि नवीन कर्मचाऱ्यांसाठी knowledge base बनतात.'],
        ['स्रोतांसह AI शोध', 'Perplexity वेबवर शोधून क्रमांकित स्रोतांसह उत्तर लिहितो. Google चा NotebookLM तुम्ही अपलोड केलेल्या कागदपत्रांवरून उत्तर देतो आणि संदर्भ (citations) दाखवतो.'],
      ],
      companies: 'AWS, IBM, Glean, Google, Microsoft, NVIDIA, Oracle आणि Pinecone अशा कंपन्या RAG चे टूल आणि सेवा देतात.',
      vidTitle: 'RAG शिकण्यासाठी YouTube व्हिडिओ',
      vidLang: { en: 'इंग्रजी व्हिडिओ', hi: 'हिंदी व्हिडिओ', mr: 'मराठी व्हिडिओ' },
      vidChecked: 'ही लिंक्स 8 नोव्हेंबर 2026 रोजी तपासली आहेत (शीर्षक, चॅनल, लांबी आणि बोलली जाणारी भाषा).',
      vidMore: 'आणखी हवेत? पूर्ण यादीसाठी “मराठी व्हिडिओ”, “हिंदी व्हिडिओ” किंवा “English videos” लिहा.',
      kinds: { start: 'पहिला व्हिडिओ', short: 'छोटा परिचय', deep: 'सविस्तर', course: 'प्रात्यक्षिक कोर्स' },
      min: 'मिनिटे', hr: 'तास',
      srcLabel: 'स्रोत',
      chips: ['RAG उदाहरणे मराठीत', 'RAG YouTube व्हिडिओ मराठी', 'RAG in Hindi', 'RAG in English'],
    },
  };

  /* ---------- what did the user ask for? ---------- */
  const RE = {
    rag: /\brags?\b|retrieval[\s-]*augmented|रॅग|रैग/i,
    lesson: /\bintroduction to rag\b|\blesson\b|\bteach me\b/i,
    videos: /youtube|you\s?tube|\bvideos?\b|vidio|playlist|व्हिडिओ|व्हिडीओ|वीडियो|यूट्यूब|युट्यूब|युट्युब|यू\s?ट्यूब/i,
    examples: /\bexamples?\b|use[\s-]?cases?|udaharan|udaharn|udahran|उदाहरण|इस्तेमाल|इस्तमाल|उपयोग|वापर|where\b.*\bused|kuthe\b.*\b(use|vapar)|kahan\b.*\buse/i,
    info: /what\s+is|what's|meaning|explain|mahiti|jankari|information|\binfo\b|kya\s+hai|kya\s+hota|kay\s+aahe|kay\s+ahe|mhanje|mhanaje|samjh|म्हणजे|माहिती|जानकारी|क्या\s+है|क्या\s+होता|समझ|समज|सांग|बता/i,
    mr: /marathi|marathit|मराठी/i,
    hi: /hindi|हिंदी|हिन्दी/i,
    en: /english|inglish|इंग्रजी|अंग्रेज़ी|अंग्रेजी/i,
    mrHint: /\b(mhanje|mhanaje|aahe|sanga|sang|madhe|mahiti|kuthe|kasa|aani)\b/i,
    hiHint: /\b(kya\s+hai|kya\s+hota|batao|bataiye|samjhao|samjhaiye|kaise|kahan|mein|jankari)\b/i,
    devanagari: /[ऀ-ॿ]/,
    marathiWords: /(आहे|काय|म्हणजे|माहिती|सांग|द्या|मध्ये|आणि|उदाहरणे)/,
  };

  // sticky = a short follow-up without the word RAG ("examples"): keep the language of the last answer.
  function langOf(text, ctx, sticky) {
    if (RE.mr.test(text)) return 'mr';
    if (RE.hi.test(text)) return 'hi';
    if (RE.en.test(text)) return 'en';
    if (RE.devanagari.test(text)) return RE.marathiWords.test(text) ? 'mr' : 'hi';
    if (RE.mrHint.test(text)) return 'mr';
    if (RE.hiHint.test(text)) return 'hi';
    return sticky && ctx && ctx.last ? ctx.last.lang : 'en';
  }

  /* Returns null (not for the library), { lesson: true } (run the lesson loop) or { lang, parts, videoLangs, limit }.
     ctx.demo: true in demo mode. ctx.last: the previous library answer in this chat, so "hindi" or "videos" can follow it. */
  function parse(text, ctx) {
    const t = String(text || '').trim();
    ctx = ctx || {};
    if (!t) return null;
    const mentionsRag = RE.rag.test(t);
    const hasLang = RE.mr.test(t) || RE.hi.test(t) || RE.en.test(t);
    const wantVideos = RE.videos.test(t);
    const wantExamples = RE.examples.test(t);
    const wantInfo = RE.info.test(t);
    const explicit = hasLang || wantVideos || wantExamples;
    const short = t.split(/\s+/).length <= 3; // a follow-up is a few words: "hindi", "videos", "examples in marathi"

    if (mentionsRag) {
      if (RE.lesson.test(t) && !explicit) return { lesson: true };
      if (!ctx.demo && !explicit) return null; // live backend: let it write a lesson
    } else if (!(ctx.last && explicit && short)) {
      return null;
    }

    const lang = langOf(t, ctx, !mentionsRag);
    const parts = [];
    if (wantInfo || (!wantVideos && !wantExamples)) parts.push('info');
    if (wantExamples) parts.push('examples');
    if (wantVideos) parts.push('videos');

    const named = ['en', 'hi', 'mr'].filter(l => RE[l].test(t));
    return { lang, parts, videoLangs: named.length ? named : ['en', 'hi', 'mr'], limit: named.length ? Infinity : 4 };
  }

  /* ---------- the answer, as Markdown ---------- */
  const ytUrl = id => 'https://www.youtube.com/watch?v=' + id;
  const linkText = s => String(s).replace(/[\[\]]/g, '');
  const duration = (min, L) => (min >= 60
    ? Math.floor(min / 60) + ' ' + L.hr + (min % 60 ? ' ' + (min % 60) + ' ' + L.min : '')
    : min + ' ' + L.min);

  function infoMd(L) {
    const md = ['# ' + L.infoTitle, ''];
    md.push('**' + L.fullLabel + ':** **RAG** = **R**etrieval-**A**ugmented **G**eneration', '');
    md.push('**' + L.shortLabel + ':** ' + L.shortText, '');
    md.push('**' + L.thinkLabel + ':** ' + L.thinkText, '');
    md.push('## ' + L.howTitle, '');
    L.how.forEach((s, i) => md.push((i + 1) + '. ' + s));
    md.push('', '## ' + L.advTitle, '');
    L.adv.forEach(s => md.push('- ' + s));
    md.push('', '## ' + L.noteTitle, '');
    L.note.forEach(s => md.push('- ' + s));
    md.push('', '> **' + L.funLabel + ':** ' + L.funText);
    return md.join('\n');
  }

  function examplesMd(L, first) {
    const md = [(first ? '# ' : '## ') + L.exTitle, ''];
    L.ex.forEach(e => md.push('- **' + e[0] + '**: ' + e[1]));
    md.push('', L.companies);
    return md.join('\n');
  }

  function videosMd(L, req, first) {
    const md = [(first ? '# ' : '## ') + L.vidTitle, ''];
    let trimmed = false;
    req.videoLangs.forEach(code => {
      const list = VIDEOS.filter(v => v.lang === code);
      if (!list.length) return;
      md.push('### ' + L.vidLang[code], '');
      list.slice(0, req.limit).forEach(v => {
        md.push('- [' + linkText(v.title) + '](' + ytUrl(v.id) + '): ' + v.channel + ' · ' + duration(v.min, L) + ' · ' + L.kinds[v.kind]);
      });
      if (list.length > req.limit) trimmed = true;
      md.push('');
    });
    md.push('*' + L.vidChecked + '*');
    if (trimmed) md.push('', '*' + L.vidMore + '*');
    return md.join('\n');
  }

  function build(req) {
    const L = T[req.lang] || T.en;
    const blocks = [];
    req.parts.forEach((p, i) => {
      if (p === 'info') blocks.push(infoMd(L));
      else if (p === 'examples') blocks.push(examplesMd(L, i === 0));
      else if (p === 'videos') blocks.push(videosMd(L, req, i === 0));
    });
    if (req.parts.includes('info') || req.parts.includes('examples')) {
      blocks.push('**' + L.srcLabel + ':** ' + SOURCES.map(s => '[' + s.name + '](' + s.url + ')').join(' · '));
    }
    return blocks.join('\n\n');
  }

  /* The follow-up buttons under an answer: each one is a message the library understands. */
  const chipsFor = lang => (T[lang] || T.en).chips.slice();

  LL.ragKb = {
    data: { T, VIDEOS, SOURCES, CHECKED },
    parse,
    answer: req => ({ text: build(req), suggest: chipsFor(req.lang), kb: { lang: req.lang } }),
    chips: chipsFor,
  };

})(window.LL = window.LL || {});
