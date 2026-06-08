import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import '../Style.css';

import HeaderCOACenter from '../../../components/COACenter/HeaderCOACenter';
import SidebarCOACenter from '../../../components/COACenter/SidebarCOACenter';
import DateSelectorCOA from '../../../components/COACenter/DateSelectorCOA';
import ResumoDetailDiario from './ResumoDetailDiario';

import { supabase } from '../../../lib/supabaseClient';

const DEFAULT_CATEGORIES = ['AGRÍCOLA', 'APOIO'];

const toIsoDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const brToIso = (brDate) => {
  if (!brDate || typeof brDate !== 'string' || !brDate.includes('/')) return '';
  const [dd, mm, yyyy] = brDate.split('/');
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
};

const TabButton = ({ id, label, activeTab, onClick }) => (
  <button
    type="button"
    onClick={() => onClick(id)}
    className={`w-full min-w-0 py-3 px-2 md:px-5 text-[10px] md:text-[11px] font-black uppercase tracking-[0.08em] md:tracking-widest transition-all border-b-[3px] text-center whitespace-nowrap ${
      activeTab === id
        ? 'text-[var(--coa-accent)] border-[var(--coa-accent)] bg-[rgba(255,255,255,0.02)]'
        : 'text-[var(--coa-text-soft)] border-transparent hover:text-[var(--coa-text)]'
    }`}
  >
    {label}
  </button>
);

const PlaceholderTab = ({ title, selectedDate, setSelectedDate, availableDates, selectedCategories }) => {
  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  return (
    <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-end">
        <div className="w-full max-w-sm md:max-w-md">
          <DateSelectorCOA
            value={selectedDate}
            onChange={setSelectedDate}
            maxDate={todayIso}
            availableDates={availableDates}
          />
        </div>
      </div>

      <div className="coa-card">
        <div className="coa-card__header">
          <h2 className="coa-text-title !mb-0">{title}</h2>
        </div>

        <div className="coa-card__body flex flex-col gap-4">
          <div className="coa-panel p-4 md:p-5 flex flex-col gap-3">
            <span className="coa-text-micro">Status</span>

            <div className="text-sm font-bold text-[var(--coa-text)]">
              Estrutura inicial da aba pronta.
            </div>

            <div className="text-sm font-bold text-[var(--coa-text-soft)]">
              Data selecionada: {selectedDate || '--'}
            </div>

            <div className="text-sm font-bold text-[var(--coa-text-soft)]">
              Categorias: {selectedCategories?.length ? selectedCategories.join(', ') : 'Nenhuma'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ResumoDetail = () => {
  const location = useLocation();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('diario');

  const [selectedDate, setSelectedDate] = useState(
    location.state?.selectedDate || toIsoDate(new Date())
  );

  const [selectedCategories, setSelectedCategories] = useState(
    location.state?.selectedCategories || DEFAULT_CATEGORIES
  );

  const [availableDates, setAvailableDates] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadAvailableDates = async () => {
      try {
        const { data, error } = await supabase
          .from('vw_c_datas')
          .select('data,qnt_equip');

        if (error) throw error;

        const normalizedDates = [...new Set(
          (data || [])
            .map((row) => brToIso(row.data))
            .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));

        if (!mounted) return;

        setAvailableDates(normalizedDates);

        if (normalizedDates.length && !normalizedDates.includes(selectedDate)) {
          setSelectedDate(normalizedDates[normalizedDates.length - 1]);
        }
      } catch (err) {
        console.error('[COA] Erro ao carregar datas disponíveis do resumo:', err);
      }
    };

    loadAvailableDates();

    return () => {
      mounted = false;
    };
  }, [selectedDate]);

  return (
    <div className="coa-theme min-h-screen">
      <HeaderCOACenter onMenuOpen={() => setSidebarOpen(true)} />

      <SidebarCOACenter
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="coa-container py-5 md:py-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-[1.35rem] md:text-[1.45rem] font-black uppercase tracking-tight leading-none text-[var(--coa-text)]">
            RESUMO GERAL
          </h1>
        </div>

        <div
          className="grid grid-cols-4 w-full border-b"
          style={{ borderColor: 'var(--coa-divider)' }}
        >
          <TabButton
            id="diario"
            label="Diário"
            activeTab={activeTab}
            onClick={setActiveTab}
          />
          <TabButton
            id="equip"
            label="Equip."
            activeTab={activeTab}
            onClick={setActiveTab}
          />
          <TabButton
            id="semanal"
            label="Semanal"
            activeTab={activeTab}
            onClick={setActiveTab}
          />
          <TabButton
            id="mensal"
            label="Mensal"
            activeTab={activeTab}
            onClick={setActiveTab}
          />
        </div>

        {activeTab === 'diario' && (
        <ResumoDetailDiario
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedCategories={selectedCategories}
            setSelectedCategories={setSelectedCategories}
            availableDates={availableDates}
        />
        )}

        {activeTab === 'equip' && (
          <PlaceholderTab
            title="Resumo por Equipamento"
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            availableDates={availableDates}
            selectedCategories={selectedCategories}
          />
        )}

        {activeTab === 'semanal' && (
          <PlaceholderTab
            title="Resumo Semanal"
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            availableDates={availableDates}
            selectedCategories={selectedCategories}
          />
        )}

        {activeTab === 'mensal' && (
          <PlaceholderTab
            title="Resumo Mensal"
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            availableDates={availableDates}
            selectedCategories={selectedCategories}
          />
        )}
      </main>
    </div>
  );
};

export default ResumoDetail;