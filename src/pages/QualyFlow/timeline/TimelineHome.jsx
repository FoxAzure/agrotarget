// ================================= DOCUMENTATION ------------------------------------------
// Script: TimelineHome
// Purpose: Hub da Timeline do QualyFlow. Cada atividade fica isolada em um card próprio.
// Cards: Recebem selectedYear e onYearChange; controlam suas consultas e indicadores internamente.
// Year source: vw_q_agrotarget_datas.
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

import HeaderQualyFlow from '../../../components/QualyFlow/HeaderQualyFlow';
import Sidebar from '../../../components/QualyFlow/Sidebar';
import YearSelectorQualyFlow from '../../../components/QualyFlow/YearSelectorQualyFlow';
import CardTLPerdasMec from './cards/CardTLPerdasMec';

import '../Style.css';
import './TimelineHome.css';

// Para adicionar outra atividade: importe o card e inclua-o neste catálogo.
const TIMELINE_CARDS = [
  { id: 'perdas-mecanizadas', component: CardTLPerdasMec },
];

const TimelineHome = () => {
  const currentYear = new Date().getFullYear();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [maxYearDb, setMaxYearDb] = useState(currentYear);
  const [activeYear, setActiveYear] = useState(null);
  const [isLoadingYears, setIsLoadingYears] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadAvailableYears = async () => {
      try {
        const { data, error } = await supabase
          .from('vw_q_agrotarget_datas')
          .select('ano')
          .order('ano', { ascending: false })
          .limit(1);

        if (error) throw error;

        const highestYear = Number(data?.[0]?.ano) || currentYear;
        if (mounted) {
          setMaxYearDb(highestYear);
          setActiveYear(highestYear);
        }
      } catch (error) {
        console.error('[TimelineHome] Não foi possível carregar as safras disponíveis:', error);
        if (mounted) {
          setMaxYearDb(currentYear);
          setActiveYear(currentYear);
        }
      } finally {
        if (mounted) setIsLoadingYears(false);
      }
    };

    loadAvailableYears();
    return () => { mounted = false; };
  }, [currentYear]);

  const availableYears = useMemo(() => {
    const firstYear = Math.min(2024, maxYearDb);
    return Array.from({ length: maxYearDb - firstYear + 1 }, (_, index) => maxYearDb - index);
  }, [maxYearDb]);

  return (
    <div className="qf-theme qf-timeline-page">
      <HeaderQualyFlow onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="qf-container qf-timeline-main">
        <section className="qf-timeline-heading">
          <h1>Timeline de <strong>Indicadores</strong></h1>
        </section>

        <section className="qf-timeline-year-section" aria-label="Selecionar safra">
          <YearSelectorQualyFlow
            value={activeYear}
            onChange={setActiveYear}
            availableYears={availableYears}
            isLoading={isLoadingYears}
          />
        </section>

        <section className="qf-timeline-content" aria-label="Cards de atividades">
          <div className="qf-timeline-cards">
            {TIMELINE_CARDS.map(({ id, component: ActivityCard }) => (
              <ActivityCard key={id} selectedYear={activeYear} onYearChange={setActiveYear} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default TimelineHome;
