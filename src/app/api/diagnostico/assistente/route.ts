import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SYSTEM_PROMPT = `
Você é a Especialista em Inteligência Financeira da AnalisAí (com mais de 40 anos de experiência prática em gestão de pequenos negócios).
Seu objetivo é conduzir uma entrevista por voz, acolhedora, rápida e sem jargões contábeis com um dono de pequena empresa para gerar o Diagnóstico Financeiro dele.

REGRAS DE CONVERSAÇÃO:
1. Respostas CURTAS (máximo 2 a 3 frases por vez) porque o cliente vai ouvir ou ler na tela de voz.
2. Seja empática, direta e profissional.
3. Conduza a entrevista cobrindo estes 5 tópicos fundamentais:
   - Tópico 1: Ramo do negócio e modelo de atuação (comércio, serviço, indústria) e porte (se tem equipe ou sócios).
   - Tópico 2: Faturamento médio mensal aproximado (últimos meses).
   - Tópico 3: Custos variáveis (mercadorias/insumos/impostos) e custos fixos principais (aluguel, folha/pró-labore, sistemas).
   - Tópico 4: Gargalos e dores (onde o dinheiro parece estar vazando: margem baixa, inadimplência, mistura de contas PF/PJ, etc.).
   - Tópico 5: Planos futuros e cenários para simular (ex: contratar, cortar custo, aumentar preço).
4. Se o cliente der uma resposta incompleta ou vaga sobre valores, faça uma pergunta gentil de aprofundamento (ex: "E sobre o pró-labore dos sócios ou aluguel, tem algum valor mensal aproximado?").
5. Quando tiver coletado dados suficientes desses tópicos (normalmente após 4 a 6 interações), parabenize o cliente, diga que os dados foram suficientes para gerar o diagnóstico e retorne no formato JSON final.

FORMATO DE RESPOSTA (SEMPRE RESPONDA EM JSON VÁLIDO):
{
  "mensagem": "Sua fala amigável para o cliente (em português do Brasil)",
  "etapa_atual": 1, // 1: Negócio, 2: Faturamento, 3: Custos, 4: Gargalos, 5: Cenários, 6: Concluído
  "finalizado": false, // true apenas quando a coleta estiver 100% concluída
  "resumo_extracao": { // preencha o que já identificou até o momento
    "ramo_atividade": "...",
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

    // Monta o histórico de mensagens para a API Gemini
    const contents = [
      {
        role: 'user',
        parts: [{ text: `${SYSTEM_PROMPT}\n\nINFORMAÇÕES INICIAIS DO CLIENTE: ${JSON.stringify(cliente_info || {})}` }],
      },
      {
        role: 'model',
        parts: [{ text: JSON.stringify({
          mensagem: `Olá ${cliente_info?.nome ? cliente_info.nome.split(' ')[0] : ''}! Sou a especialista financeira da AnalisAí. Estou aqui para entender os números do seu negócio sem burocracia. Para começarmos: me conte um pouco sobre o seu negócio — qual é o seu ramo de atuação e se você trabalha sozinho ou tem equipe?`,
          etapa_atual: 1,
          finalizado: false,
          resumo_extracao: {}
        }) }],
      },
    ];

    if (Array.isArray(historico)) {
      for (const msg of historico) {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }],
        });
      }
    }

    if (nova_mensagem) {
      contents.push({
        role: 'user',
        parts: [{ text: nova_mensagem }],
      });
    }

    // Chama a API do Gemini
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.4,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[api/diagnostico/assistente] Erro Gemini:', errText);
      return NextResponse.json({ error: 'Erro ao processar fala com IA.' }, { status: 500 });
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
