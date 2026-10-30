import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { ExtractedDocumentData } from '@/types/solo';
import { isSettlementVerbMessage } from './conversational-router';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '';

export function getGeminiClient() {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada no ambiente.');
  }
  return new GoogleGenerativeAI(GEMINI_API_KEY);
}

/**
 * 1. Extração estruturada de Documentos (Visão / PDF / Fotos)
 * Retorna campos contábeis e score de confiança (0.0 a 1.0).
 */
export async function extractDocumentWithGemini(
  fileBufferBase64: string,
  mimeType: string,
  userInstruction?: string
): Promise<ExtractedDocumentData> {
  const genAI = getGeminiClient();
  const candidateModels = ['gemini-3-flash-preview', 'gemini-3.5-flash', 'gemini-3.1-flash-lite-preview'];
  let lastError: any = null;

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: ({
            type: SchemaType.OBJECT,
            properties: {
              is_financial_doc: {
                type: SchemaType.BOOLEAN,
                description:
                  'True se o arquivo for um documento fiscal, contábil ou financeiro real (boleto, conta de luz/água/telefone, nota fiscal, recibo, cupom, comprovante). False se for foto de objeto, pessoa, paisagem, meme, documento não financeiro ou ilegível.',
              },
              doc_type: {
                type: SchemaType.STRING,
                enum: ['nfe', 'nfse', 'boleto', 'recibo', 'cupom', 'das_mei', 'outro'],
                description:
                  'Tipo estrito do documento. REGRA MANDATÓRIA: Se a imagem contiver logotipo ou nome de banco ("Banrisul", "Bradesco", "Itaú", "Banco do Brasil", "Caixa", "Santander", "Sicoob", "Sicredi", "Inter", etc.), código de banco (ex: 041-8, 237-2, 341-7, 001-9, 033-7, 104-0), "Recibo do Pagador", "Recibo do Sacado", "Ficha de Compensação", "Local de Pagamento", "Beneficiário / Cedente", "Nosso Número", "Vencimento" e "Valor do Documento", o doc_type DEVE ser obrigatoriamente "boleto". NUNCA classifique como "nfe" ou "nfse" mesmo que haja menção ao número de uma NF no campo de observação ou número do documento!',
              },
              has_boleto_layout: {
                type: SchemaType.BOOLEAN,
                description:
                  'True se a imagem apresentar layout de boleto bancário (logotipo/nome de banco como Banrisul, Bradesco, Itaú, BB, Caixa, Santander, "Recibo do Pagador", "Ficha de Compensação", "Local de Pagamento", "Nosso Número", "Vencimento" e "Valor do Documento"), mesmo que a parte inferior do código de barras esteja cortada.',
              },
              bank_name: {
                type: SchemaType.STRING,
                description:
                  'Nome ou código do banco se o documento contiver cabeçalho ou logotipo bancário (ex: "Banrisul 041-8", "Bradesco 237-2", "Itaú 341-7", "Banco do Brasil 001-9", "Caixa 104-0", "Santander 033-7", "Sicoob 756", "Sicredi 748").',
                nullable: true,
              },
              raw_ocr_text: {
                type: SchemaType.STRING,
                description:
                  'Transcrição literal do cabeçalho, títulos e campos-chave visíveis na imagem (ex: nome e código do banco como "Banrisul 041-8", "Recibo do Pagador", "Ficha de Compensação", "Autenticação Mecânica", "Linha Digitável", "Nosso Número", "Agência/Código do Beneficiário", "DANFE", etc.).',
              },
              notes: {
                type: SchemaType.STRING,
                description:
                  'Instruções, observações do documento, referências a faturas/parcelas ou textos complementares impressos.',
                nullable: true,
              },
              counterparty_name: {
                type: SchemaType.STRING,
                description:
                  'Nome real do fornecedor, cedente/beneficiário, prestador ou órgão emissor (ex: "Refrigeração Dufrio", "Bitzer"). Se for boleto bancário, extraia o nome do Beneficiário/Cedente (fornecedor) ou, se não houver outro nome além do banco, o nome do banco. NUNCA retorne a palavra genérica "Emitente"!',
              },
              tax_id: {
                type: SchemaType.STRING,
                description: 'CNPJ ou CPF do emissor se legível',
                nullable: true,
              },
              total_amount: {
                type: SchemaType.NUMBER,
                description: 'Valor total monetário em reais (ex: 150.50)',
              },
              due_date: {
                type: SchemaType.STRING,
                description: 'Data de vencimento no formato YYYY-MM-DD se identificável',
                nullable: true,
              },
              issue_date: {
                type: SchemaType.STRING,
                description: 'Data de emissão no formato YYYY-MM-DD se identificável',
                nullable: true,
              },
              tax_competence: {
                type: SchemaType.STRING,
                description: 'Mês e ano da competência tributária de apuração (ex: 10/2026), especialmente para guias de tributos como DAS-MEI',
                nullable: true,
              },
              invoice_number_ref: {
                type: SchemaType.STRING,
                description:
                  'Número do documento ou Nota Fiscal de origem citado no boleto bancário (ex: campo "Número do Documento", "Nº do Documento", "000021644162", "216441/01").',
                nullable: true,
              },
              digitable_line: {
                type: SchemaType.STRING,
                description:
                  'Linha digitável numérica do boleto bancário (47 ou 48 dígitos) ou código de barras (44 dígitos), se visível no documento.',
                nullable: true,
              },
              barcode_or_pix: {
                type: SchemaType.STRING,
                description:
                  'Código de barras numérico legível (linha digitável bancária com 44, 47 ou 48 dígitos, ou arrecadação governamental iniciada com 8). NUNCA insira CNPJs ou CPFs aqui.',
                nullable: true,
              },
              barcode: {
                type: SchemaType.STRING,
                description: 'Código de barras ou linha digitável numérica do boleto bancário ou de arrecadação governamental (se visível)',
                nullable: true,
              },
              pix_code: {
                type: SchemaType.STRING,
                description: 'Código copia-e-cola Pix presente no documento ou guia PGMEI',
                nullable: true,
              },
              pix_key: {
                type: SchemaType.STRING,
                description:
                  'Chave Pix para pagamento informada no documento (CNPJ, CPF, celular, e-mail, chave aleatória ou payload Pix Copia e Cola).',
                nullable: true,
              },
              pix_key_type: {
                type: SchemaType.STRING,
                enum: ['cnpj', 'cpf', 'email', 'telefone', 'aleatoria', 'copia_e_cola', 'outro'],
                description: 'Tipo da chave Pix identificada',
                nullable: true,
              },
              is_rent: {
                type: SchemaType.BOOLEAN,
                description:
                  'True se o documento for notificação, recibo ou cobrança de aluguel de imóvel, condomínio ou taxa predial locatícia.',
              },
              is_insurance: {
                type: SchemaType.BOOLEAN,
                description:
                  'True se o documento for apólice, carnê, fatura ou proposta de seguradora (ex: Tokio Marine, Porto Seguro, Bradesco Seguros, etc.).',
              },
              policy_number: {
                type: SchemaType.STRING,
                description: 'Número da apólice, proposta ou contrato se legível.',
                nullable: true,
              },
              payer_name: {
                type: SchemaType.STRING,
                description:
                  'Nome do pagador, sacado, tomador de serviços ou locatário impresso no documento se identificável.',
                nullable: true,
              },
              payer_tax_id: {
                type: SchemaType.STRING,
                description:
                  'CPF ou CNPJ do pagador/sacado/tomador/locatário impresso no documento se identificável (números ou formatado).',
                nullable: true,
              },
              payer_tax_type: {
                type: SchemaType.STRING,
                enum: ['cpf', 'cnpj'],
                description: 'Indica se o pagador/sacado é Pessoa Física (cpf) ou Pessoa Jurídica (cnpj)',
                nullable: true,
              },
              confidence_score: {
                type: SchemaType.NUMBER,
                description: 'Nível de certeza da extração dos dados (0.0 a 1.0)',
              },
              category_suggestion: {
                type: SchemaType.STRING,
                description:
                  'Sugestão de categoria contábil DRE (ex: aluguel, seguro, energia_eletrica, telecomunicacoes, agua_saneamento, fornecedores_mercadoria, servicos_terceiros, tributos, combustivel, alimentacao, outros)',
                nullable: true,
              },
              critical_notes: {
                type: SchemaType.STRING,
                description:
                  'Observações relevantes para o gestor: juros diários expressivos por atraso, risco de protesto em cartório, corte iminente de serviço essencial ou desconto por pagamento pontual.',
                nullable: true,
              },
              installments: {
                type: SchemaType.ARRAY,
                description:
                  'OBRIGATÓRIO: Caso a fatura, nota fiscal, carnê de seguro ou contrato contenha mais de uma parcela ou cronograma de pagamentos, extraia CADA UMA das parcelas no array com número, vencimento (YYYY-MM-DD) e valor.',
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    installment_number: { type: SchemaType.NUMBER },
                    due_date: { type: SchemaType.STRING },
                    amount: { type: SchemaType.NUMBER },
                  },
                },
                nullable: true,
              },
              installments_count: {
                type: SchemaType.INTEGER,
                description: 'Número de parcelas se indicado pelo usuário na legenda ou no documento (ex: se o usuário disse "dividido em 10x", retorne 10)',
                nullable: true,
              },
              is_installment: {
                type: SchemaType.BOOLEAN,
                description: 'True se o documento ou a legenda do usuário indicar que é um pagamento parcelado',
              },
              entry_type: {
                type: SchemaType.STRING,
                enum: ['payable', 'receivable'],
                description: 'payable se for despesa/conta a pagar/boleto de fornecedor. receivable se for receita/conta a receber/NFS-e emitida para cliente ou comprovante de recebimento.',
              },
              is_bank_statement: {
                type: SchemaType.BOOLEAN,
                description: 'True se o documento for um extrato bancário (conta corrente, poupança, etc.) com lista de lançamentos de débito e crédito.',
              },
              bank_transactions: {
                type: SchemaType.ARRAY,
                description: 'Se for extrato bancário, extraia a lista com as movimentações individuais.',
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    date: { type: SchemaType.STRING, description: 'Data da movimentação YYYY-MM-DD' },
                    description: { type: SchemaType.STRING, description: 'Histórico/descrição bancária do lançamento' },
                    amount: { type: SchemaType.NUMBER, description: 'Valor monetário numérico positivo' },
                    transaction_type: { type: SchemaType.STRING, enum: ['credit', 'debit'], description: 'credit para entradas/recebimentos, debit para saídas/pagamentos' },
                  },
                },
                nullable: true,
              },
              analysis_advice: {
                type: SchemaType.STRING,
                description:
                  'Conselho estratégico do AnalisAí: tom humano, parceiro e experiente (parceiro de trincheira). Ex: "Sabesp com corte iminente se passar de 15 dias de atraso. Priorize quitar hoje."',
                nullable: true,
              },
            },
            required: [
              'is_financial_doc',
              'doc_type',
              'raw_ocr_text',
              'counterparty_name',
              'total_amount',
              'confidence_score',
            ],
          } as any),
        },
        systemInstruction: `Você é o AnalisAí Solo, um assistente contábil e financeiro de inteligência artificial de elite.
Sua missão é ler documentos financeiros (fotos, PDFs, comprovantes, faturas, carnês, extratos e boletos bancários brasileiros).

REGRA MANDATÓRIA DE DISCRIMINAÇÃO — BOLETO BANCÁRIO vs NOTA FISCAL:
- Se a imagem contiver logotipo ou nome de banco ("Banrisul", "Bradesco", "Itaú", "Banco do Brasil", "Caixa", "Santander", "Sicoob", "Sicredi", "Inter", etc.), código de banco (ex: "041-8", "237-2", "341-7", "001-9", "033-7", "104-0"), "Recibo do Pagador", "Recibo do Sacado", "Ficha de Compensação", "Local de Pagamento", "Agência / Código do Beneficiário", "Nosso Número", "Vencimento" e "Valor do Documento", o tipo \`doc_type\` DEVE ser classificado OBRIGATORIAMENTE como \`'boleto'\` e \`has_boleto_layout = true\`.
- NUNCA classifique um boleto bancário como \`'nfe'\`, \`'nfse'\` ou \`'recibo'\`, mesmo que haja menção ao número de uma NF no campo de observação, "Número do Documento" (ex: "000021644162") ou a razão social completa do cedente/fornecedor (ex: Dufrio, Refrigeração Dufrio, Bitzer).
- Extraia o campo \`invoice_number_ref\` com o número do documento/NF citado no boleto (ex: "000021644162" ou número da nota) e preencha \`barcode\`, \`digitable_line\` e \`barcode_or_pix\` se a linha digitável ou código de barras estiver visível.

DIRETRIZES DE EXTRAÇÃO:
1. Priorize com extrema precisão a identificação de:
   - Fornecedor / Favorecido ou Cliente / Pagador (counterparty_name) e CNPJ/CPF do emissor (tax_id)
   - Valor Total (total_amount)
   - Data de Vencimento (due_date)
   - Código de barras bancário (barcode_or_pix) OU Chave Pix (pix_key e pix_key_type)
   - Sacado / Pagador / Tomador / Locatário (payer_name, payer_tax_id e payer_tax_type)
   - Direção do título: entry_type ('payable' para despesas/a pagar, 'receivable' para receitas/a receber)
2. DISTINÇÃO ENTRE CONTAS A PAGAR (payable) E CONTAS A RECEBER (receivable):
   - Se for boleto a pagar, conta de luz/água/gás, carnê, fatura de fornecedor ou despesa: entry_type = 'payable'.
   - Se for Nota Fiscal de Serviços (NFS-e) ou Venda emitida pelo usuário (onde a empresa do usuário é o prestador/emissor e o cliente é o tomador/sacado): entry_type = 'receivable'.
   - Se for comprovante de transferência Pix ou TED onde o favorecido/destinatário é a empresa do usuário (Pix recebido): entry_type = 'receivable'.
3. EXTRATOS BANCÁRIOS (is_bank_statement):
   - Se a imagem ou PDF contiver um extrato bancário de banco brasileiro (Itaú, Bradesco, Santander, Banco do Brasil, Nubank, Inter, Sicredi, Sicoob, etc.) com várias linhas de movimentações:
   - Defina is_bank_statement = true e doc_type = 'outro'.
   - Extraia as movimentações dentro do array "bank_transactions" com date (YYYY-MM-DD), description, amount e transaction_type ('credit' para entradas e 'debit' para saídas).
4. DISTINÇÃO CRÍTICA ENTRE CÓDIGO DE BARRAS E CHAVE PIX:
   - Linha digitável bancária SEMPRE possui 44, 47 ou 48 dígitos numéricos. Preencha em barcode_or_pix.
   - NUNCA coloque CNPJ (14 dígitos) ou CPF (11 dígitos) no campo barcode_or_pix! Se o documento trouxer "PIX (CNPJ) XX.XXX.XXX/XXXX-XX" ou chave Pix, coloque a chave em pix_key e marque pix_key_type = 'cnpj' (ou 'cpf', 'email', etc.), deixando barcode_or_pix = null.
5. IDENTIFICAÇÃO DO SACADO / PAGADOR / TOMADOR / LOCATÁRIO (PJ x PF):
   - Todo boleto bancário tem campo "Sacado / Pagador" com Nome e CPF/CNPJ.
   - Toda NFS-e/NF-e tem campo "Tomador de Serviços / Destinatário" com Nome e CPF/CNPJ.
   - Recibos e contratos de locação trazem o "Locatário" (ex: MAR BRASIL SERVIÇOS LOCAÇÕES LTDA CNPJ 02.233.923/0001-19).
   - Contas pessoais trazem o titular da conta com CPF de Pessoa Física (11 dígitos).
   - Extraia SEMPRE payer_name, payer_tax_id e payer_tax_type ('cpf' ou 'cnpj') quando visível.
6. ALUGUEL E LOCAÇÃO (is_rent):
   - Se for notificação de aluguel, locação de imóvel, condomínio ou taxa de administração predial (ex: O&M Administradora de Bens, imobiliárias, etc.), marque is_rent = true e category_suggestion = 'aluguel'.
   - Se o documento trouxer discriminação de aluguel, água, luz, condomínio, o total_amount deve ser o valor total líquido a pagar.
7. SEGUROS E CARNÊS DE PAGAMENTO (is_insurance & installments):
   - Se o documento for de uma seguradora (ex: Tokio Marine Seguradora, Porto Seguro, Azul, Allianz, etc.), marque is_insurance = true e category_suggestion = 'seguro'.
   - OBRIGATÓRIO: Se o documento contiver um carnê, histórico de parcelas ou tabela de pagamento parcelado (ex: 12 parcelas mensais), você DEVE extrair TODAS as parcelas dentro do array "installments" com installment_number, due_date (YYYY-MM-DD) e amount de cada parcela!
8. GUIA DAS-MEI / PGMEI / TRIBUTOS DO SIMPLES NACIONAL (doc_type = 'das_mei'):
   - Caso o documento seja o Documento de Arrecadação do Simples Nacional (DAS, DAS-MEI ou PGMEI emitido pela Receita Federal):
   - Defina doc_type = 'das_mei', entry_type = 'payable' e category_suggestion = 'tributos'.
   - O favorecido/fornecedor (counterparty_name) deve ser 'Receita Federal (DAS-MEI)'.
   - Capture a competência de apuração no campo tax_competence (ex: '10/2026' ou o mês/ano discriminado no período de apuração).
   - O vencimento oficial geralmente é o dia 20 (YYYY-MM-20).
   - Capture a linha digitável de arrecadação governamental (iniciada pelo dígito 8, com 48 dígitos) em barcode e barcode_or_pix.
   - Capture o código copia-e-cola Pix presente na guia PGMEI em pix_code e pix_key.
9. Se o documento NÃO for financeiro (ex: foto de objeto, pessoa, paisagem, meme, documento não financeiro ou ilegível), defina is_financial_doc = false.
10. Se a imagem estiver cortada, borrada ou dados ambíguos, indique confidence_score < 0.7.
11. INSTRUÇÃO OU LEGENDA CONTEXTUAL DO USUÁRIO (PARCELAMENTO E NOTAS FISCAIS):
    - O usuário pode enviar a foto de uma Nota Fiscal (NF-e, NFC-e, NFS-e), boleto ou cupom fiscal acompanhada de uma legenda com orientações (ex: "valor total dividido em 10x", "parcelar em 3 vezes", "paguei no pix", "metade entrada e metade no cartão").
    - Você DEVE considerar a legenda do usuário com prioridade máxima para entender as condições comerciais.
    - Se a legenda indicar parcelamento (ex: "em 10x", "dividido em 10 vezes", "10 parcelas"):
      a) Defina is_installment = true;
      b) Defina installments_count com o número de parcelas indicado (ex: 10);
      c) Extraia o valor total da nota em total_amount;
      d) No array installments, se as datas não estiverem explícitas no documento, gere as N parcelas consecutivas a cada 30 dias a partir da data de vencimento da 1ª parcela (ou data da emissão + 30 dias), com o valor unitário igual a (total_amount / N);
    - NUNCA diga que não consegue ler Nota Fiscal! Notas Fiscais e Danfes são documentos financeiros primários suportados. Extraia sempre o emitente/fornecedor (counterparty_name), CNPJ (tax_id), valor total (total_amount) e data.
12. EXTRAÇÃO DE NOTAS FISCAIS E DANFEs (NF-e, NFC-e, NFS-e, DANFE):
    - VALOR TOTAL (total_amount): O valor monetário total NUNCA deve ser retornado como 0 ou nulo se houver valores legíveis no documento.
      Busque com prioridade máxima o campo "VALOR TOTAL DA NOTA", "VALOR TOTAL DOS PRODUTOS", "VALOR TOTAL DOS SERVIÇOS", "TOTAL A PAGAR" ou "VALOR LÍQUIDO".
    - FORNECEDOR / EMITENTE (counterparty_name): Extraia a Razão Social ou Nome Fantasia da empresa que emitiu o documento fiscal (quadro "EMITENTE", "PRESTADOR DE SERVIÇOS" ou cabeçalho da nota). NUNCA utilize termos de forma de pagamento (como "Cartão", "Boleto", "Pix", "Parcela") como nome de fornecedor!
    - DATA DE EMISSÃO (issue_date): Extraia a data de emissão impressa no documento fiscal (YYYY-MM-DD).
    - DATA DE VENCIMENTO (due_date): Se a nota tiver quadro de faturas/duplicatas, capture o vencimento. Se não tiver vencimento explícito, preencha com a data de emissão.`,
      });

      let promptText = `Analise este documento fiscal/financeiro e retorne os dados contábeis estruturados.
REGRA MANDATÓRIA DE CLASSIFICAÇÃO: Se a imagem contiver logotipo ou nome de banco ("Banrisul", "Bradesco", "Itaú", "Banco do Brasil", "Caixa", "Santander", "Sicoob", "Sicredi", "Inter", etc.), código de banco (ex: "041-8"), "Recibo do Pagador", "Ficha de Compensação", "Local de Pagamento", "Nosso Número", "Vencimento" e "Valor do Documento", defina OBRIGATORIAMENTE doc_type = "boleto" e has_boleto_layout = true. NUNCA classifique um boleto bancário como "nfe" ou "nfse", mesmo que cite número de Nota Fiscal!`;
      if (userInstruction && userInstruction.trim().length > 0) {
        promptText += `\n\nLEGENDA / INSTRUÇÃO DO USUÁRIO ENVIADA JUNTO AO DOCUMENTO:\n"${userInstruction.trim()}"\nConsidere com máxima prioridade as instruções do usuário acima (ex: parcelamento, divisão de valores, condição de pagamento).`;
      }

      const geminiResp = await model.generateContent([
        {
          inlineData: {
            data: fileBufferBase64,
            mimeType: mimeType || 'image/jpeg',
          },
        },
        {
          text: promptText,
        },
      ]);

      const rawJson = geminiResp.response.text();
      const result = JSON.parse(rawJson) as ExtractedDocumentData;

      if (!result.counterparty && result.counterparty_name) {
        result.counterparty = result.counterparty_name;
      }

      // Garantias pós-processamento para Boletos Bancários e códigos de barras
      if (!result.barcode_or_pix && result.digitable_line) {
        result.barcode_or_pix = result.digitable_line;
      } else if (!result.barcode_or_pix && result.barcode) {
        result.barcode_or_pix = result.barcode;
      }
      if (!result.digitable_line && result.barcode_or_pix) {
        result.digitable_line = result.barcode_or_pix;
      }
      if (!result.barcode && result.barcode_or_pix) {
        result.barcode = result.barcode_or_pix;
      }

      // TRAVA DETERMINÍSTICA POR CÓDIGO (Ignora alucinação de doc_type se houver marcadores de boleto)
      const rawTextUpper = (
        (result.counterparty || result.counterparty_name || '') + ' ' +
        (result.raw_ocr_text || '') + ' ' +
        (result.notes || result.critical_notes || '') + ' ' +
        (result.bank_name || '')
      ).toUpperCase();

      // Lista determinística de bancos e termos exclusivos de boletos
      const BOLETO_STRONG_MARKERS = [
        'BANRISUL', '041-8', '0418',
        'BRADESCO', '237-2',
        'ITAU', 'ITAÚ', '341-7',
        'BANCO DO BRASIL', '001-9',
        'CAIXA ECONOMICA', 'CAIXA ECONÔMICA', '104-0',
        'SANTANDER', '033-7',
        'SICOOB', '756',
        'SICREDI', '748',
        'RECIBO DO PAGADOR',
        'FICHA DE COMPENSAÇÃO',
        'FICHA DE COMPENSACAO',
        'AUTENTICAÇÃO MECÂNICA',
        'AUTENTICACAO MECANICA',
        'LINHA DIGITÁVEL',
        'LINHA DIGITAVEL'
      ];

      const hasBoletoMarker = BOLETO_STRONG_MARKERS.some((marker) => rawTextUpper.includes(marker));

      // FORÇAR CLASSIFICAÇÃO: Se tem marca de banco ou linha digitável, NUNCA pode ser Nota Fiscal
      if (hasBoletoMarker || result.barcode || result.digitable_line || result.barcode_or_pix || result.has_boleto_layout) {
        if (result.doc_type !== 'das_mei' || hasBoletoMarker) {
          result.doc_type = 'boleto';
        }
      }

      return result;
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini Extract Doc] Falha com ${modelName}, tentando próximo modelo:`, err);
    }
  }

  throw lastError || new Error('Falha ao analisar documento com Gemini.');
}

/**
 * Mensagem proativa e humanizada enviada quando a imagem não contiver dados contábeis legíveis
 * ou for classificada como não financeira. Orienta reenvio ou registro por voz.
 */
export const UNREADABLE_OR_NON_FINANCIAL_DOC_MESSAGE = `⚠️ *Não consegui ler os dados deste documento com nitidez.*

