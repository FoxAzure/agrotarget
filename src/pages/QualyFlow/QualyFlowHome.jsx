import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import './Style.css';

// Componentes
import QualyHeader from '../../components/QualyFlow/QualyHeader';
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelector from '../../components/QualyFlow/DateSelector';
import CucCard from '../../components/QualyFlow/CucCard';

// ================================= HELPERS ------------------------------------------------
const formatToInputDate = (dd_mm_yyyy) => {
  if (!dd_mm_yyyy) return '';
  const [dia, mes, ano] = dd_mm_yyyy.split('/');
  return `${ano}-${mes}-${dia}`;
};

const scrollToElement = (id) => {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

// ================================= EXECUTOR -----------------------------------------------
const QualyFlowHome = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Datas e Histórico
  const [dataFiltroInput, setDataFiltroInput] = useState(''); // Formato YYYY-MM-DD para o seletor
  const [availableDates, setAvailableDates] = useState([]); // Formato YYYY-MM-DD
  
  // Dados do Dashboard
  const [atividadesResumo, setAtividadesResumo] = useState([]);
  const [cucGeralData, setCucGeralData] = useState([]);

  // 1. Carrega todas as datas disponíveis no banco apenas uma vez ao abrir a tela
  useEffect(() => {
    async function initDates() {
      try {
        const { data: dts } = await supabase
          .from('vw_atvrealizadas')
          .select('data_apontamento, ano, mes')
          .order('ano', { ascending: false })
          .order('mes', { ascending: false })
          .order('data_apontamento', { ascending: false });
        
        if (dts && dts.length > 0) {
          // Extrai apenas as datas únicas já convertidas para o seletor (YYYY-MM-DD)
          const uniqueDates = [...new Set(dts.map(d => formatToInputDate(d.data_apontamento)))];
          setAvailableDates(uniqueDates);
          
          // Seta a data mais recente automaticamente
          const ultimaDataInput = uniqueDates[0];
          setDataFiltroInput(ultimaDataInput);
          fetchDashboardData(dts[0].data_apontamento); // Manda a original DD/MM/YYYY pro banco
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error("Erro ao buscar datas do histórico:", e);
        setLoading(false);
      }
    }
    initDates();
  }, []);

  // 2. Busca os dados reais com base na data selecionada
  const fetchDashboardData = async (dbDate) => {
    try {
      setLoading(true);

      const { data: atvData } = await supabase
        .from('vw_atvrealizadas')
        .select('atividade, pontos')
        .eq('data_apontamento', dbDate)
        .order('atividade', { ascending: true });

      setAtividadesResumo(atvData || []);

      const hasCuc = atvData?.some(a => a.atividade.includes('CUC'));
      if (hasCuc) {
        const { data: cucData } = await supabase
          .from('vw_cuc_geral')
          .select('*')
          .eq('data_final', dbDate);
        setCucGeralData(cucData || []);
      } else {
        setCucGeralData([]);
      }

    } catch (err) {
      console.error("Erro no fetch:", err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Ações de mudança de data do DateSelector
  const handleDateChange = (novaDataInput) => {
    setDataFiltroInput(novaDataInput);
    // Transforma YYYY-MM-DD de volta para DD/MM/YYYY antes de consultar o banco
    const [y, m, d] = novaDataInput.split('-');
    fetchDashboardData(`${d}/${m}/${y}`);
  };

  const handleNextDate = () => {
    const currentIndex = availableDates.indexOf(dataFiltroInput);
    if (currentIndex > 0) handleDateChange(availableDates[currentIndex - 1]);
  };

  const handlePrevDate = () => {
    const currentIndex = availableDates.indexOf(dataFiltroInput);
    if (currentIndex < availableDates.length - 1) handleDateChange(availableDates[currentIndex + 1]);
  };

  return (
    <div className="min-h-screen bg-[var(--q-bg)] flex flex-col items-center pb-20 no-scrollbar">
      
      {/* HEADER + DATE SELECTOR INTEGRADOS */}
      <QualyHeader onMenuOpen={() => setSidebarOpen(true)}>
        <DateSelector 
          date={dataFiltroInput}
          availableDates={availableDates}
          onSelectDate={handleDateChange}
          onPrev={handlePrevDate}
          onNext={handleNextDate}
          disableNext={availableDates.indexOf(dataFiltroInput) === 0}
          disablePrev={availableDates.indexOf(dataFiltroInput) === availableDates.length - 1}
        />
      </QualyHeader>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ÍNDICE DE ATIVIDADES (Vertical e Organizado) */}
      {!loading && atividadesResumo.length > 0 && (
        <div className="w-full max-w-[400px] px-4 mt-6 flex flex-col gap-2">
          <p className="text-micro mb-1 ml-1 text-[var(--q-gray)]">Índice de Avaliações</p>
          <div className="flex flex-col gap-2">
            {atividadesResumo.map((atv, idx) => {
              const anchorId = atv.atividade.toLowerCase().replace(/[^a-z0-9]/g, '-');
              return (
                <button 
                  key={idx}
                  onClick={() => scrollToElement(anchorId)}
                  className="group flex justify-between items-center px-5 py-3.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-[var(--q-green)] hover:shadow-md active:scale-95 transition-all w-full text-left"
                >
                  <span className="text-[13px] font-black text-[var(--q-dark)] group-hover:text-[var(--q-green)] transition-colors">
                    {atv.atividade}
                  </span>
                  <span className="text-[11px] font-black text-[var(--q-orange)]">
                    {atv.pontos} PONTOS
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ÁREA DE CARDS */}
      <main className="w-full px-4 flex flex-col gap-6 mt-4 items-center">
        {loading ? (
           <div className="mt-10 flex flex-col items-center gap-3">
             <div className="w-8 h-8 border-4 border-[var(--q-green)]/20 border-t-[var(--q-green)] rounded-full animate-spin"></div>
             <span className="text-micro animate-pulse text-[var(--q-green)]">Buscando auditorias...</span>
           </div>
        ) : atividadesResumo.length === 0 ? (
           <div className="mt-16 flex flex-col items-center opacity-50">
             <span className="text-4xl mb-2">🍃</span>
             <span className="text-sm font-bold text-[var(--q-dark)]">Nenhuma auditoria nesta data.</span>
           </div>
        ) : (
          <>
            {cucGeralData.length > 0 && (
              <CucCard 
                id="cuc-gotejo"
                dataList={cucGeralData} 
                to="/qualyflow/cuc" 
                selectedDate={dataFiltroInput} 
              />
            )}
          </>
        )}
      </main>

    </div>
  );
};

export default QualyFlowHome;