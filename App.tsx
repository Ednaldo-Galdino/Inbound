
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchSheetData, extractSheetId } from './services/sheetService';
import { SheetData, AIInsight } from './types';
import MetricCard from './components/MetricCard';

const GiroTradeLogo: React.FC<{ isTVMode: boolean }> = ({ isTVMode }) => (
  <div className={`flex items-center gap-2 ${isTVMode ? 'scale-125 origin-bottom-right' : ''}`}>
    <div className="w-14 h-14 flex-shrink-0">
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Top Arc (White) - Shifted Left */}
        <path d="M 12 46 A 24 24 0 0 1 60 46" stroke="#ffffff" strokeWidth="18" strokeLinecap="round" />
        {/* Bottom Arc (Green) - Shifted Right */}
        <path d="M 40 54 A 24 24 0 0 0 88 54" stroke="#22c55e" strokeWidth="18" strokeLinecap="round" />
      </svg>
    </div>
    <div className="flex flex-col justify-center items-start leading-[0.7] -mt-1">
      <span className="text-white font-bold text-4xl tracking-tighter">giro</span>
      <span className="text-white font-bold text-4xl tracking-tighter ml-[1.15rem]">trade</span>
    </div>
  </div>
);

const DEFAULT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1kgo_BrjuyPp5zxOGaJJfucd6t9fdufE8KF2Po-aCkGk/edit?pli=1&gid=961088198#gid=961088198';

