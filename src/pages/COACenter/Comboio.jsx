import React, { useState, useMemo, useEffect } from 'react';
import { 
  COA_RULES, 
  COA_COLORS, 
  formatDecimalToHHMM, 
  buildComboioDashboardData 
} from '../../pages/COACenter/coa_rules';

// Dados e Componentes
import coaMockData from '../../data/mockData_coa.json';
import COAComboioHeader from '../../components/COACenter/COAComboioHeader';
import COASidebar from '../../components/COACenter/COASidebar'; // <-- Adicionado
import COADateSelector from '../../components/COACenter/COADateSelector';
import COAEquipModal from '../../components/COACenter/COAEquipModal';

// Componente Interno: Barra de Progresso no padrão Detalhe
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

const Comboio = () => {
  // --- ESTADOS DE NAVEGAÇÃO ---
  const [isSidebarOpen, setSidebarOpen] = useState(false); // <-- Adicionado
  
  const [selectedDate, setSelectedDate] = useState("");
  const [modalEquip, setModalEquip] = useState(null);

  // 1. Gerenciamento de Datas
  const availableDates = useMemo(() => {
    const dates = [...new Set(coaMockData.map(i => i.DATA?.substring(0, 10)).filter(Boolean))];
    return dates.sort((a, b) => b.localeCompare(a));
  }, []);

  useEffect(() => {
    if (!selectedDate && availableDates.length > 0) setSelectedDate(availableDates[0]);
  }, [availableDates, selectedDate]);

  // 2. Processamento dos Dados (Apenas os 3 Comboios)
  const dash = useMemo(() => buildComboioDashboardData(coaMockData, selectedDate), [selectedDate]);

  if (!dash) return null;

  const efOpCor = COA_RULES.eficienciaOp(dash.statsGeral.efOp);

  return (
    <div className="min-h-screen bg-[#06090F] text-slate-300 font-sans pb-10">
      {/* HEADER CONECTADO AO MENU */}
      <COAComboioHeader 
        title="Gestão de Comboios" 
        onMenuOpen={() => setSidebarOpen(true)} 
      />

      {/* SIDEBAR RENDERIZADA */}
      <COASidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        onNavigate={() => {}} 
      />
      
      <main className="p-4 flex flex-col items-center gap-6">
        <COADateSelector 
          date={selectedDate} 
          onPrev={() => setSelectedDate(availableDates[availableDates.indexOf(selectedDate) + 1])}
          onNext={() => setSelectedDate(availableDates[availableDates.indexOf(selectedDate) - 1])}
        />

        {/* TABELA DE EQUIPAMENTOS (LISTA RÁPIDA) */}
        <div className="w-full max-w-[400px] bg-[#161B22] rounded-xl border border-slate-700/50 overflow-hidden shadow-xl">
          <div className="bg-[#11151D] px-4 py-3 border-b border-slate-700/50 flex justify-between items-center">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Frota Comboio</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase">{dash.equips.length} Máquinas</span>
          </div>
          <div className="flex flex-col">
            {dash.equips.map(eq => (
              <div key={eq.id} className="flex items-center justify-between p-3 border-b border-slate-800/50 last:border-0 hover:bg-[#1C2128] transition-colors">
                <div className="flex flex-col">
                  <span className="text-xs font-black text-slate-200">{eq.id}</span>
                  <span className="text-[8px] font-bold text-slate-500 uppercase">Comboio de Apoio</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-end w-10">
                    <span className="text-[7.5px] font-black text-slate-500 uppercase">Ef. Op.</span>
                    <span className="text-[11px] font-black" style={{ color: COA_RULES.eficienciaOp(eq.kpis.efOp) }}>
                      {eq.kpis.efOp.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex flex-col items-end w-10">
                    <span className="text-[7.5px] font-black text-slate-500 uppercase">Ocioso</span>
                    <span className="text-[11px] font-black" style={{ color: COA_RULES.motorOcioso(eq.kpis.percMotorOcioso) }}>
                      {eq.kpis.percMotorOcioso.toFixed(1)}%
                    </span>
                  </div>
                  <button 
                    onClick={() => setModalEquip(eq)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 font-serif italic font-bold transition-all"
                  >
                    i
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* DASHBOARD CONSOLIDADO (PADRÃO DETALHE) */}
        <div className="w-full max-w-[400px] bg-[#161B22] border-t-4 border-emerald-500 rounded-2xl border-x border-b border-slate-700/80 shadow-2xl overflow-hidden p-5">
           <div className="flex flex-col items-center mb-4">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1">Resultado Consolidado</span>
           </div>

           <div className="flex gap-4 mb-6">
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
                      strokeDasharray={`${(dash.statsGeral.efOp / 100) * 126} 126`} 
                      className="transition-all duration-1000 ease-out" 
                    />
                  </svg>
                  <div className="flex flex-col items-center mt-7">
                    <span className="text-2xl font-black tracking-tighter" style={{ color: efOpCor }}>
                      {dash.statsGeral.efOp.toFixed(1)}%
                    </span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Ef. Op.</span>
                  </div>
                </div>
                <div className="mt-5 text-center border-t border-slate-700/80 pt-2.5 w-full">
                  <span className="text-[9px] font-bold text-slate-400 uppercase block leading-none mb-0.5">Ef. Real</span>
                  <span className="text-sm font-black text-slate-100">{dash.statsGeral.efReal.toFixed(1)}%</span>
                </div>
              </div>

              <div className="w-[52%] grid grid-cols-2 gap-2">
                <div className="bg-[#11151D] p-2 rounded-lg border border-slate-700/50 flex flex-col justify-center">
                  <span className="text-[8px] font-black text-slate-500 uppercase mb-0.5">Totais</span>
                  <span className="text-xs font-black text-white">{dash.statsGeral.totalH.toFixed(1)}h</span>
                </div>
                <div className="bg-[#11151D] p-2 rounded-lg border border-slate-700/50 flex flex-col justify-center">
                  <span className="text-[8px] font-black text-slate-500 uppercase mb-0.5">Produtivas</span>
                  <span className="text-xs font-black text-emerald-400">{dash.statsGeral.prodH.toFixed(1)}h</span>
                </div>
                <div className="bg-[#11151D] p-2 rounded-lg border border-slate-700/50 flex flex-col justify-center col-span-2">
                  <span className="text-[8px] font-black text-slate-500 uppercase mb-0.5">Motor Ocioso</span>
                  <span className="text-xs font-black text-red-400">{dash.statsGeral.ociosoH.toFixed(1)}h</span>
                </div>
              </div>
           </div>

           <div className="flex flex-col gap-2.5">
              <ProgressBar 
                label="Sem Apontamento" 
                percent={dash.statsGeral.percSApont} 
                color={COA_RULES.semApontamento(dash.statsGeral.percSApont)} 
              />
              <ProgressBar 
                label="Indeterminado" 
                percent={dash.statsGeral.percIndet} 
                color={COA_RULES.indeterminado(dash.statsGeral.percIndet)} 
              />
              <ProgressBar 
                label="Motor Ocioso" 
                percent={dash.statsGeral.percMotorOcioso} 
                color={COA_RULES.motorOcioso(dash.statsGeral.percMotorOcioso)} 
              />
           </div>
        </div>

      </main>

      <COAEquipModal 
        isOpen={!!modalEquip} 
        onClose={() => setModalEquip(null)} 
        equipData={modalEquip} 
      />
    </div>
  );
};

export default Comboio;