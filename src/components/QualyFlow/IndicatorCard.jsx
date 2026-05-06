import React from 'react';
import { Link } from 'react-router-dom';

const IndicatorRow = ({ title, value, unit, color }) => {
  const hasValue = value !== null && value !== undefined;
  const displayValue = hasValue ? value : "--";
  const isFora = hasValue && color === '#FF0000';
  const displayColor = hasValue ? color : '#CBD5E1';

  return (
    <div className="flex flex-col py-1 font-sans">
      <h3 
        className={`text-[10px] font-black uppercase tracking-widest leading-none mb-0.5 transition-all duration-500 ${isFora ? 'animate-pulse' : ''}`}
        style={{ 
          color: displayColor,
          textShadow: isFora ? `0 0 12px ${displayColor}` : 'none'
        }}
      >
        {title}
      </h3>
      <div className="flex items-baseline gap-1">
        <span 
          className="text-2xl font-black tracking-tighter leading-none"
          style={{ 
            color: displayColor,
            textShadow: isFora ? `0 0 15px ${displayColor}80` : 'none'
          }}
        >
          {displayValue}
        </span>
        {hasValue && (
          <span className="text-[9px] font-bold text-slate-400 uppercase opacity-60 ml-0.5 tracking-tighter">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};

// ADICIONADO: selectedDate nas props
const UnifiedModuleCard = ({ sectionTitle, children, to, selectedDate }) => (
  <section className="w-full max-w-[400px] animate-in fade-in zoom-in duration-500 mt-2 font-sans">
    {/* Ajustado hover da borda do card para agro-green */}
    <div className="bg-white border-2 border-slate-200/80 rounded-xl shadow-xl overflow-hidden group hover:border-agro-green/40 transition-all relative">
      
      {/* Detalhe Premium: Fita Colorida no Topo (h-1.5 mantida) */}
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-agro-green to-agro-orange opacity-90 shadow-sm" />

      {/* Header Compacto */}
      <div className="px-5 pt-4 pb-2 border-b border-slate-100 bg-slate-50/30">
        <h2 className="text-[13px] font-black text-agro-green uppercase tracking-widest">
          {sectionTitle}
        </h2>
      </div>

      {/* Corpo do Card (Mais compactado verticalmente) */}
      <div className="px-5 py-3.5 grid grid-cols-2 gap-x-5 gap-y-3">
        {children}
      </div>

      {/* Ajustados hovers de fundo e de texto para agro-green */}
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

export { UnifiedModuleCard, IndicatorRow };