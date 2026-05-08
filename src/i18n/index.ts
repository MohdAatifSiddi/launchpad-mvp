import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const en = {
  common: {
    research: "Research",
    decisionEngine: "Decision Engine",
    litigation: "Litigation Intel",
    matters: "Matters",
    drafts: "Drafts",
    settings: "Settings",
    admin: "Admin",
    save: "Save",
    pdf: "PDF",
    listen: "Listen",
    stop: "Stop",
    speak: "Speak",
    recording: "Recording…",
    transcribing: "Transcribing…",
    language: "Language",
    english: "English",
    hindi: "हिन्दी",
    verifyBeforeFiling: "AI output. Verify before filing.",
  },
  research: {
    welcome: "What can I help you research?",
    subtitle: "Cited answers from the Indian Supreme Court corpus and the live web.",
    caseLaw: "Case law",
    web: "Web",
    answer: "Answer",
    sources: "Sources",
    askPlaceholder: "Ask in English or Hindi — e.g. specific performance after delay…",
  },
};

const hi = {
  common: {
    research: "शोध",
    decisionEngine: "निर्णय इंजन",
    litigation: "मुकदमा सूचना",
    matters: "मामले",
    drafts: "मसौदे",
    settings: "सेटिंग्स",
    admin: "व्यवस्थापक",
    save: "सहेजें",
    pdf: "पीडीएफ",
    listen: "सुनें",
    stop: "रोकें",
    speak: "बोलें",
    recording: "रिकॉर्डिंग…",
    transcribing: "लिप्यंतरण…",
    language: "भाषा",
    english: "English",
    hindi: "हिन्दी",
    verifyBeforeFiling: "एआई उत्तर. दाखिल करने से पहले सत्यापित करें.",
  },
  research: {
    welcome: "मैं किस विषय पर शोध में सहायता करूँ?",
    subtitle: "भारतीय सर्वोच्च न्यायालय कोष और लाइव वेब से उद्धृत उत्तर।",
    caseLaw: "केस लॉ",
    web: "वेब",
    answer: "उत्तर",
    sources: "स्रोत",
    askPlaceholder: "हिन्दी या अंग्रेज़ी में पूछें — जैसे विलंब के बाद विशिष्ट पालन…",
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, hi: { translation: hi } },
    fallbackLng: "en",
    supportedLngs: ["en", "hi"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "weybre_lang",
    },
  });

export default i18n;
