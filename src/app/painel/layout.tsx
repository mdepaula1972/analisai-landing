import type { Metadata, Viewport } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'AnalisAí — Painel Financeiro',
  description: 'Seu painel visual em tempo real de fluxo de caixa, contas da semana, gráficos e termômetro tributário.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'AnalisAí',
  },
};

export const viewport: Viewport = {
  themeColor: '#020617',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans antialiased">
      {children}
    </div>
  );
}
