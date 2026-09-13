import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { formatDueDateDetails } from './date-utils';
import { ASAAS_ONE_OFF, ASAAS_PLANS } from './constants';
import { sendEvolutionMedia } from './evolution';

export interface GenerateLedgerPdfOptions {
  clientId: string;
}

/**
 * Calcula a diferença em dias entre duas datas YYYY-MM-DD
 */
function getDaysDifference(dateStr1: string, dateStr2: string): number {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diffTime = d1.getTime() - d2.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Gera o buffer do PDF do Livro Caixa Oficial do Cliente Assinante
 */
export async function generateCashLedgerPdfBuffer(clientId: string): Promise<{
  buffer: Buffer;
  fileName: string;
  totalOpen: number;
  overdueCount: number;
  overdueTotal: number;
  companyName: string;
}> {
  const supabase = createServiceRoleClient();

  // 1. Busca dados cadastrais do cliente
  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single();

  const companyName = client?.company_name || client?.name || 'Cliente AnalisAí';
  const taxType = client?.tax_type || 'CNPJ';
  const taxId = client?.tax_id || 'Não informado';
  const email = client?.email || 'contato@suaempresa.com.br';
  const phone = client?.whatsapp_number ? `+${client.whatsapp_number}` : 'Não informado';
  const address = client?.address || 'Endereço comercial em atualização cadastral';
  const hasCustomLogo = Boolean(client?.logo_url);

  // 2. Busca contas a pagar em aberto
  const { data: bills } = await supabase
    .from('payables_receivables')
    .select('*')
    .eq('client_id', clientId)
    .eq('type', 'payable')
    .order('current_due_date', { ascending: true });

  const allBills = bills || [];
  const todayStr = new Date().toISOString().split('T')[0];

  // Divide em Vencidas e A Vencer
  const overdueBills = allBills.filter(b => b.status === 'open' && b.current_due_date < todayStr);
  const upcomingBills = allBills.filter(b => (b.status === 'open' || b.status === 'postponed') && b.current_due_date >= todayStr);

  const totalOpen = allBills.filter(b => b.status === 'open' || b.status === 'postponed').reduce((acc, b) => acc + Number(b.amount || 0), 0);
  const overdueTotal = overdueBills.reduce((acc, b) => acc + Number(b.amount || 0), 0);
  const upcomingTotal = upcomingBills.reduce((acc, b) => acc + Number(b.amount || 0), 0);

  // 3. Montagem do PDF com pdf-lib (Formato A4: 595.28 x 841.89 pt)
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Paleta de cores corporativa executiva
  const navyDark = rgb(0.06, 0.09, 0.16);     // #0f172a
  const amberGold = rgb(0.96, 0.62, 0.04);    // #f59e0b
  const slate600 = rgb(0.38, 0.44, 0.53);     // #64748b
  const slate200 = rgb(0.89, 0.91, 0.94);     // #e2e8f0
  const lightBg = rgb(0.97, 0.98, 0.99);      // #f8fafc
  const redAlertBg = rgb(0.99, 0.93, 0.93);   // fundo suave alerta
  const redAlertText = rgb(0.75, 0.11, 0.11); // texto alerta vermelho
  const textDark = rgb(0.12, 0.15, 0.2);

  // ── CABEÇALHO SUPERIOR (Marca AnalisAí) ────────────────────────────────────
  page.drawRectangle({
    x: 0,
    y: height - 80,
    width,
    height: 80,
    color: navyDark,
  });

  page.drawText('ANALISAÍ.ME', {
    x: 35,
    y: height - 38,
    size: 20,
    font: fontBold,
    color: amberGold,
  });

  page.drawText('Relatório Oficial de Livro Caixa & Gestão Financeira', {
    x: 35,
    y: height - 56,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.85, 0.9, 0.95),
  });

  const emissaoDate = new Date().toLocaleDateString('pt-BR');
  const emissaoHora = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  page.drawText(`EMISSÃO: ${emissaoDate} às ${emissaoHora}`, {
    x: width - 210,
    y: height - 38,
    size: 8,
    font: fontBold,
    color: rgb(0.9, 0.95, 1.0),
  });

  page.drawText('AUTENTICAÇÃO: IA-SOLO-2026', {
    x: width - 210,
    y: height - 54,
    size: 7.5,
    font: fontRegular,
    color: rgb(0.7, 0.75, 0.8),
  });

  let currentY = height - 95;

  // ── QUADRO DE IDENTIFICAÇÃO CADASTRAL DA EMPRESA ──────────────────────────
  const clientBoxHeight = 78;
  page.drawRectangle({
    x: 35,
    y: currentY - clientBoxHeight,
    width: width - 70,
    height: clientBoxHeight,
    color: lightBg,
    borderColor: slate200,
    borderWidth: 1,
  });

  // Nome da Empresa / Razão Social
  page.drawText(companyName.toUpperCase(), {
    x: 48,
    y: currentY - 18,
    size: 10.5,
    font: fontBold,
    color: navyDark,
  });

  // CNPJ/CPF + E-mail + Telefone
  page.drawText(`${taxType}: ${taxId}    |    E-mail: ${email}    |    WhatsApp: ${phone}`, {
    x: 48,
    y: currentY - 33,
    size: 8,
    font: fontRegular,
    color: slate600,
  });

  // Endereço Comercial
  page.drawText(`Endereço: ${address}`, {
    x: 48,
    y: currentY - 47,
    size: 8,
    font: fontRegular,
    color: slate600,
  });

  // Box / Selo de Logotipo & Upsell
  if (hasCustomLogo) {
    page.drawText('✅ Logotipo Institucional Autenticado na Plataforma', {
      x: 48,
      y: currentY - 63,
      size: 7.5,
      font: fontBold,
      color: rgb(0.1, 0.5, 0.2),
    });
  } else {
    page.drawText('⭐ Personalize este relatório com o LOGOTIPO da sua empresa (Solo Plus ou Compra Avulsa por R$ 29,90)', {
      x: 48,
      y: currentY - 63,
      size: 7.5,
      font: fontBold,
      color: amberGold,
    });
  }

  currentY -= (clientBoxHeight + 12);

  // ── CARDS DE INDICADORES DE CAIXA (KPIs) ──────────────────────────────────
  const cardWidth = (width - 70 - 20) / 3;
  const cardHeight = 44;

  // Card 1: Total em Aberto
  page.drawRectangle({
    x: 35,
    y: currentY - cardHeight,
    width: cardWidth,
    height: cardHeight,
    color: rgb(0.94, 0.96, 0.99),
    borderColor: slate200,
    borderWidth: 1,
  });
  page.drawText('TOTAL EM ABERTO', { x: 45, y: currentY - 16, size: 7.5, font: fontBold, color: slate600 });
  page.drawText(`R$ ${totalOpen.toFixed(2)}`, { x: 45, y: currentY - 34, size: 12, font: fontBold, color: navyDark });

  // Card 2: Contas Vencidas (Alerta Vermelho)
  page.drawRectangle({
    x: 35 + cardWidth + 10,
    y: currentY - cardHeight,
    width: cardWidth,
    height: cardHeight,
    color: overdueBills.length > 0 ? redAlertBg : lightBg,
    borderColor: overdueBills.length > 0 ? rgb(0.95, 0.6, 0.6) : slate200,
    borderWidth: 1,
  });
  page.drawText('CONTAS VENCIDAS (EM ATRASO)', {
    x: 35 + cardWidth + 20,
    y: currentY - 16,
    size: 7.5,
    font: fontBold,
    color: overdueBills.length > 0 ? redAlertText : slate600,
  });
  page.drawText(`R$ ${overdueTotal.toFixed(2)} (${overdueBills.length})`, {
    x: 35 + cardWidth + 20,
    y: currentY - 34,
    size: 12,
    font: fontBold,
    color: overdueBills.length > 0 ? redAlertText : navyDark,
  });

  // Card 3: A Vencer no Prazo
  page.drawRectangle({
    x: 35 + (cardWidth + 10) * 2,
    y: currentY - cardHeight,
    width: cardWidth,
    height: cardHeight,
    color: rgb(0.93, 0.98, 0.95),
    borderColor: slate200,
    borderWidth: 1,
  });
  page.drawText('A VENCER NO PRAZO', { x: 35 + (cardWidth + 10) * 2 + 10, y: currentY - 16, size: 7.5, font: fontBold, color: rgb(0.1, 0.5, 0.2) });
  page.drawText(`R$ ${upcomingTotal.toFixed(2)} (${upcomingBills.length})`, {
    x: 35 + (cardWidth + 10) * 2 + 10,
    y: currentY - 34,
    size: 12,
    font: fontBold,
    color: rgb(0.1, 0.45, 0.2),
  });

  currentY -= (cardHeight + 14);

  // ── SEÇÃO 1: CONTAS VENCIDAS / EM ATRASO (SE HOUVER) ──────────────────────
  if (overdueBills.length > 0) {
    page.drawRectangle({
      x: 35,
      y: currentY - 20,
      width: width - 70,
      height: 20,
      color: redAlertBg,
    });
    page.drawText('⚠️ CONTAS VENCIDAS — RISCO DE CORTE, PROTESTO E JUROS DIÁRIOS DE MORA', {
      x: 45,
      y: currentY - 14,
      size: 8,
      font: fontBold,
      color: redAlertText,
    });
    currentY -= 25;

    // Cabeçalho da tabela de contas vencidas
    page.drawText('FORNECEDOR / CREDOR', { x: 45, y: currentY - 10, size: 7.5, font: fontBold, color: slate600 });
    page.drawText('VENCIMENTO ORIGINAL', { x: 260, y: currentY - 10, size: 7.5, font: fontBold, color: slate600 });
    page.drawText('DIAS DE ATRASO', { x: 380, y: currentY - 10, size: 7.5, font: fontBold, color: slate600 });
    page.drawText('VALOR (R$)', { x: width - 95, y: currentY - 10, size: 7.5, font: fontBold, color: slate600 });
    currentY -= 15;

    for (const b of overdueBills.slice(0, 4)) {
      page.drawLine({ start: { x: 35, y: currentY + 2 }, end: { x: width - 35, y: currentY + 2 }, color: slate200, thickness: 0.5 });
      const supName = b.counterparty_name.length > 32 ? b.counterparty_name.slice(0, 32) + '...' : b.counterparty_name;
      const daysOverdue = getDaysDifference(todayStr, b.current_due_date);

      page.drawText(supName, { x: 45, y: currentY - 8, size: 8, font: fontRegular, color: textDark });
      page.drawText(formatDueDateDetails(b.current_due_date), { x: 260, y: currentY - 8, size: 7.5, font: fontRegular, color: slate600 });
      page.drawText(`+${daysOverdue} dias`, { x: 380, y: currentY - 8, size: 7.5, font: fontBold, color: redAlertText });
      page.drawText(`R$ ${Number(b.amount).toFixed(2)}`, { x: width - 95, y: currentY - 8, size: 8, font: fontBold, color: redAlertText });
      currentY -= 17;
    }
    currentY -= 8;
  }

  // ── SEÇÃO 2: CONTAS A VENCER (CRONOGRAMA LIVRO CAIXA) ─────────────────────
  page.drawRectangle({
    x: 35,
    y: currentY - 20,
    width: width - 70,
    height: 20,
    color: navyDark,
  });
  page.drawText('📅 CRONOGRAMA DE PRÓXIMOS VENCIMENTOS (LIVRO CAIXA)', {
    x: 45,
    y: currentY - 14,
    size: 8,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  currentY -= 25;

  page.drawText('FORNECEDOR / BENEFICIÁRIO', { x: 45, y: currentY - 10, size: 7.5, font: fontBold, color: slate600 });
  page.drawText('DATA DE VENCIMENTO EXATA', { x: 260, y: currentY - 10, size: 7.5, font: fontBold, color: slate600 });
  page.drawText('SITUAÇÃO', { x: 380, y: currentY - 10, size: 7.5, font: fontBold, color: slate600 });
  page.drawText('VALOR (R$)', { x: width - 95, y: currentY - 10, size: 7.5, font: fontBold, color: slate600 });
  currentY -= 15;

  const maxUpcoming = overdueBills.length > 0 ? 5 : 7;
  const listToShow = upcomingBills.slice(0, maxUpcoming);

  if (listToShow.length === 0) {
    page.drawText('Nenhuma conta a vencer agendada no momento.', {
      x: 45,
      y: currentY - 10,
      size: 8,
      font: fontRegular,
      color: slate600,
    });
    currentY -= 20;
  } else {
    for (const b of listToShow) {
      page.drawLine({ start: { x: 35, y: currentY + 2 }, end: { x: width - 35, y: currentY + 2 }, color: slate200, thickness: 0.5 });
      const supName = b.counterparty_name.length > 32 ? b.counterparty_name.slice(0, 32) + '...' : b.counterparty_name;
      const statusLabel = b.status === 'postponed' ? 'Prorrogada' : 'No Prazo';
      const statusColor = b.status === 'postponed' ? amberGold : rgb(0.1, 0.5, 0.2);

      page.drawText(supName, { x: 45, y: currentY - 8, size: 8, font: fontRegular, color: textDark });
      page.drawText(formatDueDateDetails(b.current_due_date), { x: 260, y: currentY - 8, size: 7.5, font: fontRegular, color: slate600 });
      page.drawText(statusLabel, { x: 380, y: currentY - 8, size: 7.5, font: fontBold, color: statusColor });
      page.drawText(`R$ ${Number(b.amount).toFixed(2)}`, { x: width - 95, y: currentY - 8, size: 8, font: fontBold, color: textDark });
      currentY -= 17;
    }
  }

  currentY -= 12;

  // ── BOX DE MONETIZAÇÃO ESTRATÉGICA (CONSULTOR DE CAIXA R$ 14,90) ──────────
  const promoBoxHeight = 65;
  page.drawRectangle({
    x: 35,
    y: currentY - promoBoxHeight,
    width: width - 70,
    height: promoBoxHeight,
    color: rgb(0.99, 0.98, 0.92),
    borderColor: amberGold,
    borderWidth: 1.5,
  });

  page.drawText('🤝 APERTO TEMPORÁRIO OU CONTAS EM ATRASO? PROTEJA SEU CAIXA AGORA', {
    x: 48,
    y: currentY - 16,
    size: 8.5,
    font: fontBold,
    color: navyDark,
  });

  page.drawText('Contrate nossa Análise Estratégica de Fluxo de Caixa individual por apenas R$ 14,90. Nossa IA contábil', {
    x: 48,
    y: currentY - 29,
    size: 7.5,
    font: fontRegular,
    color: textDark,
  });
  page.drawText('calcula as multas de cada boleto e entrega uma recomendação exata de qual conta adiar com o menor custo financeiro.', {
    x: 48,
    y: currentY - 40,
    size: 7.5,
    font: fontRegular,
    color: textDark,
  });

  page.drawText(`👉 Ativação imediata via Asaas (R$ 14,90): ${ASAAS_ONE_OFF.cashFlowAnalysis.checkoutUrl}`, {
    x: 48,
    y: currentY - 54,
    size: 8,
    font: fontBold,
    color: rgb(0.8, 0.3, 0.0),
  });

  // ── RODAPÉ E CERTIFICAÇÃO BANCÁRIA ─────────────────────────────────────────
  page.drawLine({
    start: { x: 35, y: 55 },
    end: { x: width - 35, y: 55 },
    color: slate200,
    thickness: 0.5,
  });

  page.drawText('Segurança Bancária: Este relatório é um demonstrativo contábil de controle gerencial emitido pela tecnologia AnalisAí.', {
    x: 35,
    y: 42,
    size: 6.8,
    font: fontRegular,
    color: slate600,
  });
  page.drawText('A conferência de dados, autenticação de código de barras e liquidação de pagamentos cabem exclusivamente ao pagador junto ao seu banco.', {
    x: 35,
    y: 32,
    size: 6.8,
    font: fontRegular,
    color: slate600,
  });

  page.drawText('ANALISAÍ.ME © 2026 — TODOS OS DIREITOS RESERVADOS', {
    x: width - 210,
    y: 32,
    size: 6.5,
    font: fontBold,
    color: slate600,
  });

  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);
  const cleanComp = companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 25);
  const fileName = `Livro-Caixa-${cleanComp || 'analisai'}.pdf`;

  return {
    buffer,
    fileName,
    totalOpen,
    overdueCount: overdueBills.length,
    overdueTotal,
    companyName,
  };
}

