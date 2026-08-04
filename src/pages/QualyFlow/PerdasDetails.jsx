import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { QUALY_RULES } from '../../pages/QualyFlow/rules';
import { supabase } from '../../supabaseClient';

// Componentes Reutilizáveis
import HeaderQualyFlow from '../../components/QualyFlow/HeaderQualyFlow';
import Sidebar from '../../components/QualyFlow/Sidebar';
import DateSelectorQualyFlow from '../../components/QualyFlow/DateSelectorQualyFlow';

const PerdasDetails = () => {
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('diario'); // diario | ranking | historico
  const [loading, setLoading] = useState(false);

  // Estados dos Dados (Prontos para receber do Supabase)
  const [diarioData, setDiarioData] = useState([]);
  const [rankingData, setRankingData] = useState([]);
  const [historicoData, setHistoricoData] = useState([]);

  // Quando plugar o Supabase, você fará os fetches baseados na data/aba selecionada aqui
  useEffect(() => {
    // Simulando carga de dados baseado na estrutura de Views que você definiu
    const mockRanking = [
      { colhedora: '015', perda: 3.2, pisoteio: 45, arranquio: 1.5, turno: 'A' },
      { colhedora: '022', perda: 5.1, pisoteio: 60, arranquio: 3.1, turno: 'B' },
      { colhedora: '018', perda: 2.8, pisoteio: 30, arranquio: 1.0, turno: 'C' },
    ];
    setRankingData(mockRanking);

    const mockHistorico = [
      { mes: 'Jan', perda: 4.8 }, { mes: 'Fev', perda: 4.2 }, { mes: 'Mar', perda: 3.9 },
      { mes: 'Abr', perda: 4.6 }, { mes: 'Mai', perda: 3.5 }
    ];
    setHistoricoData(mockHistorico);
  }, [activeTab]);

  const TabButton = ({ id, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex-1 py-3 text-xs font-black uppercase tracking-widest transition-all border-b-2 ${
        activeTab === id 
          ? 'text-[var(--q-green)] border-[var(--q-green)] bg-white' 
          : 'text-[var(--q-gray)] border-transparent hover:text-[var(--q-orange)] hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[var(--q-bg)] flex flex-col items-center pb-10 font-sans">
      <HeaderQualyFlow onMenuOpen={() => setSidebarOpen(true)}>
        <DateSelectorQualyFlow 
          date="2026-05-27" 
          availableDates={["2026-05-27"]} 
          onSelectDate={() => {}} 
          onPrev={() => {}} 
          onNext={() => {}} 
        />
      </HeaderQualyFlow>
      
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="w-full max-w-5xl px-4 flex flex-col mt-6 animate-in fade-in duration-500">
        
        {/* Título Principal */}
        <div className="flex flex-col mb-6">
          <h1 className="text-xl font-black text-[var(--q-dark)] uppercase tracking-tighter">
            Perdas <span className="text-[var(--q-orange)]">Mecanizadas</span>
          </h1>
          <p className="text-micro text-[var(--q-gray)]">Análise de Colheita e Rendimento</p>
        </div>

        {/* CONTROLE DE ABAS */}
        <div className="flex w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mb-6">
          <TabButton id="diario" label="Diário" />
          <TabButton id="ranking" label="Ranking" />
          <TabButton id="historico" label="Histórico" />
        </div>

        {/* ÁREA DE CONTEÚDO DAS ABAS */}
        <div className="w-full">
          
          {/* ABA 1: DIÁRIO */}
          {activeTab === 'diario' && (
            <div className="flex flex-col gap-4 animate-in slide-in-from-left-4 duration-300">
               {/* Estrutura do Resumo Diário virá aqui com vw_perdamec_diario */}
               <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center opacity-70 py-20">
                 <span className="text-4xl mb-3">🚜</span>
                 <span className="text-sm font-bold text-[var(--q-gray)] uppercase tracking-widest">Aguardando View de Campos</span>
               </div>
            </div>
          )}

          {/* ABA 2: RANKING DAS COLHEDORAS */}
          {activeTab === 'ranking' && (
            <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-300">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-title">Ranking Mensal • Colhedoras</h2>
                  <select className="bg-slate-50 border border-slate-200 text-xs font-bold text-[var(--q-dark)] py-1.5 px-3 rounded-lg outline-none cursor-pointer">
                    <option>Maio 2026</option>
                  </select>
                </div>
                
                {/* Gráfico Recharts - Ranking */}
                <div className="w-full h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rankingData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="colhedora" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--q-gray)', fontWeight: 'bold' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--q-gray)', fontWeight: 'bold' }} />
                      <Tooltip cursor={{ fill: 'var(--q-bg)' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                      
                      <Bar dataKey="perda" name="Perda (%)" fill="var(--q-danger)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="arranquio" name="Arranquio (%)" fill="var(--q-orange)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* ABA 3: HISTÓRICO */}
          {activeTab === 'historico' && (
            <div className="flex flex-col gap-4 animate-in slide-in-from-right-4 duration-300">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h2 className="text-title mb-6">Evolução Anual • Perda Geral</h2>
                
                {/* Gráfico Recharts - Histórico Evolutivo */}
                <div className="w-full h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={historicoData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="mes" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--q-gray)', fontWeight: 'bold' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'var(--q-gray)', fontWeight: 'bold' }} />
                      <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                      
                      <Line type="monotone" dataKey="perda" name="Perda Média" stroke="var(--q-green)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default PerdasDetails;