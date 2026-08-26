import React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AnalisAI.me — Inteligência Financeira de Alta Precisão",
  description:
    "Simulações financeiras avançadas e análise preditiva sem necessidade de integração bancária direta. Tome decisões estratégicas com total segurança e sigilo.",
  keywords: ["inteligência financeira", "fluxo de caixa", "simulação financeira", "IA financeira", "análise preditiva"],
  openGraph: {
    title: "AnalisAI.me — Inteligência Financeira de Alta Precisão",
    description:
      "Simulações financeiras avançadas e análise preditiva sem integração bancária. Decisões estratégicas com total segurança.",
    type: "website",
    locale: "pt_BR",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        {children}
        <GoogleAnalytics gaId="G-KK4WR61BDM" />
      </body>
    </html>
  );
}
