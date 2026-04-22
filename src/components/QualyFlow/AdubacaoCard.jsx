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
    <section className="w-full max-w-[340px] animate-in fade-in zoom-in duration-500 mt-2 font-sans">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden group hover:border-agro-green/30 transition-all relative">
        
        {/* Fita Premium no Topo */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-agro-green to-agro-orange opacity-90" />
        
        <div className="px-4 pt-5 pb-2">
          <h2 className="text-[10px] font-black text-agro-green uppercase tracking-widest leading-none">
            {title}
          </h2>
        </div>

        {/* Seletores Slim */}
        <div className="px-4 py-2 flex gap-1.5 bg-slate-50/50 border-y border-slate-100">
          {stats.has2L && (
            <button 
              onClick={() => setTipo(2)}
              className={`text-[8px] font-black px-2.5 py-1 rounded transition-all uppercase tracking-tighter ${tipo === 2 ? 'bg-agro-green text-white shadow-sm' : 'bg-white text-slate-400 border border-slate-200 hover:border-agro-green/50'}`}
            >
              2 Linhas
            </button>
          )}
          {stats.has3L && (
            <button 
              onClick={() => setTipo(3)}
              className={`text-[8px] font-black px-2.5 py-1 rounded transition-all uppercase tracking-tighter ${tipo === 3 ? 'bg-agro-green text-white shadow-sm' : 'bg-white text-slate-400 border border-slate-200 hover:border-agro-green/50'}`}
            >
              3 Linhas
            </button>
          )}
        </div>

        {/* Display Compacto: Inspirado no IndicatorRow */}
        <div className="px-4 py-5 flex flex-col items-center justify-center bg-white">
          <h3 
            className={`text-[8px] font-black uppercase tracking-tight leading-none mb-1 transition-all duration-500 ${isFora ? 'animate-pulse' : ''}`}
            style={{ 
              color: color,
              textShadow: isFora ? `0 0 12px ${color}` : 'none'
            }}
          >
            Variação Média
          </h3>
          <div className="flex items-baseline gap-0.5">
            <span 
              className="text-2xl font-black tracking-tighter leading-none transition-all duration-500"
              style={{ 
                color: color,
                textShadow: isFora ? `0 0 15px ${color}80` : 'none'
              }}
            >
              {variacao > 0 ? '+' : ''}{Number(variacao).toFixed(1)}
            </span>
            <span className="text-[8px] font-bold text-slate-400 uppercase opacity-60 ml-0.5 tracking-tighter">
              %
            </span>
          </div>
        </div>

        {/* Link Técnico Padronizado */}
        <Link 
          to={to} 
          className="w-full py-3 bg-slate-50/80 border-t border-slate-100 flex justify-center items-center group-hover:bg-green-50 transition-all"
        >
          <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100">
            <span className="text-[9px] font-black text-slate-500 group-hover:text-agro-green uppercase tracking-widest">
              Detalhes Técnicos
            </span>
            <span className="text-slate-400 group-hover:text-agro-green text-[12px] font-bold">→</span>
          </div>
        </Link>
      </div>
    </section>
  );
};

export default AdubacaoCard;