import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import './Style.css';

import QualyHeader from '../../components/QualyFlow/QualyHeader';
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelector from '../../components/QualyFlow/DateSelector';
import CucCard from '../../components/QualyFlow/CucCard';
import PerdasMecCard from '../../components/QualyFlow/PerdasMecCard'; 

const formatToInputDate = (dd_mm_yyyy) => {
  if (!dd_mm_yyyy) return '';
  const [dia, mes, ano] = dd_mm_yyyy.split('/');
  return `${ano}-${mes}-${dia}`;
};

const generateAnchorId = (text) => {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, '-');
};

const scrollToElement = (id) => {
  const element = document.getElementById(id);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

const ORDERED_CARDS = [
  'CUC - Gotejo',
  'Avaliação de Perda Mecanizada',
  'Avaliação Drone',
  'Semente Mecanizada'
];

const QualyFlowHome = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isIndexOpen, setIsIndexOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [dataFiltroInput, setDataFiltroInput] = useState('');
  const [availableDates, setAvailableDates] = useState([]);
  
  const [atividadesResumo, setAtividadesResumo] = useState([]);
  const [cucGeralData, setCucGeralData] = useState([]);
  
  const [perdasMecData, setPerdasMecData] = useState([]);
  const [perdasMecDiario, setPerdasMecDiario] = useState({});
  const [perdasMecAnual, setPerdasMecAnual] = useState({});
  const [perdasMecCategorias, setPerdasMecCategorias] = useState([]);

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
          const uniqueDates = [...new Set(dts.map(d => formatToInputDate(d.data_apontamento)))];
          setAvailableDates(uniqueDates);
          const ultimaDataInput = uniqueDates[0];
          setDataFiltroInput(ultimaDataInput);
          fetchDashboardData(dts[0].data_apontamento);
        } else {
          setLoading(false);
        }
      } catch (e) {
        console.error("Erro ao buscar datas:", e);
        setLoading(false);
      }
    }
    initDates();
  }, []);

  const fetchDashboardData = async (dbDate) => {
    try {
      setLoading(true);
      const year = dbDate.substring(6, 10);
      
      const { data: atvData } = await supabase
        .from('vw_atvrealizadas')
        .select('atividade, pontos')
        .eq('data_apontamento', dbDate);

      const sortedAtv = (atvData || []).sort((a, b) => {
        const idxA = ORDERED_CARDS.indexOf(a.atividade);
        const idxB = ORDERED_CARDS.indexOf(b.atividade);
        if (idxA === -1 && idxB === -1) return a.atividade.localeCompare(b.atividade);
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });

      setAtividadesResumo(sortedAtv);

      // NOVO MOTOR CUC: Busca os campos avaliados no dia e cruza com a visão geral
      if (sortedAtv.some(a => a.atividade.includes('CUC'))) {
        const { data: cucCamposDbDate } = await supabase
          .from('vw_cuc_datas')
          .select('*')
          .eq('data_apontamento', dbDate);

        if (cucCamposDbDate && cucCamposDbDate.length > 0) {
          const camposList = cucCamposDbDate.map(c => c.campo);
          const avalsList = cucCamposDbDate.map(c => c.avaliacao);

          const { data: cucData } = await supabase
            .from('vw_cuc_geral')
            .select('*')
            .in('campo', camposList);

          // Garante que não mistura safras/avaliações antigas do mesmo campo
          const filteredCuc = (cucData || []).filter(c => avalsList.includes(c.avaliacao));
          setCucGeralData(filteredCuc);
        } else {
          setCucGeralData([]);
        }
      } else {
        setCucGeralData([]);
      }

      // PERDA MECANIZADA
      if (sortedAtv.some(a => a.atividade.includes('Perda'))) {
        const [camposRes, diarioRes, anualRes, categoriasRes] = await Promise.all([
          supabase.from('vw_perdamec_datacampo').select('*').eq('data', dbDate),
          supabase.from('vw_perdamec_diario').select('*').eq('data', dbDate).single(),
          supabase.from('vw_perdamec_anual').select('*').eq('ano', year).single(),
          supabase.from('vw_perdamec_categorias_diario').select('*').eq('data', dbDate)
        ]);

        setPerdasMecData(camposRes.data || []);
        setPerdasMecDiario(diarioRes.data || {});
        setPerdasMecAnual(anualRes.data || {});
        setPerdasMecCategorias(categoriasRes.data || []);
      } else {
        setPerdasMecData([]);
        setPerdasMecDiario({});
        setPerdasMecAnual({});
        setPerdasMecCategorias([]);
      }

    } catch (err) {
      console.error("Erro no fetch:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (novaDataInput) => {
    setDataFiltroInput(novaDataInput);
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
    <div className="min-h-screen bg-[var(--q-bg)] flex flex-col items-center pb-20 no-scrollbar font-sans">
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

      {/* NOVO ÍNDICE DE ATIVIDADES RETRÁTIL (Encapsulado e Clean) */}
      {!loading && atividadesResumo.length > 0 && (
        <div className="w-full max-w-[400px] px-4 mt-6 flex flex-col">
          <div className="w-full bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden transition-all duration-300">
            
            {/* Cabeçalho do Card */}
            <button 
              onClick={() => setIsIndexOpen(!isIndexOpen)}
              className="flex justify-between items-center w-full px-5 py-4 hover:bg-slate-50 transition-colors"
            >
              <span className="text-[12px] font-black text-slate-700 uppercase tracking-widest">
                Atividades Realizadas
              </span>
              <div className="flex items-center gap-3">
                {!isIndexOpen && (
                  <span className="text-[11px] font-black text-white bg-[var(--q-green)] px-2.5 py-0.5 rounded shadow-sm">
                    {atividadesResumo.length}
                  </span>
                )}
                <span className={`text-[10px] text-slate-400 font-bold transition-transform duration-300 ${isIndexOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </div>
            </button>

            {/* Conteúdo Aberto */}
            <div className={`flex flex-col transition-all duration-300 ${isIndexOpen ? 'max-h-[800px] bg-[var(--q-green)]/5 border-t border-[var(--q-green)]/20' : 'max-h-0 opacity-0'}`}>
              {atividadesResumo.map((atv, idx) => {
                const anchorId = generateAnchorId(atv.atividade);
                return (
                  <button 
                    key={idx}
                    onClick={() => scrollToElement(anchorId)}
                    className="flex justify-between items-center px-5 py-3.5 border-b border-[var(--q-green)]/10 last:border-0 hover:bg-[var(--q-green)]/10 transition-colors w-full text-left group"
                  >
                    <span className="text-[11px] font-black text-[var(--q-dark)] group-hover:text-[var(--q-green)] transition-colors">
                      {atv.atividade}
                    </span>
                    <span className="text-[11px] font-black text-[var(--q-orange)]">
                      {atv.pontos}
                    </span>
                  </button>
                );
              })}
            </div>

          </div>
        </div>
      )}

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
            {cucGeralData.length > 0 && <CucCard id={generateAnchorId('CUC - Gotejo')} dataList={cucGeralData} to="/qualyflow/cuc" selectedDate={dataFiltroInput} />}
            {perdasMecData.length > 0 && (
              <PerdasMecCard 
                id={generateAnchorId('Avaliação de Perda Mecanizada')} 
                dataList={perdasMecData} 
                diario={perdasMecDiario}
                anual={perdasMecAnual}
                categorias={perdasMecCategorias}
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