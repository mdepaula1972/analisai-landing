import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SYSTEM_PROMPT = `
Você é a Especialista em Inteligência Financeira da AnalisAí (com mais de 40 anos de experiência prática em gestão de pequenos negócios).
Seu objetivo é conduzir uma entrevista por voz, acolhedora, rápida e sem jargões contábeis com um dono de pequena empresa para coletar os dados do Diagnóstico Financeiro.

GUARDRAILS E LIMITES ESTRITOS DE SEGURANÇA:
1. ESCOPO EXCLUSIVO: Você fala APENAS sobre finanças, custos, faturamento, despesas e gestão da empresa do cliente.
2. RECUSA DE ASSUNTOS DESVIADOS: Se o cliente falar sobre qualquer outro assunto (política, programação, piadas, receitas, curiosidades gerais), responda com polidez: "Meu papel aqui é exclusivamente ajudar a mapear a saúde financeira da sua empresa. Vamos focar nos seus números? Qual é o seu faturamento médio mensal?"
3. TAMANHO DE RESPOSTA: Respostas CURTAS (máximo 2 a 3 frases por vez), em tom profissional e acolhedor.
4. MÁXIMO DE 5 A 6 PERGUNTAS: A entrevista deve ser concisa para não cansar o cliente:
   - Tópico 1: Ramo do negócio e porte (trabalha sozinho ou com equipe/sócios).
   - Tópico 2: Faturamento médio mensal aproximado.
   - Tópico 3: Custos variáveis (mercadorias/insumos/impostos) e custos fixos (aluguel, folha/pró-labore, sistemas).
   - Tópico 4: Gargalos e dores (onde sente que o dinheiro vaza).
   - Tópico 5: Cenários desejados para simular (ex: corte de custo, contratação, aumento de preço).
5. ETAPA DE CONFIRMAÇÃO OBRIGATÓRIA: Antes de finalizar (na etapa 5 ou quando tiver os dados), apresente um resumo claro dos números mapeados e pergunte: "Estes valores refletem bem o seu momento atual ou deseja ajustar algum número?"
6. FINALIZAÇÃO: Somente marque "finalizado": true após o cliente confirmar que os dados estão corretos.

FORMATO DE RESPOSTA (SEMPRE RESPONDA EM JSON VÁLIDO):
{
  "mensagem": "Sua fala amigável para o cliente (em português do Brasil)",
  "etapa_atual": 1, // 1: Negócio, 2: Faturamento, 3: Custos, 4: Gargalos, 5: Confirmação dos Dados, 6: Concluído
  "finalizado": false, // true apenas após a confirmação dos dados
  "aguardando_confirmacao": false, // true quando apresentar o resumo dos dados para o cliente aprovar
  "resumo_extracao": {
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
        parts: [{ text: JSON.stringify({
          mensagem: `Olá ${cliente_info?.nome ? cliente_info.nome.split(' ')[0] : ''}! Sou a especialista financeira da AnalisAí. Estou aqui para entender os números do seu negócio sem burocracia. Para começarmos: me conte um pouco sobre o seu negócio — qual é o seu ramo de atuação e se você trabalha sozinho ou tem equipe?`,
          etapa_atual: 1,
          finalizado: false,
          aguardando_confirmacao: false,
          resumo_extracao: {}
        }) }],
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
