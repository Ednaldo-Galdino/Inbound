
import React, { useMemo } from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { SheetData } from '../types';

interface DataChartsProps {
  data: SheetData;
  isTVMode?: boolean;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const DataCharts: React.FC<DataChartsProps> = ({ data, isTVMode }) => {
  // Logic to find potential numeric and categorical columns
  const analysis = useMemo(() => {
    if (data.rows.length === 0) return null;
    
    const numericCols = data.headers.filter(h => typeof data.rows[0][h] === 'number');
    const categoricalCols = data.headers.filter(h => typeof data.rows[0][h] === 'string');
    
    return {
      numeric: numericCols[0] || data.headers[1],
      category: categoricalCols[0] || data.headers[0],
      secondaryNumeric: numericCols[1]
    };
  }, [data]);

  if (!analysis) return null;

  const chartData = data.rows.slice(0, 15); // Limit for clean visualization

  return (
    <div className={`grid ${isTVMode ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'} gap-8 mt-8`}>
      {/* Trend Chart */}
      <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 h-[400px]">
        <h3 className="text-slate-400 mb-6 font-medium">Performance Trend</h3>
        <ResponsiveContainer width="100%" height="85%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey={analysis.category} stroke="#94a3b8" fontSize={isTVMode ? 14 : 12} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={isTVMode ? 14 : 12} tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#f8fafc' }}
            />
            <Area type="monotone" dataKey={analysis.numeric} stroke="#6366f1" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Distribution Chart */}
      <div className="bg-slate-800/50 p-6 rounded-3xl border border-slate-700/50 h-[400px]">
        <h3 className="text-slate-400 mb-6 font-medium">Distribution by Category</h3>
        <ResponsiveContainer width="100%" height="85%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey={analysis.category} stroke="#94a3b8" fontSize={isTVMode ? 14 : 12} tickLine={false} axisLine={false} />
            <YAxis stroke="#94a3b8" fontSize={isTVMode ? 14 : 12} tickLine={false} axisLine={false} />
            <Tooltip 
              cursor={{ fill: '#334155', opacity: 0.4 }}
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#f8fafc' }}
            />
            <Bar dataKey={analysis.numeric} radius={[6, 6, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DataCharts;
