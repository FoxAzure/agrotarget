import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { QUALY_RULES, COLORS } from '../../pages/QualyFlow/rules';

const AnimatedProgressBar = ({ value, color }) => {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(value), 150);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-0.5 shadow-inner">
      <div
        className="h-full rounded-full transition-all duration-[1500ms] ease-out"
        style={{
          width: `${width}%`,
          backgroundColor: color,
          boxShadow: width > 0 ? `0 0 8px ${color}80` : 'none'
        }}
      />
    </div>
  );
};

// Adicionado o selectedDate aqui nas props
const CucCard = ({ stats, to, selectedDate }) => {
  const { totais, campos } = stats;

  return (
    <section className="w-full max-w-[340px] animate-in fade-in zoom-in duration-500 mt-2 font-sans">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden group hover:border-agro-green/30 transition-all relative">

        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-agro-green to-agro-orange opacity-90" />

        <div className="px-4 pt-4 pb-2">
          <h2 className="text-[10px] font-black text-agro-green uppercase">
            CUC - Gotejo
          </h2>
        </div>

        <div className="px-4 py-3 flex justify-between bg-slate-50/50 border-y border-slate-100 shadow-inner">
          <div className="flex flex-col">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">Emissores Avaliados</span>
            <span className="text-2xl font-black text-slate-700 tracking-tighter leading-none">
              {totais.avaliados}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-black text-slate-500 uppercase tracking-tighter mb-0.5">Emissores Entupidos</span>
            <span className="text-2xl font-black tracking-tighter leading-none" style={{ color: totais.entupidos > 0 ? COLORS.fora : COLORS.dentro }}>
              {totais.entupidos}
            </span>
          </div>
        </div>

        <div className="px-4 py-3 flex flex-col gap-3">
          
          <div className="grid grid-cols-4 pb-1 border-b border-slate-200">
            <span className="text-left text-[8px] font-black text-slate-500 uppercase">Campo</span>
            <span className="text-center text-[8px] font-black text-slate-500 uppercase">CUC %</span>
            <span className="text-center text-[8px] font-black text-slate-500 uppercase">Vazão</span>
            <span className="text-right text-[8px] font-black text-slate-500 uppercase">Entup %</span>
          </div>

          {campos.map((c, idx) => {
            // Conversão blindada para garantir que o toFixed nunca quebre
            const cucNum = Number(c.cuc) || 0;
            const vazaoNum = Number(c.vazao) || 0;
            const entupNum = Number(c.entupPerc) || 0;

            return (
              <div key={idx} className="flex flex-col gap-1">
                <div className="grid grid-cols-4 items-end">
                  <span className="text-left text-[11px] font-black text-slate-700 uppercase truncate pr-1">
                    {c.nome}
                  </span>
                  {/* CUC com 2 casas decimais */}
                  <span className="text-center text-[12px] font-black tracking-tighter" style={{ color: QUALY_RULES.CUC.meta(cucNum) }}>
                    {cucNum.toFixed(2)}%
                  </span>
                  {/* Vazão com 1 casa decimal */}
                  <span className="text-center text-[12px] font-black tracking-tighter" style={{ color: QUALY_RULES.CUC.vazaoMeta(vazaoNum) }}>
                    {vazaoNum.toFixed(2)}
                    <span className="text-[7px] font-bold opacity-40 ml-0.5">L/h</span>
                  </span>
                  {/* Entupimento com 1 casa decimal */}
                  <span className="text-right text-[12px] font-black tracking-tighter" style={{ color: QUALY_RULES.CUC.entupimentoMeta(entupNum) }}>
                    {entupNum.toFixed(1)}%
                  </span>
                </div>
                
                <AnimatedProgressBar value={cucNum} color={QUALY_RULES.CUC.meta(cucNum)} />
              </div>
            );
          })}
        </div>

        <Link 
          to={to}
          state={{ selectedDate }} // Passando o bilhete com a data
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

export default CucCard;