Se você tirou foto de uma tela ou o papel ficou distante, tente tirar uma foto mais de perto e enquadrada.

💡 *Você também pode lançar rapidinho por voz:*
🎙️ Mande um áudio dizendo: *"Paguei [valor] em [onde/o que] hoje"* ou *"Boleto de [valor] para o dia [data]"*.

Se tiver a foto da nota, cupom fiscal ou comprovante Pix, é só me enviar aqui!`;

/**
 * Avalia se o documento extraído pelo Gemini possui dados financeiros reais e texto extraível.
 * Retorna false se o documento for foto ilegível, não contábil, meme ou sem dados mínimos de valor/código.
 */
export function isDocumentReadableAndFinancial(doc: ExtractedDocumentData): boolean {
  if (!doc) return false;
  if (doc.is_financial_doc === false) return false;
  if (doc.is_bank_statement) return true;

  const rawText = (doc.raw_ocr_text || '').trim();
  const amount = Number(doc.total_amount || 0);
  const hasValidAmount = amount > 0;
  const hasBarcodeOrPix = Boolean(doc.barcode_or_pix || doc.digitable_line || doc.barcode || doc.pix_code || doc.pix_key);
  const hasInstallments = Boolean(doc.installments && doc.installments.length > 0);
  const hasCounterparty = Boolean(
    doc.counterparty_name &&
    doc.counterparty_name !== 'Desconhecido' &&
    doc.counterparty_name !== 'Fornecedor' &&
    doc.counterparty_name.trim().length > 0
  );

  // Se não tem valor, não tem código de barras/pix e não possui parcelas
  if (!hasValidAmount && !hasBarcodeOrPix && !hasInstallments) {
    return false;
  }

  // Se não tem texto algum extraído e não possui código de barras/pix
  if (!rawText && !hasBarcodeOrPix) {
    return false;
  }

  // Se foi classificado como outro, sem valor e sem contraparte válida
  if (doc.doc_type === 'outro' && !hasValidAmount && !hasBarcodeOrPix && !hasCounterparty) {
    return false;
  }

  // Se a pontuação de confiança for mínima (ex: foto borrada/ruído) e não houver valor nem código
  if ((doc.confidence_score ?? 1) < 0.3 && !hasValidAmount && !hasBarcodeOrPix) {
    return false;
  }

  return true;
}

/**
 * Sanitiza o nome do favorecido/fornecedor removendo ruídos de IA e textos metalinguísticos
 */
export function cleanSupplierName(raw: any): string {
  if (!raw || typeof raw !== 'string') return 'Fornecedor';
  let cleaned = raw.trim();

  // Se o modelo inseriu delimitadores técnicos ("/" ou ";")
  if (cleaned.includes('/')) {
    cleaned = cleaned.split('/')[0].trim();
  }
  if (cleaned.includes(';')) {
    cleaned = cleaned.split(';')[0].trim();
  }

  // Remove termos em inglês típicos de alucinação de LLM
  cleaned = cleaned.replace(/\b(primary supplier|processed first|standard output|compatibility check|internal evaluation|pipeline|baseline|setup sequence|validation|payload|json format|result generation|system process|finish logic|output done)\b/gi, '').trim();

  // Limpa pontuações estranhas no início e no final
  cleaned = cleaned.replace(/^[-:,\s]+|[-:,\s]+$/g, '').trim();

  if (cleaned.length > 50) {
    cleaned = cleaned.slice(0, 50).trim();
  }

  return cleaned || 'Fornecedor';
}

/**
 * 2. Análise e Extração de Lançamentos Financeiros Conversacionais (Texto ou Áudio Transcrito)
 * Identifica se é Conta a Pagar (payable) ou Conta a Receber (receivable)
 * e extrai cada compromisso citado pelo usuário para a lista de lançamentos.
 */
export async function parseConversationalFinancialEntry(
  userText: string,
  referenceDateStr: string = new Date().toISOString().split('T')[0]
) {
  // PROIBIÇÃO ESTRITA: Verbos de baixa/liquidação ("baixar", "dar baixa", "liquidar", "paguei", "quitei", "recebi", "recebido")
  // NUNCA podem ser desviados para extração de novo lançamento (NEW_ENTRY) ou perguntas de preenchimento de campos!
  if (isSettlementVerbMessage(userText)) {
    return {
      is_financial_entry: false,
      entries: [],
      needs_clarification: false,
      clarification_prompt: null,
    };
  }

  const genAI = getGeminiClient();
  const candidateModels = ['gemini-3-flash-preview', 'gemini-3.5-flash', 'gemini-3.1-flash-lite-preview'];
  let lastError: any = null;

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: ({
            type: SchemaType.OBJECT,
            properties: {
              is_financial_entry: {
                type: SchemaType.BOOLEAN,
                description: 'True se a mensagem indicar intenção de registrar contas, despesas ou receitas.',
              },
              entries: {
                type: SchemaType.ARRAY,
                description: 'Lista com TODOS os compromissos financeiros citados na mensagem.',
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    supplier_or_customer: {
                      type: SchemaType.STRING,
                      description: 'Nome limpo e curto da empresa, favorecido ou compromisso em português (ex: "Contabilivre", "Vivo", "CPFL Piratininga", "Sabesp", "Pensão Alimentícia", "Empréstimo Irmão"). NUNCA use textos em inglês ou explicações técnicas.',
                    },
                    amount: {
                      type: SchemaType.NUMBER,
                      description: 'Valor monetário numérico em reais (ex: 170.0, 90.0, 85.0, 1200.0, 500.0)',
                      nullable: true,
                    },
                    due_date: {
                      type: SchemaType.STRING,
                      description: 'Data de vencimento no formato YYYY-MM-DD calculada a partir de hoje',
                      nullable: true,
                    },
                    entry_type: {
                      type: SchemaType.STRING,
                      enum: ['payable', 'receivable'],
                      description: 'payable para contas a pagar/despesas/obrigações, receivable para recebimentos',
                    },
                    category_suggestion: {
                      type: SchemaType.STRING,
                      description: 'Categoria DRE simples em português (ex: contabilidade, telecomunicacoes, energia, agua, pessoal)',
                      nullable: true,
                    },
                    is_provision: {
                      type: SchemaType.BOOLEAN,
                      description: 'True se for valor estimado, variável ou aproximado (ex: energia variável)',
                    },
                    is_recurring: {
                      type: SchemaType.BOOLEAN,
                      description: 'True se for conta recorrente mensal (todo mês, todo dia X)',
                    },
                    recurrence_day: {
                      type: SchemaType.INTEGER,
                      description: 'Dia do mês do vencimento (ex: 10, 21, 3)',
                      nullable: true,
                    },
                    barcode_or_pix: {
                      type: SchemaType.STRING,
                      description: 'Código de barras numérico (linha digitável com 44-48 dígitos ou números ditados) ou chave Pix citada por voz se houver.',
                      nullable: true,
                    },
                  },
                  required: ['supplier_or_customer', 'entry_type', 'is_provision'],
                },
              },
              needs_clarification: {
                type: SchemaType.BOOLEAN,
                description: 'True apenas se o usuário quis registrar uma conta mas não informou nenhum dado essencial e não for provisão.',
              },
              clarification_prompt: {
                type: SchemaType.STRING,
                description: 'Mensagem curta e acolhedora em português solicitando os dados faltantes.',
                nullable: true,
              },
            },
            required: ['is_financial_entry', 'entries', 'needs_clarification'],
          } as any),
        },
        systemInstruction: `Você é o parceiro de trincheira financeiro do AnalisAí Solo.
