import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { QUALY_RULES } from '../../pages/QualyFlow/rules';

// ADICIONADO: selectedDate nas props
const ChecklistGotejoCard = ({ stats, to, selectedDate }) => {
  const [activeIdx, setActiveIdx] = useState(0);
  const current = stats[activeIdx];
  const { colors } = QUALY_RULES.ChecklistGotejo;

  if (!current) return null;

  // 1. Classificação Natural dos Lotes (1, 2, 10...)
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
    <section className="w-full max-w-[400px] animate-in fade-in zoom-in duration-500 mt-2 font-sans">
      <div className="bg-white border-2 border-slate-200/80 rounded-xl shadow-xl overflow-hidden group hover:border-agro-green/40 transition-all relative">
        
        {/* Fita Premium no Topo (h-1.5) */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-agro-green to-agro-orange opacity-90 shadow-sm" />
        
        {/* Header Compacto Padronizado */}
        <div className="px-5 pt-4 pb-2 border-b border-slate-100 bg-slate-50/30">
          <h2 className="text-[13px] font-black text-agro-green uppercase tracking-widest leading-none">
            CheckList - Gotejo
          </h2>
        </div>

        {/* Novo Seletor Padronizado (Estilo Adubação/CUC) */}
        <div className="px-5 py-2.5 flex gap-2 bg-slate-50/50 border-y border-slate-100 overflow-x-auto scrollbar-hide shadow-inner">
          {stats.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`text-[9px] font-black px-3 py-1.5 rounded transition-all uppercase tracking-widest whitespace-nowrap ${
                activeIdx === i 
                  ? 'bg-agro-green text-white shadow-sm' 
                  : 'bg-white text-slate-400 border border-slate-200 hover:border-agro-green/50 hover:text-slate-500'
              }`}
            >
              {s.campo}
            </button>
          ))}
        </div>

        {/* Área do Gráfico - Blindada contra transbordo */}
        <div className="h-[155px] w-full px-2 mt-2">
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

        {/* Resumo de Médias Compacto */}
        <div className="px-5 py-3.5 grid grid-cols-2 gap-4 border-t border-slate-100 bg-white">
          <div className="flex flex-col items-center justify-center">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Média Mínima</span>
            <span className="text-2xl font-black tracking-tighter leading-none" style={{ color: QUALY_RULES.ChecklistGotejo.pressao(current.avgMin) }}>
              {current.avgMin.toFixed(1)}
            </span>
          </div>
          <div className="flex flex-col items-center justify-center border-l border-slate-200">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Média Máxima</span>
            <span className="text-2xl font-black tracking-tighter leading-none" style={{ color: QUALY_RULES.ChecklistGotejo.pressao(current.avgMax) }}>
              {current.avgMax.toFixed(1)}
            </span>
          </div>
        </div>

        {/* Link Técnico Padronizado (py-2.5) */}
        {/* ADICIONADO: state={{ selectedDate }} para passar a data */}
        <Link 
          to={to} 
          state={{ selectedDate }} 
          className="w-full py-2.5 bg-[#F8FAFC] border-t border-slate-100 flex justify-center items-center group-hover:bg-agro-green/5 transition-all"
        >
          <div className="flex items-center gap-2 opacity-70 group-hover:opacity-100 transition-opacity">
            <span className="text-[10px] font-black text-slate-500 group-hover:text-agro-green uppercase tracking-widest">
              Relatório Detalhado
            </span>
            <span className="text-slate-400 group-hover:text-agro-green text-[14px] font-black">→</span>
          </div>
        </Link>
      </div>
    </section>
  );
};

export default ChecklistGotejoCard;