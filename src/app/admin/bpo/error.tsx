'use client';

import { useEffect } from 'react';

export default function BpoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Erro capturado na Torre BPO:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-slate-900 border border-red-500/30 rounded-2xl p-6 shadow-xl">
        <div className="w-12 h-12 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
          ⚠️
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          Falha ao carregar a Torre de Controle
        </h2>
        <p className="text-sm text-slate-400 mb-4">
          Ocorreu uma instabilidade na consulta de dados do BPO. Os detalhes do erro foram registrados.
        </p>
        {error.message && (
          <div className="bg-slate-950 p-3 rounded-lg text-xs font-mono text-red-300 text-left mb-6 overflow-x-auto border border-slate-800">
            {error.message}
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => reset()}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2.5 px-4 rounded-xl transition cursor-pointer"
          >
            Tentar Novamente
          </button>
          <a
            href="/admin"
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-2.5 px-4 rounded-xl transition text-center cursor-pointer"
          >
            Voltar ao Admin
          </a>
        </div>
      </div>
    </div>
  );
}

