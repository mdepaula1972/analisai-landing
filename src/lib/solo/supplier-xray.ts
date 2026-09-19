import { GoogleGenerativeAI } from '@google/generative-ai';
import { createServiceRoleClient } from '@/lib/supabase-server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { sendEvolutionMedia, sendEvolutionText } from './evolution';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';

export interface SupplierAlternative {
  name: string;
  category: string;
  location: string;
  contact_info: string;
  differential: string;
  estimated_benefit: string;
}

export interface SupplierXRayResult {
  client_name: string;
  company_name: string;
  segment: string;
  region: string;
  summary: string;
  categories_analyzed: string[];
  suppliers: SupplierAlternative[];
  negotiation_strategy: string;
}

/**
 * 1. Pesquisa de Fornecedores via Gemini com Google Search Grounding
 */
export async function runSupplierSearchWithGrounding(
  companyName: string,
  segment: string,
  cityOrState: string
): Promise<SupplierXRayResult> {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearch: {} }],
    systemInstruction: `Você é o Auditor Especialista de Compras e Suprimentos do AnalisAí.
Sua meta é encontrar alternativas reais de fornecedores para pequenas empresas brasileiras, visando redução de custos e melhores prazos.
UTILIZE A BUSCA DO GOOGLE para encontrar empresas ativas, contatos reais e diferenciais.

Mantenha o escopo estrito em no máximo 3 categorias essenciais (ex: Embalagens, Matéria-Prima, Distribuição/Logística).
Retorne SEMPRE em formato JSON estrito sem formatações adicionais com o seguinte schema:
{
  "summary": "Resumo executivo da análise de compras",
  "categories_analyzed": ["Categoria 1", "Categoria 2", "Categoria 3"],
  "suppliers": [
    {
      "name": "Nome da Empresa Fornecedora",
      "category": "Categoria correspondente",
      "location": "Cidade/Estado ou Abrangência Nacional",
      "contact_info": "Telefone, WhatsApp ou Site encontrado",
      "differential": "Diferencial de preço, prazo ou condições",
      "estimated_benefit": "Economia estimada de 10 a 25% ou prazo de faturamento"
    }
  ],
  "negotiation_strategy": "Diretrizes práticas para o cliente negociar com seus fornecedores atuais usando estas cotações."
}`,
  });

  const prompt = `Faça um levantamento de mercado e encontre fornecedores alternativos competitivos para a empresa "${companyName}", atuante no segmento "${segment}", localizada ou atendida na região "${cityOrState || 'Brasil'}".
Foque em fornecedores B2B com boas condições de atacado ou prazos flexíveis.`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  let cleanedJson = responseText.trim();
  if (cleanedJson.startsWith('```json')) {
    cleanedJson = cleanedJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanedJson.startsWith('```')) {
    cleanedJson = cleanedJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  try {
    const parsed = JSON.parse(cleanedJson);
    return {
      client_name: companyName,
      company_name: companyName,
      segment,
      region: cityOrState || 'Brasil',
      summary: parsed.summary || 'Análise de compras e competitividade de fornecedores.',
      categories_analyzed: parsed.categories_analyzed || [segment],
      suppliers: parsed.suppliers || [],
      negotiation_strategy: parsed.negotiation_strategy || 'Alinhe prazos e volumes para obter descontos.',
    };
  } catch (err) {
    console.error('[Supplier X-Ray JSON Parse Error]:', err, responseText);
    return {
      client_name: companyName,
      company_name: companyName,
      segment,
      region: cityOrState || 'Brasil',
      summary: 'Mapeamento preliminar de fornecedores alternativos na sua região.',
      categories_analyzed: [segment, 'Insumos Gerais'],
      suppliers: [
        {
          name: 'Distribuidores Regionais e Atacadistas',
          category: segment,
          location: cityOrState || 'Brasil',
          contact_info: 'Cotação direta via central de compras',
          differential: 'Preços de atacado para compras conjuntas',
          estimated_benefit: 'Redução média estimada de 15% em compras programadas',
        },
      ],
      negotiation_strategy: 'Apresente o histórico de compras do AnalisAí para negociar faturamento a prazo.',
    };
  }
}

