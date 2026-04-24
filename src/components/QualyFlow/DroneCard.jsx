import React from 'react';
import { Link } from 'react-router-dom';
import { QUALY_RULES, COLORS } from '../../pages/QualyFlow/rules';

const DroneCard = ({ stats, to, selectedDate }) => {
  const { variacaoGeral, coletasMedia, totalDrones } = stats;

  const corGeral = QUALY_RULES.Drone.meta(variacaoGeral);
  const isFora = corGeral === COLORS.fora;

  return (
    <section className="w-full max-w-[340px] animate-in fade-in zoom-in duration-500 mt-2 font-sans">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden group hover:border-agro-green/30 transition-all relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-agro-green to-agro-orange opacity-90" />
        
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-[10px] font-black text-agro-green uppercase">
            Avaliação Drone
          </h2>
        </div>

        {/* Hero Section: Variação Geral do Dia */}
        <div className="px-4 py-3 flex justify-between bg-slate-50/50 border-y border-slate-100 shadow-inner">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">Variação Média Geral</span>
            <div className="flex items-baseline gap-0.5">
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
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">Drones Avaliados</span>
            <span className="text-2xl font-black text-slate-700 tracking-tighter leading-none">
              {totalDrones}
            </span>
          </div>
        </div>

        {/* Grade de Coletas: 1ª a 4ª */}
        <div className="px-4 py-4">
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((num) => {
              const val = coletasMedia[num - 1] || 0;
              const cor = QUALY_RULES.Drone.meta(val);
              return (
                <div key={num} className="flex flex-col items-center border-r last:border-0 border-slate-100">
                  <span className="text-[8px] font-black text-slate-400 uppercase mb-1">{num}ª Coleta</span>
                  <div className="flex items-baseline gap-px">
                    <span className="text-[13px] font-black tracking-tighter" style={{ color: cor }}>
                      {val > 0 ? '+' : ''}{val.toFixed(2)}
                    </span>
                    <span className="text-[6px] font-bold opacity-40" style={{ color: cor }}>%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Passando o bilhete (state) no Link */}
        <Link 
          to={to} 
          state={{ selectedDate }} 
          className="w-full py-3 bg-slate-50/80 border-t border-slate-100 flex justify-center items-center group-hover:bg-green-50 transition-all"
        >
          <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100">
            <span className="text-[9px] font-black text-slate-500 group-hover:text-agro-green uppercase tracking-[0.2em]">
              Detalhes Técnicos
            </span>
            <span className="text-slate-400 group-hover:text-agro-green text-[12px] font-bold">→</span>
          </div>
        </Link>
      </div>
    </section>
  );
};

export default DroneCard;