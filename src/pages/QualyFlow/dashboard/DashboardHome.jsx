// ================================= DOCUMENTATION ------------------------------------------
// Script: DashboardHome
// Purpose: Container FullScreen com motor de playlist de Dashboards.
// Relationships:
//   - DashCUC
//   - DashPerdasMec
// ==========================================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

// Dashboards Modulares
import DashCUC from './DashCUC';
import DashPerdasMec from './DashPerdasMec';
import DashPreparo from './DashPreparo';

// Lista de Módulos Disponíveis (Fácil de escalar)
const DASH_MODULES = [
  { id: 'cuc', name: 'Irrigação: CUC', component: <DashCUC /> },
  { id: 'perdasmec', name: 'Perda Colheita Mecanizada', component: <DashPerdasMec /> },
  { id: 'preparo', name: 'Preparo de Solo', component: <DashPreparo /> },
];

// Opções de tempo para a Playlist
const TIME_OPTIONS = [
  { label: '30 seg', value: 30 },
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
  { label: '15 min', value: 900 },
  { label: '1 hora', value: 3600 },
];

const DashboardHome = () => {
  const navigate = useNavigate();
  
  // ================================= ESTADOS =================================
  const [activeDash, setActiveDash] = useState(DASH_MODULES[0].id);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  
  // Motor da Playlist
  const [isPlaying, setIsPlaying] = useState(false);
  const [playlist, setPlaylist] = useState(DASH_MODULES.map(m => m.id));
  const [intervalSecs, setIntervalSecs] = useState(30);
  const [currentIndex, setCurrentIndex] = useState(0);

  // ================================= EFEITOS =================================
  
  useEffect(() => {
    let timer;
    if (isPlaying && playlist.length > 0) {
      timer = setInterval(() => {
        setCurrentIndex((prev) => {
          const nextIndex = (prev + 1) % playlist.length;
          setActiveDash(playlist[nextIndex]);
          return nextIndex;
        });
      }, intervalSecs * 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, playlist, intervalSecs]);

  const handleManualNav = (id) => {
    setIsPlaying(false);
    setActiveDash(id);
    setSidebarOpen(false);
  };

  // ================================= HANDLERS DA PLAYLIST =================================
  const togglePlay = () => {
    if (playlist.length === 0) return alert("Selecione ao menos um dash na playlist!");
    setIsPlaying(!isPlaying);
    const idx = playlist.indexOf(activeDash);
    if (idx !== -1) setCurrentIndex(idx);
    else setCurrentIndex(0);
    setModalOpen(false);
  };

  const toggleDashInPlaylist = (id) => {
    setPlaylist(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Descobre qual é o dash atual para quebrar o título bonitinho
  const currentDashInfo = DASH_MODULES.find(m => m.id === activeDash) || DASH_MODULES[0];
  const titleParts = currentDashInfo.name.split(':');

  // ================================= RENDER =================================
  return (
    <div className="qf-tv-layout">
      
      {/* ================= HEADER MINIMALISTA ================= */}
      <header className="qf-tv-header">
        <h1 className="qf-tv-title">
          {titleParts[0]} {titleParts[1] && <span>: {titleParts[1].trim()}</span>}
        </h1>
        
        <div className="qf-tv-actions">
          {isPlaying && (
            <span 
              className="w-3 h-3 bg-[var(--q-green)] rounded-full animate-pulse shadow-[0_0_8px_var(--q-green)]" 
              title="Playlist Rodando"
            />
          )}

          <button 
            onClick={() => setModalOpen(true)}
            className="qf-btn qf-btn--ghost"
          >
            {isPlaying ? 'Parar Playlist' : 'Playlist'}
          </button>
          
          <button onClick={() => setSidebarOpen(true)} className="qf-btn qf-btn--menu">
            ☰
          </button>
          
          <button onClick={() => navigate('/qualyflow')} className="text-slate-400 hover:text-[var(--q-orange)] font-bold ml-2">
            Voltar
          </button>
        </div>
      </header>

      {/* ================= CONTEÚDO ================= */}
      <main className="qf-tv-content">
        {DASH_MODULES.map((module) => (
          <div 
            key={module.id} 
            className={`qf-tv-module ${activeDash === module.id ? 'block' : 'hidden'}`}
          >
            {module.component}
          </div>
        ))}
      </main>

      {/* ================= MENU LATERAL INLINE ================= */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50" onClick={() => setSidebarOpen(false)} />
      )}
      <aside className={`fixed top-0 right-0 h-full bg-white z-[60] shadow-2xl transition-transform duration-300 w-[300px] flex flex-col border-l border-slate-200 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-[var(--q-bg)]">
          <span className="text-sm font-black uppercase tracking-widest text-[var(--q-dark)]">Navegação Rápida</span>
          <button onClick={() => setSidebarOpen(false)} className="text-[var(--q-gray)] hover:text-[var(--q-danger)] font-bold text-2xl mb-1">×</button>
        </div>
        <div className="flex flex-col p-4 gap-2 overflow-y-auto custom-scrollbar">
          {DASH_MODULES.map((module) => (
            <button
              key={module.id}
              onClick={() => handleManualNav(module.id)}
              className={`w-full text-left p-4 rounded-xl text-xs font-black uppercase transition-all ${
                activeDash === module.id 
                  ? 'bg-[var(--q-green)] text-white shadow-md' 
                  : 'bg-slate-50 text-[var(--q-gray)] border border-slate-200 hover:border-[var(--q-green)]'
              }`}
            >
              {module.name}
            </button>
          ))}
        </div>
      </aside>

      {/* ================= MODAL DE PLAYLIST ================= */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[70] flex items-center justify-center p-4">
          <div className="qf-playlist-modal animate-in zoom-in-95 duration-200">
            
            <div className="qf-playlist-header">
              <h3>Lista de Dashboards</h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-red-500 font-bold text-xl">×</button>
            </div>
            
            <div className="qf-playlist-body">
              {/* Seleção de Tempo com Botões */}
              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-3">
                  Tempo por tela
                </label>
                <div className="flex flex-wrap gap-2">
                  {TIME_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setIntervalSecs(opt.value)}
                      className={`px-4 py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
                        intervalSecs === opt.value
                          ? 'bg-[var(--q-green)] text-white shadow-md'
                          : 'bg-slate-100 text-slate-500 border border-slate-200 hover:border-[var(--q-green)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lista de Dashboards */}
              <div className="mt-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-3">
                  Dashboards Inclusos
                </label>
                <div className="flex flex-col gap-3">
                  {DASH_MODULES.map((module) => (
                    <label key={module.id} className="qf-playlist-option select-none">
                      <input 
                        type="checkbox" 
                        checked={playlist.includes(module.id)}
                        onChange={() => toggleDashInPlaylist(module.id)}
                      />
                      {module.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="qf-playlist-footer gap-3">
              <button 
                onClick={() => setModalOpen(false)} 
                className="qf-btn-secondary"
              >
                Cancelar
              </button>
              <button 
                onClick={togglePlay} 
                className={`qf-btn-primary ${isPlaying ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' : ''}`}
                style={!isPlaying ? {} : { background: '#ef4444' }}
              >
                {isPlaying ? 'Parar Playlist' : 'Iniciar Playlist'}
              </button>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
};

export default DashboardHome;