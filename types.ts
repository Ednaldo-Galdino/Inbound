
export interface SheetData {
  headers: string[];
  rows: Record<string, any>[];
}

export interface DashboardConfig {
  sheetId: string;
  refreshInterval: number;
  title: string;
}

export interface AIInsight {
  title: string;
  value: string;
  description: string;
  trend: 'up' | 'down' | 'neutral';
  details?: { label: string; value: string; isTotal?: boolean }[];
}
