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
    <section className="w-full max-w-[400px] animate-in fade-in zoom-in duration-500 mt-2 font-sans">
      <div className="bg-white border-2 border-slate-200/80 rounded-xl shadow-xl overflow-hidden group hover:border-agro-green/40 transition-all relative">
        
        {/* Fita Premium no Topo (h-1.5) */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-agro-green to-agro-orange opacity-90 shadow-sm" />
        
        {/* Título Padronizado */}
        <div className="px-5 pt-4 pb-2 border-b border-slate-100 bg-slate-50/30">
          <h2 className="text-[13px] font-black text-agro-green uppercase tracking-widest leading-none">
            Aplicação de Composto
          </h2>
        </div>

        {/* Resumo Geral */}
        <div className="px-5 py-3.5 flex justify-between bg-slate-50/50 border-b border-slate-100 shadow-inner">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Média ton/ha</span>
            <span className="text-2xl font-black text-slate-700 tracking-tighter leading-none" style={{ color: geralTonColor }}>
              {tonValue.toFixed(1)}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Variação Geral</span>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-black tracking-tighter leading-none" style={{ color: geralVarColor }}>
                {varValue > 0 ? '+' : ''}{varValue.toFixed(1)}
              </span>
              <span className="text-[10px] font-black opacity-60 uppercase" style={{ color: geralVarColor }}>%</span>
            </div>
          </div>
        </div>

        {/* Tabela de Implementos - Espaçamento ajustado para 400px */}
        <div className="px-5 py-4 flex flex-col gap-3.5">
          <div className="grid grid-cols-[1fr_70px_70px] pb-1.5 border-b border-slate-200">
            <span className="text-left text-[9px] font-black text-slate-400 uppercase tracking-wider">Implemento</span>
            <span className="text-center text-[9px] font-black text-slate-400 uppercase tracking-wider">ton/ha</span>
            <span className="text-right text-[9px] font-black text-slate-400 uppercase tracking-wider">var%</span>
          </div>

          <div className="flex flex-col gap-2.5">
            {implementos.map((impl, idx) => {
              const tonColor = QUALY_RULES.Composto.ton(impl.valor);
              const varColor = QUALY_RULES.Composto.variacao(impl.variacao);

              return (
                <div key={idx} className="grid grid-cols-[1fr_70px_70px] items-end pb-1.5 border-b border-slate-100 last:border-0 last:pb-0">
                  <span className="text-left text-[12px] font-black text-slate-700 uppercase truncate pr-2">
                    {impl.nome}
                  </span>
                  <span className="text-center text-[13px] font-black tracking-tighter" style={{ color: tonColor }}>
                    {impl.valor.toFixed(1)}
                  </span>
                  <span className="text-right text-[13px] font-black tracking-tighter" style={{ color: varColor }}>
                    {impl.variacao > 0 ? '+' : ''}{impl.variacao.toFixed(1)}
                  </span>
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

export default CompostoCard;