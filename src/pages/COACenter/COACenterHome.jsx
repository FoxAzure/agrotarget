import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// Componentes
import COAHeader from '../../components/COACenter/COAHeader';
import COASidebar from '../../components/COACenter/COASidebar';
import COADateSelector from '../../components/COACenter/COADateSelector';

// Dados
import coaMockData from '../../data/mockData_coa.json';

// Helpers de Tempo
const timeToSeconds = (t) => {
  if (!t || typeof t !== 'string') return 0;
  const p = t.split(':');
  return (+p[0] || 0) * 3600 + (+p[1] || 0) * 60 + (+p[2] || 0);
};

const secondsToTime = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const COACenterHome = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  // Tratamento de Datas (Limpando resíduos e garantindo DD/MM/AAAA)
  const availableDates = useMemo(() => {
    const dates = [...new Set(coaMockData.map(i => {
      return i.DATA ? i.DATA.substring(0, 10) : null;
    }).filter(Boolean))];
    
    return dates.sort((a, b) => b.split('/').reverse().join('-').localeCompare(a.split('/').reverse().join('-')));
  }, []);

  const [dateIndex, setDateIndex] = useState(0);
  const selectedDate = availableDates[dateIndex] || "";

  // Agrupamento por AREA_MAP
  const cardsData = useMemo(() => {
    if (!selectedDate) return [];

    const filtered = coaMockData.filter(i => i.DATA && i.DATA.startsWith(selectedDate));
    const groups = {};

    filtered.forEach(item => {
      const area = item.AREA_MAP || "NÃO MAPEADO";
      const grupoOp = item.DESC_GRUPO_OPERACAO || "OUTROS";
      const secs = timeToSeconds(item.HRS_OPERACIONAIS);

      if (!groups[area]) groups[area] = { totalSecs: 0, ops: {} };
      
      groups[area].totalSecs += secs;
      groups[area].ops[grupoOp] = (groups[area].ops[grupoOp] || 0) + secs;
    });

    return Object.entries(groups)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.totalSecs - a.totalSecs);
  }, [selectedDate]);

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-slate-300 font-sans pb-10">
      <COAHeader onMenuOpen={() => setSidebarOpen(true)} />
      <COASidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
        onNavigate={(route) => {
            if(route === "Operações") navigate("/coacenter/operacoes", { state: { selectedDate } });
        }} 
      />

      <main className="p-4 flex flex-col items-center">
        <COADateSelector 
          date={selectedDate}
          onPrev={() => setDateIndex(i => Math.min(i + 1, availableDates.length - 1))}
          onNext={() => setDateIndex(i => Math.max(i - 1, 0))}
          disablePrev={dateIndex === availableDates.length - 1}
          disableNext={dateIndex === 0}
        />

        <div className="w-full max-w-md flex flex-col gap-4 mt-4">
          {cardsData.map((area, idx) => (
            <div 
              key={idx} 
              className="bg-[#161B22] rounded-2xl border border-slate-800 shadow-xl overflow-hidden hover:border-emerald-500/50 transition-all cursor-pointer group"
              onClick={() => navigate("/coacenter/operacoes", { state: { selectedDate, area: area.name } })}
            >
              {/* Glow bar superior */}
              <div className="h-1 bg-emerald-500 opacity-10 group-hover:opacity-100 group-hover:shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all" />
              
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                    Área Operacional
                  </h3>
                  <span className="text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                    {secondsToTime(area.totalSecs)}h
                  </span>
                </div>
                
                <p className="text-sm font-black text-slate-100 uppercase mb-5 tracking-tight group-hover:text-emerald-400 transition-colors">
                  {area.name}
                </p>

                <div className="space-y-2">
                  {Object.entries(area.ops)
                    .sort(([, a], [, b]) => b - a)
                    .map(([opName, opSecs], opIdx) => (
                    <div key={opIdx} className="flex justify-between items-center text-[11px] border-b border-slate-800 pb-2 last:border-0">
                      <span className="font-bold text-slate-500 uppercase">{opName}</span>
                      <span className={`font-black ${opName.toUpperCase() === 'PRODUTIVO' ? 'text-emerald-400' : 'text-slate-300'}`}>
                        {secondsToTime(opSecs)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default COACenterHome;