
import { GoogleGenAI, Type } from "@google/genai";
import { SheetData, AIInsight } from "../types";

export const getAIInsights = async (data: SheetData): Promise<AIInsight[]> => {
  if (!data || data.rows.length === 0) return [];

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const dataSummary = {
      totalRows: data.rows.length,
      headers: data.headers,
      sampleRows: data.rows.slice(0, 30) // Amostra para análise
    };

    const prompt = `Analise estes dados de logística de carga/descarga. 
    Identifique 3 insights críticos sobre: 
    1. Eficiência das docas. 
    2. Alertas de possíveis atrasos baseados no status.
    3. Padrão de volumes.
    Seja extremamente conciso e profissional.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              value: { type: Type.STRING },
              description: { type: Type.STRING },
              trend: { type: Type.STRING, enum: ["up", "down", "neutral"] }
            },
            required: ["title", "value", "description", "trend"]
          }
        }
      }
    });

    const jsonStr = response.text;
    return jsonStr ? JSON.parse(jsonStr) : [];
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return [];
  }
};
