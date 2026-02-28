
import React from 'react';
import { AIInsight } from '../types';

interface MetricCardProps {
  insight: AIInsight;
  isTVMode?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ insight, isTVMode }) => {
  const getTheme = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('programado')) return { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-400', icon: '📋' };
    if (t.includes('operação') || t.includes('doca')) return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-400', icon: '🏗️' };
    return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-400', icon: '✅' };
  };

  const theme = getTheme(insight.title);

  return (
    <div className={`${theme.bg} backdrop-blur-md border ${theme.border} rounded-[1.5rem] p-2 transition-all duration-500 flex flex-col items-center justify-center relative overflow-hidden h-full min-h-[75px]`}>
      {!insight.details ? (
        <>
          <div className="flex items-center gap-2 mb-0.5">
            <span className={isTVMode ? 'text-lg' : 'text-xs'}>{theme.icon}</span>
            <h3 className={`text-slate-400 font-bold uppercase tracking-widest ${isTVMode ? 'text-[10px]' : 'text-[8px]'}`}>
              {insight.title}
            </h3>
          </div>
          <div className={`${isTVMode ? 'text-4xl' : 'text-2xl'} font-black ${theme.text} mb-0.5 tracking-tighter`}>
            {insight.value}
          </div>
          <p className={`text-slate-500 font-medium ${isTVMode ? 'text-[8px]' : 'text-[7px]'} uppercase`}>
            {insight.description}
          </p>
        </>
      ) : (
        <div className="w-full h-full flex flex-col">
          <h3 className={`text-slate-300 font-black uppercase text-center mb-1 tracking-widest ${isTVMode ? 'text-[11px]' : 'text-[9px]'}`}>
            {insight.title}
          </h3>
          <div className="flex-grow flex flex-col justify-center">
            <table className="w-full border-collapse">
              <tbody>
                {insight.details.map((detail, idx) => (
                  <tr key={idx} className={`${detail.isTotal ? 'border-t border-emerald-500/30 mt-0.5' : 'border-b border-slate-800/50'}`}>
                    <td className={`py-0.5 text-left font-bold uppercase tracking-tight ${detail.isTotal ? 'text-emerald-400' : 'text-slate-400'} ${isTVMode ? 'text-[11px]' : 'text-[8px]'}`}>
                      {detail.label}
                    </td>
                    <td className={`py-0.5 text-right font-black ${detail.isTotal ? 'text-emerald-400' : 'text-slate-200'} ${isTVMode ? 'text-[18px]' : 'text-[14px]'}`}>
                      {detail.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MetricCard;