Data de referência de hoje: ${referenceDateStr}.
IDIOMA OBRIGATÓRIO: Português do Brasil.
PROIBIÇÃO RIGOROSA: NUNCA gere textos em inglês, comentários de código, justificativas de sistema ou metadados de compatibilidade nos campos de saída.

OBJETIVO:
O usuário enviou uma mensagem de texto ou transcrição de áudio listando seus compromissos financeiros.
Ele pode citar 1, 2, 3, 4, 5, 6 ou mais contas no mesmo áudio ou texto!
Você DEVE identificar e incluir CADA UMA das contas citadas como um item individual dentro da lista 'entries'.

REGRAS PARA CADA ITEM EM 'entries':
1. 'supplier_or_customer': Nome LIMPO, DIRETO e CURTO em português do favorecido ou compromisso.
   Exemplos: "Contabilivre", "Vivo", "CPFL Piratininga", "Sabesp", "Pensão Alimentícia", "Cartão de Crédito".
   NUNCA adicione frases longas, explicações ou termos em inglês como "primary supplier" ou "standard output".
2. 'amount': Valor numérico em reais (ex: 170, 90, 85, 1200, 500). Se for aproximado ("uns 90 reais", "valor aproximado"), use o valor citado e marque is_provision = true.
   REGRA VITAL DE VALOR: Se o usuário NÃO informou o valor na frase (ex: "parcelado em 10x no cartão a começar em janeiro"), deixe amount = null e MARQUE OBRIGATORIAMENTE needs_clarification = true!
