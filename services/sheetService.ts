
import { SheetData } from "../types";

export const fetchSheetData = async (sheetId: string, sheetName: string = "dash"): Promise<SheetData> => {
  // Use the gviz API to get CSV data from a specific tab by name
  const encodedSheetName = encodeURIComponent(sheetName);
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedSheetName}`;
  
  const response = await fetch(url);
  if (!response.ok) {
    // If specific sheet fails, fallback to default first sheet
    const fallbackUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
    const fallbackResponse = await fetch(fallbackUrl);
    if (!fallbackResponse.ok) throw new Error("Falha ao acessar planilha. Verifique se está compartilhada como 'Qualquer pessoa com o link'.");
    const csvText = await fallbackResponse.text();
    return parseCSV(csvText);
  }
  
  const csvText = await response.text();
  return parseCSV(csvText);
};

const parseCSV = (csv: string): SheetData => {
  const lines = csv.split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };

  const splitLine = (line: string) => {
    return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(cell => cell.replace(/^"|"$/g, '').trim());
  };

  const headers = splitLine(lines[0]);
  const rows = lines.slice(1)
    .filter(line => line.trim() !== '')
    .map(line => {
      const values = splitLine(line);
      const row: Record<string, any> = {};
      headers.forEach((header, index) => {
        const val = values[index] ?? "";
        
        // Stricter number parsing:
        // parseFloat("19/02/2025") returns 19, which corrupts the date.
        // Number("19/02/2025") returns NaN, which is what we want (keep as string).
        const num = Number(val);
        
        // We accept the value as a number only if:
        // 1. It is not an empty string
        // 2. It is a valid number (not NaN)
        // 3. It doesn't look like a date/time string with common separators (to be extra safe against locale formats)
        const isDateLike = val.includes('/') || val.includes(':') || (val.includes('-') && val.split('-').length > 2);
        
        if (val !== "" && !isNaN(num) && !isDateLike) {
            row[header] = num;
        } else {
            row[header] = val;
        }
      });
      return row;
    });

  return { headers, rows };
};

export const extractSheetId = (url: string): string | null => {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : url;
};
