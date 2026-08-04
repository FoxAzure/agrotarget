import React, { useState, useEffect } from 'react';
import './Style.css';

import { supabase } from '../../lib/supabaseClient'; // O caminho certinho!

import QualyHeader from '../../components/QualyFlow/QualyHeader';
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelectorQualyFlow from '../../components/QualyFlow/DateSelector';
import CardAtividadesDiaria from '../../components/QualyFlow/CardAtividadesDiaria';

const QualyFlowHome = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [loadingDates, setLoadingDates] = useState(true);
  
  // Datas recebidas do banco
  const [availableDates, setAvailableDates] = useState([]);
  
  // A data que o usuário vê (DD/MM/AAAA)
  const [selectedDate, setSelectedDate] = useState('');

  // 1. Busca as datas assim que a Home carrega (Padrão COA Center)
  useEffect(() => {
    let mounted = true;

    const loadAvailableDates = async () => {
      try {
        setLoadingDates(true);
        const { data, error } = await supabase
          .from('vw_q_agrotarget_datas')
          .select('data_apontamento');

        if (error) throw error;

        if (!mounted) return;

        if (data && data.length > 0) {
          // Extrai apenas as strings e remove nulos/vazios
          const rawDates = [...new Set(data.map(d => d.data_apontamento).filter(Boolean))];
          setAvailableDates(rawDates);
        }
      } catch (err) {
        console.error('[QualyFlow] Erro ao carregar vw_q_agrotarget_datas:', err);
      } finally {
        if (mounted) setLoadingDates(false);
      }
    };

    loadAvailableDates();

    return () => { mounted = false; };
  }, []);

  // 2. Quando a data muda, dispara a busca dos Cards
  useEffect(() => {
    if (!selectedDate) return;
    console.log(`[Home] Buscando dados dos cards para: ${selectedDate}`);
    // Aqui entrará o seu motor de CUC e Perdas Mecanizadas!
  }, [selectedDate]);

  return (
    <div className="min-h-screen bg-[var(--q-bg)] flex flex-col items-center pb-24 no-scrollbar font-sans w-full">
      
      <QualyHeader onMenuOpen={() => setSidebarOpen(true)}>
        <DateSelectorQualyFlow 
          value={selectedDate}
          availableDatesData={availableDates}
          onChange={setSelectedDate}
          isLoading={loadingDates} // Passamos o estado de loading pro seletor
        />
      </QualyHeader>

      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="w-full px-4 flex flex-col gap-6 mt-6 items-center flex-1 max-w-[600px] mx-auto">
        
        {loadingDates ? (
          <div className="mt-20 flex flex-col items-center justify-center gap-4 w-full">
            <div className="w-10 h-10 border-4 border-[var(--q-green)]/20 border-t-[var(--q-green)] rounded-full animate-spin"></div>
            <span className="text-micro text-[var(--q-green)] tracking-widest animate-pulse">
              Carregando Calendário...
            </span>
          </div>
        ) : !selectedDate ? (
          <div className="mt-20 flex flex-col items-center justify-center text-center opacity-40 px-6">
            <span className="text-6xl mb-4 grayscale">🍃</span>
            <span className="text-title text-[var(--q-dark)]">Base Vazia</span>
            <span className="text-sm font-medium mt-1 text-slate-500">Nenhum dado encontrado no servidor.</span>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-4">
            
            {/* Card de Atividades Diárias Integrado */}
            <CardAtividadesDiaria selectedDate={selectedDate} />

          </div>
        )}

      </main>
    </div>
  );
};

export default QualyFlowHome;