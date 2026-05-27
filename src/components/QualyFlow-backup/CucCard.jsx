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
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-1.5 shadow-inner border border-slate-200/50">
      <div
        className="h-full rounded-full transition-all duration-[1500ms] ease-out"
        style={{
          width: `${Math.min(width, 100)}%`,
          backgroundColor: color,
          boxShadow: width > 0 ? `0 0 8px ${color}60` : 'none'
        }}
      />
    </div>
  );
};

const CucCard = ({ stats, to, selectedDate }) => {
  const { totais, campos } = stats;

  return (
    // LARGURA PADRONIZADA: max-w-[400px] para alinhar com o COA Center
    <section className="w-full max-w-[400px] animate-in fade-in zoom-in duration-500 mt-2 font-sans">
      <div className="bg-white border-2 border-slate-200/80 rounded-xl shadow-xl overflow-hidden group hover:border-agro-green/40 transition-all relative">

        {/* BARRA SUPERIOR: Aumentada para 6px (h-1.5) para mais destaque */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-agro-green to-agro-orange opacity-90 shadow-sm" />

        {/* Header Padronizado com o COA */}
        <div className="px-5 pt-5 pb-3 flex justify-between items-center border-b border-slate-100 bg-slate-50/30">
          <h2 className="text-[13px] font-black text-agro-green uppercase tracking-widest">
            CUC - Gotejo
          </h2>
          <span className="text-[10px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200 shadow-sm">
             {campos.length} CAMPOS
          </span>
        </div>

        {/* Banner de Métricas (Destaque) */}
        <div className="px-5 py-4 flex justify-between bg-slate-50/80 border-b border-slate-100 shadow-inner gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Emissores Avaliados</span>
            <span className="text-2xl font-black text-slate-700 tracking-tighter leading-none">
              {totais.avaliados}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Emissores Entupidos</span>
            <span className="text-2xl font-black tracking-tighter leading-none" style={{ color: totais.entupidos > 0 ? COLORS.fora : COLORS.dentro }}>
              {totais.entupidos}
            </span>
          </div>
        </div>

        {/* Listagem Técnica */}
        <div className="px-5 py-5 flex flex-col gap-4">
          
          <div className="grid grid-cols-4 pb-2 border-b border-slate-200">
            <span className="text-left text-[9px] font-black text-slate-400 uppercase tracking-wider">Campo</span>
            <span className="text-center text-[9px] font-black text-slate-400 uppercase tracking-wider">CUC %</span>
            <span className="text-center text-[9px] font-black text-slate-400 uppercase tracking-wider">Vazão</span>
            <span className="text-right text-[9px] font-black text-slate-400 uppercase tracking-wider">Entup %</span>
          </div>

          {campos.map((c, idx) => {
            const cucNum = Number(c.cuc) || 0;
            const vazaoNum = Number(c.vazao) || 0;
            const entupNum = Number(c.entupPerc) || 0;

            return (
              <div key={idx} className="flex flex-col gap-1.5">
                <div className="grid grid-cols-4 items-end">
                  <span className="text-left text-[12px] font-black text-slate-700 uppercase truncate pr-1">
                    {c.nome}
                  </span>
                  <span className="text-center text-[13px] font-black tracking-tighter" style={{ color: QUALY_RULES.CUC.meta(cucNum) }}>
                    {cucNum.toFixed(2)}%
                  </span>
                  <span className="text-center text-[13px] font-black tracking-tighter" style={{ color: QUALY_RULES.CUC.vazaoMeta(vazaoNum) }}>
                    {vazaoNum.toFixed(2)}
                    <span className="text-[8px] font-bold opacity-40 ml-0.5">L/h</span>
                  </span>
                  <span className="text-right text-[13px] font-black tracking-tighter" style={{ color: QUALY_RULES.CUC.entupimentoMeta(entupNum) }}>
                    {entupNum.toFixed(1)}%
                  </span>
                </div>
                
                <AnimatedProgressBar value={cucNum} color={QUALY_RULES.CUC.meta(cucNum)} />
              </div>
            );
          })}
        </div>

        {/* Botão de Ação: Nome Atualizado e py-3.5 */}
        <Link 
          to={to}
          state={{ selectedDate }}
          className="w-full py-3.5 bg-[#F8FAFC] border-t border-slate-100 flex justify-center items-center group-hover:bg-agro-green/5 transition-all"
        >
          <div className="flex items-center gap-2 opacity-70 group-hover:opacity-100">
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

export default CucCard;