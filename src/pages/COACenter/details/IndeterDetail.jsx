import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import '../Style.css';

import HeaderCOACenter from '../../../components/COACenter/HeaderCOACenter';
import SidebarCOACenter from '../../../components/COACenter/SidebarCOACenter';

import { supabase } from '../../../lib/supabaseClient';

// Nossos futuros componentes filhos!
import IndeterDetailDiario from './IndeterDetailDiario';
import IndeterDetailSemanal from './IndeterDetailSemanal';
import IndeterDetailCalendario from './IndeterDetailCalendario';

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

const IndeterDetail = () => {
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('diario');

  // Herda a data selecionada do Card da Home (se houver) ou pega hoje
  const [selectedDate, setSelectedDate] = useState(
    location.state?.selectedDate || toIsoDate(new Date())
  );

  // Herda as categorias selecionadas do Card da Home
  const [selectedCategories, setSelectedCategories] = useState(
    location.state?.selectedCategories || ['AGRÍCOLA', 'APOIO']
  );

  const [availableDates, setAvailableDates] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadAvailableDates = async () => {
      try {
        const { data, error } = await supabase
          .from('vw_c_datas') // Continuamos usando a view central de datas
          .select('data,qnt_equip');

        if (error) throw error;

        const normalizedDates = [...new Set(
          (data || [])
            .map((row) => brToIso(row.data))
            .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));

        if (!mounted) return;

        setAvailableDates(normalizedDates);

        // Se a data selecionada não estiver na base, puxa a última disponível
        if (normalizedDates.length && !normalizedDates.includes(selectedDate)) {
          setSelectedDate(normalizedDates[normalizedDates.length - 1]);
        }
      } catch (err) {
        console.error('[COA] Erro ao carregar datas disponíveis:', err);
      }
    };

    loadAvailableDates();

    return () => {
      mounted = false;
    };
  }, [selectedDate]);

  const TabButton = ({ id, label }) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={`w-full min-w-0 py-3 px-2 md:px-5 text-[10px] md:text-[11px] font-black uppercase tracking-[0.08em] md:tracking-widest transition-all border-b-[3px] text-center whitespace-nowrap ${
        activeTab === id
          ? 'text-[var(--coa-accent)] border-[var(--coa-accent)] bg-[rgba(255,255,255,0.02)]'
          : 'text-[var(--coa-text-soft)] border-transparent hover:text-[var(--coa-text)]'
      }`}
    >
      {label}
    </button>
  );

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
            INDETERMINADO
          </h1>
        </div>

        {/* 3 Abas: Diário, Semanal e Calendário */}
        <div
          className="grid grid-cols-3 w-full border-b"
          style={{ borderColor: 'var(--coa-divider)' }}
        >
          <TabButton id="diario" label="Diário" />
          <TabButton id="semanal" label="Semanal" />
          <TabButton id="calendario" label="Calendário" />
        </div>

        {/* Conteúdo Dinâmico das Abas */}
        {activeTab === 'diario' && (
          <IndeterDetailDiario
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedCategories={selectedCategories}
            setSelectedCategories={setSelectedCategories}
            availableDates={availableDates}
          />
        )}

        {activeTab === 'semanal' && (
          <IndeterDetailSemanal
            selectedDate={selectedDate}
            selectedCategories={selectedCategories}
            availableDates={availableDates}
          />
        )}

        {activeTab === 'calendario' && (
          <IndeterDetailCalendario
            selectedDate={selectedDate}
            selectedCategories={selectedCategories}
            availableDates={availableDates}
          />
        )}
      </main>
    </div>
  );
};

export default IndeterDetail;