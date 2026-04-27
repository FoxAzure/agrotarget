import React, { useState, useMemo, useEffect } from 'react';

// Componentes de Navegação
import COAOperacoesHeader from '../../components/COACenter/COAOperacoesHeader';
import COASidebar from '../../components/COACenter/COASidebar';

// Motor de Regras e Lógica
import { 
  COA_RULES, 
  COA_COLORS, 
  COA_CONSTANTS,
  parseTimeToHours, 
  formatDecimalToHHMM 
} from '../../pages/COACenter/coa_rules';

// MOCK DATA
import coaMockData from '../../data/mockData_coa.json'; 

// --- HELPER DE FORMATAÇÃO VISUAL (PT-BR) ---
const formatToBR = (dateStr) => {
  if (!dateStr) return "";
  if (dateStr.includes('/') && dateStr.indexOf('/') === 2) return dateStr;
  if (dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  return dateStr;
};

// --- COMPONENTE DE BARRA DE PROGRESSO ---
const ProgressBar = ({ label, percent, color, extraText }) => {
  const safePercent = isNaN(percent) ? 0 : Math.min(percent, 100);
  return (
    <div className="flex flex-col gap-1 w-full mt-1.5">
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

  // 1. Extração das Datas
  const availableDates = useMemo(() => {
    const dates = [...new Set(coaMockData.map(item => 
      item.DATA ? item.DATA.substring(0, 10) : null
    ).filter(Boolean))];
    
    return dates.sort((a, b) => {
      const dateA = a.includes('/') ? a.split('/').reverse().join('-') : a;
      const dateB = b.includes('/') ? b.split('/').reverse().join('-') : b;
      return dateB.localeCompare(dateA);
    });
  }, []);

  useEffect(() => {
    if (!selectedDate && availableDates.length > 0) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableDates, selectedDate]);

  // 2. Filtragem de Opções de Busca
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

  // 3. Motor de Cálculo usando a nova engine (Horas Decimais)
  const entityData = useMemo(() => {
    if (!selectedDate || !selectedEntity) return null;

    const rawData = coaMockData.filter(item => 
      item.DATA.startsWith(selectedDate) && 
      (searchType === "OPERADOR" ? item.COD_OP === selectedEntity : item.COD_EQUIP === selectedEntity)
    );

    const summary = { 
      totalH: 0, prodH: 0, descontosH: 0, sApontH: 0, indetH: 0, motorH: 0, ociosoH: 0, 
      equipamentos: {} 
    };

    rawData.forEach(row => {
      const eqID = row.COD_EQUIP || "N/A";
      const eqDesc = row.DESC_EQUIP || "";
      const eqKey = `${eqID} - ${eqDesc}`;
      const grupo = (row.DESC_GRUPO_OPERACAO || "INDETERMINADO").toUpperCase().trim();
      const operacao = (row.DESC_OPERACAO || "NÃO INFORMADA").toUpperCase().trim();
      const estado = (row.ESTADO || "").toUpperCase().trim();
      
      const hrs = parseTimeToHours(row.HRS_OPERACIONAIS);
      const motorHrs = parseTimeToHours(row.HRS_MOTOR_LIGADO);
      
      const isOcioso = estado === 'F' && grupo !== 'PRODUTIVO';
      const ociosoHrs = isOcioso ? motorHrs : 0;

      if (!summary.equipamentos[eqKey]) {
        summary.equipamentos[eqKey] = { id: eqID, totalH: 0, prodH: 0, grupos: {} };
      }

      const eqRef = summary.equipamentos[eqKey];
      eqRef.totalH += hrs;
      summary.totalH += hrs;
      summary.motorH += motorHrs;
      summary.ociosoH += ociosoHrs;

      if (grupo === "PRODUTIVO") {
        eqRef.prodH += hrs;
        summary.prodH += hrs;
      }
      
      if (COA_CONSTANTS.GRUPOS_INDISPONIBILIDADE.includes(grupo)) summary.descontosH += hrs;
      if (grupo === 'SEM APONTAMENTO') summary.sApontH += hrs;
      if (grupo === 'INDETERMINADO') summary.indetH += hrs;

      if (!eqRef.grupos[grupo]) eqRef.grupos[grupo] = { totalH: 0, operacoes: {} };
      eqRef.grupos[grupo].totalH += hrs;
      eqRef.grupos[grupo].operacoes[operacao] = (eqRef.grupos[grupo].operacoes[operacao] || 0) + hrs;
    });

    const dispH = Math.max(0, summary.totalH - summary.descontosH);
    
    summary.kpis = {
      dispH,
      efOp: dispH > 0 ? (summary.prodH / dispH) * 100 : 0,
      efReal: summary.totalH > 0 ? (summary.prodH / summary.totalH) * 100 : 0,
      percSApont: summary.totalH > 0 ? (summary.sApontH / summary.totalH) * 100 : 0,
      percIndet: summary.totalH > 0 ? (summary.indetH / summary.totalH) * 100 : 0,
      percMotorOcioso: summary.totalH > 0 ? (summary.ociosoH / summary.totalH) * 100 : 0
    };

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

  const efOpCor = entityData ? COA_RULES.eficienciaOp(entityData.kpis.efOp) : COA_COLORS.neutro;

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
                      {formatToBR(date)}
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
            
            {/* Feedback de Sem Dados */}
            {Object.keys(entityData.equipamentos).length === 0 ? (
               <div className="bg-[#161B22] p-8 rounded-2xl border border-dashed border-slate-700 text-center">
                 <span className="text-xs font-bold text-slate-500 uppercase">Nenhum registro para {selectedEntity} em {formatToBR(selectedDate)}</span>
               </div>
            ) : (
              <>
                {/* DASHBOARD RESUMO DO OPERADOR / EQUIPAMENTO */}
                <div className="bg-[#161B22] border-t-4 border-emerald-500 rounded-2xl border-x border-b border-slate-700/80 shadow-2xl overflow-hidden">
                  <div className="p-4 flex gap-4">
                    <div className="w-[45%] flex flex-col items-center justify-center p-3 bg-[#11151D] rounded-xl border border-slate-700/80 shadow-inner">
                      <div className="relative flex items-center justify-center w-28 h-14">
                        <svg className="w-full h-full absolute top-0" viewBox="0 0 100 50">
                          <path d="M 10 45 A 40 40 0 0 1 90 45" fill="none" stroke="#2D3748" strokeWidth="12" strokeLinecap="round" />
                          <path 
                            d="M 10 45 A 40 40 0 0 1 90 45" 
                            fill="none" 
                            stroke={efOpCor} 
                            strokeWidth="12" 
                            strokeLinecap="round"
                            strokeDasharray={`${(Math.min(entityData.kpis.efOp, 100) / 100) * 126} 126`} 
                            className="transition-all duration-1000 ease-out"
                          />
                        </svg>
                        <div className="flex flex-col items-center justify-center mt-6">
                          <span className="text-xl font-black tracking-tighter leading-none" style={{ color: efOpCor, textShadow: `0 0 8px ${efOpCor}40` }}>
                            {Number(entityData.kpis.efOp).toFixed(1)}%
                          </span>
                          <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-1">Ef. Op.</span>
                        </div>
                      </div>
                      <div className="mt-4 text-center border-t border-slate-700/80 pt-2 w-full">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block leading-none mb-0.5">Ef. Real</span>
                        <span className="text-xs font-black text-slate-100">{Number(entityData.kpis.efReal).toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="w-[55%] flex flex-col justify-center gap-1.5">
                      <div className="flex justify-between items-center bg-[#11151D] p-2 rounded-lg border border-slate-700/50">
                        <span className="text-[8px] font-black text-slate-400 uppercase">Totais</span>
                        <span className="text-xs font-black text-slate-100">{formatDecimalToHHMM(entityData.totalH)}h</span>
                      </div>
                      <div className="flex justify-between items-center bg-[#11151D] p-2 rounded-lg border border-slate-700/50">
                        <span className="text-[8px] font-black text-slate-400 uppercase">Produtivas</span>
                        <span className="text-xs font-black" style={{ color: COA_COLORS.dentro }}>{formatDecimalToHHMM(entityData.prodH)}h</span>
                      </div>
                      <div className="flex justify-between items-center bg-[#11151D] p-2 rounded-lg border border-slate-700/50">
                        <span className="text-[8px] font-black text-slate-400 uppercase">Disp.</span>
                        <span className="text-xs font-black text-emerald-400">{formatDecimalToHHMM(entityData.kpis.dispH)}h</span>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-1 flex flex-col gap-2.5 bg-[#161B22]">
                    <ProgressBar label="Sem Apontamento" percent={entityData.kpis.percSApont} color={COA_RULES.semApontamento(entityData.kpis.percSApont)} extraText={`${formatDecimalToHHMM(entityData.sApontH)}h`} />
                    <ProgressBar label="Indeterminado" percent={entityData.kpis.percIndet} color={COA_RULES.indeterminado(entityData.kpis.percIndet)} extraText={`${formatDecimalToHHMM(entityData.indetH)}h`} />
                    <ProgressBar label="Motor Ocioso" percent={entityData.kpis.percMotorOcioso} color={COA_RULES.motorOcioso(entityData.kpis.percMotorOcioso)} extraText={`${formatDecimalToHHMM(entityData.ociosoH)}h`} />
                  </div>
                </div>

                {/* LISTA DE EQUIPAMENTOS / OPERAÇÕES */}
                {Object.entries(entityData.equipamentos).map(([eqFullName, eqData], eqIdx) => (
                  <div key={eqIdx} className="bg-[#161B22] rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
                    <div className="bg-[#0D1117] p-4 border-b border-slate-800">
                      <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Equipamento</span>
                      <h3 className="text-sm font-black text-slate-200 uppercase mt-1 tracking-tight">{eqFullName}</h3>
                    </div>

                    <div className="p-3 flex flex-col gap-2">
                      {Object.entries(eqData.grupos)
                        .sort(([, a], [, b]) => b.totalH - a.totalH) // Sort by hours now
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
                                <span className={`text-xs font-black ${isProd ? 'text-emerald-500' : 'text-slate-500'}`}>{formatDecimalToHHMM(grpData.totalH)}</span>
                              </button>

                              {isOpen && (
                                <div className="px-4 pb-3 flex flex-col gap-1 border-t border-slate-800/50 pt-2">
                                  {Object.entries(grpData.operacoes).sort(([, a], [, b]) => b - a).map(([opName, opHrs], opIdx) => (
                                    <div key={opIdx} className="flex justify-between items-center py-2 border-b border-slate-800/30 last:border-0">
                                      <span className={`text-[11px] font-medium ${isProd ? 'text-emerald-300' : 'text-slate-500'}`}>{opName}</span>
                                      <span className="text-xs font-bold text-slate-300">{formatDecimalToHHMM(opHrs)}</span>
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

                {/* Resumo Geral Unificado */}
                {Object.keys(entityData.equipamentos).length > 0 && (
                  <div className="bg-[#161B22] rounded-2xl border border-slate-800 shadow-2xl p-6">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-5 border-b border-slate-800 pb-3">Distribuição de Horas</h3>
                    <div className="flex flex-col gap-4">
                      <div className="flex text-[8px] font-black text-slate-600 uppercase tracking-widest px-1">
                        <span className="flex-1">Equipamento</span>
                        <span className="w-20 text-right">Produtivo</span>
                        <span className="w-20 text-right">Total</span>
                      </div>
                      {Object.entries(entityData.equipamentos).map(([eqFullName, eqData], idx) => (
                        <div key={idx} className="flex items-center px-1 py-3 border-b border-slate-800 last:border-0">
                          <span className="flex-1 text-[11px] font-black text-slate-400 truncate mr-2">{eqData.id}</span>
                          <span className="w-20 text-right text-xs font-black text-emerald-500">{formatDecimalToHHMM(eqData.prodH)}</span>
                          <span className="w-20 text-right text-xs font-black text-slate-200">{formatDecimalToHHMM(eqData.totalH)}</span>
                        </div>
                      ))}
                      {Object.keys(entityData.equipamentos).length > 1 && (
                        <div className="mt-2 p-4 bg-emerald-600/10 border border-emerald-500/30 rounded-xl flex items-center shadow-lg">
                          <div className="flex-1 flex flex-col">
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Total da Frota</span>
                            <span className="text-[8px] font-bold text-emerald-600/60 uppercase">Consolidado Geral</span>
                          </div>
                          <span className="w-20 text-right text-xs font-black text-emerald-400">{formatDecimalToHHMM(entityData.prodH)}</span>
                          <span className="w-20 text-right text-sm font-black text-emerald-100">{formatDecimalToHHMM(entityData.totalH)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Operacoes;