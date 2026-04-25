import React, { useState, useMemo, useEffect } from 'react';

// Componentes de Navegação
import COAOperacoesHeader from '../../components/COACenter/COAOperacoesHeader';
import COASidebar from '../../components/COACenter/COASidebar';

// MOCK DATA
import coaMockData from '../../data/mockData_coa.json'; 

// ================================= HELPERS --------------------------------------
const timeToSeconds = (timeStr) => {
  if (!timeStr) return 0;
  let str = String(timeStr).trim().replace(',', '.');

  if (str.includes('1900') || str.includes('1899')) {
    if (str.includes('1900-01-01') || str.includes('01/01/1900')) return 24 * 3600;
    return 0;
  }

  if (str.includes('day')) {
    const parts = str.split('day');
    const d = parseInt(parts[0]) || 0;
    const rest = parts[1].replace(/s|,/g, '').trim();
    const p = rest.split(':');
    return (d * 24 * 3600) + ((+p[0] || 0) * 3600) + ((+p[1] || 0) * 60) + (+p[2] || 0);
  }

  if (!isNaN(str) && !str.includes(':')) return parseFloat(str) * 3600;
  if (str.includes(' ')) str = str.split(' ').pop();

  const parts = str.split(':');
  const h = parseFloat(parts[0]) || 0;
  const m = parseFloat(parts[1]) || 0;
  const s = parseFloat(parts[2]) || 0;
  
  return (h * 3600) + (m * 60) + s;
};

