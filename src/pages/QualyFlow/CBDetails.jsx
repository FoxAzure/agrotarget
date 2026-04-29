import React, { useState, useMemo } from 'react';
import { useLocation } from 'react-router-dom';

// Componentes Reutilizáveis
import HeaderCB from '../../components/QualyFlow/HeaderCB'; 
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelector from '../../components/QualyFlow/DateSelector';

// Dados e Mapeamento
import qualyflowMockData from '../../data/mockData.json';
import ebMapping from '../../data/ebMapping.json'; // O seu JSON conectado aqui!

// ===========================================================================
// FUNÇÕES HELPERS DE CORES E STATUS
// ===========================================================================
const getColorPerc = (val) => {
  if (val >= 90) return '#22c55e'; // Verde
  if (val >= 80) return '#eab308'; // Amarelo
  return '#ef4444'; // Vermelho
};

const getColorStatus = (status) => {
  if (status === 'Conforme') return '#22c55e';
  if (status === 'Não Conforme') return '#ef4444';
  return '#94a3b8'; // Cinza se não avaliado
};

const getColorZeroGood = (val) => {
  if (val === 0) return '#22c55e'; // 0 é Verde
  return '#ef4444'; // >0 é Vermelho
};

const formatStatus = (val) => {
  if (val === 100) return 'Conforme';
  if (val === 0) return 'Não Conforme';
  return 'N/A';
};

