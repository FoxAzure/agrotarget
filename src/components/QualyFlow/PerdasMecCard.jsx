import React from 'react';
import { Link } from 'react-router-dom';
import { COLORS } from '../../pages/QualyFlow/rules'; 

// ===========================================================================
// REGRAS LOCAIS (Baseadas no seu script Python diary_perdamec.py)
// ===========================================================================
const LOCAL_RULES = {
  Perda: (v) => v <= 4.5 ? COLORS.dentro : COLORS.fora,
  Arranquio: (v) => v <= 2.5 ? COLORS.dentro : COLORS.fora,
  PisoteioSimples: (v) => v <= 50.0 ? COLORS.dentro : COLORS.fora,
  PisoteioDuplo: (v) => v <= 2.0 ? COLORS.dentro : COLORS.fora,
};

const PerdasMecCard = ({ stats, selectedDate }) => {
  // Desestruturação esperada do objeto stats que virá do QualyFlowHome
  const { totais, kpis, campos } = stats;

  return (
    <section className="w-full max-w-[400px] animate-in fade-in zoom-in duration-500 mt-2 font-sans">
      <div className="bg-white border-2 border-slate-200/80 rounded-xl shadow-xl overflow-hidden group hover:border-agro-green/40 transition-all relative">
        
        {/* BARRA SUPERIOR DE DESTAQUE */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-agro-green to-agro-orange opacity-90 shadow-sm" />

        {/* HEADER */}
        <div className="px-5 pt-5 pb-3 flex justify-between items-center border-b border-slate-100 bg-slate-50/30">
          <h2 className="text-[13px] font-black text-agro-green uppercase tracking-widest">
            Perdas na Colheita Mecanizada
          </h2>
          <span className="text-[10px] font-bold text-slate-500 bg-white px-2.5 py-1 rounded border border-slate-200 shadow-sm">
             {campos.length} CAMPOS
          </span>
        </div>

        {/* BANNER DE MÉTRICAS GERAIS */}
        <div className="px-5 py-4 flex justify-between bg-slate-50/80 border-b border-slate-100 shadow-inner gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pontos Realizados</span>
            <span className="text-2xl font-black text-slate-700 tracking-tighter leading-none">
              {totais.pontos}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Colhedoras Avaliadas</span>
            <span className="text-2xl font-black text-slate-700 tracking-tighter leading-none">
              {totais.colhedoras}
            </span>
          </div>
        </div>

        {/* CONTEÚDO TÉCNICO */}
        <div className="px-5 py-4 flex flex-col gap-3">
          
          {/* INDICADORES GERAIS EM LINHA */}
          <div className="flex flex-col mb-2">
            <div className="flex justify-between items-center py-2.5 border-b border-slate-200">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Perdas</span>
              <span className="text-[15px] font-black tracking-tight" style={{ color: LOCAL_RULES.Perda(kpis.perdas) }}>
                {kpis.perdas.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-slate-200">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pisoteio Simples</span>
              <span className="text-[15px] font-black tracking-tight" style={{ color: LOCAL_RULES.PisoteioSimples(kpis.pisoteioSimples) }}>
                {kpis.pisoteioSimples.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-slate-200">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Pisoteio Duplo</span>
              <span className="text-[15px] font-black tracking-tight" style={{ color: LOCAL_RULES.PisoteioDuplo(kpis.pisoteioDuplo) }}>
                {kpis.pisoteioDuplo.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-slate-200">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Arranquio de Rizomas</span>
              <span className="text-[15px] font-black tracking-tight" style={{ color: LOCAL_RULES.Arranquio(kpis.arranquio) }}>
                {kpis.arranquio.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* TABELA DE RESULTADOS POR CAMPO */}
          <div className="flex flex-col gap-2 mt-1">
            <div className="grid grid-cols-4 pb-2 border-b border-slate-200">
              <span className="text-left text-[9px] font-black text-slate-400 uppercase tracking-wider">Campo</span>
              <span className="text-center text-[9px] font-black text-slate-400 uppercase tracking-wider">Perda</span>
              <span className="text-center text-[9px] font-black text-slate-400 uppercase tracking-wider">Pisoteio</span>
              <span className="text-right text-[9px] font-black text-slate-400 uppercase tracking-wider">Arranq.</span>
            </div>

            {campos.map((c, idx) => {
              const perdaNum = Number(c.perdas) || 0;
              const pisoNum = Number(c.pisoteio) || 0;
              const arranNum = Number(c.arranquio) || 0;
              
              // Lógica esperta: se o campo passar qual é a meta do pisoteio dele (2.0 ou 50.0), a cor obedece. 
              // Se não passar, caímos no fallback do Pisoteio Simples para não quebrar a UI.
              const pisoColor = c.metaPisoteio 
                ? (pisoNum <= c.metaPisoteio ? COLORS.dentro : COLORS.fora) 
                : LOCAL_RULES.PisoteioSimples(pisoNum);

              return (
                <div key={idx} className="grid grid-cols-4 items-center py-1.5 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <span className="text-left text-[11px] font-black text-slate-700 uppercase truncate pr-1">
                    {c.nome}
                  </span>
                  <span className="text-center text-[12px] font-black tracking-tighter" style={{ color: LOCAL_RULES.Perda(perdaNum) }}>
                    {perdaNum.toFixed(1)}%
                  </span>
                  <span className="text-center text-[12px] font-black tracking-tighter" style={{ color: pisoColor }}>
                    {pisoNum.toFixed(1)}%
                  </span>
                  <span className="text-right text-[12px] font-black tracking-tighter" style={{ color: LOCAL_RULES.Arranquio(arranNum) }}>
                    {arranNum.toFixed(1)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTÃO DE AÇÃO */}
        <Link 
          to="/qualyflow/perdasmec"
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

export default PerdasMecCard;