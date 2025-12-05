import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are the central operating system "CIT-OS" of a dystopian cyberpunk megacity in the year 2099.
Generate short, atmospheric ambient radio chatter, police dispatch alerts, or advertisement fragments.
Keep it cryptic, neon-noir, and brief (under 15 words).
Examples:
- "Sector 7 acid rain warning. Visibility reduced to 40%."
- "Suspect vehicle spotted in Lower Grid. All units converge."
- "Enjoy the synthetic bliss of Soma-Cola. Drink the void."
- "Energy surge detected in District 9. Power rerouted."
`;

export const fetchRadioChatter = async (): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: "Generate one radio transmission.",
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.9,
        maxOutputTokens: 50,
      }
    });
    
    if (response.text) {
      return response.text.trim();
    }
    
    return "Signal encrypted... Decryption failed.";
  } catch (error) {
    console.error("Gemini Radio Error:", error);
    return "Signal interference detected... Reconnecting...";
  }
};