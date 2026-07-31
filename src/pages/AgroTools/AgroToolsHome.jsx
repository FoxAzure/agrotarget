// ================= DOCUMENTATION ------------------------------------------
// Script: AgroToolsHome
// Purpose: Hub central das ferramentas agrícolas. Com suporte visual a modo offline (PWA).
// ==========================================================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Style.css';

import HeaderAgroTools from '../../components/AgroTools/HeaderAgroTools';
import SidebarAgroTools from '../../components/AgroTools/SidebarAgroTools';

const AgroToolsHome = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  // Detector de status da rede (Online/Offline)
  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Lista atualizada com ícones SVG minimalistas (estilo linha fina) embutidos
  const toolsList = [
    { 
      id: 'perdas', 
      titulo: 'Perdas na Colheita', 
      descricao: 'Categorias, cálculos e histórico',
      rota: '/agrotools/perdas',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      )
    },
    { 
      id: 'adubacao', 
      titulo: 'Adubação', 
      descricao: 'Sulcamento, Cobertura e Plantio',
      rota: '/agrotools/adubacao',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      )
    },
    { 
      id: 'cuc', 
      titulo: 'CUC Gotejo', 
      descricao: 'Uniformidade da Irrigação, Vazão L/h',
      rota: '/agrotools/cuc',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-1.383 1.956-6.75 8.784-6.75 12.375a6.75 6.75 0 0013.5 0c0-3.591-5.367-10.419-6.75-12.375z" />
        </svg>
      )
    },
    { 
      id: 'cucpivot', 
      titulo: 'CUC Pivot', 
      descricao: 'Uniformidade de Irrigação de Pivô Central',
      rota: '/agrotools/cucpivot',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25a.75.75 0 01.75.75v13.5a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM5.25 10.5a6.75 6.75 0 1013.5 0" />
        </svg>
      )
    },
    { 
      id: 'vinhaca', 
      titulo: 'Vinhaça', 
      descricao: 'Cálculos e Métrica da Vinhaça Localizada',
      rota: '/agrotools/vinhaca',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
      )
    }
  ];

  return (
    <div className="at-theme relative">
      <HeaderAgroTools onMenuOpen={() => setSidebarOpen(true)} />

      <SidebarAgroTools 
        isOpen={isSidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />

      <main className="at-container py-10">
        <section className="fade-in max-w-3xl mx-auto">
          
          {/* O texto voltou, mas com uma tipografia elegante */}
          <div className="mb-8">
            <h2 className="at-page-title flex items-center gap-2">
              Calculadoras e Ferramentas
              {/* Badge indicando o modo offline */}
              {isOffline && (
                <span className="bg-orange-100 text-orange-600 border border-orange-200 text-[10px] font-black uppercase px-2 py-0.5 rounded-md shadow-sm ml-2">
                  Offline
                </span>
              )}
            </h2>
            <p className="at-page-subtitle">
              Módulos de apoio operacional - Qualidade Agrícola
            </p>
          </div>

          {/* Lista Slim - Fina e sofisticada */}
          <div className="at-slim-list">
            {toolsList.map((tool) => (
              <button 
                key={tool.id} 
                className="at-slim-card group"
                onClick={() => navigate(tool.rota)}
              >
                <div className="at-slim-left">
                  <div className="at-slim-text">
                    <span className="at-slim-title">{tool.titulo}</span>
                    <span className="at-slim-desc">{tool.descricao}</span>
                  </div>
                </div>

                <div className="at-slim-right">
                  <span className="at-slim-arrow">
                    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  </span>
                </div>
              </button>
            ))}
          </div>
          
        </section>
      </main>
    </div>
  );
};

export default AgroToolsHome;