const CBDetails = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState({});
  const [activeTabs, setActiveTabs] = useState({}); // Controla a aba ativa de cada EB
  const location = useLocation();
  const passedDate = location.state?.selectedDate;

  const toggleSection = (id) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const setTab = (id, tab) => {
    setActiveTabs(prev => ({ ...prev, [id]: tab }));
  };

  const getTab = (id) => activeTabs[id] || 'captacao';

  // ===========================================================================
  // 1. GESTÃO DE DATAS
  // ===========================================================================
  const availableDates = useMemo(() => {
    const data = qualyflowMockData.filter(i => 
      ["Captação", "Fertirrigação", "Adubeira", "Limpeza e Organização"].includes(i.OCORRENCIA)
    );
    const dates = [...new Set(data.map(item => item.DATA_HORA?.substring(0, 10)).filter(Boolean))];
    return dates.sort((a, b) => {
      const dateA = a.includes('/') ? a.split('/').reverse().join('-') : a;
      const dateB = b.includes('/') ? b.split('/').reverse().join('-') : b;
      return dateB.localeCompare(dateA);
    });
  }, []);

  const [dateIndex, setDateIndex] = useState(() => {
    if (passedDate && availableDates.includes(passedDate)) return availableDates.indexOf(passedDate);
    return 0;
  });

  const selectedDate = availableDates[dateIndex] || "";

  // ===========================================================================
  // 2. MOTOR DE CÁLCULO
  // ===========================================================================
  const cbData = useMemo(() => {
    if (!selectedDate) return [];

    const dayData = qualyflowMockData.filter(i => 
      i.DATA_HORA?.startsWith(selectedDate) && 
      ["Captação", "Fertirrigação", "Adubeira", "Limpeza e Organização"].includes(i.OCORRENCIA)
    );

    const ebNames = [...new Set(dayData.map(i => i.NOME_EB || i.NRO_EB || i.CASA_DE_BOMBA).filter(Boolean))];

    const getVal = (df, ocorr, indics) => {
      for (let indic of indics) {
        const item = df.find(i => i.OCORRENCIA === ocorr && i.INDICADOR === indic);
        if (item && !isNaN(Number(item.VALOR))) return Number(item.VALOR);
      }
      return 0;
    };

    return ebNames.map(ebName => {
      const dfEb = dayData.filter(i => (i.NOME_EB || i.NRO_EB || i.CASA_DE_BOMBA) === ebName);
      
      // Aqui a mágica acontece: puxando do seu ebMapping.json
      const referencia = ebMapping[ebName] || ebName;

      // --- CÁLCULOS DO CABEÇALHO (Visão Geral) ---
      const totalTelas = getVal(dfEb, "Captação", ["Total de Telas"]);
      const telasDanificadas = getVal(dfEb, "Captação", ["Tela Danificada"]);
      const telasFaltando = getVal(dfEb, "Captação", ["Tela Faltando"]);
      const telasSujas = getVal(dfEb, "Captação", ["Tela Suja"]);
      const telasProblema = telasDanificadas + telasFaltando + telasSujas;
      const telasPerc = totalTelas > 0 ? (1 - (telasProblema / totalTelas)) * 100 : 100;

      const totalCaixas = getVal(dfEb, "Fertirrigação", ["Total de Caixas", "Total Caixas"]);
      const caixasDanificadas = getVal(dfEb, "Fertirrigação", ["Caixas Danificadas"]);
      const caixasPerc = totalCaixas > 0 ? (1 - (caixasDanificadas / totalCaixas)) * 100 : 100;

      // --- CAPTAÇÃO ---
      const capVazamentos = getVal(dfEb, "Captação", ["Vazamentos"]);
      const capLimpeza = formatStatus(getVal(dfEb, "Captação", ["Limpeza do tanque", "Limpeza do Tanque"]));

      // --- FERTIRRIGAÇÃO (Vazamentos) ---
      const vazBomba = getVal(dfEb, "Fertirrigação", ["Vazamentos Conexões Bomba Fertil", "Total Vaz. Conexões Bomba Fertil"]);
      const vazReg = getVal(dfEb, "Fertirrigação", ["Vazamentos Registros", "Total Vaz. Registros"]);
      const vazTub = getVal(dfEb, "Fertirrigação", ["Vazamentos Tubulação", "Total Vaz. Tubulação"]);
      const vazBar = getVal(dfEb, "Fertirrigação", ["Vazamentos Barrilete", "Vaz. Barrilete"]);
      const vazFiltro = getVal(dfEb, "Fertirrigação", ["Vazamentos Filtro de Areia", "Vaz. Filtro de Areia"]);
      const vazMicro = getVal(dfEb, "Fertirrigação", ["Vazamentos Microtubo e Conexões", "Vaz. Microtubo e Conexões"]);

      // --- ADUBEIRA ---
      const adOrgInsumos = formatStatus(getVal(dfEb, "Adubeira", ["Organização dos Insumos"]));
      const adPlacas = formatStatus(getVal(dfEb, "Adubeira", ["Placas Indicativas para os Insumos"]));
      const adPallets = formatStatus(getVal(dfEb, "Adubeira", ["Produtos Estão sobre os Pallets"]));

      // --- LIMPEZA E ORGANIZAÇÃO ---
      const limExt = formatStatus(getVal(dfEb, "Limpeza e Organização", ["Limpeza Externa da EB"]));
      const limInt = formatStatus(getVal(dfEb, "Limpeza e Organização", ["Limpeza Interna da EB"]));
      const limOrg = formatStatus(getVal(dfEb, "Limpeza e Organização", ["Organização Geral"]));
      const ilumExt = getVal(dfEb, "Limpeza e Organização", ["Iluminação Externa Queimada"]);
      const ilumInt = getVal(dfEb, "Limpeza e Organização", ["Iluminação Interna Queimada"]);

      return {
        nomeOriginal: ebName,
        referencia,
        telasPerc,
        caixasPerc,
        captacao: { totalTelas, telasDanificadas, telasFaltando, telasSujas, capVazamentos, capLimpeza },
        fert: { totalCaixas, caixasDanificadas, vazBomba, vazReg, vazTub, vazBar, vazFiltro, vazMicro },
        adubeira: { adOrgInsumos, adPlacas, adPallets },
        limpeza: { limExt, limInt, limOrg, ilumExt, ilumInt }
      };
    }).sort((a, b) => String(a.referencia).localeCompare(String(b.referencia), undefined, { numeric: true }));

  }, [selectedDate]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900">
      <HeaderCB onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={(p) => console.log(p)} />

      <main className="p-4 flex flex-col items-center">
        
        {/* Seletor Ajustado para 400px */}
        <div className="w-full max-w-[400px] mb-5 mt-2">
          <DateSelector 
            date={selectedDate} 
            onPrev={() => setDateIndex(di => Math.min(di + 1, availableDates.length - 1))} 
            onNext={() => setDateIndex(di => Math.max(di - 1, 0))} 
            disablePrev={dateIndex === availableDates.length - 1} 
            disableNext={dateIndex === 0} 
          />
        </div>

        {/* MENSAGEM QUANDO VAZIO */}
        {cbData.length === 0 && (
          <div className="w-full max-w-[400px] text-center p-8 bg-white rounded-xl border border-slate-200 border-dashed text-slate-400 font-bold text-xs uppercase tracking-widest mt-4">
            Nenhuma CB avaliada nesta data
          </div>
        )}

        <div className="w-full max-w-[400px] flex flex-col gap-6 animate-in fade-in duration-500">
          
          {/* RESUMO SIMPLES DE FROTA */}
          {cbData.length > 0 && (
             <div className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center shadow-sm">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">Casas de Bombas Avaliadas</span>
                <span className="text-2xl font-black tracking-tighter text-agro-green">
                  {cbData.length} <span className="text-[10px] font-bold text-slate-400 uppercase"></span>
                </span>
             </div>
          )}

          {/* LISTAGEM ACORDEÃO DAS CASAS DE BOMBA */}
          {cbData.length > 0 && (
            <div className="flex flex-col gap-3.5">
              <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-2">Monitoramento por EB</h3>
              
              <div className="flex flex-col gap-2">
                {cbData.map((eb, idx) => {
                  const isExpanded = expandedSections[eb.nomeOriginal];
                  const currentTab = getTab(eb.nomeOriginal);

                  return (
                    <div key={idx} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                      
                      <button 
                        onClick={() => toggleSection(eb.nomeOriginal)}
                        className={`w-full p-4 flex justify-between items-center transition-colors z-10 relative ${
                          isExpanded ? 'bg-slate-50/80 border-b border-slate-100' : 'bg-white hover:bg-slate-50/50'
                        }`}
                      >
                        {/* Indicador visual à esquerda */}
                        <div className={`absolute top-0 left-0 w-1.5 h-full transition-colors ${isExpanded ? 'bg-agro-green' : 'bg-slate-200'}`} />

                        <div className="flex flex-col items-start text-left pl-2">
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Casa de Bomba</span>
                          {/* Nome da referência aplicado aqui! */}
                          <h4 className="text-[15px] font-black text-slate-800 leading-none truncate max-w-[150px]">{eb.referencia}</h4>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="flex gap-4">
                            <div className="flex flex-col items-center leading-none">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Telas OK</span>
                              <span className="text-sm font-black tracking-tighter" style={{ color: getColorPerc(eb.telasPerc) }}>
                                {eb.telasPerc.toFixed(0)}%
                              </span>
                            </div>
                            <div className="flex flex-col items-center leading-none border-l border-slate-200 pl-4">
                              <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Caixas OK</span>
                              <span className="text-sm font-black tracking-tighter" style={{ color: getColorPerc(eb.caixasPerc) }}>
                                {eb.caixasPerc.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <span className={`text-slate-300 text-[12px] ml-1 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                        </div>
                      </button>

                      {/* Animação Fluida via Grid para os Detalhes */}
                      <div className={`grid transition-all duration-300 ease-in-out bg-white ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                        <div className="overflow-hidden">
                          <div className="p-4 flex flex-col gap-4">
                            
                            {/* Abas Superiores */}
                            <div className="flex bg-slate-100 p-1 rounded-lg">
                              {[
                                { id: 'captacao', label: 'Captação' },
                                { id: 'fert', label: 'Fertirrig.' },
                                { id: 'adubeira', label: 'Adubeira' },
                                { id: 'limpeza', label: 'Limpeza' }
                              ].map(tab => (
                                <button
                                  key={tab.id}
                                  onClick={() => setTab(eb.nomeOriginal, tab.id)}
                                  className={`flex-1 text-[9px] font-black uppercase py-2 rounded-md transition-all truncate px-1 ${
                                    currentTab === tab.id ? 'bg-white shadow-sm text-agro-green' : 'text-slate-400 hover:text-slate-600'
                                  }`}
                                >
                                  {tab.label}
                                </button>
                              ))}
                            </div>

                            {/* --- CONTEÚDO: CAPTAÇÃO --- */}
                            {currentTab === 'captacao' && (
                              <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="flex justify-between items-end border-b border-slate-100 pb-2">
                                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total de Telas Inspecionadas</span>
                                  <span className="text-lg font-black text-slate-700 leading-none">{eb.captacao.totalTelas}</span>
                                </div>
                                <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex flex-col gap-2">
                                  <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-200/60 pb-1.5 mb-1">Problemas nas Telas</h5>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-bold text-slate-600">Tela Danificada</span>
                                    <span className="text-[12px] font-black" style={{ color: getColorZeroGood(eb.captacao.telasDanificadas) }}>{eb.captacao.telasDanificadas}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-bold text-slate-600">Tela Faltando</span>
                                    <span className="text-[12px] font-black" style={{ color: getColorZeroGood(eb.captacao.telasFaltando) }}>{eb.captacao.telasFaltando}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-bold text-slate-600">Tela Suja</span>
                                    <span className="text-[12px] font-black" style={{ color: getColorZeroGood(eb.captacao.telasSujas) }}>{eb.captacao.telasSujas}</span>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center border-b border-slate-100 pb-2 mt-1">
                                  <span className="text-[11px] font-bold text-slate-600">Vazamentos na Captação</span>
                                  <span className="text-[14px] font-black" style={{ color: getColorZeroGood(eb.captacao.capVazamentos) }}>
                                    {eb.captacao.capVazamentos}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center border-b border-slate-50 pb-1">
                                  <span className="text-[11px] font-bold text-slate-600">Limpeza do Tanque</span>
                                  <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: getColorStatus(eb.captacao.capLimpeza) }}>
                                    {eb.captacao.capLimpeza}
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* --- CONTEÚDO: FERTIRRIGAÇÃO --- */}
                            {currentTab === 'fert' && (
                              <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="grid grid-cols-2 gap-2 mb-1">
                                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex flex-col items-center">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Total Caixas</span>
                                    <span className="text-xl font-black text-slate-700">{eb.fert.totalCaixas}</span>
                                  </div>
                                  <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex flex-col items-center">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 text-center">Danificadas</span>
                                    <span className="text-xl font-black" style={{ color: getColorZeroGood(eb.fert.caixasDanificadas) }}>{eb.fert.caixasDanificadas}</span>
                                  </div>
                                </div>
                                
                                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100 pb-2 mt-2">Vazamentos</h5>
                                <div className="flex flex-col gap-2.5">
                                  {[
                                    { label: 'Conexões Bomba', val: eb.fert.vazBomba },
                                    { label: 'Registros', val: eb.fert.vazReg },
                                    { label: 'Tubulação', val: eb.fert.vazTub },
                                    { label: 'Barrilete', val: eb.fert.vazBar },
                                    { label: 'Filtro de Areia', val: eb.fert.vazFiltro },
                                    { label: 'Microtubo e Conex.', val: eb.fert.vazMicro },
                                  ].map((vaz, vIdx) => (
                                    <div key={vIdx} className="flex justify-between items-center border-b border-slate-50 border-dashed pb-1.5 last:border-0">
                                      <span className="text-[11px] font-bold text-slate-600">{vaz.label}</span>
                                      <span className="text-[13px] font-black" style={{ color: getColorZeroGood(vaz.val) }}>{vaz.val}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* --- CONTEÚDO: ADUBEIRA --- */}
                            {currentTab === 'adubeira' && (
                              <div className="flex flex-col gap-3.5 animate-in fade-in slide-in-from-right-2 duration-300 pt-1">
                                {[
                                  { label: 'Organização dos Insumos', val: eb.adubeira.adOrgInsumos },
                                  { label: 'Placas Indicativas', val: eb.adubeira.adPlacas },
                                  { label: 'Produtos sobre Pallets', val: eb.adubeira.adPallets },
                                ].map((item, iIdx) => (
                                  <div key={iIdx} className="flex justify-between items-center border-b border-slate-100 pb-2.5 last:border-0">
                                    <span className="text-[11px] font-bold text-slate-600 pr-4">{item.label}</span>
                                    <span className="text-[11px] font-black uppercase tracking-wider whitespace-nowrap" style={{ color: getColorStatus(item.val) }}>
                                      {item.val}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* --- CONTEÚDO: LIMPEZA --- */}
                            {currentTab === 'limpeza' && (
                              <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-2 duration-300">
                                <div className="flex flex-col gap-2.5">
                                  <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5">Conformidade Geral</h5>
                                  {[
                                    { label: 'Limpeza Externa', val: eb.limpeza.limExt },
                                    { label: 'Limpeza Interna', val: eb.limpeza.limInt },
                                    { label: 'Organização Geral', val: eb.limpeza.limOrg },
                                  ].map((item, iIdx) => (
                                    <div key={iIdx} className="flex justify-between items-center border-b border-slate-50 border-dashed pb-1.5 last:border-0">
                                      <span className="text-[11px] font-bold text-slate-600">{item.label}</span>
                                      <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: getColorStatus(item.val) }}>
                                        {item.val}
                                      </span>
                                    </div>
                                  ))}
                                </div>

                                <div className="flex flex-col gap-2.5 mt-1">
                                  <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1.5">Iluminação (Queimadas)</h5>
                                  <div className="flex justify-between items-center border-b border-slate-50 border-dashed pb-1.5">
                                    <span className="text-[11px] font-bold text-slate-600">Iluminação Externa</span>
                                    <span className="text-[13px] font-black" style={{ color: getColorZeroGood(eb.limpeza.ilumExt) }}>{eb.limpeza.ilumExt}</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-[11px] font-bold text-slate-600">Iluminação Interna</span>
                                    <span className="text-[13px] font-black" style={{ color: getColorZeroGood(eb.limpeza.ilumInt) }}>{eb.limpeza.ilumInt}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                          </div>
                        </div>
                      </div>
                      
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default CBDetails;