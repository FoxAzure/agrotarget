import React from 'react';
import { Link } from 'react-router-dom';
import { QUALY_RULES, COLORS } from '../../pages/QualyFlow/rules';

const DroneCard = ({ stats, to, selectedDate }) => {
  const { variacaoGeral, coletasMedia, totalDrones } = stats;

  const corGeral = QUALY_RULES.Drone.meta(variacaoGeral);
  const isFora = corGeral === COLORS.fora;

  return (
    <section className="w-full max-w-[400px] animate-in fade-in zoom-in duration-500 mt-2 font-sans">
      <div className="bg-white border-2 border-slate-200/80 rounded-xl shadow-xl overflow-hidden group hover:border-agro-green/40 transition-all relative">
        
        {/* Fita Premium no Topo (h-1.5) */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-agro-green to-agro-orange opacity-90 shadow-sm" />
        
        {/* Header Compacto Padronizado */}
        <div className="px-5 pt-4 pb-2 border-b border-slate-100 bg-slate-50/30">
          <h2 className="text-[13px] font-black text-agro-green uppercase tracking-widest leading-none">
            Avaliação Drone
          </h2>
        </div>

        {/* Hero Section: Variação Geral do Dia */}
        <div className="px-5 py-3.5 flex justify-between bg-slate-50/50 border-b border-slate-100 shadow-inner">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Variação Média Geral</span>
            <div className="flex items-baseline gap-1">
              <span 
                className={`text-2xl font-black tracking-tighter leading-none ${isFora ? 'animate-pulse' : ''}`}
                style={{ color: corGeral }}
              >
                {variacaoGeral > 0 ? '+' : ''}{Number(variacaoGeral).toFixed(2)}
              </span>
              <span className="text-[10px] font-black opacity-60 uppercase" style={{ color: corGeral }}>%</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Drones Avaliados</span>
            <span className="text-2xl font-black text-slate-700 tracking-tighter leading-none">
              {totalDrones}
            </span>
          </div>
        </div>

        {/* Grade de Coletas: 1ª a 4ª */}
        <div className="px-5 py-4">
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((num) => {
              const val = coletasMedia[num - 1] || 0;
              const cor = QUALY_RULES.Drone.meta(val);
              return (
                <div key={num} className="flex flex-col items-center border-r last:border-0 border-slate-100">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">{num}ª Coleta</span>
                  <div className="flex items-baseline gap-px">
                    <span className="text-[14px] font-black tracking-tighter" style={{ color: cor }}>
                      {val > 0 ? '+' : ''}{val.toFixed(2)}
                    </span>
                    <span className="text-[7px] font-bold opacity-50 ml-0.5" style={{ color: cor }}>%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Link Técnico Padronizado */}
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

export default DroneCard;