/**
 * Gera o buffer do PDF de Demonstração para leads na Degustação Gratuita
 */
export async function generateTrialDocPdfBuffer(extraction: any, phone: string): Promise<{
  buffer: Buffer;
  fileName: string;
}> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const navyDark = rgb(0.06, 0.09, 0.16);     // #0f172a
  const amberGold = rgb(0.96, 0.62, 0.04);    // #f59e0b
  const slate600 = rgb(0.38, 0.44, 0.53);     // #64748b
  const slate200 = rgb(0.89, 0.91, 0.94);     // #e2e8f0
  const lightBg = rgb(0.97, 0.98, 0.99);      // #f8fafc
  const textDark = rgb(0.12, 0.15, 0.2);

  // Cabeçalho
  page.drawRectangle({
    x: 0,
    y: height - 80,
    width,
    height: 80,
    color: navyDark,
  });

  page.drawText('ANALISAÍ.ME', {
    x: 35,
    y: height - 38,
    size: 20,
    font: fontBold,
    color: amberGold,
  });

  page.drawText('Demonstração Contábil & Leitura Inteligente de Documento', {
    x: 35,
    y: height - 56,
    size: 8.5,
    font: fontRegular,
    color: rgb(0.85, 0.9, 0.95),
  });

  const emissaoDate = new Date().toLocaleDateString('pt-BR');
  page.drawText(`DEGUSTAÇÃO: ${emissaoDate}`, {
    x: width - 180,
    y: height - 38,
    size: 8,
    font: fontBold,
    color: rgb(0.9, 0.95, 1.0),
  });

  let currentY = height - 105;

  // Quadro do Documento Lido
  page.drawRectangle({
    x: 35,
    y: currentY - 110,
    width: width - 70,
    height: 110,
    color: lightBg,
    borderColor: slate200,
    borderWidth: 1,
  });

  page.drawText('📄 DADOS EXTRAÍDOS DO SEU DOCUMENTO PELA NOSSA IA', {
    x: 48,
    y: currentY - 20,
    size: 9.5,
    font: fontBold,
    color: navyDark,
  });

  const sup = extraction.counterparty_name || 'Fornecedor identificado';
  const val = Number(extraction.total_amount || 0).toFixed(2);
  const due = extraction.due_date ? formatDueDateDetails(extraction.due_date) : 'À vista';
  const cat = extraction.category_suggestion || 'Despesa Operacional';

  page.drawText(`• Favorecido / Cedente: ${sup}`, { x: 48, y: currentY - 40, size: 8.5, font: fontRegular, color: textDark });
  page.drawText(`• Valor Reconhecido: R$ ${val}`, { x: 48, y: currentY - 55, size: 8.5, font: fontBold, color: navyDark });
  page.drawText(`• Vencimento Oficial: ${due}`, { x: 48, y: currentY - 70, size: 8.5, font: fontRegular, color: textDark });
  page.drawText(`• Classificação Contábil DRE: ${cat}`, { x: 48, y: currentY - 85, size: 8.5, font: fontRegular, color: slate600 });
  page.drawText(`• Status: Registrado como modelo demonstrativo no seu Livro Caixa`, { x: 48, y: currentY - 100, size: 8, font: fontBold, color: rgb(0.1, 0.5, 0.2) });

  currentY -= 130;

  // Tabela Comparativa de Planos
  page.drawRectangle({
    x: 35,
    y: currentY - 20,
    width: width - 70,
    height: 20,
    color: navyDark,
  });
  page.drawText('🚀 ESCOLHA O PLANO IDEAL PARA A GESTÃO FINANCEIRA DA SUA EMPRESA', {
    x: 45,
    y: currentY - 14,
    size: 8,
    font: fontBold,
    color: rgb(1, 1, 1),
  });
  currentY -= 30;

  // Box Planos
  const planWidth = (width - 70 - 20) / 3;

  // Start
  page.drawRectangle({ x: 35, y: currentY - 120, width: planWidth, height: 120, color: lightBg, borderColor: slate200, borderWidth: 1 });
  page.drawText('START', { x: 45, y: currentY - 20, size: 10, font: fontBold, color: navyDark });
  page.drawText('R$ 39,90 /mês', { x: 45, y: currentY - 36, size: 11, font: fontBold, color: amberGold });
  page.drawText('• 15 documentos/mês', { x: 45, y: currentY - 52, size: 7.5, font: fontRegular, color: slate600 });
  page.drawText('• Lembretes de vencimento', { x: 45, y: currentY - 64, size: 7.5, font: fontRegular, color: slate600 });
  page.drawText('• Livro caixa digital', { x: 45, y: currentY - 76, size: 7.5, font: fontRegular, color: slate600 });
  page.drawText('• Relatório em PDF', { x: 45, y: currentY - 88, size: 7.5, font: fontRegular, color: slate600 });
  page.drawText('👉 assinar start', { x: 45, y: currentY - 108, size: 8, font: fontBold, color: navyDark });

  // Solo
  page.drawRectangle({ x: 35 + planWidth + 10, y: currentY - 120, width: planWidth, height: 120, color: rgb(0.99, 0.98, 0.93), borderColor: amberGold, borderWidth: 1.5 });
  page.drawText('SOLO (Mais Escolhido)', { x: 35 + planWidth + 18, y: currentY - 20, size: 9, font: fontBold, color: amberGold });
  page.drawText('R$ 87,99 /mês', { x: 35 + planWidth + 18, y: currentY - 36, size: 11, font: fontBold, color: navyDark });
  page.drawText('• 30 documentos/mês', { x: 35 + planWidth + 18, y: currentY - 52, size: 7.5, font: fontRegular, color: slate600 });
  page.drawText('• Comandos por Áudio/Voz', { x: 35 + planWidth + 18, y: currentY - 64, size: 7.5, font: fontBold, color: navyDark });
  page.drawText('• Consultor de Caixa IA', { x: 35 + planWidth + 18, y: currentY - 76, size: 7.5, font: fontBold, color: navyDark });
  page.drawText('• Prorrogação no WhatsApp', { x: 35 + planWidth + 18, y: currentY - 88, size: 7.5, font: fontRegular, color: slate600 });
  page.drawText('👉 assinar solo', { x: 35 + planWidth + 18, y: currentY - 108, size: 8, font: fontBold, color: rgb(0.8, 0.3, 0.0) });

  // Solo Plus
  page.drawRectangle({ x: 35 + (planWidth + 10) * 2, y: currentY - 120, width: planWidth, height: 120, color: lightBg, borderColor: slate200, borderWidth: 1 });
  page.drawText('SOLO PLUS', { x: 35 + (planWidth + 10) * 2 + 10, y: currentY - 20, size: 10, font: fontBold, color: navyDark });
  page.drawText('R$ 147,99 /mês', { x: 35 + (planWidth + 10) * 2 + 10, y: currentY - 36, size: 11, font: fontBold, color: amberGold });
  page.drawText('• 60 documentos/mês', { x: 35 + (planWidth + 10) * 2 + 10, y: currentY - 52, size: 7.5, font: fontRegular, color: slate600 });
  page.drawText('• Logotipo nos relatórios', { x: 35 + (planWidth + 10) * 2 + 10, y: currentY - 64, size: 7.5, font: fontBold, color: navyDark });
  page.drawText('• Suporte contábil prioritário', { x: 35 + (planWidth + 10) * 2 + 10, y: currentY - 76, size: 7.5, font: fontRegular, color: slate600 });
  page.drawText('• 4 análises de caixa/mês', { x: 35 + (planWidth + 10) * 2 + 10, y: currentY - 88, size: 7.5, font: fontRegular, color: slate600 });
  page.drawText('👉 assinar plus', { x: 35 + (planWidth + 10) * 2 + 10, y: currentY - 108, size: 8, font: fontBold, color: navyDark });

  currentY -= 140;

  // Box de Link Direto
  page.drawRectangle({
    x: 35,
    y: currentY - 45,
    width: width - 70,
    height: 45,
    color: rgb(0.95, 0.98, 0.95),
    borderColor: rgb(0.2, 0.6, 0.3),
    borderWidth: 1,
  });

  page.drawText('Ative sua conta em 1 minuto sem contratos ou fidelidade pelo link seguro Asaas:', {
    x: 48,
    y: currentY - 18,
    size: 8,
    font: fontBold,
    color: rgb(0.1, 0.45, 0.2),
  });

  page.drawText(`Plano Solo Oficial: ${ASAAS_PLANS.monthly.solo.checkoutUrl}`, {
    x: 48,
    y: currentY - 32,
    size: 8,
    font: fontBold,
    color: rgb(0.05, 0.3, 0.1),
  });

  // Rodapé
  page.drawLine({
    start: { x: 35, y: 45 },
    end: { x: width - 35, y: 45 },
    color: slate200,
    thickness: 0.5,
  });

  page.drawText('AnalisAí.me — Inteligência Artificial Financeira para Empresas. Central WhatsApp Oficial.', {
    x: 35,
    y: 30,
    size: 7,
    font: fontRegular,
    color: slate600,
  });

  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);
  const fileName = `Demonstrativo-Analisai-${phone.slice(-4)}.pdf`;

  return { buffer, fileName };
}

