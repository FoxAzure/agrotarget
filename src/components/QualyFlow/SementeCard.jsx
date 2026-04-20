import React from 'react';
import { QUALY_RULES, COLORS } from '../../pages/QualyFlow/rules';

const SementeCard = ({ stats }) => {
  const { gemasPerc, idade, tamanhoMedio, pisoteioPerc, tipoIrrig, variedades } = stats;

  const isGotejo = ["GOTEJO", "GOTEJAMENTO"].includes(tipoIrrig?.toUpperCase());
  const metaPisoteio = isGotejo ? 0 : 50;
  const pisoteioCor = pisoteioPerc > metaPisoteio ? COLORS.fora : COLORS.dentro;

  return (
    <section className="w-full max-w-[340px] animate-in fade-in zoom-in duration-500 mt-2 font-sans">
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden group hover:border-agro-orange/40 transition-all">
        
        <div className="px-4 pt-3 pb-1">
          <h2 className="text-[9px] font-black text-agro-green uppercase tracking-[0.3em]">Avaliação de Semente</h2>
          <div className="w-full h-[1.5px] bg-agro-orange mt-1 opacity-90" />
        </div>

        <div className="p-4 flex items-center justify-between gap-8">
          
          {/* Lado Esquerdo: Velocímetro maior e mais espesso (gorduchinho) */}
          <div className="relative flex flex-col items-center justify-center min-w-[100px]">
            <svg className="w-28 h-14" viewBox="0 0 100 50">
              <path 
                d="M 12 48 A 38 38 0 0 1 88 48" 
                fill="none" 
                stroke="#F1F5F9" 
                strokeWidth="14" 
                strokeLinecap="round" 
              />
              <path 
                d="M 12 48 A 38 38 0 0 1 88 48" 
                fill="none" 
                stroke={QUALY_RULES.GemasViáveis.meta(gemasPerc)} 
                strokeWidth="14" 
                strokeLinecap="round"
                strokeDasharray={`${(gemasPerc / 100) * 120} 120`} 
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="mt-2 text-center">
              <span className="text-2xl font-black text-agro-green tracking-tighter leading-none">{gemasPerc}%</span>
              <p className="text-[7px] font-black text-slate-400 uppercase leading-none mt-1 tracking-tight">Gemas Viáveis</p>
            </div>
          </div>

          {/* Lado Direito: Dados Técnicos movidos para a extremidade */}
          <div className="flex flex-col gap-3 flex-grow border-l border-slate-100 pl-5">
            
            <div className="flex flex-col">
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Idade Semente</p>
              <span className="text-sm font-black tracking-tighter leading-none" style={{ color: QUALY_RULES.Semente.idade(idade) }}>
                {idade || '--'} <span className="text-[8px] italic text-slate-300">meses</span>
              </span>
            </div>

            <div className="flex flex-col">
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Rebolos (cm)</p>
              <span className="text-sm font-black tracking-tighter leading-none" style={{ color: QUALY_RULES.Semente.tamanho(tamanhoMedio) }}>
                {tamanhoMedio || '--'}
              </span>
            </div>

            <div className="flex flex-col">
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-tighter">Pisoteio</p>
              <span className="text-sm font-black tracking-tighter leading-none" style={{ color: pisoteioCor }}>
                {pisoteioPerc}%
              </span>
            </div>

          </div>
        </div>

        {/* Footer com as Variedades - Mantido Compacto */}
        <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 flex gap-1.5 overflow-x-auto no-scrollbar">
          {variedades.map(v => (
            <span key={v} className="text-[7px] font-bold text-slate-400 border border-slate-200 px-2 py-0.5 rounded uppercase whitespace-nowrap bg-white shadow-sm">
              {v}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SementeCard;