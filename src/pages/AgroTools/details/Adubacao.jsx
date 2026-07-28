import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Style.css';

import HeaderAgroTools from '../../../components/AgroTools/HeaderAgroTools';
import SidebarAgroTools from '../../../components/AgroTools/SidebarAgroTools';

const AdubacaoTools = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  // Estados com localStorage para Configuração
  const [linhas, setLinhas] = useState(() => Number(localStorage.getItem('at_adub_linhas')) || 2);
  const [doseKgHa, setDoseKgHa] = useState(() => localStorage.getItem('at_adub_dose') || '');
  const [espacamento, setEspacamento] = useState(() => localStorage.getItem('at_adub_espac') || '');
  const [velocidade, setVelocidade] = useState(() => localStorage.getItem('at_adub_vel') || '');
  
  // Histórico de coletas
  const [historico, setHistorico] = useState(() => JSON.parse(localStorage.getItem('at_adub_hist')) || []);

  // Inputs de coleta atual
  const [inputEsq, setInputEsq] = useState('');
  const [inputMeio, setInputMeio] = useState('');
  const [inputDir, setInputDir] = useState('');

  // Salva no LocalStorage automaticamente
  useEffect(() => {
    localStorage.setItem('at_adub_linhas', linhas);
    localStorage.setItem('at_adub_dose', doseKgHa);
    localStorage.setItem('at_adub_espac', espacamento);
    localStorage.setItem('at_adub_vel', velocidade);
    localStorage.setItem('at_adub_hist', JSON.stringify(historico));
  }, [linhas, doseKgHa, espacamento, velocidade, historico]);

  // Cálculo da Dose Alvo (kg) em 30 segundos
  const doseAlvo = useMemo(() => {
    const d = parseFloat(doseKgHa);
    const e = parseFloat(espacamento);
    const v = parseFloat(velocidade);
    if (d > 0 && e > 0 && v > 0) {
      return (d * e * v) / 600 / 2;
    }
    return 0;
  }, [doseKgHa, espacamento, velocidade]);

  // Função para calcular variação (%)
  const calcVariacao = (coletaKg) => {
    if (!coletaKg || doseAlvo === 0) return null;
    const val = parseFloat(coletaKg.replace(',', '.'));
    if (isNaN(val)) return null;
    return ((val - doseAlvo) / doseAlvo) * 100;
  };

  const checkMeta = (varPercent) => {
    if (varPercent === null) return null;
    return varPercent >= -8 && varPercent <= 8; // Meta: entre -8% e +8%
  };

  // Variáveis ao vivo para os cards
  const varEsq = calcVariacao(inputEsq);
  const varMeio = calcVariacao(inputMeio);
  const varDir = calcVariacao(inputDir);

  // Calcula a média geral AO VIVO antes de salvar
  const varGeralLive = useMemo(() => {
    if (doseAlvo === 0) return null;
    const vEsq = parseFloat(inputEsq.replace(',', '.'));
    const vDir = parseFloat(inputDir.replace(',', '.'));
    const vMeio = parseFloat(inputMeio.replace(',', '.'));

    let sum = 0;
    let count = 0;

    if (!isNaN(vEsq)) { sum += vEsq; count++; }
    if (!isNaN(vDir)) { sum += vDir; count++; }
    if (linhas === 3 && !isNaN(vMeio)) { sum += vMeio; count++; }

    // Só mostra a média se todos os campos da linha selecionada estiverem preenchidos
    if (linhas === 2 && count === 2) {
      return (((sum / 2) - doseAlvo) / doseAlvo) * 100;
    } else if (linhas === 3 && count === 3) {
      return (((sum / 3) - doseAlvo) / doseAlvo) * 100;
    }
    return null;
  }, [inputEsq, inputDir, inputMeio, linhas, doseAlvo]);

  const formatPercent = (val) => val !== null ? `${val > 0 ? '+' : ''}${val.toFixed(2)}%` : '--';
  const getCorVariacao = (val) => {
    if (val === null) return 'var(--at-text-muted)';
    return checkMeta(val) ? '#16a34a' : '#ef4444'; // Verde ou Vermelho
  };

  // Registrar Amostra
  const handleSave = (e) => {
    e.preventDefault();
    if (doseAlvo === 0) return alert('Preencha os dados de configuração primeiro.');
    if (!inputEsq || !inputDir || (linhas === 3 && !inputMeio)) return alert('Preencha todas as coletas.');

    const novaAmostra = {
      id: Date.now(),
      data: new Date().toLocaleDateString('pt-BR'),
      hora: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      linhas,
      alvo: doseAlvo,
      varEsq: varEsq,
      varDir: varDir,
      varMeio: linhas === 3 ? varMeio : null,
      varGeral: varGeralLive,
    };

    setHistorico([novaAmostra, ...historico]);
    setInputEsq('');
    setInputDir('');
    setInputMeio('');
  };

  const handleRemove = (id) => setHistorico(historico.filter(h => h.id !== id));
  const handleClear = () => { if (window.confirm('Limpar histórico?')) setHistorico([]); };

  // ================= TEXTOS PARA WHATSAPP =================
  const iconStatus = (val) => checkMeta(val) ? '🟢' : '🔴';

  const copySingle = (item) => {
    const texto = `📋 *Variação da Adubação*
Data: ${item.data}
Hora: ${item.hora}

${iconStatus(item.varEsq)} Esquerdo.......${item.varEsq.toFixed(2)}%
${item.linhas === 3 ? `${iconStatus(item.varMeio)} Meio................${item.varMeio.toFixed(2)}%\n` : ''}${iconStatus(item.varDir)} Direito............${item.varDir.toFixed(2)}%

${iconStatus(item.varGeral)} Geral..............${item.varGeral.toFixed(2)}%`;

    navigator.clipboard.writeText(texto);
    alert('Resumo copiado!');
  };

  const copyAll = () => {
    if (historico.length === 0) return;
    const dataHoje = new Date().toLocaleDateString('pt-BR');
    
    let texto = `📋 *Variação da Adubação*
Histórico de Variação
Data: ${dataHoje}
`;
    historico.forEach(item => {
      texto += `
🕒 Hora: ${item.hora}
${iconStatus(item.varEsq)} Esquerdo.......${item.varEsq.toFixed(2)}%
${item.linhas === 3 ? `${iconStatus(item.varMeio)} Meio................${item.varMeio.toFixed(2)}%\n` : ''}${iconStatus(item.varDir)} Direito............${item.varDir.toFixed(2)}%
${iconStatus(item.varGeral)} Geral..............${item.varGeral.toFixed(2)}%
----------------------------------------`;
    });

    navigator.clipboard.writeText(texto);
    alert('Histórico completo copiado!');
  };

  return (
    <div className="at-theme">
      <HeaderAgroTools onMenuOpen={() => setSidebarOpen(true)}>
        <span className="font-bold text-slate-500 uppercase text-xs tracking-widest hidden md:inline-block">
          Módulo de Tratos Culturais
        </span>
      </HeaderAgroTools>

      <SidebarAgroTools isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="at-container py-8 max-w-lg mx-auto fade-in">
        
        {/* Cabeçalho */}
        <div className="mb-6">
          <h2 className="at-page-title text-center md:text-left">Regulagem da Adubação</h2>
          <p className="at-page-subtitle text-center md:text-left">
            Variação da Adubação por coleta e histórico de regulagem do implemento. Meta: ±8%.
          </p>
        </div>

        {/* Abas 2 ou 3 Linhas */}
        <div className="at-tabs mb-6">
          <button 
            className={`at-tab-btn ${linhas === 2 ? 'active' : ''}`} 
            onClick={() => { setLinhas(2); setInputMeio(''); }}
          >
            2 Linhas
          </button>
          <button 
            className={`at-tab-btn ${linhas === 3 ? 'active' : ''}`} 
            onClick={() => setLinhas(3)}
          >
            3 Linhas
          </button>
        </div>

        {/* Configuração Alvo */}
        <div className="at-panel mb-6">
          <div className="at-panel-header">Parâmetros (Dose Alvo)</div>
          <div className="at-panel-body at-calc-config p-4">
            <div className="at-input-group">
              <label>Dose (kg/ha)</label>
              <input type="number" value={doseKgHa} onChange={e => setDoseKgHa(e.target.value)} className="at-input" />
            </div>
            <div className="at-input-group">
              <label>Espaçamento (m)</label>
              <input type="number" step="0.1" value={espacamento} onChange={e => setEspacamento(e.target.value)} className="at-input" />
            </div>
            <div className="at-input-group">
              <label>Veloc. (km/h)</label>
              <input type="number" step="0.1" value={velocidade} onChange={e => setVelocidade(e.target.value)} className="at-input" />
            </div>
            <div className="at-input-group flex flex-col justify-end">
              <div className="bg-slate-100 rounded-lg h-[48px] flex flex-col items-center justify-center border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400">Alvo (30s)</span>
                <span className="text-sm font-black text-agro-green">{doseAlvo > 0 ? `${doseAlvo.toFixed(3)} kg` : '--'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Área de Coleta Viva (Ideal para Print) */}
        <form onSubmit={handleSave} className="mb-8">
          <div className={`at-adub-grid ${linhas === 3 ? 'cols-3' : 'cols-2'} mb-3`}>
            
            {/* Esquerdo */}
            <div className="at-adub-card" style={{ borderBottom: `4px solid ${getCorVariacao(varEsq)}` }}>
              <span className="at-adub-label">Esquerdo</span>
              <span className="at-adub-rec">Rec: {doseAlvo > 0 ? doseAlvo.toFixed(2) : '--'} kg</span>
              <input 
                type="number" inputMode="decimal" step="0.01" required
                value={inputEsq} onChange={e => setInputEsq(e.target.value)}
                className="at-adub-input" placeholder="0.00"
              />
              <span className="at-adub-var" style={{ color: getCorVariacao(varEsq) }}>
                {formatPercent(varEsq)}
              </span>
            </div>

            {/* Meio (Condicional) */}
            {linhas === 3 && (
              <div className="at-adub-card" style={{ borderBottom: `4px solid ${getCorVariacao(varMeio)}` }}>
                <span className="at-adub-label">Meio</span>
                <span className="at-adub-rec">Rec: {doseAlvo > 0 ? doseAlvo.toFixed(2) : '--'} kg</span>
                <input 
                  type="number" inputMode="decimal" step="0.01" required
                  value={inputMeio} onChange={e => setInputMeio(e.target.value)}
                  className="at-adub-input" placeholder="0.00"
                />
                <span className="at-adub-var" style={{ color: getCorVariacao(varMeio) }}>
                  {formatPercent(varMeio)}
                </span>
              </div>
            )}

            {/* Direito */}
            <div className="at-adub-card" style={{ borderBottom: `4px solid ${getCorVariacao(varDir)}` }}>
              <span className="at-adub-label">Direito</span>
              <span className="at-adub-rec">Rec: {doseAlvo > 0 ? doseAlvo.toFixed(2) : '--'} kg</span>
              <input 
                type="number" inputMode="decimal" step="0.01" required
                value={inputDir} onChange={e => setInputDir(e.target.value)}
                className="at-adub-input" placeholder="0.00"
              />
              <span className="at-adub-var" style={{ color: getCorVariacao(varDir) }}>
                {formatPercent(varDir)}
              </span>
            </div>
          </div>

          {/* MÉDIA GERAL AO VIVO (Antes de Salvar) */}
          {varGeralLive !== null && (
            <div 
              className="at-adub-live-geral mb-4"
              style={{ 
                backgroundColor: checkMeta(varGeralLive) ? '#f0fdf4' : '#fef2f2',
                borderColor: getCorVariacao(varGeralLive) 
              }}
            >
              <span className="at-live-geral-label text-slate-600">Variação Média Geral:</span>
              <span className="at-live-geral-val" style={{ color: getCorVariacao(varGeralLive) }}>
                {formatPercent(varGeralLive)}
              </span>
            </div>
          )}
          
          <button type="submit" className="at-btn at-btn--primary w-full h-[54px] text-sm">
            SALVAR REGISTRO
          </button>
        </form>

        {/* Histórico */}
        <div className="at-list-header mb-3">
          <span className="font-bold text-xs text-slate-500 uppercase">
            Histórico ({historico.length})
          </span>
          {historico.length > 0 && (
            <div className="flex gap-3">
              <button type="button" onClick={copyAll} className="at-btn-text text-green-600">Copiar Geral</button>
              <button type="button" onClick={handleClear} className="at-btn-text text-red-500">Limpar</button>
            </div>
          )}
        </div>

        <div className="at-slim-list mt-2">
          {historico.length === 0 ? (
            <div className="at-empty-state">Nenhum registro de variação.</div>
          ) : (
            historico.map((item) => {
              const isMeta = checkMeta(item.varGeral);
              const bgColor = isMeta ? '#f0fdf4' : '#fef2f2'; // Verde pastel / Vermelho pastel
              const borderColor = getCorVariacao(item.varGeral);

              return (
                <div 
                  key={item.id} 
                  className="at-hist-card-v2"
                  style={{ backgroundColor: bgColor, borderColor: borderColor }}
                >
                  {/* Linha 1: Info e Geral */}
                  <div className="at-hist-row-top">
                    <div className="flex items-center gap-2">
                      <span className="at-hist-tag-lines">{item.linhas}L</span>
                      <span className="at-hist-time">{item.hora}</span>
                    </div>
                    <div className="at-hist-geral-badge" style={{ color: borderColor }}>
                      Geral: {formatPercent(item.varGeral)}
                    </div>
                  </div>

                  {/* Linha 2: Valores Individuais */}
                  <div className="at-hist-row-mid">
                    <div className="at-hist-col-v2">
                      <span className="at-hist-label-v2">Esq.</span>
                      <span className="at-hist-val-v2" style={{ color: getCorVariacao(item.varEsq) }}>{formatPercent(item.varEsq)}</span>
                    </div>
                    {item.linhas === 3 && (
                      <div className="at-hist-col-v2">
                        <span className="at-hist-label-v2">Meio</span>
                        <span className="at-hist-val-v2" style={{ color: getCorVariacao(item.varMeio) }}>{formatPercent(item.varMeio)}</span>
                      </div>
                    )}
                    <div className="at-hist-col-v2">
                      <span className="at-hist-label-v2">Dir.</span>
                      <span className="at-hist-val-v2" style={{ color: getCorVariacao(item.varDir) }}>{formatPercent(item.varDir)}</span>
                    </div>
                  </div>

                  {/* Linha 3: Ações */}
                  <div className="at-hist-row-bot">
                    <button type="button" onClick={() => handleRemove(item.id)} className="at-btn-remove-v2">
                      Excluir
                    </button>
                    <button type="button" onClick={() => copySingle(item)} className="at-btn-copy-v2">
                      Copiar Resumo
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

      </main>
    </div>
  );
};

export default AdubacaoTools;