import React from 'react';
import { Link } from 'react-router-dom';
import { COA_RULES, COA_COLORS } from '../../pages/COACenter/coa_rules';

// Usamos o mesmo ProgressBar, mas você pode mudar depois
const ProgressBar = ({ label, percent, color }) => (
  <div className="flex flex-col gap-1 w-full mt-1.5">
    <div className="flex justify-between items-end leading-none">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
      <span className="text-xs font-black" style={{ color }}>{Number(percent).toFixed(1)}%</span>
    </div>
    <div className="w-full h-2 bg-[#0A0D14] rounded-full overflow-hidden border border-slate-700/80 shadow-inner">
      <div 
        className="h-full rounded-full transition-all duration-1000 ease-out" 
        style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}60` }} 
      />
    </div>
  </div>
);

const COAcctCard = ({ areaName, stats, to }) => {
  const { 
    qtdEquipamentos = 0, totalHoras = 0, horasDisponiveis = 0, 
    horasProdutivas = 0, horasSemApontamento = 0, horasMotor = 0, 
    horasOcioso = 0, percSemApontamento = 0, percIndeterminado = 0, 
    percMotorOcioso = 0, eficienciaOperacional = 0, eficienciaReal = 0, ofensores = []
  } = stats || {};

  const efOpCor = COA_RULES.eficienciaOp(eficienciaOperacional);

  return (
    <section className="w-full max-w-[400px] animate-in fade-in zoom-in duration-500 mt-2 font-sans relative">
      {/* Badge Exclusiva para mostrar que é CCT Diferenciado */}
      <div className="absolute -top-3 right-4 bg-indigo-600 text-white text-[9px] font-black uppercase px-3 py-1 rounded-full shadow-lg z-10 border border-indigo-400/50">
        Operação Corte Mecanizado
      </div>

      {/* Repare que mudei as cores do hover e das bordas para dar um tom mais exclusivo (Indigo/Azul) */}
      <div className="bg-[#1A202C] border-2 border-indigo-900/80 hover:border-indigo-500/60 rounded-xl shadow-2xl overflow-hidden group transition-all relative">
        <div className="absolute top-0 left-0 w-full h-1.5 bg-indigo-500 opacity-80 shadow-md group-hover:opacity-100 transition-opacity" />

        <div className="px-5 pt-5 pb-3 flex justify-between items-start border-b border-slate-700/80 bg-[#11151D]">
          <h2 className="text-[13px] font-black uppercase tracking-widest text-indigo-200">
            {areaName} <span className="text-slate-500">| ESPECIAL</span>
          </h2>
          <span className="text-[10px] font-bold text-slate-300 bg-[#0A0D14] px-2.5 py-1 rounded border border-indigo-900 shadow-sm">
            {qtdEquipamentos} COLHEDORAS
          </span>
        </div>

        <div className="flex p-4 gap-4">
          <div className="w-[48%] flex flex-col items-center justify-center p-3 bg-[#11151D] rounded-xl border border-slate-700/80 shadow-inner">
            <div className="relative flex items-center justify-center w-32 h-16">
              <svg className="w-full h-full absolute top-0" viewBox="0 0 100 50">
                <path d="M 10 45 A 40 40 0 0 1 90 45" fill="none" stroke="#2D3748" strokeWidth="12" strokeLinecap="round" />
                <path 
                  d="M 10 45 A 40 40 0 0 1 90 45" 
                  fill="none" 
                  stroke={efOpCor} 
                  strokeWidth="12" 
                  strokeLinecap="round"
                  strokeDasharray={`${(Math.min(eficienciaOperacional, 100) / 100) * 126} 126`} 
                  className="transition-all duration-1000 ease-out"
                />
              </svg>
              <div className="flex flex-col items-center justify-center mt-7">
                <span className="text-2xl font-black tracking-tighter leading-none" style={{ color: efOpCor, textShadow: `0 0 8px ${efOpCor}40` }}>
                  {Number(eficienciaOperacional).toFixed(1)}%
                </span>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Ef. Op.</span>
              </div>
            </div>
            <div className="mt-5 text-center border-t border-slate-700/80 pt-2.5 w-full">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block leading-none mb-0.5">Ef. Real</span>
              <span className="text-sm font-black text-slate-100">{Number(eficienciaReal).toFixed(1)}%</span>
            </div>
          </div>

          <div className="w-[52%] flex flex-col justify-between">
            <div className="grid grid-cols-2 gap-y-2.5 gap-x-2">
              <div className="flex flex-col bg-[#11151D] p-2 rounded-lg border border-slate-700/50">
                <span className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Totais</span>
                <span className="text-sm font-black text-slate-100 leading-none">{Number(totalHoras).toFixed(1)}h</span>
              </div>
              <div className="flex flex-col bg-[#11151D] p-2 rounded-lg border border-slate-700/50">
                <span className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Disp</span>
                <span className="text-sm font-black text-slate-100 leading-none">{Number(horasDisponiveis).toFixed(1)}h</span>
              </div>
              <div className="flex flex-col bg-[#11151D] p-2 rounded-lg border border-slate-700/50">
                <span className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Produtivas</span>
                <span className="text-sm font-black leading-none" style={{ color: COA_COLORS.dentro }}>{Number(horasProdutivas).toFixed(1)}h</span>
              </div>
              <div className="flex flex-col bg-[#11151D] p-2 rounded-lg border border-slate-700/50">
                <span className="text-[8px] font-black text-slate-400 uppercase mb-0.5">S/Apont</span>
                <span className="text-sm font-black leading-none" style={{ color: COA_RULES.semApontamento(percSemApontamento) }}>{Number(horasSemApontamento).toFixed(1)}h</span>
              </div>
              <div className="flex flex-col bg-[#11151D] p-2 rounded-lg border border-slate-700/50">
                <span className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Motor Lig</span>
                <span className="text-sm font-black text-slate-100 leading-none">{Number(horasMotor).toFixed(1)}h</span>
              </div>
              <div className="flex flex-col bg-[#11151D] p-2 rounded-lg border border-slate-700/50">
                <span className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Motor Oc</span>
                <span className="text-sm font-black leading-none" style={{ color: COA_RULES.motorOcioso(percMotorOcioso) }}>{Number(horasOcioso).toFixed(1)}h</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 pt-1 flex flex-col gap-2.5 border-b border-slate-700/80">
          <ProgressBar label="Sem Apontamento" percent={percSemApontamento} color={COA_RULES.semApontamento(percSemApontamento)} />
          <ProgressBar label="Indeterminado" percent={percIndeterminado} color={COA_RULES.indeterminado(percIndeterminado)} />
          <ProgressBar label="Motor Ocioso" percent={percMotorOcioso} color={COA_RULES.motorOcioso(percMotorOcioso)} />
        </div>

        {ofensores && ofensores.length > 0 && (
          <div className="px-5 py-3.5 bg-[#11151D]/80">
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2 block">Ofensores CCT</span>
            <div className="flex flex-col gap-1.5">
              {ofensores.map((ofensor, idx) => (
                <div key={idx} className="flex justify-between items-center text-[10px]">
                  <span className="font-bold text-slate-300 truncate w-3/4">
                    <span className="text-indigo-500/60 mr-2">{idx + 1}</span> {ofensor.nome}
                  </span>
                  <span className="font-black text-slate-100">
                    {Number(ofensor.horas).toFixed(1)}h
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link 
          to={to}
          className="w-full py-3.5 bg-[#0A0D14] border-t border-slate-700 flex justify-center items-center group-hover:bg-slate-800/60 transition-all"
        >
          <div className="flex items-center gap-2 opacity-80 group-hover:opacity-100">
            <span className="text-[10px] font-black uppercase tracking-widest group-hover:text-indigo-400 text-slate-300">
              Análise Profunda CCT
            </span>
            <span className="font-black text-indigo-500">→</span>
          </div>
        </Link>
      </div>
    </section>
  );
};

export default COAcctCard;