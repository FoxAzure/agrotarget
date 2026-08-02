import React, { useEffect, useMemo, useState } from 'react';
import './Style.css';

import { supabase } from '../../lib/supabaseClient';

import HeaderCOACenter from '../../components/COACenter/HeaderCOACenter';
import SidebarCOACenter from '../../components/COACenter/SidebarCOACenter';
import DateSelectorCOA from '../../components/COACenter/DateSelectorCOA';
import CardResumo from '../../components/COACenter/CardResumo';
import CardOcioso from '../../components/COACenter/CardOcioso';
import CardDisponibilidade from '../../components/COACenter/CardDisponibilidade';
import CardOperacoes from '../../components/COACenter/CardOperacoes';
import CardIndeterminado from '../../components/COACenter/CardIndeterminado';



const toIsoDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const brToIsoDate = (brDate) => {
  if (!brDate || typeof brDate !== 'string' || !brDate.includes('/')) return '';
  const [dd, mm, yyyy] = brDate.split('/');
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
};

const COACenterHome = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(toIsoDate(new Date()));
  const [availableDates, setAvailableDates] = useState([]);

  const todayIso = useMemo(() => toIsoDate(new Date()), []);

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
            .map((row) => brToIsoDate(row.data))
            .filter(Boolean)
        )].sort((a, b) => a.localeCompare(b));

        if (!mounted) return;

        setAvailableDates(normalizedDates);

        if (normalizedDates.length) {
          setSelectedDate((prev) => {
            if (normalizedDates.includes(prev)) return prev;
            return normalizedDates[normalizedDates.length - 1];
          });
        }
      } catch (err) {
        console.error('[COA] Erro ao carregar vw_c_datas:', err);
      }
    };

    loadAvailableDates();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="coa-theme">
      <HeaderCOACenter onMenuOpen={() => setSidebarOpen(true)} />

      <SidebarCOACenter
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="coa-container py-5 md:py-6">
        <section className="coa-section coa-fade-in flex flex-col gap-5">
          <div className="w-full flex justify-center">
            <div className="w-full max-w-sm md:max-w-md">
              <DateSelectorCOA
                value={selectedDate}
                onChange={setSelectedDate}
                maxDate={todayIso}
                availableDates={availableDates}
              />
            </div>
          </div>

          <CardOperacoes selectedDate={selectedDate} />
          <CardResumo selectedDate={selectedDate} />
          <CardIndeterminado selectedDate={selectedDate} />
          <CardOcioso selectedDate={selectedDate} />
          <CardDisponibilidade selectedDate={selectedDate} />

        </section>
      </main>
    </div>
  );
};

export default COACenterHome;