import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient, createServiceRoleClient } from '@/lib/supabase-server';
import { GoogleGenerativeAI, Part } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const PROMPT_EXTRACAO = `Você é um especialista em finanças empresariais e análise de documentos para BPO financeiro.
Analise este documento (nota fiscal, boleto, recibo, extrato, comprovante ou transcrição de áudio) e extraia as informações financeiras em JSON válido.

Retorne APENAS o JSON, sem explicações:
{
  "descricao": "descrição do documento/transação",
  "valor": número (apenas o valor principal, sem centavos formatados),
  "data": "YYYY-MM-DD ou data aproximada",
  "fornecedor_ou_cliente": "nome da empresa ou pessoa",
  "tipo": "pagar | receber | dre",
  "conta_dre": "categoria DRE (ex: Receita Operacional, Custos, Despesas Administrativas, Folha de Pagamento...)",
  "categoria": "categoria da conta (ex: Fornecedores, Aluguel, Marketing...)",
  "periodo": "Mês/Ano no formato Jan/26",
  "observacoes": "observações relevantes",
  "confianca": 0.0 a 1.0
}

Se algum campo não puder ser determinado, use null.
Foque em extrair o VALOR correto e o TIPO (pagar=conta a pagar, receber=conta a receber, dre=lançamento DRE).`;

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar autenticação
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // 2. Verificar role admin_bpo
    const { data: tu } = await supabase
      .from('tenant_users')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin_bpo')
      .single();

    if (!tu) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // 3. Parsear FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const tenantId = formData.get('tenantId') as string;

    if (!file || !tenantId) {
      return NextResponse.json({ error: 'Arquivo e tenantId são obrigatórios' }, { status: 400 });
    }

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Arquivo muito grande (máx 10MB)' }, { status: 400 });
    }

    // 4. Determinar tipo
    const mime = file.type;
    let tipo: 'imagem' | 'audio' | 'pdf' | 'planilha' = 'imagem';
    if (mime.startsWith('audio/')) tipo = 'audio';
    else if (mime === 'application/pdf') tipo = 'pdf';
    else if (mime.includes('spreadsheet') || mime.includes('excel')) tipo = 'planilha';

    // 5. Upload para Supabase Storage
    const serviceClient = createServiceRoleClient();
    const ext = file.name.split('.').pop() || 'bin';
    const storagePath = `${tenantId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    const bytes = await file.arrayBuffer();
    const { error: storageError } = await serviceClient.storage
      .from('bpo-uploads')
      .upload(storagePath, bytes, {
        contentType: mime,
        upsert: false,
      });

    if (storageError) {
      console.error('Storage error:', storageError);
      return NextResponse.json({ error: 'Erro ao salvar arquivo' }, { status: 500 });
    }

    // 6. Registrar upload no DB
    const { data: uploadRecord, error: dbError } = await serviceClient
      .from('uploads')
      .insert({
        tenant_id: tenantId,
        tipo,
        storage_path: storagePath,
        nome_original: file.name,
        tamanho_bytes: file.size,
        status: 'processando',
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (dbError) {
      console.error('DB error:', dbError);
      return NextResponse.json({ error: 'Erro ao registrar upload' }, { status: 500 });
    }

    // 7. Processar com Gemini IA
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

      let parts: Part[];

      if (tipo === 'audio') {
        // Áudio: transcrição + extração
        parts = [
          {
            inlineData: {
              mimeType: mime as any,
              data: Buffer.from(bytes).toString('base64'),
            },
          },
          { text: PROMPT_EXTRACAO },
        ];
      } else {
        // Imagem / PDF
        parts = [
          {
            inlineData: {
              mimeType: mime as any,
              data: Buffer.from(bytes).toString('base64'),
            },
          },
          { text: PROMPT_EXTRACAO },
        ];
      }

      const iaResult = await model.generateContent({ contents: [{ role: 'user', parts }] });
      const iaText = iaResult.response.text().trim();

      // Extrair JSON da resposta
      const jsonMatch = iaText.match(/\{[\s\S]*\}/);
      let iaExtracao = null;

      if (jsonMatch) {
        try {
          iaExtracao = JSON.parse(jsonMatch[0]);
        } catch {
          iaExtracao = { descricao: iaText, confianca: 0.3 };
        }
      }

      // 8. Atualizar upload com resultado da IA
      await serviceClient
        .from('uploads')
        .update({
          status: 'revisao',
          ia_extracao: iaExtracao,
          ia_confianca: iaExtracao?.confianca || null,
        })
        .eq('id', uploadRecord.id);

      return NextResponse.json({
        success: true,
        uploadId: uploadRecord.id,
        iaExtracao,
        status: 'revisao',
        message: 'Arquivo processado pela IA. Revise e publique.',
      });
    } catch (iaError) {
      console.error('IA processing error:', iaError);

      // Mesmo com erro na IA, o arquivo foi salvo
      await serviceClient
        .from('uploads')
        .update({ status: 'erro', erro_msg: String(iaError) })
        .eq('id', uploadRecord.id);

      return NextResponse.json({
        success: true,
        uploadId: uploadRecord.id,
        iaExtracao: null,
        status: 'erro',
        message: 'Arquivo salvo, mas houve erro no processamento IA. Tente novamente.',
      });
    }
  } catch (err) {
    console.error('Upload handler error:', err);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
