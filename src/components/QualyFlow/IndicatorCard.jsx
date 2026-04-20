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
        className={`text-[8px] font-black uppercase tracking-tighter leading-none mb-1 transition-all duration-500 ${isFora ? 'animate-pulse' : ''}`}
        style={{ 
          color: displayColor,
          textShadow: isFora ? `0 0 12px ${displayColor}` : 'none'
        }}
      >
        {title}
      </h3>
      <div className="flex items-baseline gap-0.5">
        <span 
          className="text-xl font-extrabold tracking-tighter leading-none"
          style={{ 
            color: displayColor,
            textShadow: isFora ? `0 0 15px ${displayColor}80` : 'none'
          }}
        >
          {displayValue}
        </span>
        {hasValue && (
          <span className="text-[7px] font-bold text-slate-300 uppercase italic">{unit}</span>
        )}
      </div>
    </div>
  );
};

const UnifiedModuleCard = ({ sectionTitle, children, to }) => (
  <section className="w-full max-w-[340px] animate-in fade-in zoom-in duration-500 mt-2 font-sans">
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden group hover:border-agro-orange/50 transition-all">
      <div className="px-4 pt-3 pb-2">
        <h2 className="text-[9px] font-black text-agro-green uppercase tracking-[0.3em]">
          {sectionTitle}
        </h2>
        <div className="w-full h-[1.5px] bg-agro-orange mt-1 opacity-90" />
      </div>

      <div className="px-4 pb-4 pt-2 grid grid-cols-2 gap-x-4 gap-y-3">
        {children}
      </div>

      <Link 
        to={to}
        className="w-full py-2.5 bg-slate-50/80 border-t border-slate-100 flex justify-center items-center group-hover:bg-orange-50 transition-all"
      >
        <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
          <span className="text-[8px] font-black text-slate-500 group-hover:text-agro-orange uppercase tracking-[0.2em]">
            Detalhes Técnicos
          </span>
          <span className="text-slate-400 group-hover:text-agro-orange text-[10px] font-bold">→</span>
        </div>
      </Link>
    </div>
  </section>
);

export { UnifiedModuleCard, IndicatorRow };