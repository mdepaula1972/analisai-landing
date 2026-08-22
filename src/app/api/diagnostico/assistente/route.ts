import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SYSTEM_PROMPT = `
Você é o Consultor Especialista Sênior em Finanças e Gestão de Negócios da AnalisAí (com mais de 40 anos de vivência prática em consultoria empresarial, estilo mentor sênior do SEBRAE).
Seu objetivo é conduzir uma conversa acolhedora, humana, investigativa e sem jargões contábeis para entender a fundo o modelo de negócio do empresário e mapear sua realidade financeira.

POSTURA E COMPORTAMENTO DE CONSULTOR EXPERIENTE:
1. NÃO ASSUMA NADA DE ANTEMÃO: O ramo e o modelo do cliente são totalmente livres e abertos. Apenas extraia os dados que ele REALMENTE falar. Nunca invente ou antecipe números que ele não disse.
2. CURIOSIDADE INVESTIGATIVA EMPÁTICA:
   - Quando o cliente disser o ramo de atividade, NÃO pule direto para os números secos. Demonstre genuíno interesse e investigue o modelo operacional da empresa, pois isso muda toda a estrutura de custos:
     * Se falar "ramo de alimentação": investigue se é restaurante a la carte, buffet, delivery de marmitas, padaria ou lanchonete; se tem salão ou é só entrega; se abre no almoço, noite ou integral.
     * Se falar "comércio/loja": investigue se é loja de rua, shopping ou e-commerce; se vende à vista ou muito parcelado no cartão.
     * Se falar "serviços/saúde/TI/consultoria": investigue se trabalha sozinho ou com equipe/comissionados; se cobra mensalidade recorrente ou por projeto/atendimento.
     * Se falar "indústria/oficina": investigue se trabalha sob encomenda ou com estoque pronto.
3. CONDUÇÃO FLUIDA (UMA PERGUNTA POR VEZ):
   - Nunca sobrecarregue o empresário com múltiplas perguntas complexas na mesma fala.
   - Seja caloroso, fale frases curtas (2 a 3 frases por resposta), em tom de conversa de balcão ou café com um consultor parceiro.
   - Linguagem 100% simples: não use termos técnicos como "CMV", "EBITDA" ou "DRE". Use "quanto você gasta comprando mercadoria", "qual o aluguel e despesas fixas", "quanto entra no caixa".

FLUXO DA CONVERSA:
- PASSO 1: Acolhida e Ramo/Modelo Operacional (investigar como a empresa opera no dia a dia).
- PASSO 2: Faturamento Médio Mensal (quanto costuma entrar no caixa por mês, em média).
Seu papel é conduzir uma entrevista por voz estruturada em 5 ETAPAS CLARAS, acolhedora, transparente e sem jargões contábeis.

AS 5 ETAPAS DO DIAGNÓSTICO (ANUNCIE COM CLAREZA AO EMPRESÁRIO):
- ETAPA 1 (Modelo & Operação): Investigar a fundo como a empresa opera no dia a dia (se tem salão, delivery, loja física, fábrica, se cobra mensalidade ou projeto, equipe).
- ETAPA 2 (Faturamento): Mapear o faturamento bruto médio mensal (quanto costuma entrar no caixa por mês).
- ETAPA 3 (Custos & Despesas): Mapear os custos variáveis (compra de mercadorias/ingredientes/produtos) e custos fixos (aluguel, funcionários, pró-labore, sistemas).
- ETAPA 4 (Gargalos & Objetivos): Mapear onde o dinheiro mais vaza, misturas de contas e cenários que deseja simular no relatório.
- ETAPA 5 (Confirmação do Raio-X): Apresentar o resumo completo dos números mapeados e pedir a confirmação formal do empresário para gerar o relatório final.

TRANSIÇÕES CLARAS ENTRE ETAPAS:
- Ao passar de uma etapa para outra, mencione a transição de forma acolhedora:
  Exemplo: "Excelente! Mapeamos seu modelo de negócio (Etapa 1). Agora vamos para a Etapa 2: qual é o seu faturamento médio mensal aproximado?"
- Se o usuário já tiver antecipado o dado da etapa seguinte, NÃO repita a pergunta. Diga: "Como você já me adiantou que fatura cerca de R$ X na Etapa 2, vamos avançar direto para a Etapa 3 (Custos e Despesas)..."

REGRA DE OURO DA MEMÓRIA:
- NUNCA PERGUNTE NOVAMENTE O QUE O USUÁRIO JÁ DISSE.
- Mantenha sempre o objeto "resumo_extracao" CUMULATIVO com todos os dados coletados até o momento.
- Mantenha respostas curtas (2 a 3 frases) e tom de conversa acolhedora de balcão.

FORMATO DE RESPOSTA (SEMPRE JSON VÁLIDO):
{
  "mensagem": "Sua fala de consultor para o empresário, reconhecendo o que ele disse, anunciando a etapa e fazendo a próxima pergunta",
  "etapa_atual": 1, // 1: Modelo, 2: Faturamento, 3: Custos, 4: Gargalos, 5: Confirmação, 6: Concluído
  "finalizado": false, // true APENAS após o cliente confirmar o resumo na etapa 5
  "aguardando_confirmacao": false, // true na etapa 5 quando apresentar o resumo
  "resumo_extracao": {
    "ramo_atividade": "descrição detalhada do modelo",
    "faturamento_mensal_estimado": 0,
    "custos_fixos_estimados": 0,
    "custos_variaveis_estimados": 0,
    "principais_gargalos": ["..."],
    "cenarios_solicitados": ["..."]
  }
}
`;

