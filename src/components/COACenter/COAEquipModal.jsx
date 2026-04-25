import React, { useState } from 'react';
import { COA_RULES, COA_COLORS } from '../../pages/COACenter/coa_rules';

// Helper para tempo blindado contra undefined/NaN
const secondsToTime = (secs) => {
  if (!secs || isNaN(secs) || secs <= 0) return "00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// Componente Interno: Barra de Progresso Suave blindada
const ProgressBar = ({ label, percent, color, extraText }) => {
  const safePercent = isNaN(percent) ? 0 : Math.min(percent, 100);
  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex justify-between items-end leading-none">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
        <div className="flex gap-2 items-baseline">
          {extraText && <span className="text-[9px] font-bold text-slate-500">{extraText}</span>}
          <span className="text-xs font-black" style={{ color }}>{Number(safePercent).toFixed(1)}%</span>
        </div>
      </div>
      <div className="w-full h-2 bg-[#0A0D14] rounded-full overflow-hidden border border-slate-700/80 shadow-inner">
        <div 
          className="h-full rounded-full transition-all duration-1000 ease-out" 
          style={{ width: `${safePercent}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}60` }} 
        />
      </div>
    </div>
  );
};

const COAEquipModal = ({ isOpen, onClose, equipData }) => {
  const [expandedGroups, setExpandedGroups] = useState({});

  if (!isOpen || !equipData) return null;

  const { id, desc, kpis = {}, gruposOp = {} } = equipData;

  // --- LIMPANDO O NOME: Prevenção caso a base ainda mande algum lixo na string
  const cleanDesc = desc ? desc.replace(/\d{5,}$/, '').trim() : 'SEM DESCRIÇÃO';

  // --- CÁLCULOS DERIVADOS COM REDE DE SEGURANÇA ---
  const totalH = kpis.totalH || 0;
  const descontosH = kpis.descontosH || 0;
  const prodH = kpis.prodH || 0;
  
  const totalSecs = totalH * 3600;
  
  // Math.max evita NaN e números negativos acidentais
  const dispH = Math.max(0, totalH - descontosH); 
  const efReal = totalH > 0 ? (prodH / totalH) * 100 : 0;
  const efOpCor = COA_RULES.eficienciaOp(kpis.efOp || 0);

  const indetSecs = gruposOp['INDETERMINADO']?.totalSecs || 0;
  const indetPerc = totalSecs > 0 ? (indetSecs / totalSecs) * 100 : 0;
  
  const motorH = kpis.motorH || totalH || 0; 
  const ociosoH = kpis.ociosoH || 0; 
  const sApont = kpis.sApont || 0;
  
  const percMotorOcioso = totalH > 0 ? (ociosoH / totalH) * 100 : 0;

  // --- OFENSORES (Top 10) ---
  const ofensores = [];
  Object.entries(gruposOp).forEach(([grpName, grpData]) => {
    if (['IMPRODUTIVO', 'AUXILIAR'].includes(grpName)) {
      Object.entries(grpData.operacoes).forEach(([opName, secs]) => {
        ofensores.push({ nome: opName, horas: (secs || 0) / 3600 });
      });
    }
  });
  const top10Ofensores = ofensores.sort((a, b) => b.horas - a.horas).slice(0, 10);

  // --- GRUPOS ORDENADOS PARA BARRAS ---
  const sortedGroups = Object.entries(gruposOp).sort((a, b) => (b[1].totalSecs || 0) - (a[1].totalSecs || 0));

  // --- HANDLER DO ACORDEÃO ---
  const toggleGroup = (grpName) => {
    setExpandedGroups(prev => ({ ...prev, [grpName]: !prev[grpName] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-[#06090F]/80 backdrop-blur-md transition-opacity" 
        onClick={onClose} 
      />

      <div className="relative w-full max-w-lg max-h-[90vh] bg-[#161B22] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* HEADER */}
        <div className="flex justify-between items-start p-5 border-b border-slate-700/80 bg-[#11151D] shrink-0">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest leading-none mb-1">
              Equipamento - Analítico
            </span>
            <div className="flex items-baseline gap-2">
              <h2 className="text-xl font-black text-slate-100 uppercase tracking-tight leading-none">
                {id}
              </h2>
              <span className="text-xs font-bold text-slate-500 uppercase">
                {cleanDesc}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-[#1C2128] text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors font-bold text-lg"
          >
            ×
          </button>
        </div>

        {/* CORPO ROLÁVEL */}
        <div className="overflow-y-auto p-5 flex flex-col gap-6 custom-scrollbar">
          
          <div className="flex gap-4">
            <div className="w-[40%] flex flex-col items-center justify-center p-4 bg-[#11151D] rounded-xl border border-slate-700/50 shadow-inner">
              <div className="relative flex items-center justify-center w-32 h-16">
                <svg className="w-full h-full absolute top-0" viewBox="0 0 100 50">
                  <path d="M 10 45 A 40 40 0 0 1 90 45" fill="none" stroke="#2D3748" strokeWidth="12" strokeLinecap="round" />
                  <path 
                    d="M 10 45 A 40 40 0 0 1 90 45" 
                    fill="none" 
                    stroke={efOpCor} 
                    strokeWidth="12" 
                    strokeLinecap="round"
                    strokeDasharray={`${(Math.min(kpis.efOp || 0, 100) / 100) * 126} 126`} 
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="flex flex-col items-center justify-center mt-8">
                  <span className="text-2xl font-black tracking-tighter leading-none" style={{ color: efOpCor, textShadow: `0 0 10px ${efOpCor}40` }}>
                    {Number(kpis.efOp || 0).toFixed(1)}%
                  </span>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">Eficiência Op.</span>
                </div>
              </div>

              <div className="mt-5 text-center border-t border-slate-700/80 pt-3 w-full">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block leading-none mb-1">Eficiência Real</span>
                <span className="text-sm font-black text-white">{Number(efReal).toFixed(1)}%</span>
              </div>
            </div>

            <div className="w-[60%] grid grid-cols-2 gap-2">
              <div className="bg-[#11151D] p-2.5 rounded-lg border border-slate-700/50 flex flex-col">
                <span className="text-[8px] font-black text-slate-500 uppercase">Horas Totais</span>
                <span className="text-sm font-black text-white">{Number(totalH).toFixed(1)} h</span>
              </div>
              <div className="bg-[#11151D] p-2.5 rounded-lg border border-slate-700/50 flex flex-col">
                <span className="text-[8px] font-black text-slate-500 uppercase">Horas Disp.</span>
                <span className="text-sm font-black text-emerald-400">{Number(dispH).toFixed(1)} h</span>
              </div>
              <div className="bg-[#11151D] p-2.5 rounded-lg border border-slate-700/50 flex flex-col">
                <span className="text-[8px] font-black text-slate-500 uppercase">Horas Prod.</span>
                <span className="text-sm font-black text-white">{Number(prodH).toFixed(1)} h</span>
              </div>
              <div className="bg-[#11151D] p-2.5 rounded-lg border border-slate-700/50 flex flex-col">
                <span className="text-[8px] font-black text-slate-500 uppercase">Motor Ligado</span>
                <span className="text-sm font-black text-white">{Number(motorH).toFixed(1)} h</span>
              </div>
              <div className="bg-[#11151D] p-2.5 rounded-lg border border-slate-700/50 flex flex-col">
                <span className="text-[8px] font-black text-slate-500 uppercase">Sem Apont.</span>
                <span className={`text-sm font-black ${sApont <= 2 ? 'text-emerald-400' : 'text-red-400'}`}>{Number(sApont).toFixed(1)}%</span>
              </div>
              <div className="bg-[#11151D] p-2.5 rounded-lg border border-slate-700/50 flex flex-col">
                <span className="text-[8px] font-black text-slate-500 uppercase">Indeterminado</span>
                <span className={`text-sm font-black ${indetPerc <= 10 ? 'text-emerald-400' : 'text-red-400'}`}>{Number(indetPerc).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="bg-[#11151D] p-4 rounded-xl border border-slate-700/50 shadow-md">
            <ProgressBar 
              label="Motor Ocioso" 
              percent={percMotorOcioso} 
              color={COA_RULES.motorOcioso(percMotorOcioso)} 
              extraText={`${Number(ociosoH).toFixed(1)} h`}
            />
          </div>

          <div className="flex flex-col gap-3 bg-[#11151D] p-4 rounded-xl border border-slate-700/50">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-700/50 pb-2 mb-1">
              Distribuição do Tempo
            </h3>
            {sortedGroups.map(([grpName, grpData]) => {
              const isProd = grpName === 'PRODUTIVO';
              const percent = totalSecs > 0 ? (grpData.totalSecs / totalSecs) * 100 : 0;
              const barColor = isProd ? COA_COLORS.dentro : COA_COLORS.neutro;

              return (
                <div key={grpName} className="flex flex-col gap-1 w-full">
                  <div className="flex justify-between items-end leading-none">
                    <span className={`text-[9px] font-bold uppercase ${isProd ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {grpName}
                    </span>
                    <span className="text-[10px] font-black text-slate-200">
                      {secondsToTime(grpData.totalSecs)} h
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#0A0D14] rounded-full overflow-hidden border border-slate-700/80">
                    <div 
                      className="h-full rounded-full transition-all duration-1000 ease-out" 
                      style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: barColor }} 
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1">
              Detalhamento por Grupo
            </h3>
            {sortedGroups.map(([grpName, grpData]) => {
              const isProd = grpName === 'PRODUTIVO';
              const isOpen = expandedGroups[grpName];

              return (
                <div key={grpName} className="bg-[#11151D] rounded-xl border border-slate-700/50 overflow-hidden">
                  <button 
                    onClick={() => toggleGroup(grpName)}
                    className="w-full flex justify-between items-center p-3.5 hover:bg-[#1C2128] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] text-slate-500 transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                      <span className={`text-[11px] font-black uppercase ${isProd ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {grpName}
                      </span>
                    </div>
                    <span className="text-xs font-black text-slate-400">
                      {secondsToTime(grpData.totalSecs)} h
                    </span>
                  </button>

                  {isOpen && (
                    <div className="bg-[#0A0D14] p-3 border-t border-slate-700/50 flex flex-col gap-1.5">
                      {Object.entries(grpData.operacoes)
                        .sort(([, a], [, b]) => b - a)
                        .map(([opName, secs], idx) => (
                          <div key={idx} className="flex justify-between items-center py-1.5 px-2 border-b border-slate-800/50 last:border-0 rounded hover:bg-[#161B22] transition-colors">
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${isProd ? 'text-emerald-500' : 'text-slate-500'}`}>
                              {opName}
                            </span>
                            <span className={`text-[11px] font-black ${isProd ? 'text-emerald-400' : 'text-slate-300'}`}>
                              {secondsToTime(secs)} h
                            </span>
                          </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {top10Ofensores.length > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4 mt-2">
              <span className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-3 block border-b border-red-500/20 pb-2">
                Top 10 Ofensores (Improdutivos / Auxiliares)
              </span>
              <div className="flex flex-col gap-1.5">
                {top10Ofensores.map((ofensor, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-slate-300 truncate w-3/4">
                      <span className="text-red-500/60 mr-2">{idx + 1}</span> {ofensor.nome}
                    </span>
                    <span className="font-black text-slate-100">
                      {Number(ofensor.horas).toFixed(1)} h
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default COAEquipModal;