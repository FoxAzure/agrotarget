import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { QUALY_RULES } from '../../pages/QualyFlow/rules';

const AdubacaoCard = ({ title, stats, to }) => {
  // Define o tipo inicial: 2L se existir, senão 3L
  const [tipo, setTipo] = useState(stats.has2L ? 2 : 3);
  
  const variacao = tipo === 2 ? stats.variacao2L : stats.variacao3L;
  const color = QUALY_RULES.Adubacao.meta(variacao);
  const isFora = color === '#FF0000';

  return (
    <section className="w-full max-w-[400px] animate-in fade-in zoom-in duration-500 mt-2 font-sans">
      <div className="bg-white border-2 border-slate-200/80 rounded-xl shadow-xl overflow-hidden group hover:border-agro-green/40 transition-all relative">
        
        {/* Fita Premium no Topo (h-1.5) */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-agro-green to-agro-orange opacity-90 shadow-sm" />
        
        {/* Header Compacto Padronizado */}
        <div className="px-5 pt-4 pb-2 border-b border-slate-100 bg-slate-50/30">
          <h2 className="text-[13px] font-black text-agro-green uppercase tracking-widest leading-none">
            {title}
          </h2>
        </div>

        {/* Seletores Slim (Paddings ajustados para px-5) */}
        <div className="px-5 py-2.5 flex gap-2 bg-slate-50/50 border-y border-slate-100 shadow-inner">
          {stats.has2L && (
            <button 
              onClick={() => setTipo(2)}
              className={`text-[9px] font-black px-3 py-1.5 rounded transition-all uppercase tracking-widest ${tipo === 2 ? 'bg-agro-green text-white shadow-sm' : 'bg-white text-slate-400 border border-slate-200 hover:border-agro-green/50 hover:text-slate-500'}`}
            >
              2 Linhas
            </button>
          )}
          {stats.has3L && (
            <button 
              onClick={() => setTipo(3)}
              className={`text-[9px] font-black px-3 py-1.5 rounded transition-all uppercase tracking-widest ${tipo === 3 ? 'bg-agro-green text-white shadow-sm' : 'bg-white text-slate-400 border border-slate-200 hover:border-agro-green/50 hover:text-slate-500'}`}
            >
              3 Linhas
            </button>
          )}
        </div>

        {/* Display Compacto: Inspirado no IndicatorRow */}
        <div className="px-5 py-4 flex flex-col items-center justify-center bg-white">
          <h3 
            className={`text-[10px] font-black uppercase tracking-widest leading-none mb-1.5 transition-all duration-500 ${isFora ? 'animate-pulse' : ''}`}
            style={{ 
              color: color,
              textShadow: isFora ? `0 0 12px ${color}` : 'none'
            }}
          >
            Variação Média
          </h3>
          <div className="flex items-baseline gap-1">
            <span 
              className="text-2xl font-black tracking-tighter leading-none transition-all duration-500"
              style={{ 
                color: color,
                textShadow: isFora ? `0 0 15px ${color}80` : 'none'
              }}
            >
              {variacao > 0 ? '+' : ''}{Number(variacao).toFixed(1)}
            </span>
            <span className="text-[9px] font-bold text-slate-400 uppercase opacity-60 ml-0.5 tracking-tighter">
              %
            </span>
          </div>
        </div>

        {/* Link Técnico Padronizado (py-2.5) */}
        <Link 
          to={to} 
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

export default AdubacaoCard;