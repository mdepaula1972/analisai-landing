const fs = require('fs');
const path = require('path');

const logoBuffer = fs.readFileSync(path.join(__dirname, '..', 'public', 'logo.png'));
const logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;

function getBannerSVG(option) {
  const isOption1 = option === 1;
  const headlineTop = isOption1 
    ? 'VOCÊ SABE PARA ONDE ESTÁ INDO'
    : 'SEU DINHEIRO ESTÁ TRABALHANDO';
  
  const headlineHighlight = isOption1
    ? 'O DINHEIRO DO SEU NEGÓCIO?'
    : 'A FAVOR OU CONTRA O SEU NEGÓCIO?';

  const subheadline = isOption1
    ? 'Você vende. Recebe. Paga. <tspan fill="#ffffff" font-weight="800">Mas quanto realmente sobra?</tspan>'
    : 'Você sabe quanto realmente sobra? <tspan fill="#ffffff" font-weight="800">Onde sua margem está sendo perdida?</tspan>';

  const buttonText = isOption1
    ? 'DESCUBRA SEU LUCRO REAL · R$ 197'
    : 'DESCUBRA EM 5 MINUTOS · R$ 197';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">
  <defs>
    <!-- Gradientes de Fundo e Elementos -->
    <radialGradient id="bgGlow" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#1e1b18" />
      <stop offset="50%" stop-color="#090a0f" />
      <stop offset="100%" stop-color="#020204" />
    </radialGradient>

    <radialGradient id="amberRadial" cx="50%" cy="45%" r="50%">
      <stop offset="0%" stop-color="rgba(245, 158, 11, 0.22)" />
      <stop offset="100%" stop-color="rgba(245, 158, 11, 0)" />
    </radialGradient>

    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="50%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>

    <linearGradient id="cardGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#13161f" stop-opacity="0.95" />
      <stop offset="100%" stop-color="#0b0d14" stop-opacity="0.98" />
    </linearGradient>

    <filter id="cardShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.6" />
    </filter>

    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" />
    </filter>

    <style>
      @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800;900&amp;display=swap');
      .font-sans { font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif; }
    </style>
  </defs>

  <!-- Fundo com Profundidade -->
  <rect width="1080" height="1080" fill="url(#bgGlow)" />
  <circle cx="540" cy="480" r="460" fill="url(#amberRadial)" />

  <!-- Grade Sutil de Fundo -->
  <g opacity="0.04" stroke="#ffffff" stroke-width="1">
    <line x1="0" y1="180" x2="1080" y2="180" />
    <line x1="0" y1="360" x2="1080" y2="360" />
    <line x1="0" y1="540" x2="1080" y2="540" />
    <line x1="0" y1="720" x2="1080" y2="720" />
    <line x1="0" y1="900" x2="1080" y2="900" />
    <line x1="180" y1="0" x2="180" y2="1080" />
    <line x1="360" y1="0" x2="360" y2="1080" />
    <line x1="540" y1="0" x2="540" y2="1080" />
    <line x1="720" y1="0" x2="720" y2="1080" />
    <line x1="900" y1="0" x2="900" y2="1080" />
  </g>

  <!-- ── CABEÇALHO COM LOGOTIPO OFICIAL EM DESTAQUE (AMPLIADO 3X) ── -->
  <g transform="translate(540, 78)" text-anchor="middle" class="font-sans">
    
    <!-- Pílula Container Imponente -->
    <rect x="-260" y="-45" width="520" height="90" rx="45" fill="#0b0e14" stroke="rgba(245, 158, 11, 0.45)" stroke-width="2" filter="url(#cardShadow)" />
    
    <!-- Logotipo Oficial Incorporado 3x Maior -->
    <image href="${logoBase64}" x="-235" y="-34" width="280" height="68" preserveAspectRatio="xMidYMid meet" />
    
    <!-- Linha Divisória Sutil -->
    <line x1="60" y1="-25" x2="60" y2="25" stroke="#334155" stroke-width="2" />

    <!-- Tag Diagnóstico Oficial -->
    <g transform="translate(150, 0)">
      <rect x="-70" y="-16" width="140" height="32" rx="16" fill="rgba(245, 158, 11, 0.15)" stroke="rgba(245, 158, 11, 0.3)" />
      <text y="5" fill="#f59e0b" font-size="13" font-weight="900" letter-spacing="1.5">DIAGNÓSTICO</text>
    </g>
  </g>

  <!-- ── HEADLINE PRINCIPAL (PERFEITAMENTE ESPAÇADA) ── -->
  <g transform="translate(540, 175)" text-anchor="middle" class="font-sans">
    <text y="0" fill="#ffffff" font-size="36" font-weight="900" letter-spacing="-0.5">
      ${headlineTop}
    </text>
    <text y="52" fill="url(#goldGradient)" font-size="44" font-weight="900" letter-spacing="-1" filter="url(#glow)">
      ${headlineHighlight}
    </text>
    <text y="102" fill="#cbd5e1" font-size="21" font-weight="600">
      ${subheadline}
    </text>
  </g>

  <!-- ── CARD CENTRAL: RAIO-X & SCORE EXECUTIVO ── -->
  <g transform="translate(140, 315)" class="font-sans">
    
    <!-- Moldura do Card -->
    <rect width="800" height="575" rx="32" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.5" filter="url(#cardShadow)" />
    
    <!-- Topo do Card: Score de Saúde -->
    <g transform="translate(40, 38)">
      
      <!-- Box Score Esquerdo -->
      <rect width="330" height="150" rx="20" fill="#0c0e15" stroke="rgba(245,158,11,0.25)" stroke-width="1.5" />
      
      <!-- Arco Medidor do Score -->
      <path d="M 50,110 A 55,55 0 0,1 160,110" fill="none" stroke="#262b38" stroke-width="10" stroke-linecap="round" />
      <path d="M 50,110 A 55,55 0 0,1 145,70" fill="none" stroke="url(#goldGradient)" stroke-width="10" stroke-linecap="round" filter="url(#glow)" />
      
      <text x="105" y="102" fill="#ffffff" font-size="32" font-weight="900" text-anchor="middle">70</text>
      <text x="105" y="122" fill="#64748b" font-size="11" font-weight="700" text-anchor="middle">/ 100</text>
      
      <text x="180" y="55" fill="#94a3b8" font-size="11" font-weight="800" letter-spacing="1">SAÚDE FINANCEIRA</text>
      <text x="180" y="82" fill="#f59e0b" font-size="18" font-weight="800">Atenção</text>
      <text x="180" y="105" fill="#f59e0b" font-size="18" font-weight="800">Operacional</text>
      <text x="180" y="128" fill="#ef4444" font-size="11" font-weight="700">⚠️ Sangrias no Caixa</text>
    </g>

    <!-- Box Benefícios Direita -->
    <g transform="translate(390, 38)">
      <rect width="370" height="150" rx="20" fill="#0c0e15" stroke="#1e293b" stroke-width="1.5" />
      
      <g transform="translate(25, 30)">
        <circle cx="10" cy="8" r="8" fill="rgba(16,185,129,0.2)" />
        <circle cx="10" cy="8" r="4" fill="#10b981" />
        <text x="30" y="13" fill="#f8fafc" font-size="14" font-weight="700">Análise por Voz em 5 Minutos</text>
      </g>

      <g transform="translate(25, 68)">
        <circle cx="10" cy="8" r="8" fill="rgba(245,158,11,0.2)" />
        <circle cx="10" cy="8" r="4" fill="#f59e0b" />
        <text x="30" y="13" fill="#f8fafc" font-size="14" font-weight="700">Relatório Executivo em PDF no Ato</text>
      </g>

      <g transform="translate(25, 106)">
        <circle cx="10" cy="8" r="8" fill="rgba(56,189,248,0.2)" />
        <circle cx="10" cy="8" r="4" fill="#38bdf8" />
        <text x="30" y="13" fill="#f8fafc" font-size="14" font-weight="700">Ciclo de 3 Reanálises (90 dias)</text>
      </g>
    </g>

    <!-- ── TABELA DRE GERENCIAL SINTÉTICA ── -->
    <g transform="translate(40, 212)">
      <rect width="720" height="325" rx="20" fill="#0c0e15" stroke="#1e293b" stroke-width="1.5" />
      
      <!-- Cabeçalho Tabela -->
      <rect width="720" height="42" rx="20" fill="#171b26" />
      <text x="25" y="26" fill="#94a3b8" font-size="12" font-weight="800" letter-spacing="1">DRE GERENCIAL SINTÉTICA</text>
      <text x="440" y="26" fill="#94a3b8" font-size="12" font-weight="800" text-anchor="end">VALOR ESTIMADO</text>
      <text x="560" y="26" fill="#94a3b8" font-size="12" font-weight="800" text-anchor="end">% FAT.</text>
      <text x="695" y="26" fill="#94a3b8" font-size="12" font-weight="800" text-anchor="end">STATUS</text>

      <!-- Linhas da DRE -->
      <!-- 1. Faturamento -->
      <g transform="translate(0, 42)">
        <rect width="720" height="42" fill="rgba(16,185,129,0.06)" />
        <text x="25" y="26" fill="#34d399" font-size="14" font-weight="800">(+) Faturamento Médio Mensal</text>
        <text x="440" y="26" fill="#34d399" font-size="14" font-weight="800" text-anchor="end">R$ 50.000,00</text>
        <text x="560" y="26" fill="#f8fafc" font-size="13" font-weight="700" text-anchor="end">100%</text>
        <text x="695" y="26" fill="#34d399" font-size="12" font-weight="700" text-anchor="end">Base</text>
      </g>

      <!-- 2. CMV -->
      <g transform="translate(0, 84)">
        <text x="25" y="26" fill="#cbd5e1" font-size="13" font-weight="600">(-) Custos com Mercadorias (CMV)</text>
        <text x="440" y="26" fill="#fbbf24" font-size="13" font-weight="700" text-anchor="end">- R$ 22.000,00</text>
        <text x="560" y="26" fill="#cbd5e1" font-size="13" font-weight="600" text-anchor="end">44,0%</text>
        <text x="695" y="26" fill="#fbbf24" font-size="12" font-weight="700" text-anchor="end">Alto</text>
      </g>

      <!-- 3. Margem Contribuição -->
      <g transform="translate(0, 126)">
        <rect width="720" height="42" fill="rgba(56,189,248,0.05)" />
        <text x="25" y="26" fill="#38bdf8" font-size="13" font-weight="800">(=) MARGEM DE CONTRIBUIÇÃO</text>
        <text x="440" y="26" fill="#38bdf8" font-size="13" font-weight="800" text-anchor="end">R$ 28.000,00</text>
        <text x="560" y="26" fill="#38bdf8" font-size="13" font-weight="700" text-anchor="end">56,0%</text>
        <text x="695" y="26" fill="#38bdf8" font-size="12" font-weight="700" text-anchor="end">Saudável</text>
      </g>

      <!-- 4. Despesas Fixas -->
      <g transform="translate(0, 168)">
        <text x="25" y="26" fill="#cbd5e1" font-size="13" font-weight="600">(-) Despesas Fixas &amp; Pró-labore</text>
        <text x="440" y="26" fill="#f87171" font-size="13" font-weight="700" text-anchor="end">- R$ 24.000,00</text>
        <text x="560" y="26" fill="#cbd5e1" font-size="13" font-weight="600" text-anchor="end">48,0%</text>
        <text x="695" y="26" fill="#f87171" font-size="12" font-weight="700" text-anchor="end">Pesado</text>
      </g>

      <!-- 5. Lucro Líquido / Sobra -->
      <g transform="translate(0, 210)">
        <rect width="720" height="52" fill="rgba(16,185,129,0.12)" stroke="rgba(16,185,129,0.3)" stroke-width="1" />
        <text x="25" y="32" fill="#34d399" font-size="15" font-weight="900">(=) RESULTADO LÍQUIDO REAL</text>
        <text x="440" y="32" fill="#34d399" font-size="16" font-weight="900" text-anchor="end">R$ 4.000,00</text>
        <text x="560" y="32" fill="#34d399" font-size="15" font-weight="900" text-anchor="end">8,0%</text>
        <text x="695" y="32" fill="#34d399" font-size="13" font-weight="800" text-anchor="end">Sobra</text>
      </g>

      <!-- Ponto de Equilíbrio -->
      <g transform="translate(0, 275)">
        <text x="25" y="26" fill="#f59e0b" font-size="13" font-weight="800">🎯 Ponto de Equilíbrio Mínimo:</text>
        <text x="695" y="26" fill="#ffffff" font-size="14" font-weight="900" text-anchor="end">R$ 42.857,00 / mês</text>
      </g>

    </g>

  </g>

  <!-- ── RODAPÉ COM CHAMADA DE AÇÃO (CTA) ── -->
  <g transform="translate(540, 960)" text-anchor="middle" class="font-sans">
    
    <!-- Botão Principal CTA -->
    <rect x="-350" y="-35" width="700" height="70" rx="35" fill="url(#goldGradient)" filter="url(#cardShadow)" />
    
    <text y="8" fill="#090a0f" font-size="22" font-weight="900" letter-spacing="0.5">
      ${buttonText}
    </text>
    
    <text y="58" fill="#94a3b8" font-size="14" font-weight="600">
      🔒 Sem planilhas · Sem reuniões · Emissão imediata em PDF no AnalisAI.me
    </text>
  </g>

</svg>`;
}

fs.writeFileSync(path.join(__dirname, '..', 'public', 'anuncio_onde_vai_o_dinheiro.svg'), getBannerSVG(1), 'utf8');
fs.writeFileSync(path.join(__dirname, '..', 'public', 'anuncio_dinheiro_favor_contra.svg'), getBannerSVG(2), 'utf8');

console.log('✅ Banners atualizados com sucesso com o logotipo oficial em Base64 e sem sobreposição!');
