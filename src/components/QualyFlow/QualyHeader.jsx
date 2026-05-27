import React from 'react';
import { useNavigate } from 'react-router-dom';
import qualyLogo from '../../gallery/logo/qualyflow.png';

const QualyHeader = ({ onMenuOpen, children }) => {
  const navigate = useNavigate();

  return (
    <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm font-sans">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* Logo e Nome */}
        <div 
          className="flex items-center gap-2 cursor-pointer group" 
          onClick={() => navigate('/qualyflow')}
        >
          <img src={qualyLogo} alt="Qualy" className="w-10 h-10 object-contain group-hover:scale-105 transition-transform" />
          <h1 className="text-xl font-black uppercase tracking-tighter text-[var(--q-green)]">
            Qualy<span className="text-[var(--q-orange)]">Flow</span>
          </h1>
        </div>

        {/* Espaço Central */}
        {children && <div className="hidden md:flex flex-1 justify-center">{children}</div>}

        {/* Botões de Ação Reformulados */}
        <div className="flex gap-3 items-center">
          <button 
            onClick={() => navigate('/')} 
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[var(--q-gray)] bg-slate-50 border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-[var(--q-green)] hover:border-[var(--q-green)] transition-all active:scale-95 shadow-sm"
          >
            Início
          </button>
          <button 
            onClick={onMenuOpen} 
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white bg-[var(--q-orange)] rounded-lg hover:bg-[var(--q-danger)] transition-all active:scale-95 shadow-sm"
          >
            Menu
          </button>
        </div>
      </div>
      
      {children && <div className="md:hidden w-full border-t border-slate-100 bg-[var(--q-bg)]">{children}</div>}
    </header>
  );
};

export default QualyHeader;