/**
 * 2. Geração de Relatório PDF Serverless com Logo AnalisAí via pdf-lib
 */
export async function generateSupplierXRayPdfBuffer(data: SupplierXRayResult): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // Formato A4 padrão
  const { width, height } = page.getSize();

  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Paleta de Cores AnalisAí
  const amberDark = rgb(0.96, 0.62, 0.04);   // #f59e0b
  const slate900 = rgb(0.06, 0.09, 0.16);    // #0f172a
  const slate600 = rgb(0.38, 0.44, 0.53);    // #64748b
  const slate100 = rgb(0.95, 0.96, 0.98);
  const textDark = rgb(0.12, 0.15, 0.2);

  // Faixa do Cabeçalho Superior com Marca
  page.drawRectangle({
    x: 0,
    y: height - 90,
    width: width,
    height: 90,
    color: slate900,
  });

  page.drawText('ANALISAÍ.ME', {
    x: 40,
    y: height - 48,
    size: 22,
    font: fontBold,
    color: amberDark,
  });

  page.drawText('BPO Financeiro Inteligente & Consultoria Estratégica', {
    x: 40,
    y: height - 68,
    size: 9,
    font: fontRegular,
    color: rgb(0.8, 0.85, 0.9),
  });

  page.drawText(`EMISSÃO: ${new Date().toLocaleDateString('pt-BR')}`, {
    x: width - 150,
    y: height - 48,
    size: 9,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  // Título do Relatório
  let cursorY = height - 125;

  page.drawText('RELATÓRIO: RAIO-X DE FORNECEDORES', {
    x: 40,
    y: cursorY,
    size: 16,
    font: fontBold,
    color: textDark,
  });

  cursorY -= 20;

  page.drawText(`Cliente / Empresa: ${data.company_name} | Segmento: ${data.segment} | Região: ${data.region}`, {
    x: 40,
    y: cursorY,
    size: 10,
    font: fontRegular,
    color: slate600,
  });

  cursorY -= 25;

  // Bloco 1: Resumo Executivo
  page.drawRectangle({
    x: 40,
    y: cursorY - 60,
    width: width - 80,
    height: 65,
    color: slate100,
    borderColor: rgb(0.88, 0.9, 0.94),
    borderWidth: 1,
  });

  page.drawText('DIAGNÓSTICO E OPORTUNIDADE DE ECONOMIA:', {
    x: 52,
    y: cursorY - 18,
    size: 9,
    font: fontBold,
    color: amberDark,
  });

  const summaryLines = data.summary.slice(0, 180);
  page.drawText(summaryLines, {
    x: 52,
    y: cursorY - 35,
    size: 9,
    font: fontRegular,
    color: textDark,
    maxWidth: width - 105,
    lineHeight: 12,
  });

  cursorY -= 85;

  // Bloco 2: Fornecedores Mapeados
  page.drawText('FORNECEDORES ALTERNATIVOS MAPEADOS (PESQUISA IA):', {
    x: 40,
    y: cursorY,
    size: 12,
    font: fontBold,
    color: textDark,
  });

  cursorY -= 15;

  for (const sup of data.suppliers.slice(0, 4)) {
    cursorY -= 65;

    page.drawRectangle({
      x: 40,
      y: cursorY,
      width: width - 80,
      height: 60,
      color: rgb(1, 1, 1),
      borderColor: rgb(0.85, 0.88, 0.92),
      borderWidth: 1,
    });

    page.drawText(`• ${sup.name}`, {
      x: 52,
      y: cursorY + 44,
      size: 11,
      font: fontBold,
      color: slate900,
    });

    page.drawText(`Categoria: ${sup.category} | Local: ${sup.location}`, {
      x: 52,
      y: cursorY + 30,
      size: 8.5,
      font: fontRegular,
      color: slate600,
    });

    page.drawText(`Diferencial: ${sup.differential} | Benefício: ${sup.estimated_benefit}`, {
      x: 52,
      y: cursorY + 16,
      size: 8.5,
      font: fontRegular,
      color: amberDark,
    });

    page.drawText(`Contato: ${sup.contact_info}`, {
      x: 52,
      y: cursorY + 4,
      size: 8,
      font: fontRegular,
      color: slate600,
    });
  }

  // Bloco 3: Estratégia de Negociação
  cursorY -= 40;

  page.drawText('ESTRATÉGIA RECOMENDADA DE NEGOCIAÇÃO:', {
    x: 40,
    y: cursorY,
    size: 11,
    font: fontBold,
    color: textDark,
  });

  cursorY -= 15;

  page.drawText(data.negotiation_strategy.slice(0, 240), {
    x: 40,
    y: cursorY,
    size: 8.5,
    font: fontRegular,
    color: slate600,
    maxWidth: width - 80,
    lineHeight: 12,
  });

  // Rodapé Oficial com Ancoragem de Consultoria com Marcos
  page.drawRectangle({
    x: 0,
    y: 0,
    width: width,
    height: 45,
    color: slate900,
  });

  page.drawText('AnalisAí.me — Inteligência Financeira e BPO de Alta Precisão', {
    x: 40,
    y: 22,
    size: 8,
    font: fontRegular,
    color: rgb(0.7, 0.75, 0.8),
  });

  page.drawText('Consultoria Especializada com Marcos: contato via WhatsApp oficial', {
    x: 40,
    y: 10,
    size: 8,
    font: fontBold,
    color: amberDark,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

/**
 * 3. Orquestrador de Execução e Envio do Raio-X via WhatsApp
 */
export async function executeAndSendSupplierXRay(clientId: string) {
  const supabase = createServiceRoleClient();

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, company_name, whatsapp_number')
    .eq('id', clientId)
    .single();

  if (!client) return { success: false, error: 'Cliente não encontrado' };

  await sendEvolutionText({
    phone: client.whatsapp_number,
    text: `⏳ *Gerando seu Raio-X de Fornecedores...*
Nossa IA com busca ativa está pesquisando o mercado e formatando seu documento em PDF com a marca AnalisAí. Isso levará apenas alguns segundos.`,
  });

  const companyName = client.company_name || client.name;
  const searchResult = await runSupplierSearchWithGrounding(companyName, 'Comércio e Serviços', 'Brasil');
  const pdfBuffer = await generateSupplierXRayPdfBuffer(searchResult);

  // Envia o PDF via Evolution API
  const fileName = `Raio_X_Fornecedores_${companyName.replace(/\s+/g, '_')}.pdf`;
  await sendEvolutionMedia({
    phone: client.whatsapp_number,
    mediaBase64: pdfBuffer.toString('base64'),
    mediaType: 'document',
    fileName,
    caption: `📄 *Seu Raio-X de Fornecedores AnalisAí está pronto!*
O relatório completo em PDF foi anexado acima com fornecedores mapeados e estratégias de redução de custo.`,
  });

  // Gatilho de Escalonamento para Consultoria Humana com Ancoragem em R$ 247
  await sendEvolutionText({
    phone: client.whatsapp_number,
    text: `💡 *Deseja aplicar essas reduções com apoio especializado?*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Nosso consultor executivo **Marcos** pode analisar pessoalmente seu fluxo de caixa e conduzir as negociações de corte de custos para o seu negócio.

• Sessão individual de diagnóstico financeiro e compras
• Ancoragem especial para clientes AnalisAí: **a partir de R$ 247,00**

Gostaria que o Marcos entre em contato com você?
👉 Responda *Quero Consultoria* para agendar.`,
  });

  return { success: true };
}
