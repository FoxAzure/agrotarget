// ================================= DOCUMENTATION ------------------------------------------
// Script: QualyFlowHome
// Purpose: Página inicial do QualyFlow (Com resiliência anti-timeout).
// Relationships:
//   - vw_q_agrotarget_datas
//   - CardAtividadesDiaria
//   - CardCUC
//   - CardPerdaMec
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import './Style.css';
import { supabase } from '../../lib/supabaseClient';

import HeaderQualyFlow from '../../components/QualyFlow/HeaderQualyFlow';
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelectorQualyFlow from '../../components/QualyFlow/DateSelectorQualyFlow';
import CardAtividadesDiaria from '../../components/QualyFlow/CardAtividadesDiaria';
import CardCUC from '../../components/QualyFlow/CardCUC';
import CardPerdaMec from '../../components/QualyFlow/CardPerdaMec';

// ================================= HELPERS ------------------------------------------------

const toIsoDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

// Motor de resiliência: Tenta executar a query até 3 vezes antes de desistir silenciosamente
const runWithRetry = async (queryFn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await queryFn();
      if (result.error) throw result.error;
      return result.data;
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      // Espera 1s, depois 2s, antes de tentar novamente (Exponential Backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};

// ================================= EXECUTOR -----------------------------------------------

const QualyFlowHome = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(toIsoDate(new Date()));

  // Controle dos anos disponíveis
  const [maxYearDb, setMaxYearDb] = useState(new Date().getFullYear());
  const [activeYear, setActiveYear] = useState(null);

  // Datas disponíveis
  const [availableDates, setAvailableDates] = useState([]);
  const [isLoadingDates, setIsLoadingDates] = useState(true);

  // =========================================================================
  // 1. DESCOBRE O MAIOR ANO (COM RETENTATIVA)
  // =========================================================================

  useEffect(() => {
    let mounted = true;

    const fetchMaxYear = async () => {
      try {
        const data = await runWithRetry(() => 
          supabase.from('vw_q_agrotarget_datas').select('ano').limit(1)
        );

        if (mounted && data && data.length > 0) {
          const highestYear = data[0].ano;
          setMaxYearDb(highestYear);
          setActiveYear(highestYear);
        } else if (mounted) {
          const currentYear = new Date().getFullYear();
          setMaxYearDb(currentYear);
          setActiveYear(currentYear);
        }
      } catch (err) {
        // Falhou silenciosamente, assume o ano atual para não quebrar a tela
        if (mounted) {
          const currentYear = new Date().getFullYear();
          setMaxYearDb(currentYear);
          setActiveYear(currentYear);
        }
      }
    };

    fetchMaxYear();
    return () => { mounted = false; };
  }, []);

  // =========================================================================
  // 2. LISTA DE ANOS
  // =========================================================================

  const yearsList = useMemo(() => {
    const list = [];
    for (let year = maxYearDb; year >= 2024; year--) {
      list.push(year);
    }
    return list;
  }, [maxYearDb]);

  // =========================================================================
  // 3. BUSCA DATAS DO ANO SELECIONADO (COM RETENTATIVA)
  // =========================================================================

  useEffect(() => {
    if (!activeYear) return;
    let mounted = true;

    const loadAvailableDates = async () => {
      setIsLoadingDates(true);

      try {
        const data = await runWithRetry(() => 
          supabase.from('vw_q_agrotarget_datas').select('data_apontamento').eq('ano', activeYear)
        );

        if (!mounted) return;

        const rawIsoDates = (data || [])
          .map((row) => {
            if (!row.data_apontamento || !row.data_apontamento.includes('/')) return null;
            const [day, month, year] = row.data_apontamento.split('/');
            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          })
          .filter(Boolean);

        const uniqueDates = [...new Set(rawIsoDates)];

        setAvailableDates(uniqueDates);
        if (uniqueDates.length > 0) {
          setSelectedDate(uniqueDates[0]);
        }
      } catch (err) {
        // Falhou silenciosamente, deixa a lista de datas vazia e a vida segue
        if (mounted) setAvailableDates([]);
      } finally {
        if (mounted) setIsLoadingDates(false);
      }
    };

    loadAvailableDates();
    return () => { mounted = false; };
  }, [activeYear]);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="qf-theme">
      
      <HeaderQualyFlow onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="qf-container py-6 md:py-10">
        <section className="flex flex-col gap-6">

          {/* ==============================================================
              SELETOR DE DATA
          ============================================================== */}
          <div className="w-full flex justify-center">
            <div className="w-full max-w-sm md:max-w-md">
              {activeYear && (
                <DateSelectorQualyFlow
                  value={selectedDate}
                  onChange={setSelectedDate}
                  availableDates={availableDates}
                  activeYear={activeYear}
                  onYearChange={setActiveYear}
                  yearsList={yearsList}
                  isLoading={isLoadingDates}
                />
              )}
            </div>
          </div>

          {/* ==============================================================
              CONTEÚDO PRINCIPAL
          ============================================================== */}
          <div className="w-full">
            {isLoadingDates ? (
              <div className="qf-home-loading">
                <div className="qf-home-loading__text">
                  <span>Buscando Avaliações</span>
                  <span className="qf-loading-dots"><i>.</i><i>.</i><i>.</i></span>
                </div>
                <div className="qf-home-loading__line" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <CardAtividadesDiaria selectedDate={selectedDate}/>
                <CardCUC selectedDate={selectedDate}/>
                <CardPerdaMec selectedDate={selectedDate}/>
              </div>
            )}
          </div>

        </section>
      </main>
    </div>
  );
};

export default QualyFlowHome;