/**
 * Gera e envia o PDF do Livro Caixa diretamente para o WhatsApp do cliente
 */
export async function sendCashLedgerPdfToWhatsApp(clientId: string, phone: string) {
  const result = await generateCashLedgerPdfBuffer(clientId);
  const base64 = result.buffer.toString('base64');

  let caption = `📊 *Relatório Oficial de Livro Caixa — AnalisAí*\n`;
  caption += `🏢 *Empresa:* ${result.companyName}\n`;
  caption += `💰 *Total em Aberto:* R$ ${result.totalOpen.toFixed(2)}\n`;

  if (result.overdueCount > 0) {
    caption += `⚠️ *Atenção:* Há ${result.overdueCount} conta(s) em atraso somando R$ ${result.overdueTotal.toFixed(2)}.\n`;
  } else {
    caption += `✅ *Situação:* Nenhuma conta em atraso no momento.\n`;
  }

  caption += `\n📄 Segue em anexo seu relatório completo em PDF pronto para conferência ou impressão!`;

  return await sendEvolutionMedia({
    phone,
    mediaBase64: base64,
    mediaType: 'document',
    fileName: result.fileName,
    caption,
  });
}

/**
 * Envia o PDF de degustação para o lead no primeiro contato
 */
export async function sendTrialPdfToWhatsApp(phone: string, extraction: any) {
  const { buffer, fileName } = await generateTrialDocPdfBuffer(extraction, phone);
  const base64 = buffer.toString('base64');

  return await sendEvolutionMedia({
    phone,
    mediaBase64: base64,
    mediaType: 'document',
    fileName,
    caption: `📄 *Demonstrativo Contábil em PDF Gerado Instantaneamente!*\nAqui está o demonstrativo com a leitura contábil do seu documento já estruturada pela nossa IA.`,
  });
}