export async function POST(req: NextRequest) {
  try {
    const geminiKey = process.env.GEMINI_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!geminiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY não configurada.' }, { status: 500 });
    }

    const { coleta_id, pedido_id, historico, nova_mensagem, cliente_info } = await req.json();

    // Limita tamanho da mensagem do usuário para evitar abuso
    const mensagemSanitizada = typeof nova_mensagem === 'string' ? nova_mensagem.slice(0, 800) : '';

    // Trava de segurança: limite de turnos por coleta para evitar custo abusivo
    const totalTurnosUsuario = Array.isArray(historico)
      ? historico.filter((m: any) => m.role === 'user').length
      : 0;

    if (totalTurnosUsuario >= 10) {
      return NextResponse.json({
        mensagem: 'Atingimos o limite de perguntas desta etapa. Os dados informados até o momento já foram registrados para a elaboração do seu diagnóstico.',
        etapa_atual: 5,
        finalizado: true,
        aguardando_confirmacao: false,
        resumo_extracao: {},
      });
    }

    // Monta o histórico estritamente com alternância user/model
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Mensagem de boas-vindas inicial como contexto se não houver histórico
    if (!Array.isArray(historico) || historico.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: `Olá, sou ${cliente_info?.nome || 'o dono da empresa'}. Vamos iniciar a coleta do meu diagnóstico.` }],
      });
      contents.push({
        role: 'model',
        parts: [{
          text: JSON.stringify({
            mensagem: `Olá ${cliente_info?.nome ? cliente_info.nome.split(' ')[0] : ''}! Sou a especialista financeira da AnalisAí. Estou aqui para entender os números do seu negócio sem burocracia. Para começarmos: me conte um pouco sobre o seu negócio — qual é o seu ramo de atuação e se você trabalha sozinho ou tem equipe?`,
            etapa_atual: 1,
            finalizado: false,
            aguardando_confirmacao: false,
            resumo_extracao: {}
          })
        }],
      });
    } else {
      for (const msg of historico.slice(-8)) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }],
        });
      }
    }

    if (mensagemSanitizada) {
      contents.push({
        role: 'user',
        parts: [{ text: mensagemSanitizada }],
      });
    }

    // Chama a API do Gemini (usando o modelo oficial gemini-3.6-flash)
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: `${SYSTEM_PROMPT}\n\nDADOS DO CLIENTE: ${JSON.stringify(cliente_info || {})}` }],
          },
          contents,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.4,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errJson = await geminiRes.json().catch(() => null);
      const errMessage = errJson?.error?.message || 'Chave API do Gemini inválida ou sem permissão.';
      console.error('[api/diagnostico/assistente] Erro Gemini API:', errJson || errMessage);
      return NextResponse.json(
        { error: `Erro na IA: ${errMessage}` },
        { status: 400 }
      );
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    let parsedResponse = {
      mensagem: 'Entendido. Pode me falar um pouco mais sobre seus custos ou faturamento?',
      etapa_atual: 2,
      finalizado: false,
      resumo_extracao: {},
    };

    try {
      parsedResponse = JSON.parse(rawText);
    } catch {
      console.warn('[api/diagnostico/assistente] Resposta não-JSON do Gemini:', rawText);
    }

    // Persistência no Supabase Multitenant
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        let targetColetaId = coleta_id;
        let tenantId = null;

        // Se finalizado, garante a criação do Tenant no modelo multitenant
        if (parsedResponse.finalizado && cliente_info?.nome) {
          const slug = (cliente_info.nome || 'cliente')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '-')
            .slice(0, 30) + '-' + Date.now().toString().slice(-4);

          const { data: tenantData } = await supabase
            .from('tenants')
            .insert([
              {
                slug,
                razao_social: cliente_info.nome,
                nome_fantasia: parsedResponse.resumo_extracao?.ramo_atividade || 'Cliente Diagnóstico',
                plano: 'essencial',
                ativo: true,
              },
            ])
            .select()
            .single();

          if (tenantData) {
            tenantId = tenantData.id;
          }
        }

        const payloadToSave = {
          pedido_id: pedido_id || null,
          tenant_id: tenantId,
          nome_cliente: cliente_info?.nome || null,
          email_cliente: cliente_info?.email || null,
          whatsapp_cliente: cliente_info?.whatsapp || null,
          mensagens: [...(historico || []), { role: 'user', content: nova_mensagem }, { role: 'model', content: parsedResponse }],
          dados_extraidos: parsedResponse.resumo_extracao || {},
          status: parsedResponse.finalizado ? 'concluido' : 'em_andamento',
          updated_at: new Date().toISOString(),
        };

        if (targetColetaId) {
          await supabase
            .from('diagnostico_coletas')
            .update(payloadToSave)
            .eq('id', targetColetaId);
        } else {
          const { data: created } = await supabase
            .from('diagnostico_coletas')
            .insert([payloadToSave])
            .select()
            .single();
          if (created) {
            targetColetaId = created.id;
          }
        }

        return NextResponse.json({
          ...parsedResponse,
          coleta_id: targetColetaId,
          tenant_id: tenantId,
        });
      } catch (dbErr) {
        console.error('[api/diagnostico/assistente] Erro Supabase:', dbErr);
      }
    }

    return NextResponse.json(parsedResponse);
  } catch (err) {
    console.error('[api/diagnostico/assistente] Erro geral:', err);
    return NextResponse.json({ error: 'Erro interno ao processar áudio.' }, { status: 500 });
  }
}
