
import { GoogleGenAI } from "@google/genai";
import { SheetData } from "../types";

export interface AIFilter {
  supplierFilter: string | null;   // nome do fornecedor para filtrar, ou null
  statusFilter: string | null;     // "aguardando" | "em_operacao" | "finalizado" | null
  dateFilter: string | null;       // data no formato DD/MM ou null
  message: string;                 // mensagem amigável para exibir ao usuário
  clearAll: boolean;               // true se o usuário pediu para limpar filtros
}

export const processAICommand = async (
  command: string,
  data: SheetData
): Promise<AIFilter> => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      supplierFilter: null,
      statusFilter: null,
      dateFilter: null,
      message: '⚠️ Chave da API Gemini não configurada.',
      clearAll: false,
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    // Extrai fornecedores únicos para contextualizar o Gemini
    const fornecedores = [...new Set(data.rows.map(r => r['FORNECEDOR'] || r['FORNECEDOR PROGRAMADO'] || '').filter(Boolean))].slice(0, 30);

    const prompt = `Você é um assistente de dashboard logístico. O usuário digitou um comando em português.

Fornecedores disponíveis na planilha: ${fornecedores.join(', ')}

Comando do usuário: "${command}"

Retorne um JSON com os filtros a aplicar:
{
  "supplierFilter": "NOME_EXATO_DO_FORNECEDOR_OU_NULL",
  "statusFilter": "aguardando" | "em_operacao" | "finalizado" | null,
  "dateFilter": "DD/MM" | null,
  "message": "mensagem curta confirmando o que foi feito",
  "clearAll": true | false
}

Regras:
- "supplierFilter": nome parcial ou completo do fornecedor mencionado. Null se não mencionou.
- "statusFilter": "aguardando" se falou de aguardando/pátio/trânsito. "em_operacao" se falou de em operação/doca. "finalizado" se falou de finalizado/concluído.
- "dateFilter": se mencionou uma data específica, extraia como DD/MM. Null se não mencionou.
- "clearAll": true SOMENTE se o usuário claramente pediu para limpar/resetar/mostrar tudo.
- "message": curta, em português, confirma o filtro aplicado.
Retorne SOMENTE o JSON, sem explicações extras.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const text = response.text?.trim() || '';
    const jsonStr = text.replace(/```json|```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Gemini AI Error:", error);
    return {
      supplierFilter: null,
      statusFilter: null,
      dateFilter: null,
      message: '❌ Não entendi o comando. Tente: "mostrar GRUPO JAV" ou "só em operação".',
      clearAll: false,
    };
  }
};
