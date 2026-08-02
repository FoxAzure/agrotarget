// ================= DOCUMENTATION ------------------------------------------
// Script: IndeterDetailCalendario
// Purpose: Visão em formato de Calendário/Grid do Tempo Indeterminado.
// ==========================================================================

import React from 'react';

const IndeterDetailCalendario = ({
  selectedDate,
  selectedCategories,
  availableDates = [],
}) => {
  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-left-4 duration-300">
      <div className="coa-card">
        <div className="coa-card__body p-6 flex flex-col items-center justify-center gap-2">
          <span className="text-sm font-black text-[var(--coa-text)]">
            Calendário - Indeterminado
          </span>
          <span className="text-xs font-bold text-[var(--coa-text-muted)]">
            🚧 Desenvolvimento 🚧
          </span>
        </div>
      </div>
    </div>
  );
};

export default IndeterDetailCalendario;