3. 'due_date': Data no formato YYYY-MM-DD calculada com rigor a partir de ${referenceDateStr}:
   - NUNCA invente anos do passado (como 2024, 2023, 2022).
   - Se disser "todo dia 10", "dia 10": se o dia 10 já passou ou é hoje em ${referenceDateStr}, use o dia 10 do mês seguinte; senão use o mês atual.
   - Se disser "todo dia 21", "dia 21": se dia 21 já passou em ${referenceDateStr}, use o dia 21 do mês seguinte; senão use o mês atual.
   - Se disser "todo dia 3", "dia 3": se dia 3 já passou em ${referenceDateStr}, use o dia 3 do mês seguinte; senão use o mês atual.
   - Se disser "a começar em janeiro", "a partir de janeiro", "em janeiro": como hoje estamos no ano de ${referenceDateStr}, se o mês citado (janeiro) for anterior ao mês atual, o vencimento é no ano seguinte (ex: 2027). Se o usuário não disser o dia exato (ex: dia 10, dia 20), deixe due_date = null e marque needs_clarification = true para perguntar o dia do vencimento da fatura!
4. 'entry_type': 'payable' para contas a pagar/despesas, 'receivable' para receitas.
5. 'is_provision': true para valores aproximados ou contas de consumo variáveis; false para valores fixos definidos.
6. 'is_recurring': true para contas pagas mensalmente ("todo mês", "todo dia X").
7. 'recurrence_day': número do dia informado (ex: 10, 21, 3).
8. 'barcode_or_pix': Se o usuário ditar ou escrever um código de barras, linha digitável ou chave Pix (ex: "com código de barras 8467...", "chave pix CNPJ tal"), extraia no campo barcode_or_pix de cada conta correspondente apenas os dígitos ou chave limpa.
9. CLARIFICAÇÃO PRÓ-ATIVA (needs_clarification):
   Se o usuário quer lançar uma compra parcelada ou despesa mas faltou o valor ou o dia do vencimento, defina needs_clarification = true e elabore em clarification_prompt uma pergunta curta, acolhedora e direta em português perguntando os dados faltantes.
