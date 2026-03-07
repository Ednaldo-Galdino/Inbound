
import { SheetData } from "../types";

export const fetchSheetData = async (sheetKey: string, sheetName: string = "dash"): Promise<SheetData> => {
  // sheetKey may be "SHEET_ID" or "SHEET_ID?gid=XXXXXX"
  const [sheetId, gidParam] = sheetKey.split('?');
  const gid = gidParam ? gidParam.replace('gid=', '') : null;

  // Usa /export?format=csv que sempre retorna VALORES calculados (não fórmulas)
  // O endpoint gviz/tq pode retornar texto de fórmula para certos tipos de fórmulas
  const cacheBuster = `&t=${Date.now()}`;
  let url: string;

  if (gid) {
    url = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}${cacheBuster}`;
  } else {
    // Se não temos gid, usa o nome da aba
    // Nota: o endpoint /export usa 'id' como parâmetro para a aba por nome via gid
    // Tentamos primeiro com gviz para descobrir o gid, depois exportamos
    url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}${cacheBuster}`;
  }

  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) {
    // Fallback: tenta pelo nome da aba com gviz
    const fallbackUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
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

  // Handle duplicate headers by appending _2, _3 etc.
  const rawHeaders = splitLine(lines[0]);
  const headerCounts: Record<string, number> = {};
  const headers = rawHeaders.map(h => {
    if (!headerCounts[h]) {
      headerCounts[h] = 1;
      return h;
    } else {
      headerCounts[h]++;
      return `${h}_${headerCounts[h]}`;
    }
  });

  const rows = lines.slice(1)
    .filter(line => line.trim() !== '')
    .map(line => {
      const values = splitLine(line);
      const row: Record<string, any> = {};
      headers.forEach((header, index) => {
        const val = values[index] ?? "";

        const num = Number(val);
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
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return url;
  const sheetId = idMatch[1];
  // Also extract gid if present (e.g. ?gid=961088198 or #gid=961088198)
  const gidMatch = url.match(/[?&#]gid=([0-9]+)/);
  if (gidMatch) return `${sheetId}?gid=${gidMatch[1]}`;
  return sheetId;
};
