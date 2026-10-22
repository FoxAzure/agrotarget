import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import HeaderQualyFlow from '../../../components/QualyFlow/HeaderQualyFlow';
import Sidebar from '../../../components/QualyFlow/Sidebar';
import YearSelectorQualyFlow from '../../../components/QualyFlow/YearSelectorQualyFlow';
import CardTLPerdasMec from './cards/CardTLPerdasMec';
import '../Style.css';
import './TimelineHome.css';

const ALL_AREAS = 'Todas';
const TIMELINE_CARDS = [{ id: 'perdas-mecanizadas', area: 'Colheita', component: CardTLPerdasMec }];
const normalizeFileName = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-_]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();

const TimelineHome = () => {
  const currentYear = new Date().getFullYear();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [maxYearDb, setMaxYearDb] = useState(currentYear);
  const [activeYear, setActiveYear] = useState(null);
  const [activeArea, setActiveArea] = useState(ALL_AREAS);
  const [isLoadingYears, setIsLoadingYears] = useState(true);

  useEffect(() => {
    let mounted = true;
    const loadYears = async () => {
      try {
        const { data, error } = await supabase.from('vw_q_agrotarget_datas').select('ano').order('ano', { ascending: false }).limit(1);
        if (error) throw error;
        const highest = Number(data?.[0]?.ano) || currentYear;
        if (mounted) { setMaxYearDb(highest); setActiveYear(highest); }
      } catch (error) {
        console.error('[TimelineHome] Erro ao carregar anos:', error);
        if (mounted) { setMaxYearDb(currentYear); setActiveYear(currentYear); }
      } finally { if (mounted) setIsLoadingYears(false); }
    };
    loadYears();
    return () => { mounted = false; };
  }, [currentYear]);

  const availableYears = useMemo(() => {
    const firstYear = Math.min(2024, maxYearDb);
    return Array.from({ length: maxYearDb - firstYear + 1 }, (_, index) => maxYearDb - index);
  }, [maxYearDb]);
  const areas = useMemo(() => [ALL_AREAS, ...[...new Set(TIMELINE_CARDS.map((card) => card.area))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'pt-BR'))], []);
  const visibleCards = useMemo(() => activeArea === ALL_AREAS ? TIMELINE_CARDS : TIMELINE_CARDS.filter((card) => card.area === activeArea), [activeArea]);

  const handleExportExcel = () => {
    const tables = [...document.querySelectorAll('[data-timeline-export-root] table')];
    if (!tables.length) return;
    const body = tables.map((table) => table.outerHTML).join('<br>');
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"><style>body{font-family:Arial}table{border-collapse:collapse;margin-bottom:18px}th,td{border:1px solid #cbd5e1;padding:6px 9px}th{background:#002f8e;color:#fff}</style></head><body><h1>Timeline de Indicadores</h1><p>Ano: ${activeYear ?? '-'} | Area: ${activeArea}</p>${body}</body></html>`;
    const url = URL.createObjectURL(new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url; link.download = `timeline_${normalizeFileName(activeArea === ALL_AREAS ? 'todas_as_areas' : activeArea)}_${activeYear || currentYear}.xls`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
  };

  return <div className="qf-theme qf-timeline-page">
    <HeaderQualyFlow onMenuOpen={() => setSidebarOpen(true)} />
    <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />
    <main className="qf-container qf-timeline-main">
      <section className="qf-timeline-heading"><span className="qf-timeline-eyebrow">QualyFlow</span><h1>Timeline de <strong>Indicadores</strong></h1><p>Acompanhe a evolucao anual dos indicadores por area operacional.</p></section>
      <section className="qf-timeline-year-section"><YearSelectorQualyFlow value={activeYear} onChange={setActiveYear} availableYears={availableYears} isLoading={isLoadingYears} /></section>
      <section className="qf-timeline-toolbar qf-timeline-toolbar--compact">
        <div className="qf-timeline-area-block"><span className="qf-timeline-control-title">Area</span><div className="qf-timeline-area-filters">{areas.map((area) => <button key={area} type="button" className={`qf-timeline-area-button${activeArea === area ? ' is-active' : ''}`} onClick={() => setActiveArea(area)}>{area}</button>)}</div></div>
        <div className="qf-timeline-export-block"><span className="qf-timeline-control-title">Exportar</span><div className="qf-timeline-export-actions"><button type="button" className="qf-timeline-export-button qf-timeline-export-button--xls" onClick={handleExportExcel}><span>XLS</span>Excel</button><button type="button" className="qf-timeline-export-button qf-timeline-export-button--pdf" onClick={() => window.print()}><span>PDF</span>PDF</button></div></div>
      </section>
      <section className="qf-timeline-content" data-timeline-export-root><div className="qf-timeline-cards">{visibleCards.map(({ id, area, component: Card }) => <div key={id} className="qf-timeline-card-group"><div className="qf-timeline-card-area-tag">{area}</div><Card selectedYear={activeYear} /></div>)}</div></section>
    </main>
  </div>;
};
export default TimelineHome;