10. INTENÇÃO DE CADASTRO/LANÇAMENTO SEM DADOS COMPLETOS (ex: "quero inserir uma conta a pagar", "preciso cadastrar uma conta", "como lanço uma conta", "quero lançar uma despesa"):
   Marque is_financial_entry = true, needs_clarification = true e em clarification_prompt envie:
   "Com certeza! Para eu registrar sua conta a pagar, me diz: quem é o fornecedor, qual o valor e qual a data de vencimento? Se já foi paga ou se foi parcelada, me avisa também. Pode me mandar tudo em texto ou áudio!"
11. INTENÇÃO DE CADASTRO DE CONTAS A RECEBER / RECEITAS (ex: "lista de contas a receber", "contas a receber na próxima semana", "quero cadastrar uma receita", "tenho a receber", "considerei dia 31/10"):
   - Se citou clientes, valores e datas, extraia cada item em 'entries' com entry_type: 'receivable'.
   - Se o usuário anunciou a intenção de contas a receber ou citou a data (ex: "lista de contas a receber nesta próxima semana, considerei dia 31/10") mas faltou os clientes ou valores, marque is_financial_entry = true, needs_clarification = true e em clarification_prompt envie:
     "Perfeito! Identifiquei suas contas a receber para 31/10. Quais são os clientes e os respectivos valores que você tem a receber? Pode me falar por áudio ou texto que eu organizo tudo!"`,
      });

      const result = await model.generateContent(`Mensagem do usuário: "${userText}"`);
      const parsed = JSON.parse(result.response.text());

      // Normaliza e higieniza cada entrada de 'entries'
      const normalizedEntries: any[] = [];
      if (Array.isArray(parsed.entries)) {
        for (const item of parsed.entries) {
          const cleanName = cleanSupplierName(item.supplier_or_customer);
          if (cleanName && cleanName !== 'Fornecedor' || item.amount || item.due_date) {
            normalizedEntries.push({
              supplier_or_customer: cleanName,
              amount: item.amount ? Number(item.amount) : null,
              due_date: item.due_date || null,
              barcode_or_pix: item.barcode_or_pix ? String(item.barcode_or_pix).trim() : null,
              entry_type: item.entry_type || 'payable',
              category_suggestion: item.category_suggestion || 'despesa_administrativa',
              is_provision: Boolean(item.is_provision),
              is_recurring: Boolean(item.is_recurring),
              recurrence_day: item.recurrence_day || null,
            });
          }
        }
      }

      parsed.entries = normalizedEntries;

      const hasValidAmount = normalizedEntries.some((e) => e.amount && Number(e.amount) > 0);

      if (parsed.entries.length > 0) {
        parsed.is_financial_entry = true;
        const first = parsed.entries[0];
        parsed.supplier_or_customer = first.supplier_or_customer;
        parsed.amount = first.amount;
        parsed.due_date = first.due_date;
        parsed.entry_type = first.entry_type;
        parsed.category_suggestion = first.category_suggestion;
        parsed.is_provision = first.is_provision;

        // Se NÃO há valor monetário válido em nenhuma entrada, OBRIGA clarification
        if (!hasValidAmount) {
          parsed.needs_clarification = true;
          if (!parsed.clarification_prompt) {
            const entity = first.supplier_or_customer || 'sua compra';
            parsed.clarification_prompt = `Identifiquei o lançamento de *${entity}*, mas não encontrei o valor da compra. Qual é o valor total ou de cada parcela?`;
          }
        }
      }

      return parsed;
    } catch (err) {
      lastError = err;
      console.warn(`[Gemini Parse Entry] Falha com ${modelName}, tentando próximo:`, err);
    }
  }

  throw lastError || new Error('Falha ao interpretar mensagem financeira com Gemini.');
}
export async function processVoiceCommandWithGemini(
  audioBase64: string,
  mimeType: string = 'audio/ogg; codecs=opus',
  contextText: string = '',
  transcribeOnly: boolean = false
) {
  const genAI = getGeminiClient();

  const functionDeclarations = [
    {
      name: 'list_bills',
      description: 'Invocada quando o cliente quer consultar, listar ou ver suas contas a pagar cadastradas, contas a vencer ou contas vencidas.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          filter: {
            type: SchemaType.STRING,
            description: '"all" para todas as contas em aberto, "overdue" para apenas vencidas, ou "upcoming" para a vencer.',
          },
        },
      },
    },
    {
      name: 'propose_amount_change',
      description: 'Invocada quando o cliente pede para alterar, mudar ou atualizar o VALOR monetário (em R$) de uma conta a pagar cadastrada. (Ex: "mudar valor da Sabesp para 85,00" ou "Sabesp alterar para 85 reais")',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          supplier_name: {
            type: SchemaType.STRING,
            description: 'Nome do fornecedor ou identificador da conta (ex: Sabesp, Copel, Vivo, etc.)',
          },
          new_amount: {
            type: SchemaType.NUMBER,
            description: 'Novo valor numérico em reais (ex: 85.00 ou 85.45)',
          },
        },
        required: ['supplier_name', 'new_amount'],
      },
    },
    {
      name: 'propose_due_date_change',
      description: 'Invocada quando o cliente pede para alterar, adiar ou prorrogar a DATA DE VENCIMENTO de uma conta a pagar cadastrada. NÃO usar quando o pedido for para mudar o VALOR monetário.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          supplier_name: {
            type: SchemaType.STRING,
            description: 'Nome do fornecedor ou palavra-chave identificadora (ex: Copel, Vivo, Sabesp, Aluguel)',
          },
          target_date: {
            type: SchemaType.STRING,
            description: 'Nova data solicitada. Se o cliente falar apenas "dia 25" ou "25", preencha com a data no formato YYYY-MM-DD do mês atual (ex: 2026-09-25)',
          },
          reason: {
            type: SchemaType.STRING,
            description: 'Motivo informado pelo cliente, se houver',
          },
        },
        required: ['supplier_name', 'target_date'],
      },
    },
    {
      name: 'request_cash_flow_postpone_advice',
      description: 'Invocada quando o cliente relata aperto de caixa e pede recomendação de qual conta deve postergar.',
      parameters: {
        type: SchemaType.OBJECT,
        properties: {
          available_cash: {
            type: SchemaType.NUMBER,
            description: 'Saldo monetário em caixa que o cliente possui no momento',
          },
        },
      },
    },
    {
      name: 'get_plan_consumption',
      description: 'Invocada quando o cliente quer consultar o consumo do seu plano no mês.',
    },
    {
      name: 'request_human_consultant',
      description: 'Invocada quando o cliente pede para falar com um consultor humano ou especialista.',
    },
    {
      name: 'request_cash_ledger_pdf',
      description: 'Invocada quando o cliente solicita o envio do relatório financeiro, livro caixa ou extrato em PDF.',
    },
    {
      name: 'consult_tax_meter',
      description: 'Invocada quando o usuário pergunta sobre limite de faturamento anual, teto de MEI ou Simples Nacional, margem de segurança fiscal ou termômetro tributário (ex: "como está meu limite de MEI?", "quanto posso faturar no Simples?", "ver termômetro fiscal", "risco de desenquadramento").',
    },
  ];

  // Limpa o MIME type para o formato estrito aceito pelo Google (ex: 'audio/ogg')
  let cleanMime = mimeType ? mimeType.split(';')[0].trim().toLowerCase() : 'audio/ogg';
  if (cleanMime === 'audio/opus') cleanMime = 'audio/ogg';
  const cleanBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '').trim();

  // Lista de modelos com suporte nativo a áudio multimodal
  const modelsToTry = [
    'gemini-3-flash-preview',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite-preview',
  ];
  let transcribedText = '';
  const attemptedErrors: string[] = [];

  // ETAPA 1: Transcrição pura do áudio (sem tools na chamada multimodal para evitar incompatibilidade da API)
  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent([
        {
          inlineData: {
            data: cleanBase64,
            mimeType: cleanMime,
          },
        },
        {
          text: 'Transcreva com precisão o que foi falado neste áudio em português do Brasil. Retorne estritamente o texto falado, sem introduções, aspas ou explicações adicionais.',
        },
      ]);

      const txt = result.response.text();
      if (txt && txt.trim()) {
        transcribedText = txt.trim();
        console.log(`[Voice Gemini Transcription] Sucesso com ${modelName}: "${transcribedText}"`);
        break;
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      console.warn(`[Voice Gemini Transcription] Falha com ${modelName}:`, msg);
      attemptedErrors.push(`[${modelName}]: ${msg}`);
    }
  }

  if (!transcribedText) {
    throw new Error(
      `Não foi possível transcrever o áudio com os modelos disponíveis.\nModelos testados:\n${attemptedErrors.join('\n')}`
    );
  }

  console.log('[Voice Command] Áudio transcrito com sucesso:', transcribedText);

  // Se a chamada requereu apenas a transcrição do áudio (ex: degustação trial ou parsing direto), retorna imediatamente
  if (transcribeOnly) {
    return {
      functionCalls: [],
      textResponse: transcribedText,
    };
  }

  // ETAPA 2: Interpretação da intenção e extração de parâmetros sobre o texto transcrito
  let functionCalls: any[] = [];
  const lower = transcribedText.toLowerCase();

  // 1. Consulta / Listagem de Contas a Pagar por Voz
  if (
    lower.includes('contas cadastradas') ||
    lower.includes('contas a vencer') ||
    lower.includes('contas vencidas') ||
    lower.includes('mostrar contas') ||
    lower.includes('mostre as contas') ||
    lower.includes('mostrar as contas') ||
    lower.includes('mostre-me todas as contas') ||
    lower.includes('listar contas') ||
    lower.includes('quais contas') ||
    lower.includes('todas as contas') ||
    (lower.includes('contas') && (lower.includes('vencer') || lower.includes('vencida')))
  ) {
    let filter = 'all';
    if (lower.includes('vencida') && !lower.includes('a vencer')) filter = 'overdue';
    else if (lower.includes('a vencer') && !lower.includes('vencida')) filter = 'upcoming';

    functionCalls.push({
      name: 'list_bills',
      args: { filter },
    });

    return {
      functionCalls,
      textResponse: transcribedText,
    };
  }

  // 2. Alteração de VALOR de Conta por Voz (ex: "mudar valor da Sabesp para 85,00" ou "alterar valor Sabesp para 85")
  const amountMatch =
    lower.match(/(?:mudar|alterar|corrigir|trocar)\s+(?:o\s+)?valor\s+(?:d[ao]\s+)?([a-z0-9\s]+?)\s+(?:de\s+[\d.,]+\s+)?para\s+([0-9.,]+)/i) ||
    lower.match(/([a-z0-9\s]+?)[,;\s]+(?:mudar|alterar|corrigir)\s+valor\s+(?:de\s+[\d.,]+\s+)?para\s+([0-9.,]+)/i) ||
    lower.match(/(?:mudar|alterar)\s+([a-z0-9\s]+?)\s+para\s+([0-9.,]+)\s+reais/i);

  if (amountMatch) {
    const rawSupplier = amountMatch[1].replace(/^(conta\s+d[ao]|fornecedor\s+d[ao]|conta)\s+/i, '').trim();
    const rawValStr = amountMatch[2].replace(/\./g, '').replace(',', '.');
    const parsedVal = parseFloat(rawValStr);
    if (!isNaN(parsedVal) && parsedVal > 0 && rawSupplier.length >= 2) {
      functionCalls.push({
        name: 'propose_amount_change',
        args: {
          supplier_name: rawSupplier,
          new_amount: parsedVal,
        },
      });

      return {
        functionCalls,
        textResponse: transcribedText,
      };
    }
  }

  // 3. Alteração de DATA DE VENCIMENTO por Voz (ex: "mudar vencimento da Copel para dia 25")
  if (
    (lower.includes('vencimento') || lower.includes('adiar') || lower.includes('postergar') || lower.includes('prorrogar') || lower.includes('passar')) &&
    !lower.includes('valor')
  ) {
    const supplierMatch = lower.match(/(?:conta|fornecedor|do|da)\s+([a-z0-9\s]+?)\s+(?:para|pro|dia)/i);
    let sup = supplierMatch ? supplierMatch[1].trim() : '';
    const matchDay = lower.match(/(?:dia|para)\s*(\d{1,2})/);
    let tDate = matchDay ? `2026-09-${matchDay[1].padStart(2, '0')}` : '2026-09-25';

    if (sup.length >= 2) {
      functionCalls.push({
        name: 'propose_due_date_change',
        args: {
          supplier_name: sup,
          target_date: tDate,
        },
      });

      return {
        functionCalls,
        textResponse: transcribedText,
      };
    }
  }

  // 4. Consultor de Caixa por Voz
  if (
    lower.includes('atrasar') ||
    lower.includes('postergar') ||
    lower.includes('sem dinheiro') ||
    lower.includes('qual conta') ||
    lower.includes('aperto')
  ) {
    functionCalls.push({
      name: 'request_cash_flow_postpone_advice',
      args: {},
    });

    return {
      functionCalls,
      textResponse: transcribedText,
    };
  }

  // 5. Pedido de PDF / Livro Caixa por Voz
  if (
    lower.includes('pdf') ||
    lower.includes('relatório') ||
    lower.includes('relatorio') ||
    lower.includes('livro caixa') ||
    lower.includes('extrato')
  ) {
    functionCalls.push({
      name: 'request_cash_ledger_pdf',
      args: {},
    });

    return {
      functionCalls,
      textResponse: transcribedText,
    };
  }

  // 6. Gemini Flash com Function Calling para extração precisa
  try {
    const textModel = genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      tools: [{ functionDeclarations: functionDeclarations as any }],
      systemInstruction: `Você é o assistente financeiro do AnalisAí Solo.
