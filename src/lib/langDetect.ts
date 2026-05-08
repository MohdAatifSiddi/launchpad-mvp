// Simple bilingual helpers for Indian lawyers (EN / HI / Hinglish).
// Returns the language tag the AI should respond in, based on user input + UI preference.
export function detectScript(text: string): "hi" | "en" {
  // Devanagari unicode block U+0900–U+097F
  return /[\u0900-\u097F]/.test(text) ? "hi" : "en";
}

export function resolveResponseLang(
  uiLang: string,
  userText: string
): "en" | "hi" {
  const script = detectScript(userText);
  // If the user typed in Devanagari, always answer in Hindi.
  if (script === "hi") return "hi";
  // Otherwise honour the UI selection. Hinglish (Latin script) → English script
  // unless the user explicitly selected Hindi UI.
  return uiLang === "hi" ? "hi" : "en";
}
