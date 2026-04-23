import React from 'react';
import { Link } from 'react-router-dom';
import { QUALY_RULES } from '../../pages/QualyFlow/rules';

const CasaBombaCard = ({ stats, to }) => {
  const { ebs } = stats;

  return (
    <section className="w-full max-w-[340px] animate-in fade-in zoom-in duration-500 mt-2 font-sans">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden group hover:border-agro-green/30 transition-all relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-agro-green to-agro-orange opacity-90" />
        
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-[10px] font-black text-agro-green uppercase">
            Casa de Bomba (EB)
          </h2>
        </div>

        {/* Tabela de EBs - Colunas Ajustadas para o Não Conforme */}
        <div className="px-4 py-3 flex flex-col gap-3">
          {/* Grid recalibrado: EB(1fr) | Telas(40px) | Caixas(40px) | Org(85px) */}
          <div className="grid grid-cols-[1fr_40px_40px_85px] pb-1 border-b border-slate-200">
            <span className="text-left text-[8px] font-black text-slate-500 uppercase">EB Referência</span>
            <span className="text-center text-[8px] font-black text-slate-500 uppercase">Telas</span>
            <span className="text-center text-[8px] font-black text-slate-500 uppercase">Caixas</span>
            <span className="text-right text-[8px] font-black text-slate-500 uppercase pr-1">Org.</span>
          </div>

          <div className="flex flex-col gap-2">
            {ebs.map((eb, idx) => {
              const corTelas = QUALY_RULES.CasaBomba.percentual(eb.telasPerc);
              const corCaixas = QUALY_RULES.CasaBomba.percentual(eb.caixasPerc);
              const corOrg = QUALY_RULES.CasaBomba.status(eb.organizacao);

              return (
                <div key={idx} className="grid grid-cols-[1fr_40px_40px_85px] items-center pb-1 border-b border-slate-100 last:border-0">
                  <span className="text-left text-[10px] font-black text-slate-700 uppercase truncate pr-1">
                    {eb.referencia}
                  </span>
                  <span className="text-center text-[11px] font-black tracking-tighter" style={{ color: corTelas }}>
                    {eb.telasPerc.toFixed(0)}%
                  </span>
                  <span className="text-center text-[11px] font-black tracking-tighter" style={{ color: corCaixas }}>
                    {eb.caixasPerc.toFixed(0)}%
                  </span>
                  <span className="text-right text-[9px] font-black tracking-tighter uppercase whitespace-nowrap pr-1" style={{ color: corOrg }}>
                    {eb.organizacao}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <Link to={to} className="w-full py-3 bg-slate-50/80 border-t border-slate-100 flex justify-center items-center group-hover:bg-green-50 transition-all">
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

export default CasaBombaCard;