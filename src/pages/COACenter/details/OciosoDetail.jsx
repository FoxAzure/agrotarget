import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import '../Style.css';

import HeaderCOACenter from '../../../components/COACenter/HeaderCOACenter';
import SidebarCOACenter from '../../../components/COACenter/SidebarCOACenter';

import { supabase } from '../../../lib/supabaseClient';

import OciosoDetailDiario from './OciosoDetailDiario';
import OciosoDetailResumo from './OciosoDetailResumo';
import OciosoDetailSemanal from './OciosoDetailSemanal';
import OciosoDetailMensal from './OciosoDetailMensal';

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

const OciosoDetail = () => {
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('diario');

  const [selectedDate, setSelectedDate] = useState(
    location.state?.selectedDate || toIsoDate(new Date())
  );

  const [selectedCategories, setSelectedCategories] = useState(
    location.state?.selectedCategories || ['AGRÍCOLA', 'APOIO']
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
            MOTOR OCIOSO
          </h1>
        </div>

        <div
          className="grid grid-cols-4 w-full border-b"
          style={{ borderColor: 'var(--coa-divider)' }}
        >
          <TabButton id="diario" label="Diário" />
          <TabButton id="resumo" label="Resumo" />
          <TabButton id="semanal" label="Semanal" />
          <TabButton id="mensal" label="Mensal" />
        </div>

        {activeTab === 'diario' && (
          <OciosoDetailDiario
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedCategories={selectedCategories}
            setSelectedCategories={setSelectedCategories}
            availableDates={availableDates}
          />
        )}

        {activeTab === 'resumo' && (
          <OciosoDetailResumo
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedCategories={selectedCategories}
            availableDates={availableDates}
          />
        )}

        {activeTab === 'semanal' && (
          <OciosoDetailSemanal
            selectedDate={selectedDate}
            selectedCategories={selectedCategories}
            availableDates={availableDates}
          />
        )}

        {activeTab === 'mensal' && (
          <OciosoDetailMensal
            selectedDate={selectedDate}
            selectedCategories={selectedCategories}
            availableDates={availableDates}
          />
        )}
      </main>
    </div>
  );
};

export default OciosoDetail;