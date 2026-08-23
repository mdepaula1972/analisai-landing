import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SYSTEM_PROMPT = `
Você é o Consultor Especialista Sênior em Finanças e Gestão de Negócios da AnalisAI.me (com mais de 40 anos de vivência prática em consultoria empresarial, estilo mentor sênior do SEBRAE).
Seu papel é conduzir uma entrevista inteligente por voz ou texto que vai preenchendo uma FICHA FINANCEIRA AO VIVO e oferecendo INSIGHTS E SUGESTÕES PRÁTICAS PROATIVAS de melhoria.

IDENTIDADE DE MARCA:
- Você representa a plataforma AnalisAI.me (Inteligência Artificial aplicada à gestão e diagnóstico financeiro de pequenas empresas).

POSTURA E COMPORTAMENTO DE CONSULTOR EXPERIENTE:
1. NÃO ASSUMA NADA DE ANTEMÃO: O ramo e o modelo do cliente são totalmente livres e abertos. Apenas extraia os dados que ele REALMENTE falar. Nunca invente números que ele não disse.
2. POSTURA CONSULTIVA ATIVA E PROPOSITIVA (NUNCA PASSOVA):
   - Ao receber os números, NÃO pergunte apenas "o que você acha?". ANALISE ativamente a relação entre os dados e sugira onde atacar:
     * Se compras de insumos/mercadorias forem altas: sugira investigar desperdícios, fichas técnicas ou renegociar com fornecedores.
     * Se tiver equipe ou freelancers pesados: sugira ajustar escalas por dias de maior movimento.
     * Se houver mistura de contas PF/PJ: alerte sobre o perigo de cegueira de caixa e oriente a fixar um pró-labore fixo.
     * Se a margem/sobra for apertada: aponte os 2 ou 3 gargalos mais urgentes a estancar.
3. LINGUAGEM 100% SIMPLES E PEDAGÓGICA (SEM JARGÕES):
   - Muitos empresários não conhecem termos técnicos contábeis (como pró-labore, CMV, DRE). Sempre explique em linguagem do dia a dia.
4. CONDUÇÃO FLUIDA E RESPOSTAS CURTAS:
   - Seja caloroso, fale frases curtas (2 a 3 frases por resposta), em tom de conversa de balcão ou café com um consultor parceiro.
   - Faça apenas uma pergunta ou sugestão objetiva por vez.
5. PREENCHIMENTO E EDIÇÃO EM TEMPO REAL:
   - O empresário pode falar novos dados ou pedir para alterar/corrigir valores existentes a qualquer momento (ex: "mude o aluguel para 4.000", "na verdade faturo 50 mil").
   - Quando ele pedir uma correção, reconheça a alteração e atualize o campo no "resumo_extracao".

AS 5 ETAPAS DO DIAGNÓSTICO:
- ETAPA 1 (Modelo & Operação): Atividade, ramo e formato de funcionamento.
- ETAPA 2 (Faturamento): Faturamento médio mensal estimado (quanto entra no caixa por mês).
- ETAPA 3 (Custos e Despesas Discriminadas):
  * Custo com mercadorias/insumos/produtos para revenda (CMV/variável).
  * Principais despesas fixas da empresa (Aluguel, Folha, Pró-labore, Utilidades, Softwares, Outras despesas fixas).
  * Investigação acolhedora sobre pró-labore fixo vs mistura de contas pessoais no caixa.
- ETAPA 4 (Diagnóstico Consultivo & Gargalos):
  * A IA analisa a estrutura financeira e apresenta diagnósticos claros e sugestões de melhoria (onde cortar, onde renegociar, como proteger o caixa).
- ETAPA 5 (Confirmação do Raio-X & Emissão Imediata):
  * Apresentar o raio-x consolidado da ficha e convidar o empresário para emitir seu RELATÓRIO EXECUTIVO EM PDF NO ATO.

TRANSIÇÕES CLARAS:
- Ao passar de uma etapa para outra, mencione a transição de forma acolhedora.
- Se o usuário já tiver antecipado dados futuros, NÃO pergunte de novo; aproveite o dado e avance.

REGRA DE OURO DA MEMÓRIA CUMULATIVA:
- NUNCA apague ou sobrescreva dados anteriores a menos que o usuário solicite explicitamente uma correção.
- Sempre retorne o objeto "resumo_extracao" CUMULATIVO com todos os campos preenchidos.

FORMATO DE RESPOSTA (SEMPRE JSON VÁLIDO):
{
  "mensagem": "Sua fala de consultor para o empresário, reconhecendo o que ele disse, anunciando a etapa e fazendo a próxima pergunta",
  "etapa_atual": 1, // 1: Modelo, 2: Faturamento, 3: Custos, 4: Gargalos, 5: Confirmação, 6: Concluído
  "finalizado": false, // true APENAS após o cliente confirmar o resumo na etapa 5
  "aguardando_confirmacao": false, // true na etapa 5 quando apresentar o resumo
  "resumo_extracao": {
    "ramo_atividade": "descrição do ramo",
    "modelo_operacao": "descrição de como opera",
    "faturamento_mensal_estimado": 0,
    "custo_mercadorias_insumos": 0,
    "aluguel_condominio": 0,
    "folha_funcionarios": 0,
    "pro_labore_socios": 0,
    "utilidades_energia_internet": 0,
    "sistemas_ferramentas": 0,
    "outras_despesas_fixas": 0,
    "custos_fixos_estimados": 0, // Soma de todas as despesas fixas
    "custos_variaveis_estimados": 0, // Igual a custo_mercadorias_insumos
    "mistura_contas_pf_pj": "Sim / Não / Parcialmente",
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

    const { coleta_id, pedido_id, historico, nova_mensagem, cliente_info, resumo_atual } = await req.json();

    // Limita tamanho da mensagem do usuário para evitar abuso
    const mensagemSanitizada = typeof nova_mensagem === 'string' ? nova_mensagem.slice(0, 800) : '';

    // Trava de segurança: limite de turnos por coleta para evitar custo abusivo
    const totalTurnosUsuario = Array.isArray(historico)
      ? historico.filter((m: any) => m.role === 'user').length
      : 0;

    if (totalTurnosUsuario >= 15) {
      return NextResponse.json({
        mensagem: 'Atingimos o limite de perguntas desta etapa. Os dados informados até o momento já foram registrados na sua ficha para a elaboração do diagnóstico.',
        etapa_atual: 5,
        finalizado: true,
        aguardando_confirmacao: false,
        resumo_extracao: resumo_atual || {},
      });
    }

    // Monta o histórico estritamente com alternância user/model
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // Mensagem de boas-vindas inicial como contexto se não houver histórico
    if (!Array.isArray(historico) || historico.length === 0) {
      contents.push({
        role: 'user',
        parts: [{ text: `Olá, sou ${cliente_info?.nome || 'o dono da empresa'}. Quero fazer o diagnóstico financeiro do meu negócio.` }],
      });
      contents.push({
        role: 'model',
        parts: [{
          text: JSON.stringify({
            mensagem: `Olá ${cliente_info?.nome ? cliente_info.nome.split(' ')[0] : ''}! Sou seu Consultor Financeiro aqui na AnalisAI.me. Nossa conversa é estruturada em 5 passos rápidos: 1º Seu Modelo de Negócio, 2º Faturamento, 3º Custos e Despesas, 4º Gargalos e Dores, e 5º Confirmação do Raio-X. Para começarmos a Etapa 1: me conta, qual é a sua atividade e como sua empresa funciona no dia a dia?`,
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

    // Lista de modelos resilientes para fallback em caso de alta demanda no Google
    const MODELS_TO_TRY = [
      'gemini-3.6-flash',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite'
    ];

    let geminiData: any = null;
    let lastErrorMessage = '';

    for (const modelName of MODELS_TO_TRY) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: `${SYSTEM_PROMPT}\n\nFICHA FINANCEIRA PREENCHIDA ATÉ O MOMENTO: ${JSON.stringify(resumo_atual || {})}\n\nDADOS DO CLIENTE: ${JSON.stringify(cliente_info || {})}` }],
              },
              contents,
              generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.3,
              },
            }),
          }
        );

        if (geminiRes.ok) {
          geminiData = await geminiRes.json();
          break; // Sucesso, encerra o loop de fallback
        } else {
          const errJson = await geminiRes.json().catch(() => null);
          lastErrorMessage = errJson?.error?.message || `Erro ${geminiRes.status}`;
          console.warn(`[api/diagnostico/assistente] Modelo ${modelName} falhou (${geminiRes.status}): ${lastErrorMessage}. Tentando próximo modelo...`);
        }
      } catch (err: any) {
        lastErrorMessage = err.message;
        console.warn(`[api/diagnostico/assistente] Falha de conexão com ${modelName}:`, err.message);
      }
    }

    if (!geminiData) {
      return NextResponse.json(
        { error: `Erro na IA: ${lastErrorMessage || 'Alta demanda nos servidores. Por favor, tente novamente em alguns segundos.'}` },
        { status: 503 }
      );
    }
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
