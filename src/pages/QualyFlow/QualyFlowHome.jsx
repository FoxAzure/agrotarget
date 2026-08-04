// ================================= DOCUMENTATION ------------------------------------------
// Script: QualyFlowHome
// Purpose: Página inicial do QualyFlow.
// Relationships:
//   - vw_q_agrotarget_datas
//   - CardAtividadesDiaria
//   - CardCUC
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import './Style.css';
import { supabase } from '../../lib/supabaseClient';

import HeaderQualyFlow from '../../components/QualyFlow/HeaderQualyFlow';
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelectorQualyFlow from '../../components/QualyFlow/DateSelectorQualyFlow';
import CardAtividadesDiaria from '../../components/QualyFlow/CardAtividadesDiaria';
import CardCUC from '../../components/QualyFlow/CardCUC';

// ================================= HELPERS ------------------------------------------------

const toIsoDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

// ================================= EXECUTOR -----------------------------------------------

const QualyFlowHome = () => {

  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const [selectedDate, setSelectedDate] = useState(
    toIsoDate(new Date())
  );

  // Controle dos anos disponíveis
  const [maxYearDb, setMaxYearDb] = useState(
    new Date().getFullYear()
  );

  const [activeYear, setActiveYear] = useState(null);

  // Datas disponíveis
  const [availableDates, setAvailableDates] = useState([]);

  const [isLoadingDates, setIsLoadingDates] = useState(true);

  const [errorMsg, setErrorMsg] = useState('');

  // =========================================================================
  // 1. DESCOBRE O MAIOR ANO
  // =========================================================================

  useEffect(() => {

    let mounted = true;

    const fetchMaxYear = async () => {

      try {

        const { data, error } = await supabase
          .from('vw_q_agrotarget_datas')
          .select('ano')
          .limit(1);

        if (error) throw error;

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

        console.error(
          '🚨 [QualyFlow] Erro ao buscar ano máximo:',
          err
        );

        if (mounted) {

          const currentYear = new Date().getFullYear();

          setMaxYearDb(currentYear);
          setActiveYear(currentYear);

        }

      }

    };

    fetchMaxYear();

    return () => {
      mounted = false;
    };

  }, []);

  // =========================================================================
  // 2. LISTA DE ANOS
  // =========================================================================

  const yearsList = useMemo(() => {

    const list = [];

    for (
      let year = maxYearDb;
      year >= 2024;
      year--
    ) {
      list.push(year);
    }

    return list;

  }, [maxYearDb]);

  // =========================================================================
  // 3. BUSCA DATAS DO ANO SELECIONADO
  // =========================================================================

  useEffect(() => {

    if (!activeYear) return;

    let mounted = true;

    const loadAvailableDates = async () => {

      setIsLoadingDates(true);
      setErrorMsg('');

      try {

        const { data, error } = await supabase
          .from('vw_q_agrotarget_datas')
          .select('data_apontamento')
          .eq('ano', activeYear);

        if (error) throw error;

        if (!mounted) return;

        // A view entrega DD/MM/YYYY.
        // O DateSelector trabalha com YYYY-MM-DD.
        const rawIsoDates = (data || [])
          .map((row) => {

            if (
              !row.data_apontamento ||
              !row.data_apontamento.includes('/')
            ) {
              return null;
            }

            const [
              day,
              month,
              year
            ] = row.data_apontamento.split('/');

            return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

          })
          .filter(Boolean);

        // Remove datas duplicadas.
        const uniqueDates = [
          ...new Set(rawIsoDates)
        ];

        // A view já vem DESC.
        setAvailableDates(uniqueDates);

        // Seleciona automaticamente a primeira data disponível.
        if (uniqueDates.length > 0) {
          setSelectedDate(uniqueDates[0]);
        }

      } catch (err) {

        console.error(
          '🚨 [QualyFlow] Erro ao carregar datas:',
          err
        );

        if (mounted) {

          setErrorMsg(
            err.message ||
            'Erro de comunicação com o banco.'
          );

          setAvailableDates([]);

        }

      } finally {

        if (mounted) {
          setIsLoadingDates(false);
        }

      }

    };

    loadAvailableDates();

    return () => {
      mounted = false;
    };

  }, [activeYear]);

  // =========================================================================
  // RENDER
  // =========================================================================

  return (
    <div className="qf-theme">

      {/* ================================================================
          HEADER
      ================================================================= */}

      <HeaderQualyFlow
        onMenuOpen={() => setSidebarOpen(true)}
      />

      {/* ================================================================
          SIDEBAR
      ================================================================= */}

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* ================================================================
          CONTEÚDO
      ================================================================= */}

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
              ERRO
          ============================================================== */}

          {errorMsg && (

            <div
              className="
                bg-[var(--q-danger-soft)]
                text-[var(--q-danger)]
                p-4
                rounded-[var(--q-radius-md)]
                border
                border-[var(--q-danger)]
                text-sm
                font-bold
                text-center
              "
            >
              Contratempo no processamento: {errorMsg}
            </div>

          )}

          {/* ==============================================================
              CONTEÚDO PRINCIPAL
          ============================================================== */}

          <div className="w-full">

            {isLoadingDates ? (

              /* ==========================================================
                 LOADING
              ========================================================== */

              <div className="qf-home-loading">

                <div className="qf-home-loading__text">

                  <span>
                    Buscando Avaliações
                  </span>

                  <span className="qf-loading-dots">
                    <i>.</i>
                    <i>.</i>
                    <i>.</i>
                  </span>

                </div>

                <div className="qf-home-loading__line" />

              </div>

            ) : (

              /* ==========================================================
                 CARDS
              ========================================================== */

              <div className="flex flex-col gap-4">

                <CardAtividadesDiaria
                  selectedDate={selectedDate}
                />

                <CardCUC
                  selectedDate={selectedDate}
                />

              </div>

            )}

          </div>

        </section>

      </main>

    </div>
  );
};

export default QualyFlowHome;