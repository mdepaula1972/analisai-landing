import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AnalisAí — Painel Financeiro',
    short_name: 'AnalisAí',
    description: 'Seu assistente financeiro no WhatsApp com visualização em tempo real de contas, fluxo de caixa e termômetro fiscal.',
    start_url: '/painel',
    display: 'standalone',
    background_color: '#020617',
    theme_color: '#10b981',
    icons: [
      {
        src: '/favicon.ico',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