Classifique o comando do usuário e acione a ferramenta correta.
Se o usuário pedir para listar contas, acione list_bills.
Se pedir para mudar o valor em dinheiro, acione propose_amount_change com supplier_name e new_amount.
Se pedir para adiar ou prorrogar a data, acione propose_due_date_change com supplier_name e target_date.
Data de referência: 2026-09-19.`,
    });

    const textResult = await textModel.generateContent(`Comando do cliente: "${transcribedText}"`);
    const calls = textResult.response.functionCalls();
    if (calls && calls.length > 0) {
      functionCalls = calls;
    }
  } catch (textErr) {
    console.warn('[Voice Text Intent] Falha no function calling de texto:', textErr);
  }

  return {
    functionCalls,
    textResponse: transcribedText,
  };
}

export interface SupplierRenameAction {
  current_name_query: string;
  new_name: string;
}

export interface AmountChangeAction {
  supplier_query: string;
  new_amount: number;
}

export interface DueDateChangeAction {
  supplier_query: string;
  new_due_date_raw: string;
}

export interface ConversationalCorrectionsResult {
  has_corrections: boolean;
  renames: SupplierRenameAction[];
  amount_changes: AmountChangeAction[];
  due_date_changes: DueDateChangeAction[];
}

/**
 * Interpreta pedidos em linguagem natural para corrigir ou editar dados de contas já cadastradas.
 * Identifica renomeações de fornecedores/favorecidos, alterações de valor e de vencimento.
 * Exemplo: "onde está Contalivre da contabilidade é Contabilivre, onde está Julia Facundo é Julia Faco Guion de Paula"
 */
export async function parseConversationalCorrections(
  userText: string
): Promise<ConversationalCorrectionsResult> {
  const genAI = getGeminiClient();
  const candidateModels = ['gemini-3-flash-preview', 'gemini-3.5-flash', 'gemini-3.1-flash-lite-preview'];

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: ({
            type: SchemaType.OBJECT,
            properties: {
              has_corrections: {
                type: SchemaType.BOOLEAN,
                description: 'True se a mensagem solicita correção, alteração ou edição de nomes de fornecedores, valores ou datas de contas existentes.',
              },
              renames: {
                type: SchemaType.ARRAY,
                description: 'Lista de correções de nome de fornecedor/favorecido (ex: de X para Y, onde está X é Y, mudar nome de X para Y).',
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    current_name_query: {
                      type: SchemaType.STRING,
                      description: 'Nome atual ou trecho citado para busca (ex: "Contalivre", "Julia Facundo", "Persi")',
                    },
                    new_name: {
                      type: SchemaType.STRING,
                      description: 'Novo nome correto desejado (ex: "Contabilivre", "Julia Faco Guion de Paula", "Perci")',
                    },
                  },
                  required: ['current_name_query', 'new_name'],
                },
              },
              amount_changes: {
                type: SchemaType.ARRAY,
                description: 'Lista de alterações de valor solicitadas.',
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    supplier_query: {
                      type: SchemaType.STRING,
                      description: 'Nome da conta ou fornecedor',
                    },
                    new_amount: {
                      type: SchemaType.NUMBER,
                      description: 'Novo valor numérico em reais',
                    },
                  },
                  required: ['supplier_query', 'new_amount'],
                },
              },
              due_date_changes: {
                type: SchemaType.ARRAY,
                description: 'Lista de alterações de data de vencimento solicitadas.',
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    supplier_query: {
                      type: SchemaType.STRING,
                      description: 'Nome da conta ou fornecedor',
                    },
                    new_due_date_raw: {
                      type: SchemaType.STRING,
                      description: 'Nova data informada (ex: "10", "15/10", "dia 20")',
                    },
                  },
                  required: ['supplier_query', 'new_due_date_raw'],
                },
              },
            },
            required: ['has_corrections', 'renames', 'amount_changes', 'due_date_changes'],
          } as any),
        },
        systemInstruction: `Você é o analisador de correções e edições financeiras do assistente AnalisAí.
