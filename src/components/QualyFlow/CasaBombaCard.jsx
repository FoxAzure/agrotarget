import React from 'react';
import { Link } from 'react-router-dom';
import { QUALY_RULES } from '../../pages/QualyFlow/rules';

const CasaBombaCard = ({ stats, to }) => {
  const { ebs } = stats;

  return (
    <section className="w-full max-w-[400px] animate-in fade-in zoom-in duration-500 mt-2 font-sans">
      <div className="bg-white border-2 border-slate-200/80 rounded-xl shadow-xl overflow-hidden group hover:border-agro-green/40 transition-all relative">
        
        {/* Fita Premium no Topo (h-1.5) */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-agro-green to-agro-orange opacity-90 shadow-sm" />
        
        {/* Header Compacto Padronizado */}
        <div className="px-5 pt-4 pb-2 border-b border-slate-100 bg-slate-50/30">
          <h2 className="text-[13px] font-black text-agro-green uppercase tracking-widest leading-none">
            Casa de Bomba (EB)
          </h2>
        </div>

        {/* Tabela de EBs - Colunas Ajustadas para os 400px */}
        <div className="px-5 py-4 flex flex-col gap-3.5">
          {/* Grid recalibrado com mais espaço: EB(1fr) | Telas(50px) | Caixas(50px) | Org(95px) */}
          <div className="grid grid-cols-[1fr_50px_50px_95px] pb-1.5 border-b border-slate-200">
            <span className="text-left text-[9px] font-black text-slate-400 uppercase tracking-wider">EB Referência</span>
            <span className="text-center text-[9px] font-black text-slate-400 uppercase tracking-wider">Telas</span>
            <span className="text-center text-[9px] font-black text-slate-400 uppercase tracking-wider">Caixas</span>
            <span className="text-right text-[9px] font-black text-slate-400 uppercase tracking-wider pr-1">Org.</span>
          </div>

          <div className="flex flex-col gap-2.5">
            {ebs.map((eb, idx) => {
              const corTelas = QUALY_RULES.CasaBomba.percentual(eb.telasPerc);
              const corCaixas = QUALY_RULES.CasaBomba.percentual(eb.caixasPerc);
              const corOrg = QUALY_RULES.CasaBomba.status(eb.organizacao);

              return (
                <div key={idx} className="grid grid-cols-[1fr_50px_50px_95px] items-center pb-1.5 border-b border-slate-100 last:border-0 last:pb-0">
                  <span className="text-left text-[12px] font-black text-slate-700 uppercase truncate pr-2">
                    {eb.referencia}
                  </span>
                  <span className="text-center text-[13px] font-black tracking-tighter" style={{ color: corTelas }}>
                    {eb.telasPerc.toFixed(0)}%
                  </span>
                  <span className="text-center text-[13px] font-black tracking-tighter" style={{ color: corCaixas }}>
                    {eb.caixasPerc.toFixed(0)}%
                  </span>
                  <span className="text-right text-[11px] font-black tracking-tighter uppercase whitespace-nowrap pr-1" style={{ color: corOrg }}>
                    {eb.organizacao}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Link Técnico Padronizado (py-2.5) */}
        <Link to={to} className="w-full py-2.5 bg-[#F8FAFC] border-t border-slate-100 flex justify-center items-center group-hover:bg-agro-green/5 transition-all">
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

export default CasaBombaCard;