import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Style.css';

import HeaderAgroTools from '../../../components/AgroTools/HeaderAgroTools';
import SidebarAgroTools from '../../../components/AgroTools/SidebarAgroTools';

const CucGotejoTools = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // Estados com localStorage
  const [coletaMin, setColetaMin] = useState(() => Number(localStorage.getItem('at_cuc_tempo')) || 3);
  const [vazaoEsp, setVazaoEsp] = useState(() => Number(localStorage.getItem('at_cuc_vazao')) || 1.0);
  const [amostras, setAmostras] = useState(() => JSON.parse(localStorage.getItem('at_cuc_amostras')) || []);
  const [inputValue, setInputValue] = useState('');

  // Salva no LocalStorage automaticamente
  useEffect(() => {
    localStorage.setItem('at_cuc_tempo', coletaMin);
    localStorage.setItem('at_cuc_vazao', vazaoEsp);
    localStorage.setItem('at_cuc_amostras', JSON.stringify(amostras));
  }, [coletaMin, vazaoEsp, amostras]);

  // Cálculos dinâmicos
  const { cuc, avgFlow, clogPercent, fatorConversao } = useMemo(() => {
    const fator = coletaMin > 0 ? 60 / (coletaMin * 1000) : 0.02;

    if (amostras.length === 0) return { cuc: null, avgFlow: null, clogPercent: null, fatorConversao: fator };

    const totalMl = amostras.reduce((acc, curr) => acc + curr.ml, 0);
    const avgMl = totalMl / amostras.length;

    let somaDesvios = 0;
    let zeros = 0;
    
    amostras.forEach(item => {
      somaDesvios += Math.abs(item.ml - avgMl);
      if (item.ml === 0) zeros++;
    });

    let cucResult = 0;
    if (avgMl > 0) {
      cucResult = 100 * (1 - (somaDesvios / (amostras.length * avgMl)));
    }

    const vazaoMedia = avgMl * fator;
    const entupidos = (zeros / amostras.length) * 100;

    return { cuc: cucResult, avgFlow: vazaoMedia, clogPercent: entupidos, fatorConversao: fator };
  }, [amostras, coletaMin]);

  // Regras de Cores
  const getCucColor = (val) => {
    if (val === null) return 'var(--at-text)';
    if (val >= 90) return '#16a34a'; // Verde
    if (val >= 80) return '#facc15'; // Amarelo
    return '#ef4444'; // Vermelho
  };

  const getEntupidoColor = (val) => {
    if (val === null) return 'var(--at-text)';
    if (val <= 5) return '#64748b'; // Cinza
    if (val <= 10) return '#facc15'; // Amarelo
    return '#ef4444'; // Vermelho
  };

  const getVazaoColor = (val) => {
    if (val === null) return '#64748b';
    if (val < 0.8) return '#ef4444'; // Vermelho
    if (val < 0.9) return '#f97316'; // Laranja
    if (val <= 1.1) return '#16a34a'; // Verde
    if (val <= 1.2) return '#facc15'; // Amarelo
    return '#3b82f6'; // Azul
  };

  // Ações
  const handleAdd = (e) => {
    e.preventDefault();
    if (inputValue.trim() === '') return;
    const val = parseFloat(inputValue.replace(',', '.'));
    if (isNaN(val) || val < 0) return;

    setAmostras([{ id: Date.now(), ml: val }, ...amostras]);
    setInputValue('');
  };

  const handleRemove = (id) => {
    setAmostras(amostras.filter(a => a.id !== id));
  };

  const handleClear = () => {
    if (window.confirm('Limpar todas as amostras?')) {
      setAmostras([]);
    }
  };

  return (
    <div className="at-theme">
      {/* Header corrigido abrindo a Sidebar corretamente */}
      <HeaderAgroTools onMenuOpen={() => setSidebarOpen(true)}>
        
      </HeaderAgroTools>

      <SidebarAgroTools 
        isOpen={isSidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />

      <main className="at-container py-8 max-w-lg mx-auto fade-in">
        
        {/* Cabeçalho */}
        <div className="mb-6">
          <h2 className="at-page-title text-center md:text-left">CUC - Gotejo</h2>
          <p className="at-page-subtitle text-center md:text-left">
            Uniformidade da Irrigação com base nas coletas dos emissores de gotejo, histórico e cálculo de vazão L/h.
          </p>
        </div>

        {/* Configurações */}
        <div className="at-calc-config mb-6">
          <div className="at-input-group">
            <label>Tempo de Coleta (min)</label>
            <input 
              type="number" 
              value={coletaMin} 
              onChange={(e) => setColetaMin(Number(e.target.value))} 
              className="at-input"
            />
          </div>
          <div className="at-input-group">
            <label>Vazão do Emissor (L/h)</label>
            <input 
              type="number" 
              step="0.1"
              value={vazaoEsp} 
              onChange={(e) => setVazaoEsp(Number(e.target.value))} 
              className="at-input"
            />
          </div>
        </div>

        {/* Cards de KPIs */}
        <div className="at-kpi-grid mb-8">
          <div className="at-kpi-card">
            <span className="at-kpi-label">CUC %</span>
            <span className="at-kpi-value" style={{ color: getCucColor(cuc) }}>
              {cuc !== null ? cuc.toFixed(1) : '--'}
            </span>
          </div>
          
          <div className="at-kpi-card">
            <span className="at-kpi-label">Vazão L/h</span>
            <span className="at-kpi-value" style={{ color: getVazaoColor(avgFlow) }}>
              {avgFlow !== null ? avgFlow.toFixed(2) : '--'}
            </span>
          </div>
          
          <div className="at-kpi-card">
            <span className="at-kpi-label">Entupidos %</span>
            <span className="at-kpi-value" style={{ color: getEntupidoColor(clogPercent) }}>
              {clogPercent !== null ? clogPercent.toFixed(1) : '--'}
            </span>
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleAdd} className="at-form-row mb-6">
          <input
            type="number"
            inputMode="decimal"
            placeholder="Amostra em mL..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="at-input flex-1 text-lg font-bold"
            autoFocus
          />
          <button type="submit" className="at-btn at-btn-primary px-6">
            INSERIR
          </button>
        </form>

        {/* Cabeçalho da Grade */}
        <div className="at-list-header mb-3">
          <span className="font-bold text-xs text-slate-500 uppercase">
            Coletas Realizadas ({amostras.length})
          </span>
          {amostras.length > 0 && (
            <button type="button" onClick={handleClear} className="at-btn-text text-red-500">
              Limpar Tudo
            </button>
          )}
        </div>

        {/* Grid de Amostras Moderno */}
        {amostras.length === 0 ? (
          <div className="at-empty-state">Nenhuma amostra inserida.</div>
        ) : (
          <div className="at-sample-grid">
            {amostras.map((amostra) => {
              const vazaoConvertida = amostra.ml * fatorConversao;
              const corItem = getVazaoColor(vazaoConvertida);

              return (
                <div 
                  key={amostra.id} 
                  className="at-sample-box"
                  style={{ borderColor: corItem }}
                >
                  {/* Botão X discreto no canto superior direito */}
                  <button 
                    type="button" 
                    onClick={() => handleRemove(amostra.id)}
                    className="at-box-remove"
                    title="Remover"
                  >
                    ×
                  </button>

                  <div className="at-box-ml">{amostra.ml} <span className="text-[10px] text-slate-400 font-normal">mL</span></div>
                  <div className="at-box-lh" style={{ color: corItem }}>
                    {vazaoConvertida.toFixed(2)} L/h
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </main>
    </div>
  );
};

export default CucGotejoTools;