Sua missão é extrair exatamente quais contas o usuário deseja editar ou corrigir.
Preste muita atenção em expressões brasileiras como:
- "onde está X é Y" / "onde tá X coloca Y" -> renomear X para Y.
- "Persi com S é Persi com C" -> current_name_query: "Persi", new_name: "Perci".
- "Contalivre da contabilidade é Contabilivre" -> current_name_query: "Contalivre", new_name: "Contabilivre".
- "mudar valor de X para R$ Y" -> amount_change.
- "mudar vencimento de X para dia Y" -> due_date_change.
Se a mensagem for apenas um novo lançamento ou bate-papo, retorne has_corrections: false com arrays vazios.`,
      });

      const res = await model.generateContent(`Mensagem do usuário: "${userText}"`);
      const txt = res.response.text();
      const parsed = JSON.parse(txt);

      return {
        has_corrections: Boolean(parsed.has_corrections),
        renames: Array.isArray(parsed.renames) ? parsed.renames : [],
        amount_changes: Array.isArray(parsed.amount_changes) ? parsed.amount_changes : [],
        due_date_changes: Array.isArray(parsed.due_date_changes) ? parsed.due_date_changes : [],
      };
    } catch (err) {
      console.warn(`[parseConversationalCorrections] Erro no modelo ${modelName}:`, err);
    }
  }

  return {
    has_corrections: false,
    renames: [],
    amount_changes: [],
    due_date_changes: [],
  };
}

export interface InvoicePaymentResolution {
  is_understood: boolean;
  needs_clarification?: boolean;
  clarification_question?: string | null;
  payment_condition: 'already_paid' | 'installments' | 'future_single';
  payment_method: 'credit_card' | 'pix' | 'debit_card' | 'cash' | 'boleto' | 'transfer' | 'other';
  total_amount: number;
  total_installments: number;
  paid_installments_count: number;
  remaining_installments_count: number;
  installment_amount: number;
  paid_amount: number;
  remaining_amount: number;
  first_upcoming_due_date?: string | null;
  paid_date?: string | null;
  upcoming_installments: Array<{
    installment_number: number;
    amount: number;
    due_date: string;
  }>;
  past_installments: Array<{
    installment_number: number;
    amount: number;
    paid_date: string;
  }>;
  summary_explanation: string;
  category_override?: string | null;
}

/**
 * 6. Interpretador Consultivo Preditivo de Pagamento de Nota Fiscal em Linguagem Natural
 * Analisa respostas de voz ou texto sobre quitação, parcelamento, início dos pagamentos e parcelas passadas/futuras.
 */
export async function parseInvoicePaymentResolution(
  userText: string,
  invoiceContext: {
    total_amount: number;
    issue_date?: string | null;
    counterparty_name?: string | null;
    category_suggestion?: string | null;
    known_payment_method?: string | null;
    known_total_installments?: number | null;
    known_payment_condition?: string | null;
  }
): Promise<InvoicePaymentResolution> {
  const genAI = getGeminiClient();
  const candidateModels = ['gemini-3-flash-preview', 'gemini-3.5-flash', 'gemini-3.1-flash-lite-preview'];
  const todayStr = new Date().toISOString().split('T')[0];
  const totalAmount = Math.abs(Number(invoiceContext.total_amount || 0));
  const issueDateStr = invoiceContext.issue_date || todayStr;

  let knownContextNotes = '';
  if (invoiceContext.known_payment_method || invoiceContext.known_total_installments) {
    knownContextNotes = `
DADOS JÁ APURADOS EM MENSAGENS ANTERIORES DESTE MESMO DOCUMENTO:
- Método já informado: ${invoiceContext.known_payment_method || 'Não especificado'}
- Total de parcelas já informado: ${invoiceContext.known_total_installments || 'Não especificado'}
Combine a nova resposta do usuário com esses dados prévios sem esquecê-los.`;
  }

  for (const modelName of candidateModels) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: ({
            type: SchemaType.OBJECT,
            properties: {
              is_understood: {
                type: SchemaType.BOOLEAN,
                description: 'True se a fala do usuário fornece informações suficientes ou se identificou a intenção financeira sobre a forma de pagamento',
              },
              needs_clarification: {
                type: SchemaType.BOOLEAN,
                description: 'True se ainda faltam informações essenciais para registrar com segurança (ex: faltou o dia de vencimento da fatura do cartão; ou se a nota é de data passada e o usuário disse que começou em janeiro, mas não esclareceu se começou naquele ano passado ou no futuro, nem quantas parcelas já foram pagas).',
              },
              clarification_question: {
                type: SchemaType.STRING,
                description: 'Pergunta conversacional natural, empática, em português do Brasil, fazendo a pergunta exata necessária para obter o dado faltante de forma direta e acolhedora.',
                nullable: true,
              },
              payment_condition: {
                type: SchemaType.STRING,
                enum: ['already_paid', 'installments', 'future_single'],
                description: 'already_paid se já foi paga/quitada totalmente à vista. installments se foi parcelada em 2 ou mais vezes. future_single se é pagamento único a vencer no futuro.',
              },
              payment_method: {
                type: SchemaType.STRING,
                enum: ['credit_card', 'pix', 'debit_card', 'cash', 'boleto', 'transfer', 'other'],
                description: 'Forma ou método de pagamento mencionado pelo usuário',
              },
              total_installments: {
                type: SchemaType.INTEGER,
                description: 'Número total de parcelas da compra (ex: 10 para 10x, 1 para à vista)',
              },
              paid_installments_count: {
                type: SchemaType.INTEGER,
                description: 'Quantas parcelas já foram quitadas/pagas no passado (ex: se já pagou a 1ª, retorne 1; se não pagou nenhuma, retorne 0)',
              },
              remaining_installments_count: {
                type: SchemaType.INTEGER,
                description: 'Quantas parcelas faltam vencer e precisam ser provisionadas no contas a pagar futuro',
              },
              first_upcoming_due_date: {
                type: SchemaType.STRING,
                description: 'Data YYYY-MM-DD em que vencerá a próxima parcela a pagar (ou parcela única futura). NUNCA invente anos passados como 2024.',
                nullable: true,
              },
              paid_date: {
                type: SchemaType.STRING,
                description: 'Data YYYY-MM-DD do pagamento à vista ou do início das parcelas passadas',
                nullable: true,
              },
              summary_explanation: {
                type: SchemaType.STRING,
                description: 'Resumo amigável em português explicando o entendimento do AnalisAí (ex: "Compra parcelada em 10x no cartão, 8 já pagas e 2 a vencer a partir de 15/11")',
              },
              category_override: {
                type: SchemaType.STRING,
                description: 'Se o usuário mencionou categoria ou tipo de gasto específico na resposta',
                nullable: true,
              },
            },
            required: [
              'is_understood',
              'needs_clarification',
              'payment_condition',
              'payment_method',
              'total_installments',
              'paid_installments_count',
              'remaining_installments_count',
              'summary_explanation',
            ],
          } as any),
        },
        systemInstruction: `Você é o parceiro e consultor financeiro preditivo do AnalisAí.
Sua missão é dialogar de forma 100% natural, humana e acolhedora com o usuário para entender como uma Nota Fiscal foi ou será paga.

CONTEXTO DA NOTA FISCAL:
- Valor Total: R$ ${totalAmount.toFixed(2)}
- Data de Emissão da NF: ${issueDateStr}
- Fornecedor: ${invoiceContext.counterparty_name || 'Fornecedor'}
- Data Atual de Hoje: ${todayStr}${knownContextNotes}

DIRETRIZES DE INTELIGÊNCIA TEMPORAL E CONVERSAÇÃO NATURAL:
1. COMPRA JÁ QUITADA À VISTA:
   - Se o usuário disser que já pagou, pagou no Pix, no débito, em dinheiro, à vista, quitou no dia da nota ou hoje:
     - payment_condition = 'already_paid'
     - total_installments = 1
     - paid_installments_count = 1
     - remaining_installments_count = 0
     - needs_clarification = false
     - summary_explanation = "Compra quitada integralmente."

