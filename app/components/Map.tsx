'use client';

import { useState } from 'react';
import { Beer, Wine, CheckCircle, MapPin, Navigation } from 'lucide-react';

export default function InteractiveMap({ bars, teamVisits, onToggleVisit }: any) {
  const [selectedBar, setSelectedBar] = useState<any>(null);

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden flex items-center justify-center select-none">
      {/* Tło wektorowe w stylu radaru/miasta */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#f59e0b_1px,transparent_1px)] [background-size:32px_32px]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-amber-500/20 rounded-full"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] border border-amber-500/20 rounded-full"></div>
      </div>

      {/* Kontener mapy wektorowej */}
      <div className="relative w-full max-w-4xl h-[80vh] m-4 bg-slate-900/40 backdrop-blur-md border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden">

        {/* Rzeka / Droga główna (estetyczny element wektorowy) */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30">
          <path d="M 0 200 Q 300 100 800 500" stroke="#f59e0b" strokeWidth="12" fill="none" strokeDasharray="8 8" />
          <path d="M 100 0 Q 500 400 300 800" stroke="#3b82f6" strokeWidth="8" fill="none" />
        </svg>

        {/* Dynamiczne renderowanie punktów barów na naszej mapie */}
        {bars.map((bar: any) => {
          const isVisited = teamVisits.includes(bar.osmId);
          return (
            <div
              key={bar.osmId}
              onClick={() => setSelectedBar(bar)}
              style={{ top: `${bar.y}%`, left: `${bar.x}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10"
            >
              {/* Pulsująca poświata */}
              <div className={`absolute -inset-2 rounded-full opacity-60 animate-ping ${isVisited ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>

              {/* Własny pin */}
              <div className={`relative flex items-center justify-center w-8 h-8 rounded-full border-2 border-slate-950 shadow-lg transition-transform group-hover:scale-125 ${isVisited ? 'bg-emerald-400 text-slate-950' : 'bg-amber-400 text-slate-950'}`}>
                {bar.type.includes('Klub') ? <Wine size={14} /> : <Beer size={14} />}
              </div>

              {/* Mini etykieta pod pinem */}
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-0.5 bg-slate-900/90 border border-white/10 text-[10px] font-bold text-white rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                {bar.name}
              </span>
            </div>
          );
        })}

        {/* Modal / Popup po kliknięciu w bar */}
        {selectedBar && (
          <div className="absolute bottom-6 left-6 right-6 sm:left-auto sm:right-6 sm:w-80 bg-slate-900/95 backdrop-blur-xl border border-amber-500/30 p-6 rounded-3xl shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="text-xl font-black text-white">{selectedBar.name}</h3>
                <p className="text-xs text-amber-500 font-bold uppercase tracking-wider">{selectedBar.type}</p>
              </div>
              <button onClick={() => setSelectedBar(null)} className="text-slate-400 hover:text-white font-bold text-sm bg-slate-800 w-8 h-8 rounded-full flex items-center justify-center">✕</button>
            </div>

            <p className="text-xs text-slate-400 mb-6 flex items-center gap-1.5"><MapPin size={14} /> {selectedBar.address}</p>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  onToggleVisit(selectedBar);
                }}
                className={`flex-1 py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  teamVisits.includes(selectedBar.osmId)
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-lg shadow-amber-500/20'
                }`}
              >
                {teamVisits.includes(selectedBar.osmId) ? <><CheckCircle size={16} /> ODWIEDZONO</> : 'OZNACZ JAKO ODWIEDZONY'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
