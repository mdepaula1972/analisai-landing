'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Download, ArrowLeft, Sparkles, CheckCircle2 } from 'lucide-react';

export default function CriativosPage() {
  const criativos = [
    {
      id: 'anuncio_onde_vai_o_dinheiro',
      titulo: 'Opção 1: Tráfego Frio (Universal - Mais Recomendada)',
      headline: 'VOCÊ SABE PARA ONDE ESTÁ INDO O DINHEIRO DO SEU NEGÓCIO?',
      subheadline: 'Você vende. Recebe. Paga. Mas quanto realmente sobra?',
      svgPath: '/anuncio_onde_vai_o_dinheiro.svg',
    },
    {
      id: 'anuncio_dinheiro_favor_contra',
      titulo: 'Opção 2: Abordagem Sofisticada (MEI a PME)',
      headline: 'SEU DINHEIRO ESTÁ TRABALHANDO A FAVOR OU CONTRA O SEU NEGÓCIO?',
      subheadline: 'Você sabe quanto realmente sobra? Onde sua margem está sendo perdida?',
      svgPath: '/anuncio_dinheiro_favor_contra.svg',
    }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 sm:p-10 selection:bg-amber-500 selection:text-slate-950">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Topo */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <Link href="/diagnostico" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar para a Landing Page
          </Link>
          <span className="text-xs font-mono font-bold bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1 rounded-full">
            Kit de Anúncios Oficiais (1080x1080)
          </span>
        </div>

        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Banners de Anúncio em Alta Resolução (100% em Português)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Imagens nítidas sem distorções de texto, desenhadas especificamente para campanhas de Meta Ads (Instagram e Facebook).
          </p>
        </div>

        {/* Grid de Criativos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {criativos.map((item) => (
            <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl flex flex-col justify-between">
              
              <div className="space-y-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider block">
                  {item.titulo}
                </span>
                <h3 className="text-base font-bold text-white leading-tight">
                  &ldquo;{item.headline}&rdquo;
                </h3>
                <p className="text-xs text-slate-400">
                  {item.subheadline}
                </p>
              </div>

              {/* Preview da Imagem */}
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden border border-slate-800 shadow-xl bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.svgPath}
                  alt={item.headline}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Botão de Download */}
              <a
                href={item.svgPath}
                download={`${item.id}.svg`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-3.5 px-6 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Baixar Banner em Alta Definição (SVG / Vetorial)
              </a>

            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
