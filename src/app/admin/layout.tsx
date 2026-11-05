import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Controladoria & BPO — AnalisAí.me',
  description: 'Torre de Controle Operacional, Auditoria Diária e Painel do BPO Financeiro',
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