const secondsToTime = (secs) => {
  if (!secs || isNaN(secs) || secs <= 0) return "00:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

// --- HELPER DE FORMATAÇÃO VISUAL (PT-BR) ---
const formatToBR = (dateStr) => {
  if (!dateStr) return "";
  // Se já for DD/MM/AAAA (ponto no índice 2), mantém
  if (dateStr.includes('/') && dateStr.indexOf('/') === 2) return dateStr;
  // Se for ISO (AAAA-MM-DD), inverte
  if (dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  return dateStr;
};

const Operacoes = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [searchType, setSearchType] = useState("OPERADOR"); 
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState({});

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // 1. Extração das Datas (Mantendo o formato original do JSON para o filtro)
  const availableDates = useMemo(() => {
    const dates = [...new Set(coaMockData.map(item => 
      item.DATA ? item.DATA.substring(0, 10) : null
    ).filter(Boolean))];
    
    // Ordenação inteligente
    return dates.sort((a, b) => {
      const dateA = a.includes('/') ? a.split('/').reverse().join('-') : a;
      const dateB = b.includes('/') ? b.split('/').reverse().join('-') : b;
      return dateB.localeCompare(dateA);
    });
  }, []);

  // Garantir que a data inicial seja carregada
  useEffect(() => {
    if (!selectedDate && availableDates.length > 0) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates, selectedDate]);

  // 2. Filtragem de Opções (Usando o selectedDate no formato original)
  const filteredOptions = useMemo(() => {
    if (!selectedDate || searchTerm.length < 2) return [];
    const dataFromDate = coaMockData.filter(i => i.DATA.startsWith(selectedDate));
    const optionsMap = new Map();

    dataFromDate.forEach(item => {
      const val = searchType === "OPERADOR" ? item.COD_OP : item.COD_EQUIP;
      if (val) optionsMap.set(val, val);
    });

    const lowerSearch = searchTerm.toLowerCase();
    return Array.from(optionsMap.values())
      .filter(opt => String(opt).toLowerCase().includes(lowerSearch))
      .slice(0, 5);
  }, [selectedDate, searchTerm, searchType]);

  // 3. Motor de Cálculo (Filtragem robusta)
  const entityData = useMemo(() => {
    if (!selectedDate || !selectedEntity) return null;

    const rawData = coaMockData.filter(item => 
      item.DATA.startsWith(selectedDate) && 
      (searchType === "OPERADOR" ? item.COD_OP === selectedEntity : item.COD_EQUIP === selectedEntity)
    );

    const summary = { totalSecsGeral: 0, totalSecsProdutivoGeral: 0, equipamentos: {} };

    rawData.forEach(row => {
      const eqID = row.COD_EQUIP || "N/A";
      const eqDesc = row.DESC_EQUIP || "";
      const eqKey = `${eqID} - ${eqDesc}`;
      const grupo = row.DESC_GRUPO_OPERACAO || "OUTROS";
      const operacao = row.DESC_OPERACAO || "NÃO INFORMADA";
      const secs = timeToSeconds(row.HRS_OPERACIONAIS);

      if (!summary.equipamentos[eqKey]) {
        summary.equipamentos[eqKey] = { id: eqID, totalSecs: 0, produtivoSecs: 0, grupos: {} };
      }

      const eqRef = summary.equipamentos[eqKey];
      eqRef.totalSecs += secs;
      summary.totalSecsGeral += secs;

      if (grupo.toUpperCase() === "PRODUTIVO") {
        eqRef.produtivoSecs += secs;
        summary.totalSecsProdutivoGeral += secs;
      }

      if (!eqRef.grupos[grupo]) eqRef.grupos[grupo] = { totalSecs: 0, operacoes: {} };
      eqRef.grupos[grupo].totalSecs += secs;
      eqRef.grupos[grupo].operacoes[operacao] = (eqRef.grupos[grupo].operacoes[operacao] || 0) + secs;
    });

    return summary;
  }, [selectedDate, selectedEntity, searchType]);

  const toggleGroup = (id) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSelectOption = (option) => {
    setSelectedEntity(option);
    setSearchTerm(option);
  };

  const handleReset = () => {
    setSelectedEntity(null);
    setSearchTerm("");
    setExpandedGroups({});
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-slate-300 font-sans pb-10">
      <COAOperacoesHeader onMenuOpen={() => setSidebarOpen(true)} />
      <COASidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={() => {}} />

      <main className="p-4 flex flex-col items-center">
        
        <div className={`w-full max-w-md transition-all duration-500 ${selectedEntity ? 'mb-6' : 'mt-10'}`}>
          <div className="bg-[#161B22] rounded-2xl border border-slate-800 shadow-2xl p-6 relative">
            <h2 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] mb-4">
              Relatório de Operações
            </h2>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Data Operacional</label>
                <select 
                  value={selectedDate} 
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full bg-[#0D1117] border border-slate-700 text-slate-300 font-bold rounded-lg px-3 py-2 outline-none focus:border-emerald-500"
                >
                  {availableDates.map(date => (
                    <option key={date} value={date}>
                      {formatToBR(date)} {/* Exibe BR, mas o valor do select é o original */}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex bg-[#0D1117] border border-slate-800 rounded-lg p-1">
                {["OPERADOR", "EQUIPAMENTO"].map(type => (
                  <button
                    key={type}
                    onClick={() => { setSearchType(type); handleReset(); }}
                    className={`flex-1 py-1.5 text-[10px] font-black tracking-widest uppercase rounded-md transition-all ${
                      searchType === type ? 'bg-[#1C2128] text-emerald-400 shadow-md' : 'text-slate-600 hover:text-slate-400'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input 
                    type="text" 
                    placeholder={`Buscar ${searchType === 'OPERADOR' ? 'Matrícula' : 'Equipamento'}...`}
                    value={searchTerm}
                    onChange={(e) => { setSearchTerm(e.target.value); if (selectedEntity) setSelectedEntity(null); }}
                    className="w-full bg-[#0D1117] border border-slate-700 text-slate-200 font-bold rounded-lg pl-3 pr-4 py-2.5 outline-none focus:border-emerald-500 transition-colors placeholder:text-slate-600"
                  />
                  {!selectedEntity && searchTerm.length >= 2 && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-[#161B22] border border-slate-700 rounded-lg shadow-2xl overflow-hidden z-50">
                      {filteredOptions.map((opt, idx) => (
                        <button key={idx} onClick={() => handleSelectOption(opt)} className="w-full text-left px-4 py-3 text-xs font-bold text-slate-400 hover:bg-[#1C2128] hover:text-emerald-400 border-b border-slate-800 last:border-0">
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {(searchTerm || selectedEntity) && (
                  <button onClick={handleReset} className="w-11 flex items-center justify-center bg-[#0D1117] border border-slate-700 rounded-lg text-slate-500 hover:text-red-400 transition-all font-black">
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {selectedEntity && entityData && (
          <div className="w-full max-w-md flex flex-col gap-6 animate-in slide-in-from-bottom-4">
            
            {/* Feedback de Sem Dados na Data Escolhida */}
            {Object.keys(entityData.equipamentos).length === 0 && (
               <div className="bg-[#161B22] p-8 rounded-2xl border border-dashed border-slate-700 text-center">
                 <span className="text-xs font-bold text-slate-500 uppercase">Nenhum registro para {selectedEntity} em {formatToBR(selectedDate)}</span>
               </div>
            )}

            {Object.entries(entityData.equipamentos).map(([eqFullName, eqData], eqIdx) => (
              <div key={eqIdx} className="bg-[#161B22] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
                <div className="bg-[#0D1117] p-4 border-b border-slate-800">
                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Equipamento</span>
                  <h3 className="text-sm font-black text-slate-200 uppercase mt-1 tracking-tight">{eqFullName}</h3>
                </div>

                <div className="p-3 flex flex-col gap-2">
                  {Object.entries(eqData.grupos)
                    .sort(([, a], [, b]) => b.totalSecs - a.totalSecs)
                    .map(([grpName, grpData], grpIdx) => {
                      const isProd = grpName.toUpperCase() === "PRODUTIVO";
                      const groupID = `${eqIdx}-${grpIdx}`;
                      const isOpen = expandedGroups[groupID];

                      return (
                        <div key={grpIdx} className={`rounded-xl border transition-all ${isOpen ? 'border-slate-700 bg-[#0D1117]' : 'border-transparent bg-[#1C2128]'}`}>
                          <button onClick={() => toggleGroup(groupID)} className="w-full flex justify-between items-center p-3.5">
                            <div className="flex items-center gap-3">
                              <span className={`text-[10px] transition-transform ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                              <span className={`text-[11px] font-black uppercase tracking-tight ${isProd ? 'text-emerald-400' : 'text-slate-400'}`}>{grpName}</span>
                            </div>
                            <span className={`text-xs font-black ${isProd ? 'text-emerald-500' : 'text-slate-500'}`}>{secondsToTime(grpData.totalSecs)}</span>
                          </button>

                          {isOpen && (
                            <div className="px-4 pb-3 flex flex-col gap-1 border-t border-slate-800/50 pt-2">
                              {Object.entries(grpData.operacoes).sort(([, a], [, b]) => b - a).map(([opName, opSecs], opIdx) => (
                                <div key={opIdx} className="flex justify-between items-center py-2 border-b border-slate-800/30 last:border-0">
                                  <span className={`text-[11px] font-medium ${isProd ? 'text-emerald-300' : 'text-slate-500'}`}>{opName}</span>
                                  <span className="text-xs font-bold text-slate-300">{secondsToTime(opSecs)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}

            {/* Resumo Geral */}
            {Object.keys(entityData.equipamentos).length > 0 && (
              <div className="bg-[#161B22] rounded-2xl border border-slate-800 shadow-2xl p-6">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-5 border-b border-slate-800 pb-3">Resumo Geral</h3>
                <div className="flex flex-col gap-4">
                  <div className="flex text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">
                    <span className="flex-1">Equipamento</span>
                    <span className="w-20 text-right">Produtivo</span>
                    <span className="w-20 text-right">Total</span>
                  </div>
                  {Object.entries(entityData.equipamentos).map(([eqFullName, eqData], idx) => (
                    <div key={idx} className="flex items-center px-1 py-3 border-b border-slate-800 last:border-0">
                      <span className="flex-1 text-[11px] font-black text-slate-400 truncate mr-2">{eqData.id}</span>
                      <span className="w-20 text-right text-xs font-black text-emerald-500">{secondsToTime(eqData.produtivoSecs)}</span>
                      <span className="w-20 text-right text-xs font-black text-slate-200">{secondsToTime(eqData.totalSecs)}</span>
                    </div>
                  ))}
                  {Object.keys(entityData.equipamentos).length > 1 && (
                    <div className="mt-2 p-4 bg-emerald-600/10 border border-emerald-500/30 rounded-xl flex items-center shadow-lg">
                      <div className="flex-1 flex flex-col">
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Total da Frota</span>
                        <span className="text-[8px] font-bold text-emerald-600/60 uppercase">Consolidado Geral</span>
                      </div>
                      <span className="w-20 text-right text-xs font-black text-emerald-400">{secondsToTime(entityData.totalSecsProdutivoGeral)}</span>
                      <span className="w-20 text-right text-sm font-black text-emerald-100">{secondsToTime(entityData.totalSecsGeral)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Operacoes;