import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import '../Style.css';

import HeaderCOACenter from '../../../components/COACenter/HeaderCOACenter';
import SidebarCOACenter from '../../../components/COACenter/SidebarCOACenter';

import { supabase } from '../../../lib/supabaseClient';

// Nossos futuros componentes filhos!
import DispoDetailDiario from './DispoDetailDiario';
// import DispoDetailResumo from './DispoDetailResumo'; // (Se formos usar o resumo depois)
import DispoDetailSemanal from './DispoDetailSemanal';
import DispoDetailMensal from './DispoDetailMensal';

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

const DispoDetail = () => {
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('diario');

  // Herda a data selecionada do Card da Home (se houver)
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
          .from('vw_c_datas') // Usa a mesma view de datas disponíveis
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
            DISPONIBILIDADE MECÂNICA
          </h1>
        </div>

        {/* Adaptei para 3 colunas, já que você tirou o resumo. Se quiser o resumo de volta, é só voltar para grid-cols-4 e descomentar abaixo */}
        <div
          className="grid grid-cols-3 w-full border-b"
          style={{ borderColor: 'var(--coa-divider)' }}
        >
          <TabButton id="diario" label="Diário" />
          <TabButton id="semanal" label="Semanal" />
          <TabButton id="mensal" label="Mensal" />
        </div>

        {activeTab === 'diario' && (
          <DispoDetailDiario
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            selectedCategories={selectedCategories}
            setSelectedCategories={setSelectedCategories}
            availableDates={availableDates}
          />
        )}

        {activeTab === 'semanal' && (
          <DispoDetailSemanal
            selectedDate={selectedDate}
            selectedCategories={selectedCategories}
            availableDates={availableDates}
          />
        )}

        {activeTab === 'mensal' && (
          <DispoDetailMensal
            selectedDate={selectedDate}
            selectedCategories={selectedCategories}
            availableDates={availableDates}
          />
        )}
      </main>
    </div>
  );
};

export default DispoDetail;