2. COMPRA PARCELADA (CARTÃO OU BOLETO):
   - Se o usuário disser que foi parcelada (ex: "em 10x no cartão", "foi parcelado no cartão em 10 vezes a começar em janeiro"):
     - payment_condition = 'installments'
     - total_installments = número de parcelas informado (ex: 10)
     - payment_method = 'credit_card' (ou 'boleto' se citado)

     ⚠️ ANÁLISE CRÍTICA DE TEMPORALIDADE E DATAS PASSADAS:
     a) Se a nota fiscal foi emitida no passado (ex: ano anterior como 2025 ou meses atrás) e o usuário disser "a começar em janeiro":
        Note que "janeiro" pode ter sido janeiro do ano da emissão (onde parcelas já foram pagas no passado) ou janeiro do ano futuro!
        Além disso, se ele não disse qual o dia do mês que vence a fatura do cartão:
        -> Defina needs_clarification = true
        -> Em clarification_question, pergunte com naturalidade e simpatia:
           "Entendi, 10x no cartão de crédito começando em janeiro! Como essa nota fiscal é de ${issueDateStr}, me confirma dois detalhezinhos rápidos:\n1️⃣ Esse parcelamento começou lá atrás em janeiro daquele ano e você já pagou alguma (ou várias) parcelas, ou vai começar a vencer agora?\n2️⃣ Qual o melhor dia em que costuma vencer a fatura do seu cartão (ex: dia 10, dia 15)?"
     
     b) Se o usuário informou o parcelamento, mas NÃO informou o dia do vencimento da fatura/parcela nem se já foi paga alguma:
        -> Defina needs_clarification = true
        -> clarification_question = "Perfeito, ${totalAmount > 0 ? `R$ ${totalAmount.toFixed(2)}` : ''} parcelado no cartão! Qual é o melhor dia do mês em que vence a fatura do seu cartão (ex: dia 10, dia 15) e se alguma parcela já foi paga no passado?"

     c) Se o usuário já esclareceu quantas parcelas já foram pagas e o dia de vencimento (ex: "começou em janeiro de 2025, já paguei 8 parcelas, vence dia 15" ou "já paguei 8, faltam 2, vence dia 15"):
        -> paid_installments_count = quantidade já paga (ex: 8)
        -> remaining_installments_count = total_installments - paid_installments_count (ex: 2)
        -> first_upcoming_due_date = calcule a data exata da próxima parcela a vencer no ano corrente/futuro a partir de ${todayStr} (ex: se hoje é outubro/2026 e vence dia 15, a próxima é 2026-11-15). NUNCA GERE ANOS PASSADOS (2024, 2023)!
        -> needs_clarification = false
        -> summary_explanation = "Parcelamento de 10x no cartão de crédito: 8 parcelas anteriores já quitadas no histórico e 2 parcelas restantes a vencer a partir do próximo vencimento."

3. COMPRA FATURADA A PRAZO (PARCELA ÚNICA):
   - Se disser "é boleto pra 30 dias", "vence dia 25 do mês que vem", "ainda não paguei, vence dia X":
     - payment_condition = 'future_single'
     - total_installments = 1
     - paid_installments_count = 0
     - remaining_installments_count = 1
     - Se o dia do vencimento foi informado: needs_clarification = false
     - Se não foi informado quando vence: needs_clarification = true, perguntando o dia do vencimento.

4. SE O USUÁRIO DISSER QUE JÁ QUITOU TODAS AS PARCELAS:
   - Se disser "já paguei todas", "já foi totalmente paga":
     - payment_condition = 'already_paid'
     - total_installments = invoiceContext.known_total_installments || 1
     - paid_installments_count = total_installments
     - remaining_installments_count = 0
     - needs_clarification = false

5. Responda estritamente no JSON do schema estruturado.`,
      });

      const res = await model.generateContent(`Resposta do usuário sobre o pagamento da Nota Fiscal: "${userText}"`);
      const txt = res.response.text();
      const parsed = JSON.parse(txt);

      const totalInsts = Math.max(1, Number(parsed.total_installments || invoiceContext.known_total_installments || 1));
      let paidCount = Math.min(totalInsts, Math.max(0, Number(parsed.paid_installments_count || 0)));
      let remainingCount = Math.max(0, totalInsts - paidCount);

      if (parsed.payment_condition === 'already_paid') {
        paidCount = totalInsts;
        remainingCount = 0;
      }

      // Cálculo matemático das parcelas
      const rawInstVal = Math.round((totalAmount / totalInsts) * 100) / 100;
      const totalRounded = rawInstVal * totalInsts;
      const diffCentavos = Math.round((totalAmount - totalRounded) * 100) / 100;

      // Base date para cálculo de datas futuras
      let baseUpcomingDateStr = parsed.first_upcoming_due_date;
      if (!baseUpcomingDateStr) {
        const d = new Date();
        d.setDate(d.getDate() + 30);
        baseUpcomingDateStr = d.toISOString().split('T')[0];
      }

      // Garante que a data futura nunca seja no passado
      if (baseUpcomingDateStr < todayStr) {
        const [pY, pM, pD] = baseUpcomingDateStr.split('-').map(Number);
        const [tY, tM, tD] = todayStr.split('-').map(Number);
        let correctedMonth = tM;
        let correctedYear = tY;
        if (pD <= tD) {
          correctedMonth += 1;
          if (correctedMonth > 12) {
            correctedMonth = 1;
            correctedYear += 1;
          }
        }
        baseUpcomingDateStr = `${correctedYear}-${String(correctedMonth).padStart(2, '0')}-${String(pD).padStart(2, '0')}`;
      }

      const [bYear, bMonth, bDay] = baseUpcomingDateStr.split('-').map(Number);

      const upcoming_installments: Array<{ installment_number: number; amount: number; due_date: string }> = [];
      for (let i = 0; i < remainingCount; i++) {
        const instNum = paidCount + i + 1;
        const targetMonth = bMonth - 1 + i;
        const dateObj = new Date(bYear, targetMonth, bDay || 1);
        const yStr = dateObj.getFullYear();
        const mStr = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dStr = String(dateObj.getDate()).padStart(2, '0');
        const dueDate = `${yStr}-${mStr}-${dStr}`;

        const isLastOfAll = instNum === totalInsts;
        const thisAmount = isLastOfAll ? Math.round((rawInstVal + diffCentavos) * 100) / 100 : rawInstVal;

        upcoming_installments.push({
          installment_number: instNum,
          amount: thisAmount,
          due_date: dueDate,
        });
      }

      const past_installments: Array<{ installment_number: number; amount: number; paid_date: string }> = [];
      const pastPaidBase = parsed.paid_date || issueDateStr;
      const [pYear, pMonth, pDay] = pastPaidBase.split('-').map(Number);

      for (let i = 0; i < paidCount; i++) {
        const instNum = i + 1;
        const targetMonth = pMonth - 1 + i;
        const dateObj = new Date(pYear, targetMonth, pDay || 1);
        const yStr = dateObj.getFullYear();
        const mStr = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dStr = String(dateObj.getDate()).padStart(2, '0');
        const pDate = `${yStr}-${mStr}-${dStr}`;

        const isLastOfAll = instNum === totalInsts;
        const thisAmount = isLastOfAll ? Math.round((rawInstVal + diffCentavos) * 100) / 100 : rawInstVal;

        past_installments.push({
          installment_number: instNum,
          amount: thisAmount,
          paid_date: pDate,
        });
      }

      const paidAmount = past_installments.reduce((acc, cur) => acc + cur.amount, 0);
      const remainingAmount = upcoming_installments.reduce((acc, cur) => acc + cur.amount, 0);

      return {
        is_understood: Boolean(parsed.is_understood),
        needs_clarification: Boolean(parsed.needs_clarification),
        clarification_question: parsed.clarification_question || null,
        payment_condition: parsed.payment_condition || 'installments',
        payment_method: parsed.payment_method || invoiceContext.known_payment_method || 'credit_card',
        total_amount: totalAmount,
        total_installments: totalInsts,
        paid_installments_count: paidCount,
        remaining_installments_count: remainingCount,
        installment_amount: rawInstVal,
        paid_amount: Math.round(paidAmount * 100) / 100,
        remaining_amount: Math.round(remainingAmount * 100) / 100,
        first_upcoming_due_date: upcoming_installments[0]?.due_date || parsed.first_upcoming_due_date || null,
        paid_date: parsed.paid_date || issueDateStr,
        upcoming_installments,
        past_installments,
        summary_explanation: parsed.summary_explanation || 'Condição de pagamento interpretada com sucesso.',
        category_override: parsed.category_override || null,
      };
    } catch (err) {
      console.warn(`[parseInvoicePaymentResolution] Erro no modelo ${modelName}:`, err);
    }
  }

  // Fallback padrão se todos os modelos falharem
  return {
    is_understood: false,
    needs_clarification: true,
    clarification_question: `Entendi que você enviou informações sobre a compra de R$ ${totalAmount.toFixed(2)}, mas não consegui identificar todos os detalhes. Poderia me confirmar se foi à vista ou parcelada, e para quando é o vencimento?`,
    payment_condition: 'installments',
    payment_method: 'other',
    total_amount: totalAmount,
    total_installments: 1,
    paid_installments_count: 0,
    remaining_installments_count: 1,
    installment_amount: totalAmount,
    paid_amount: 0,
    remaining_amount: totalAmount,
    upcoming_installments: [{ installment_number: 1, amount: totalAmount, due_date: todayStr }],
    past_installments: [],
    summary_explanation: 'Não foi possível interpretar a resposta automaticamente.',
  };
}

