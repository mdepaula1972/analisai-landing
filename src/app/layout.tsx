import React from "react";
import Script from "next/script";
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
    <html lang="pt-BR" className={`${inter.variable} h-full overflow-x-hidden`}>
      <body className="min-h-full flex flex-col antialiased overflow-x-hidden">
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '1852838482555769');
            fbq('track', 'PageView');
          `}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src="https://www.facebook.com/tr?id=1852838482555769&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        {children}
        <GoogleAnalytics gaId="G-KK4WR61BDM" />
      </body>
    </html>
  );
}