const App: React.FC = () => {
  // Planilha fixada - carrega direto no dashboard
  const [activeSheetId] = useState<string>(() => extractSheetId(DEFAULT_SHEET_URL) || '');
  const [data, setData] = useState<SheetData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTVMode, setIsTVMode] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [copied, setCopied] = useState(false);

  // Ordens recebidas via Forms (aba bastime)
  const [bastimeOrdens, setBastimeOrdens] = useState<Set<string>>(new Set());

  const sheetId = activeSheetId.split('?')[0];

  const loadData = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const sheetData = await fetchSheetData(id, "dash");
      setData(sheetData);
      setLastUpdated(new Date());

      // Auto-detecta a data mais recente com dados na planilha
      setSelectedDate(prev => {
        const today = new Date();
        // Verifica se já há dados para hoje
        const colData = sheetData.headers.find(h =>
          h.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes('DATA')
        ) || '';
        if (!colData) return prev;

        const todayStr = `${today.getDate()}/${today.getMonth() + 1}`;
        const hasToday = sheetData.rows.some(r => {
          const v = String(r[colData] || '').trim();
          return v.startsWith(todayStr) || v.startsWith(`${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}`);
        });
        if (hasToday) return today;

        // Encontra a data mais recente na planilha
        let latestDate: Date | null = null;
        sheetData.rows.forEach(r => {
          const v = String(r[colData] || '').trim();
          const parts = v.split(/[\/\-]/);
          if (parts.length >= 2) {
            const d = parseInt(parts[0]);
            const m = parseInt(parts[1]) - 1;
            const y = parts.length >= 3 ? parseInt(parts[2]) : today.getFullYear();
            const dt = new Date(y < 100 ? y + 2000 : y, m, d, 12);
            if (!isNaN(dt.getTime()) && (!latestDate || dt > latestDate)) {
              latestDate = dt;
            }
          }
        });
        return latestDate || prev;
      });
    } catch (err: any) {
      setError("Erro ao carregar dados. Verifique se a planilha está pública.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Lê a aba bastime para pegar ordens enviadas pelo Forms
  const loadBastime = useCallback(async () => {
    try {
      const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=bastime&_t=${Date.now()}`;
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      const csv = await res.text();
      const lines = csv.split(/\r?\n/).filter(l => l.trim());
      const ordens = new Set<string>();
      lines.slice(1).forEach(line => {
        // Formato: "carimbo","NUMERO_DA_ORDEM"
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const ordem = parts[1]?.replace(/^"|"$/g, '').trim();
        if (ordem) ordens.add(ordem.toUpperCase());
      });
      setBastimeOrdens(ordens);
    } catch { }
  }, [sheetId]);

  useEffect(() => {
    if (activeSheetId) {
      loadData(activeSheetId);
      loadBastime();
      const dataInterval = setInterval(() => loadData(activeSheetId), 30000);
      const bastimeInterval = setInterval(loadBastime, 15000);
      return () => { clearInterval(dataInterval); clearInterval(bastimeInterval); };
    }
  }, [activeSheetId, loadData, loadBastime]);

  const truncate = (str: any, n: number = 15) => {
    const s = String(str ?? '');
    return s.length > n ? s.substr(0, n - 1) + '...' : s;
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(selectedDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const parts = e.target.value.split('-');
      const newDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0);
      setSelectedDate(newDate);
    }
  };

  const isOrdemDestacada = (row: any) => {
    if (bastimeOrdens.size === 0) return false;
    const ordem = String(row['ORDEM'] || row['Ordem'] || '').trim().toUpperCase();
    return bastimeOrdens.has(ordem);
  };

  const blocks = useMemo(() => {
    if (!data) return null;
    const h = data.headers;

    const normalize = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();

    const findH = (name: string) => {
      const search = normalize(name);
      // Prioritize exact match first
      const exact = h.find(col => normalize(col) === search);
      if (exact) return exact;
      // Fallback to contains
      return h.find(col => normalize(col).includes(search)) || '';
    };

    // Identificação de colunas - usando nomes reais da planilha
    const colData = findH('DATA') || findH('DATA DA CARGA') || findH('DATA AGENDAMENTO') || '';
    // FORNECEDOR = nome do fornecedor (tanto para aguardando quanto em doca)
    const colProg = findH('FORNECEDOR PROGRAMADO') || findH('FORNECEDOR');
    // Chegada em doca = timestamp que indica que o veiculo está em doca
    const colChegadaDoca = findH('CHEGADA EM DOCA') || findH('CHEGADA');
    const colOrdem = findH('ORDEM');
    const colDocaNum = findH('DOCA');
    const colStatus = findH('STATUS') || findH('STATUS GERAL');
    const colTempoTotal = findH('TEMPO TOTAL') || findH('TEMPO');
    const colTipo = findH('TIPO') || findH('FRETE') || findH('CIF/FOB');
    const colChave = findH('CHAVE AGENDAMENTO') || findH('CHAVE');
    const colContagem = findH('CONTAGEM') || findH('ID CARGA') || findH('ID');
    const colHoraFim = findH('FIM CONFERENCIA') || findH('FIM DA CONFERENCIA') || findH('HORA FINALIZACAO DA CONFERENCIA') || findH('HORA FIM') || findH('HORA FINALIZACAO') || findH('FIM DA DESCARGA') || findH('FIM');
    // Mantém colDocaFornec como alias para compatibilidade com o resto do código
    const colDocaFornec = colChegadaDoca;

    const fixedCols = [colData, colProg, colDocaFornec, colOrdem, colDocaNum, colStatus, colTempoTotal, colTipo, colChave, colContagem, colHoraFim].filter(Boolean);
    const extraCols = h.filter(col => !fixedCols.includes(col));

    const isMatchingDate = (val: any) => {
      if (!val || val === '-' || val === 0) return false;
      const valStr = String(val).trim();

      const tD = selectedDate.getDate();
      const tM = selectedDate.getMonth() + 1;
      const tY = selectedDate.getFullYear();

      // Divide por /, -, espaço ou T (formato ISO)
      const parts = valStr.split(/[\/\-\sT]/).filter(p => p.length > 0);

      // Allow dates with only 2 parts (DD/MM) by assuming current year, or full dates
      if (parts.length < 2) return false;

      let d, m, y;

      if (parts.length === 2) {
        // Format DD/MM or MM/DD - assume DD/MM as default for Brazil
        // Assume current year
        d = parseInt(parts[0]);
        m = parseInt(parts[1]);
        y = tY; // Use selected date year (usually current)
      } else if (parts[0].length === 4) { // Formato YYYY-MM-DD
        y = parseInt(parts[0]);
        m = parseInt(parts[1]);
        d = parseInt(parts[2]);
      } else { // Formato DD/MM/YYYY
        d = parseInt(parts[0]);
        m = parseInt(parts[1]);
        y = parseInt(parts[2]);
        if (y < 100) y += 2000;
      }

      if (isNaN(d) || isNaN(m) || isNaN(y)) return false;

      // Simple heuristic for MM/DD/YYYY if user locale is US but using DD/MM logic
      // If month > 12, swap.
      if (m > 12 && d <= 12) { const temp = d; d = m; m = temp; }

      return d === tD && m === tM && y === tY;
    };

    // Filtragem por data selecionada usando a coluna detectada
    const rawFiltered = colData ? data.rows.filter(r => isMatchingDate(r[colData])) : data.rows;

    const deduplicate = (rows: any[], _primaryKey?: string) => {
      const seen = new Set();
      return rows.filter(r => {
        // "Contagem" é o ID principal da NF (ex: "227202642811" - 12 dígitos)
        // Após o fix do CSV parser, r["Contagem"] = col 4 (ID longo), r["Contagem_2"] = col 8, r["Contagem_3"] = col 11
        const contagemId = String(r[colContagem] || '').trim();
        const ordemVal = String(r[colOrdem] || '').trim();
        const fornecVal = String(r[colProg] || '').trim();
        const statusVal = String(r[colStatus] || '').trim();

        let uniqueKey;
        // Usa o ID de Contagem longo (≥ 8 chars = ID real, não um count como "2")
        if (contagemId && contagemId.length >= 8) {
          uniqueKey = `ID-${contagemId}`;
        } else if (ordemVal && ordemVal !== '-' && ordemVal !== '0') {
          uniqueKey = `ORDEM-${fornecVal}-${ordemVal}-${statusVal}`.toUpperCase();
        } else {
          uniqueKey = JSON.stringify(r);
        }

        if (seen.has(uniqueKey)) return false;
        seen.add(uniqueKey);
        return true;
      });
    };

    // Total de cargas do dia (Deduplicado para contar cargas únicas)
    const totalDoDia = deduplicate(rawFiltered, colProg).length;

    const isFinished = (status: any) => {
      const s = String(status ?? '').toUpperCase();
      return s.includes('FINALIZADO') || s.includes('CONCLUÍDO') || s.includes('CONFERENCIA FINALIZADA') || s.includes('CONFERÊNCIA FINALIZADA') || s.includes('OK') || s.includes('FINALIZADA');
    };

    const isNoShow = (status: any) => {
      const s = String(status ?? '').toUpperCase();
      return s.includes('NOSHOW') || s.includes('NO SHOW') || s.includes('FALTOU') || s.includes('AUSENTE');
    };

    const isInTransit = (status: any) => {
      const s = String(status ?? '').toUpperCase();
      return s.includes('TRANSITO') || s.includes('TRÂNSITO') || s.includes('AGUARDANDO') || s.includes('AGUARDANDO VEICULO') || s.includes('AGUARDANDO VEÍCULO');
    };

    // Aguardando: fornecedor programado, ainda não chegou na doca, não finalizado
    // Na planilha: 'Chegada em doca' vazia OU status = Em trânsito / AGUARDANDO VEÍCULO
    const programadoRaw = rawFiltered.filter(r => r[colProg] && !isFinished(r[colStatus]) && !isNoShow(r[colStatus]) && (!r[colDocaFornec] || isInTransit(r[colStatus])));
    // Em operação: chegada em doca preenchida, ainda não finalizado
    const emOperacaoRaw = rawFiltered.filter(r => r[colDocaFornec] && !isFinished(r[colStatus]) && !isNoShow(r[colStatus]) && !isInTransit(r[colStatus]));
    const finalizadasRaw = rawFiltered.filter(r => isFinished(r[colStatus]));
    const noShowsRaw = rawFiltered.filter(r => isNoShow(r[colStatus]));

    const programado = deduplicate(programadoRaw, colProg);
    const emOperacao = deduplicate(emOperacaoRaw, colDocaFornec);
    const finalizadas = deduplicate(finalizadasRaw, colDocaFornec);
    const noShows = deduplicate(noShowsRaw, colProg);


    const finalizadasCIF = finalizadas.filter(r => String(r[colTipo] ?? '').toUpperCase().includes('CIF'));
    const finalizadasFOB = finalizadas.filter(r => String(r[colTipo] ?? '').toUpperCase().includes('FOB'));

    const historicoUnificado: any[] = [];
    const agrupamento: Record<string, any> = {};

    // Agrupamento usa sempre o nome do fornecedor (colProg)
    [...finalizadas, ...noShows].forEach(r => {
      const fornecedor = r[colProg] || 'DESCONHECIDO';
      if (!agrupamento[fornecedor]) {
        agrupamento[fornecedor] = {
          nome: fornecedor,
          tipo: r[colTipo] || '-',
          finalizados: 0,
          noshows: 0,
          tempos: [] as number[],
          horaFim: '-'
        };
      }

      if (isFinished(r[colStatus])) {
        agrupamento[fornecedor].finalizados++;
        const t = parseFloat(r[colTempoTotal]);
        if (!isNaN(t)) agrupamento[fornecedor].tempos.push(t);
        if (colHoraFim && r[colHoraFim]) {
          const val = String(r[colHoraFim]);
          // If it's a full ISO string or has a space, try to extract just the time
          if (val.includes(' ') || val.includes('T')) {
            const parts = val.split(/[ T]/);
            agrupamento[fornecedor].horaFim = parts[parts.length - 1].substring(0, 5);
          } else {
            agrupamento[fornecedor].horaFim = val.substring(0, 5);
          }
        }
      } else if (isNoShow(r[colStatus])) {
        agrupamento[fornecedor].noshows++;
        agrupamento[fornecedor].horaFim = 'NOSHOW';
      }
    });

    Object.values(agrupamento).forEach((item: any) => {
      const avg = item.tempos.length > 0 ? (item.tempos.reduce((a: number, b: number) => a + b, 0) / item.tempos.length).toFixed(0) : '--';
      historicoUnificado.push({ ...item, tempoMedio: avg });
    });

    return {
      programado,
      emOperacao,
      finalizadas,
      noShows,
      finalizadasCIF,
      finalizadasFOB,
      historicoUnificado,
      totalDoDia,
      extraCols,
      cols: { colProg, colDocaFornec, colOrdem, colDocaNum, colStatus, colTempoTotal, colTipo, colData, colHoraFim }
    };
  }, [data, selectedDate]);

  const displayKPIs = useMemo(() => {
    if (!blocks) return [];
    return [
      { title: 'Aguardando', value: String(blocks.programado.length), description: 'Pátio / Trânsito', trend: 'neutral' },
      { title: 'Em Operação', value: String(blocks.emOperacao.length), description: 'Cargas em Doca', trend: 'neutral' },
      {
        title: 'Finalizados',
        value: String(blocks.finalizadas.length + blocks.noShows.length),
        description: 'Total Saídas',
        trend: 'neutral',
        details: [
          { label: 'NÃO (CIF)', value: String(blocks.finalizadasCIF.length) },
          { label: 'SIM (FOB)', value: String(blocks.finalizadasFOB.length) },
          { label: 'NOSHOW', value: String(blocks.noShows.length) },
          { label: 'TOTAL', value: String(blocks.finalizadas.length + blocks.noShows.length), isTotal: true }
        ]
      }
    ] as AIInsight[];
  }, [blocks]);

  // Unused function renderExtraInfo removed from here

  const getStatusStyle = (status: any) => {
    const s = String(status ?? '').toUpperCase();
    if (s.includes('DESCARGA')) return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
    if (s.includes('AGUARDANDO') || s.includes('TRANSITO') || s.includes('TRÂNSITO')) return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400';
    if (s.includes('CONFERENCIA') || s.includes('CONFERÊNCIA') || s.includes('CONFERINDO') || s.includes('FINALIZADA') || s.includes('FINALIZADO')) return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
    if (s.includes('EM DOCA') || s.includes('DOCA')) return 'border-orange-500/30 bg-orange-500/10 text-orange-400';
    return 'border-slate-500/30 bg-slate-500/10 text-slate-400';
  };

  const formatDateDisplay = (date: Date) => {
    const today = new Date();
    if (date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()) {
      return `HOJE, ${new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(date)}`;
    }
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }).format(date).toUpperCase().replace('.', '');
  };


  return (
    <div className={`${isTVMode ? 'h-screen overflow-hidden p-2' : 'min-h-screen p-4'} bg-slate-950 flex flex-col transition-all duration-500`}>
      <header className={`flex justify-between items-center ${isTVMode ? 'mb-1' : 'mb-4'} px-2`}>
        {/* Lado Esquerdo: Data e Status */}
        <div className="flex-1 flex flex-col">
          {/* Seletor de Data */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-900/80 p-1 rounded-xl border border-slate-800 shadow-lg">
              <button onClick={() => changeDate(-1)} className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>

              <div className="relative group">
                <div className="flex items-center gap-2 px-2 cursor-pointer">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  <span className={`font-black text-white uppercase tracking-wide ${isTVMode ? 'text-sm' : 'text-xs'}`}>
                    {formatDateDisplay(selectedDate)}
                  </span>
                </div>
                <input
                  type="date"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  onChange={handleDateChange}
                />
              </div>

              <button onClick={() => changeDate(1)} className="w-6 h-6 flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <div className="text-slate-400 font-bold uppercase text-[10px] flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              ATUALIZADO: {lastUpdated?.toLocaleTimeString()}
              {blocks && <span className="text-slate-600 ml-2 border-l border-slate-700 pl-2">FILTRO: {truncate(blocks.cols.colData || 'N/A', 10)}</span>}
            </div>
          </div>
        </div>

        {/* Centro: Título e Resumo Total */}
        <div className="flex-[2] flex flex-col items-center justify-center -ml-10">
          <h1 className={`font-black text-white uppercase tracking-tighter mb-2 ${isTVMode ? 'text-4xl' : 'text-2xl'}`}>CONTROLE DE CARGAS</h1>
          {/* Totalizador Geral */}
          <div className="bg-emerald-600/20 border border-emerald-500/30 px-12 py-2 rounded-2xl flex items-center gap-5 shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <span className="text-emerald-400 font-bold text-[12px] uppercase tracking-[0.25em]">TOTAL CARGAS</span>
            <span className={`text-white font-black tracking-tighter leading-none ${isTVMode ? 'text-5xl' : 'text-4xl'}`}>{blocks?.totalDoDia || 0}</span>
          </div>
        </div>

        {/* Lado Direito: Controles */}
        <div className="flex-1 flex flex-col items-end justify-center gap-2">
          <div className={`transform ${isTVMode ? 'scale-75' : 'scale-50'} origin-right`}>
            <GiroTradeLogo isTVMode={false} />
          </div>
          <div className="flex gap-2 items-center">
            <button onClick={() => navigator.clipboard.writeText(window.location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })} title="Copiar link para compartilhar" className="bg-slate-900 text-slate-400 px-4 py-3 rounded-xl font-bold border border-slate-800 text-[10px] hover:bg-slate-800">{copied ? '✓ COPIADO' : '🔗 LINK'}</button>
            <button onClick={() => setIsTVMode(!isTVMode)} className="bg-slate-900 text-emerald-400 px-4 py-3 rounded-xl font-bold text-[10px] border border-slate-800 hover:bg-slate-800 uppercase tracking-wider">{isTVMode ? 'SAIR TV' : 'MODO TV'}</button>
          </div>
        </div>
      </header>

      {/* Cards KPI */}
      <div className={`grid grid-cols-3 ${isTVMode ? 'gap-2 mb-1' : 'gap-4 mb-4'}`}>
        {displayKPIs.map((kpi, idx) => (
          <MetricCard key={idx} insight={kpi} isTVMode={isTVMode} />
        ))}
      </div>

      <div className={`grid grid-cols-12 ${isTVMode ? 'gap-2' : 'gap-4'} flex-grow overflow-hidden`}>
        {/* A Chegar - Layout Ajustado */}
        <div className="col-span-3 bg-slate-900/60 border border-slate-800 rounded-[2rem] overflow-hidden flex flex-col shadow-2xl relative">
          <div className="bg-blue-600 px-3 py-2 flex justify-between items-center">
            <h2 className="text-white font-black uppercase text-[11px] tracking-widest">Aguardando</h2>
            <span className="bg-blue-800 text-blue-100 text-[9px] font-bold px-1.5 py-0.5 rounded-md">{blocks?.programado.length}</span>
          </div>
          <div className="p-2 overflow-y-auto flex-grow custom-scrollbar">
            <table className="w-full text-left table-auto">
              <tbody className="text-white">
                {blocks?.programado.map((row, i) => {
                  const destaque = isOrdemDestacada(row);
                  return (
                    <tr key={i} className={`border-b border-slate-800/40 last:border-0 transition-colors ${destaque ? 'bg-yellow-500/15 border-yellow-500/30' : 'hover:bg-white/5'}`}>
                      <td className="py-1 px-3">
                        <div className={`font-bold leading-tight truncate ${destaque ? 'text-yellow-300' : 'text-blue-300'} ${isTVMode ? 'text-[12px]' : 'text-[10px]'}`}>
                          {truncate(row[blocks.cols.colProg], 30)}
                        </div>
                        {destaque && <div className="text-[8px] text-yellow-500 font-black tracking-widest">⚡ ORDEM {row['ORDEM'] || row['Ordem']}</div>}
                      </td>
                    </tr>
                  );
                })}
                {blocks?.programado.length === 0 && (
                  <tr><td className="py-10 text-center text-slate-600 uppercase font-black text-[11px] tracking-widest">Lista vazia</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Em Operação */}
        <div className="col-span-5 bg-slate-900/80 border border-slate-700/50 rounded-[2rem] overflow-hidden flex flex-col shadow-2xl">
          <div className="bg-amber-600 px-3 py-2 flex justify-between items-center">
            <h2 className="text-white font-black uppercase text-[11px] tracking-widest">Em Doca / Operação</h2>
            <span className="bg-amber-800 text-amber-100 text-[9px] font-bold px-1.5 py-0.5 rounded-md">{blocks?.emOperacao.length}</span>
          </div>
          <div className="p-4 overflow-y-auto flex-grow custom-scrollbar">
            <table className="w-full text-left table-fixed">
              <thead className="text-slate-500 text-[9px] uppercase border-b border-slate-800 font-black">
                <tr>
                  <th className="pb-1 pl-2 w-[40%]">Fornecedor</th>
                  <th className="pb-1 text-center w-[20%]">Doca</th>
                  <th className="pb-1 text-center w-[40%]">Status</th>
                </tr>
              </thead>
              <tbody className="text-white">
                {blocks?.emOperacao.map((row, i) => {
                  const destaque = isOrdemDestacada(row);
                  return (
                    <tr key={i} className={`border-b border-slate-800/50 last:border-0 ${destaque ? 'bg-yellow-500/15 border-yellow-500/30' : ''}`}>
                      <td className="py-1.5 pl-2">
                        <div className={`font-black uppercase truncate leading-tight ${destaque ? 'text-yellow-300' : 'text-white'} ${isTVMode ? 'text-[12px]' : 'text-[10px]'}`}>
                          {truncate(row[blocks.cols.colProg], 25)}
                        </div>
                        <div className="text-slate-500 text-[8px] font-bold mt-0.5">
                          ORDEM: {String(row[blocks.cols.colOrdem] ?? '-')}
                          {destaque && <span className="text-yellow-500 ml-1 font-black">⚡</span>}
                        </div>
                      </td>
                      <td className="py-1.5 text-center">
                        <div className={`font-black text-amber-400 leading-none ${isTVMode ? 'text-[32px]' : 'text-[24px]'}`}>
                          {row[blocks.cols.colDocaNum] || '-'}
                        </div>
                      </td>
                      <td className="py-1.5 text-center">
                        <div className="flex justify-center w-full px-1">
                          <span className={`w-full max-w-[120px] px-1 py-0.5 rounded border font-black uppercase tracking-tight whitespace-nowrap overflow-hidden text-ellipsis ${getStatusStyle(row[blocks.cols.colStatus])} ${isTVMode ? 'text-[9px]' : 'text-[8px]'}`}>
                            {row[blocks.cols.colStatus] || 'DOCA'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {blocks?.emOperacao.length === 0 && (
                  <tr><td colSpan={3} className="py-10 text-center text-slate-600 uppercase font-black text-[11px] tracking-widest">Nenhuma carga em doca</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Histórico/Resumo */}
        <div className="col-span-4 bg-slate-900/60 border border-slate-800 rounded-[2rem] overflow-hidden flex flex-col shadow-2xl">
          <div className="bg-slate-800 px-3 py-2 border-b border-slate-700 flex justify-between items-center">
            <h2 className="text-white font-black uppercase text-[11px] tracking-widest">Finalizados</h2>
            <span className="bg-slate-700 text-slate-300 text-[9px] font-bold px-1.5 py-0.5 rounded-md">{blocks?.finalizadas.length + (blocks?.noShows.length || 0)}</span>
          </div>
          <div className="p-4 overflow-y-auto flex-grow custom-scrollbar">
            <table className="w-full text-left table-fixed">
              <thead className="text-slate-500 text-[8px] uppercase border-b border-slate-800 font-black">
                <tr>
                  <th className="pb-1 w-[40%]">Fornecedor</th>
                  <th className="pb-1 text-center w-[15%]">Tipo</th>
                  <th className="pb-1 text-center w-[15%]">Saídas</th>
                  <th className="pb-1 text-center w-[15%]">Hora</th>
                  <th className="pb-1 text-center">Médio</th>
                </tr>
              </thead>
              <tbody className="text-white">
                {blocks?.historicoUnificado.map((item, i) => (
                  <tr key={i} className="border-b border-slate-800/30 last:border-0">
                    <td className={`py-1 font-bold truncate ${isTVMode ? 'text-[10px]' : 'text-[9px]'}`}>
                      <div className="flex flex-col">
                        <span className="truncate">{truncate(item.nome, 25)}</span>
                        {item.noshows > 0 && <span className="text-[7px] text-rose-500 font-black tracking-tighter">NOSHOW: {item.noshows}</span>}
                      </div>
                    </td>
                    <td className={`py-1 text-center font-black ${String(item.tipo).includes('CIF') ? 'text-blue-400' : 'text-purple-400'} text-[8px]`}>{item.tipo}</td>
                    <td className="py-1 text-center">
                      <span className="bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded text-[8px] font-black">{item.finalizados}</span>
                    </td>
                    <td className={`py-1 text-center font-black text-slate-400 text-[8px]`}>{item.horaFim}</td>
                    <td className={`py-1 text-center font-black text-emerald-400 ${isTVMode ? 'text-[10px]' : 'text-[9px]'}`}>
                      {item.tempoMedio}{item.tempoMedio !== '--' && <span className="text-[6px] ml-0.5">MIN</span>}
                    </td>
                  </tr>
                ))}
                {blocks?.historicoUnificado.length === 0 && (
                  <tr><td colSpan={4} className="py-10 text-center text-slate-600 uppercase font-black text-[11px] tracking-widest">Sem finalizações</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="fixed bottom-20 right-6 bg-emerald-600 text-white px-6 py-3 rounded-full shadow-2xl animate-pulse z-50 font-black text-[11px] tracking-[0.2em] border border-emerald-400">
          SINCRONIZANDO...
        </div>
      )}

      {/* Indicador de ordens em destaque (bastime) */}
      {!isTVMode && bastimeOrdens.size > 0 && (
        <div className="mt-3 px-2">
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-2">
            <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></span>
            <span className="text-yellow-400 font-black text-[11px] uppercase tracking-wider">
              {bastimeOrdens.size} ordem{bastimeOrdens.size > 1 ? 's' : ''} em destaque via Forms
            </span>
            <span className="text-yellow-600 text-[10px] ml-2">
              [{[...bastimeOrdens].join(', ')}]
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
