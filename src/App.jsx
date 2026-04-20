import React from 'react';

// Sub-componente para manter o código limpo, como você gosta
const ModuleCard = ({ title, acronym, status, description }) => (
  <div className="group relative flex flex-col items-center justify-center p-8 bg-slate-900 border border-agro-green/30 rounded-2xl hover:border-agro-orange/60 transition-all duration-500 cursor-pointer overflow-hidden shadow-[0_0_15px_-5px_rgba(17,101,52,0.3)]">
    
    <div className="relative w-16 h-16 mb-4 flex items-center justify-center bg-agro-green/10 rounded-xl border border-agro-green/30 group-hover:scale-110 group-hover:border-agro-orange/40 transition-all duration-500">
      <span className="text-2xl font-black italic text-agro-orange drop-shadow-[0_0_8px_rgba(246,130,31,0.4)]">
        {acronym}
      </span>
    </div>

    <h2 className="text-xs font-black text-white uppercase tracking-[0.2em] group-hover:text-agro-orange transition-colors">
      {title}
    </h2>
    <p className="text-[10px] text-slate-500 font-medium mt-1 group-hover:text-slate-400">
      {description}
    </p>

    <div className="mt-6 pt-4 border-t border-white/5 w-full flex flex-col items-center">
      <span className="text-[7px] text-slate-600 uppercase font-bold tracking-widest">Status do Sistema</span>
      <div className="flex items-center gap-1.5 mt-1">
        <div className="w-1.5 h-1.5 rounded-full bg-agro-orange animate-pulse" />
        <span className="text-[9px] font-mono text-agro-orange uppercase tracking-tighter">
          {status}
        </span>
      </div>
    </div>
  </div>
);

function App() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-950 no-scrollbar">
      {/* Header com a sua cara */}
      <header className="w-full py-10 px-6 text-center border-b border-white/5 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <h1 className="text-4xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-agro-green to-agro-orange">
          AgroTarget
        </h1>
        <div className="flex items-center justify-center gap-2 mt-1">
          <div className="h-[1px] w-8 bg-agro-green" />
          <p className="text-[10px] uppercase tracking-[0.5em] text-agro-green font-black">
            Inteligência Agrícola
          </p>
          <div className="h-[1px] w-8 bg-agro-green" />
        </div>
      </header>

      {/* Grid Principal */}
      <main className="flex-grow p-8 flex items-center justify-center">
        <div className="w-full max-w-3xl grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <ModuleCard 
            title="QualyFlow" 
            acronym="QF" 
            status="Monitorando..." 
            description="Gestão de Qualidade e Fluxos"
          />

          <ModuleCard 
            title="COA Center" 
            acronym="COA" 
            status="Sincronizado" 
            description="Centro de Operações Agrícolas"
          />

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full py-10 px-6 text-center border-t border-white/5 bg-slate-950">
        <div className="flex flex-col gap-2">
          <p className="text-[10px] text-slate-600 uppercase tracking-[0.3em] font-bold">Arquitetura de Dados</p>
          <p className="text-lg font-black text-white tracking-tight uppercase">
            Paulo <span className="text-agro-orange">Roberto</span>
          </p>
          <div className="flex items-center justify-center gap-4 mt-2">
            <span className="text-[9px] px-2 py-0.5 rounded border border-agro-green/30 text-agro-green font-bold">V2.0 REACT</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;