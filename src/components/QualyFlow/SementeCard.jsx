import React from 'react';
import { Link } from 'react-router-dom';
import { QUALY_RULES, COLORS } from '../../pages/QualyFlow/rules';

const SementeCard = ({ stats, to, selectedDate }) => {
  const { gemasPerc, idade, tamanhoMedio, pisoteioPerc, tipoIrrig, variedades } = stats;

  const isGotejo = ["GOTEJO", "GOTEJAMENTO"].includes(tipoIrrig?.toUpperCase());
  const metaPisoteio = isGotejo ? 0 : 50;
  const pisoteioCor = Number(pisoteioPerc) > metaPisoteio ? COLORS.fora : COLORS.dentro;

  // Garantindo a precisão de 2 casas decimais solicitada
  const gemasNum = Number(gemasPerc) || 0;

  return (
    <section className="w-full max-w-[400px] animate-in fade-in zoom-in duration-500 mt-2 font-sans">
      <div className="bg-white border-2 border-slate-200/80 rounded-xl shadow-xl overflow-hidden group hover:border-agro-green/40 transition-all relative">
        
        {/* Detalhe Premium Superior (h-1.5) */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-agro-green to-agro-orange opacity-90 shadow-sm" />

        {/* Header Ultra Slim Padronizado */}
        <div className="px-5 pt-4 pb-2 border-b border-slate-100 bg-slate-50/30">
          <h2 className="text-[13px] font-black text-agro-green uppercase tracking-widest leading-none">
            Avaliação de Semente
          </h2>
        </div>

        {/* Corpo 65/35 Compactado e Robusto (Proporção ajustada para os 400px) */}
        <div className="flex border-b border-slate-100 bg-white">
          
          {/* Coluna Esquerda: Gráfico Ampliado + Variedade Centralizada */}
          <div className="w-[60%] flex flex-col items-center justify-center py-6 border-r border-slate-100 bg-slate-50/50 shadow-inner">
            <div className="relative flex items-center justify-center w-40 h-20">
              <svg className="w-full h-full absolute top-1" viewBox="0 0 100 50">
                <path 
                  d="M 10 48 A 40 40 0 0 1 90 48" 
                  fill="none" 
                  stroke="#F1F5F9" 
                  strokeWidth="12" 
                  strokeLinecap="round" 
                />
                <path 
                  d="M 10 48 A 40 40 0 0 1 90 48" 
                  fill="none" 
                  stroke={QUALY_RULES.GemasViáveis.meta(gemasNum)} 
                  strokeWidth="12" 
                  strokeLinecap="round"
                  strokeDasharray={`${(Math.min(gemasNum, 100) / 100) * 126} 126`} 
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="flex flex-col items-center justify-center mt-8 translate-y-1">
                <span className="text-2xl font-black text-slate-700 tracking-tighter leading-none" style={{ color: QUALY_RULES.GemasViáveis.meta(gemasNum) }}>
                  {gemasNum.toFixed(1)}%
                </span>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                  Gemas Viáveis
                </p>
              </div>
            </div>

            {/* Variedades logo abaixo para compactar o layout */}
            <div className="flex flex-wrap justify-center gap-1.5 mt-7 px-3">
              {variedades.map(v => (
                <span key={v} className="text-[9px] font-black bg-white text-slate-600 px-2.5 py-1 rounded border border-slate-200 shadow-sm uppercase tracking-widest">
                  {v}
                </span>
              ))}
            </div>
          </div>

          {/* Coluna Direita: Indicadores Empilhados (Ajustado para px-5) */}
          <div className="w-[40%] flex flex-col justify-center gap-5 px-6 py-5">
            <div className="flex flex-col">
              <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Idade</h3>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black tracking-tighter leading-none" style={{ color: QUALY_RULES.Semente.idade(idade) }}>
                  {Number(idade).toFixed(1) || '--'}
                </span>
                <span className="text-[9px] font-bold text-slate-300 uppercase italic">m</span>
              </div>
            </div>

            <div className="flex flex-col">
              <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Rebolos</h3>
              <span className="text-2xl font-black tracking-tighter leading-none" style={{ color: QUALY_RULES.Semente.tamanho(tamanhoMedio) }}>
                {Number(tamanhoMedio).toFixed(1) || '--'}
              </span>
            </div>

            <div className="flex flex-col">
              <h3 className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">Pisoteio</h3>
              <span className="text-2xl font-black tracking-tighter leading-none" style={{ color: pisoteioCor }}>
                {Number(pisoteioPerc).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Botão de Detalhes Padronizado */}
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

export default SementeCard;