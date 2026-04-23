import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { QUALY_RULES } from '../../pages/QualyFlow/rules';

const ChecklistGotejoCard = ({ stats, to }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const current = stats[activeIdx];
  const { colors } = QUALY_RULES.ChecklistGotejo;

  if (!current) return null;

  // 1. Classificação Natural dos Lotes (1, 2, 10...) [cite: 2026-02-11]
  const sortedLotes = [...current.lotes].sort((a, b) => {
    return a.lote.toString().localeCompare(b.lote.toString(), undefined, { numeric: true, sensitivity: 'base' });
  });

  const chartData = sortedLotes.map(l => ({
    name: l.lote,
    min: l.valMin,
    diff: l.valMax > l.valMin ? l.valMax - l.valMin : 0,
    valMin: l.valMin,
    valMax: l.valMax
  }));

  const getColor = (val, type) => {
    if (val < 7 || val > 22) return colors.erro;
    return type === 'min' ? colors.minOk : colors.maxOk;
  };

  return (
    <section className="w-full max-w-[340px] animate-in fade-in zoom-in duration-500 mt-2 font-sans">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden group hover:border-agro-green/30 transition-all relative">
       <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-agro-green to-agro-orange opacity-90" />
        
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-[10px] font-black text-agro-green uppercase">
            CheckList - Gotejo
          </h2>
        </div>

        {/* Novo Seletor Padronizado (Estilo Adubação) [cite: 2026-02-11] */}
        <div className="px-4 py-2 flex gap-1.5 bg-slate-50/50 border-y border-slate-100 overflow-x-auto scrollbar-hide">
          {stats.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`text-[8px] font-black px-2.5 py-1 rounded transition-all uppercase tracking-tighter whitespace-nowrap ${
                activeIdx === i 
                  ? 'bg-agro-green text-white shadow-sm' 
                  : 'bg-white text-slate-400 border border-slate-200 hover:border-agro-green/50'
              }`}
            >
              {s.campo}
            </button>
          ))}
        </div>

        {/* Área do Gráfico - Blindada contra transbordo [cite: 2026-02-11] */}
        <div className="h-[155px] w-full px-1 mt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={chartData} 
              margin={{ top: 10, right: 10, left: 10, bottom: 20 }}
              barCategoryGap="15%"
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis 
                dataKey="name" 
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                interval={0}
                tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }}
              />
              <YAxis domain={[0, 30]} hide width={0} />
              
              <ReferenceLine y={7} stroke={colors.meta} strokeDasharray="3 3" />
              <ReferenceLine y={22} stroke={colors.meta} strokeDasharray="3 3" />
              
              <Bar dataKey="min" stackId="a" isAnimationActive={false}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-min-${index}`} fill={getColor(entry.valMin, 'min')} />
                ))}
              </Bar>
              <Bar dataKey="diff" stackId="a" isAnimationActive={false}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-max-${index}`} fill={getColor(entry.valMax, 'max')} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Resumo de Médias */}
        <div className="px-4 py-3 grid grid-cols-2 gap-4 border-t border-slate-50 bg-slate-50/50">
          <div className="flex flex-col items-center">
            <span className="text-[8px] font-black text-slate-400 uppercase">Média Mínima</span>
            <span className="text-xl font-black tracking-tighter" style={{ color: QUALY_RULES.ChecklistGotejo.pressao(current.avgMin) }}>
              {current.avgMin.toFixed(1)}
            </span>
          </div>
          <div className="flex flex-col items-center border-l border-slate-200">
            <span className="text-[8px] font-black text-slate-400 uppercase">Média Máxima</span>
            <span className="text-xl font-black tracking-tighter" style={{ color: QUALY_RULES.ChecklistGotejo.pressao(current.avgMax) }}>
              {current.avgMax.toFixed(1)}
            </span>
          </div>
        </div>

        <Link to={to} className="w-full py-3 bg-white border-t border-slate-100 flex justify-center items-center group-hover:bg-blue-50 transition-all">
          <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100">
            <span className="text-[9px] font-black text-slate-500 group-hover:text-blue-600 uppercase tracking-[0.2em]">Detalhes Técnicos</span>
            <span className="text-blue-400 group-hover:text-blue-600 text-[12px] font-bold">→</span>
          </div>
        </Link>
      </div>
    </section>
  );
};

export default ChecklistGotejoCard;