import React from 'react';
import { Link } from 'react-router-dom';
import { QUALY_RULES, COLORS } from '../../pages/QualyFlow/rules';

const SementeCard = ({ stats, to }) => {
  const { gemasPerc, idade, tamanhoMedio, pisoteioPerc, tipoIrrig, variedades } = stats;

  const isGotejo = ["GOTEJO", "GOTEJAMENTO"].includes(tipoIrrig?.toUpperCase());
  const metaPisoteio = isGotejo ? 0 : 50;
  const pisoteioCor = Number(pisoteioPerc) > metaPisoteio ? COLORS.fora : COLORS.dentro;

  // Garantindo a precisão de 2 casas decimais solicitada
  const gemasNum = Number(gemasPerc) || 0;

  return (
    <section className="w-full max-w-[340px] animate-in fade-in zoom-in duration-500 mt-2 font-sans">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden group hover:border-agro-green/30 transition-all relative">
        
        {/* Detalhe Premium Superior */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-agro-green to-agro-orange opacity-90" />

        {/* Header Ultra Slim */}
        <div className="px-4 pt-4 pb-1">
          <h2 className="text-[10px] font-black text-agro-green uppercase tracking-widest leading-none">
            Avaliação de Semente
          </h2>
        </div>

        {/* Corpo 70/30 Compactado e Robusto */}
        <div className="flex border-y border-slate-50 bg-slate-50/5">
          
          {/* Coluna Esquerda: Gráfico Ampliado + Variedade Centralizada */}
          <div className="w-[65%] flex flex-col items-center justify-center py-5 border-r border-slate-100">
            <div className="relative flex items-center justify-center w-36 h-18">
              <svg className="w-full h-full absolute top-1" viewBox="0 0 100 50">
                <path 
                  d="M 12 48 A 38 38 0 0 1 88 48" 
                  fill="none" 
                  stroke="#F1F5F9" 
                  strokeWidth="13" 
                  strokeLinecap="round" 
                />
                <path 
                  d="M 12 48 A 38 38 0 0 1 88 48" 
                  fill="none" 
                  stroke={QUALY_RULES.GemasViáveis.meta(gemasNum)} 
                  strokeWidth="13" 
                  strokeLinecap="round"
                  strokeDasharray={`${(Math.min(gemasNum, 100) / 100) * 120} 120`} 
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="flex flex-col items-center justify-center mt-7 translate-y-1">
                <span className="text-[26px] font-black text-slate-700 tracking-tighter leading-none">
                  {gemasNum.toFixed(2)}%
                </span>
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                  Gemas Viáveis
                </p>
              </div>
            </div>

            {/* Variedades logo abaixo para compactar o layout */}
            <div className="flex flex-wrap justify-center gap-1 mt-5 px-2">
              {variedades.map(v => (
                <span key={v} className="text-[8px] font-black bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200/60 shadow-sm uppercase tracking-tighter">
                  {v}
                </span>
              ))}
            </div>
          </div>

          {/* Coluna Direita: Indicadores Empilhados */}
          <div className="w-[35%] flex flex-col justify-center gap-4 px-4 py-4">
            <div className="flex flex-col">
              <h3 className="text-[7px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-1">Idade</h3>
              <div className="flex items-baseline gap-0.5">
                <span className="text-xl font-black tracking-tighter leading-none" style={{ color: QUALY_RULES.Semente.idade(idade) }}>
                  {Number(idade).toFixed(1) || '--'}
                </span>
                <span className="text-[6px] font-bold text-slate-300 uppercase italic">m</span>
              </div>
            </div>

            <div className="flex flex-col">
              <h3 className="text-[7px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-1">Rebolos</h3>
              <span className="text-xl font-black tracking-tighter leading-none" style={{ color: QUALY_RULES.Semente.tamanho(tamanhoMedio) }}>
                {Number(tamanhoMedio).toFixed(1) || '--'}
              </span>
            </div>

            <div className="flex flex-col">
              <h3 className="text-[7px] font-black text-slate-400 uppercase tracking-tighter leading-none mb-1">Pisoteio</h3>
              <span className="text-xl font-black tracking-tighter leading-none" style={{ color: pisoteioCor }}>
                {Number(pisoteioPerc).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Botão de Detalhes Slim */}
        <Link 
          to={to}
          className="w-full py-2.5 bg-slate-50/80 border-t border-slate-100 flex justify-center items-center group-hover:bg-green-50 transition-all"
        >
          <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100">
            <span className="text-[8px] font-black text-slate-500 group-hover:text-agro-green uppercase tracking-widest">
              Detalhes Técnicos
            </span>
            <span className="text-slate-400 group-hover:text-agro-green text-[10px] font-bold">→</span>
          </div>
        </Link>
      </div>
    </section>
  );
};

export default SementeCard;