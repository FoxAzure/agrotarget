import React from 'react';
import { Link } from 'react-router-dom';
import { QUALY_RULES } from '../../pages/QualyFlow/rules';

const CompostoCard = ({ stats, to, selectedDate }) => {
  const { geralTon, geralVar, implementos } = stats;

  const tonValue = Number(geralTon) || 0;
  const varValue = Number(geralVar) || 0;

  const geralTonColor = QUALY_RULES.Composto.ton(tonValue);
  const geralVarColor = QUALY_RULES.Composto.variacao(varValue);

  return (
    <section className="w-full max-w-[340px] animate-in fade-in zoom-in duration-500 mt-2 font-sans">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden group hover:border-agro-green/30 transition-all relative">
        
        {/* Fita Premium no Topo */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-agro-green to-agro-orange opacity-90" />
        
        {/* Título Padronizado */}
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-[10px] font-black text-agro-green uppercase">
            Aplicação de Composto
          </h2>
        </div>

        {/* Resumo Geral */}
        <div className="px-4 py-3 flex justify-between bg-slate-50/50 border-y border-slate-100 shadow-inner">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">Média ton/ha</span>
            <span className="text-2xl font-black text-slate-700 tracking-tighter leading-none" style={{ color: geralTonColor }}>
              {tonValue.toFixed(1)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">Variação Geral</span>
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-black tracking-tighter leading-none" style={{ color: geralVarColor }}>
                {varValue > 0 ? '+' : ''}{varValue.toFixed(1)}
              </span>
              <span className="text-[10px] font-black opacity-60 uppercase" style={{ color: geralVarColor }}>%</span>
            </div>
          </div>
        </div>

        {/* Tabela de Implementos */}
        <div className="px-4 py-3 flex flex-col gap-3">
          <div className="grid grid-cols-[1fr_60px_60px] pb-1 border-b border-slate-200">
            <span className="text-left text-[8px] font-black text-slate-500 uppercase">Implemento</span>
            <span className="text-center text-[8px] font-black text-slate-500 uppercase">ton/ha</span>
            <span className="text-right text-[8px] font-black text-slate-500 uppercase">var%</span>
          </div>

          <div className="flex flex-col gap-2">
            {implementos.map((impl, idx) => {
              const tonColor = QUALY_RULES.Composto.ton(impl.valor);
              const varColor = QUALY_RULES.Composto.variacao(impl.variacao);

              return (
                <div key={idx} className="grid grid-cols-[1fr_60px_60px] items-end pb-1 border-b border-slate-100 last:border-0">
                  <span className="text-left text-[11px] font-black text-slate-700 uppercase truncate pr-1">
                    {impl.nome}
                  </span>
                  <span className="text-center text-[12px] font-black tracking-tighter" style={{ color: tonColor }}>
                    {impl.valor.toFixed(1)}
                  </span>
                  <span className="text-right text-[12px] font-black tracking-tighter" style={{ color: varColor }}>
                    {impl.variacao > 0 ? '+' : ''}{impl.variacao.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Link Técnico Padronizado - LIMPO E SEM COMENTÁRIOS INTERNOS */}
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

export default CompostoCard;