// scripts/stress-test.ts
import { config } from 'dotenv';
config({ path: '.env.local' });

interface TestCase {
    id: string;
    name: string;
    payload: {
        messageType: 'conversation' | 'extendedTextMessage';
        text: string;
    };
    expectedBehavior: string;
}

// Suite com 6 cenários críticos do fluxo conversacional
const testCases: TestCase[] = [
    {
        id: 'TC-01',
        name: 'Consulta de Agenda Financeira',
        payload: {
            messageType: 'conversation',
            text: 'contas',
        },
        expectedBehavior: 'Deve retornar a relação de contas com códigos [#01], [#02] ordenadas por vencimento.',
    },
    {
        id: 'TC-02',
        name: 'Baixa Rápida por Código Curto',
        payload: {
            messageType: 'conversation',
            text: 'baixar conta 01',
        },
        expectedBehavior: 'Deve resolver o índice [#01] e apresentar o Espelho de Conferência de Baixa sem pedir valor.',
    },
    {
        id: 'TC-03',
        name: 'Comando de Estorno Imediato',
        payload: {
            messageType: 'conversation',
            text: 'desfazer',
        },
        expectedBehavior: 'Deve capturar UNDO_LAST_ACTION e reverter a última liquidação para pendente.',
    },
    {
        id: 'TC-04',
        name: 'Comando Amíguo / Linguagem Coloquial',
        payload: {
            messageType: 'conversation',
            text: 'paguei aquele boleto que vencia ontem',
        },
        expectedBehavior: 'Deve acionar busca semântica no snapshot ativo e desempate se houver mais de uma conta.',
    },
    {
        id: 'TC-05',
        name: 'Abertura da Central de Recursos',
        payload: {
            messageType: 'conversation',
            text: 'ajuda',
        },
        expectedBehavior: 'Deve exibir o menu de ajuda contextual sem quebrar o fluxo.',
    },
    {
        id: 'TC-06',
        name: 'Disparo de Estresse em Concorrência (Race Condition)',
        payload: {
            messageType: 'conversation',
            text: 'meu saldo hoje é R$ 5.000',
        },
        expectedBehavior: 'Deve processar sem gerar deadlock ou erro 500 no Supabase.',
    },
];

async function runWebhookTest(test: TestCase, webhookUrl: string, testPhone: string) {
    const timestamp = Math.floor(Date.now() / 1000);
    const messageId = `TEST_${test.id}_${Date.now()}`;

    // Formato exato do payload enviado pela Evolution API (Baileys)
    const evolutionMockPayload = {
        event: 'messages.upsert',
        instance: 'analisai_solo',
        data: {
            key: {
                remoteJid: `${testPhone}@s.whatsapp.net`,
                fromMe: false,
                id: messageId,
            },
            pushName: 'Usuário de Teste Automatizado',
            message: {
                [test.payload.messageType]: test.payload.text,
            },
            messageTimestamp: timestamp,
        },
    };

    const startTime = Date.now();

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(evolutionMockPayload),
        });

        const elapsed = Date.now() - startTime;
        const isSuccess = response.status === 200;

        return {
            id: test.id,
            name: test.name,
            status: isSuccess ? 'PASSED' : 'FAILED',
            httpStatus: response.status,
            elapsedMs: elapsed,
            expected: test.expectedBehavior,
        };
    } catch (error: any) {
        const errorDetail = error?.cause?.message || error?.cause || error?.message || 'Falha de conexão';
        return {
            id: test.id,
            name: test.name,
            status: 'CRASH',
            httpStatus: 0,
            elapsedMs: Date.now() - startTime,
            error: String(errorDetail),
            expected: test.expectedBehavior,
        };
    }
}

async function main() {
    let WEBHOOK_URL = process.env.TEST_WEBHOOK_URL || 'http://127.0.0.1:3000/api/webhooks/evolution';
    if (WEBHOOK_URL.includes('localhost')) {
        WEBHOOK_URL = WEBHOOK_URL.replace('localhost', '127.0.0.1');
    }
    // Telefone que já existe no seu banco de testes (de preferência o seu de QA)
    const TEST_PHONE = process.env.TEST_PHONE_NUMBER || '5513999999999';

    console.log(`\n======================================================`);
    console.log(`🚀 INICIANDO BATERIA DE TESTES SINTÉTICOS — ANALISAÍ.ME`);
    console.log(`🎯 Alvo: ${WEBHOOK_URL}`);
    console.log(`📱 Telefone Mock: ${TEST_PHONE}`);
    console.log(`======================================================\n`);

    // Pré-validação de conectividade com o alvo
    try {
        await fetch(WEBHOOK_URL, { method: 'GET' });
    } catch (connErr: any) {
        console.error(`❌ ERRO DE CONEXÃO AO ALVO: Não foi possível conectar a ${WEBHOOK_URL}`);
        console.error(`💡 Causa: ${connErr?.cause?.message || connErr?.message || 'Servidor inacessível'}`);
        console.error(`\n👉 IMPORTANTE:`);
        console.error(`   1. O comando 'npm run dev' precisa ficar RODANDO em uma janela de terminal.`);
        console.error(`   2. Se você digitou 'npm run test:stress' no mesmo terminal de onde rodou 'npm run dev', o servidor parou!`);
        console.error(`   3. Abra um NOVO terminal (ou use outra aba) para rodar:`);
        console.error(`      • Terminal 1: npm run dev`);
        console.error(`      • Terminal 2: npm run test:stress`);
        console.error(`   4. Alternativamente, para testar a API na nuvem (Vercel), configure no .env.local:`);
        console.error(`      TEST_WEBHOOK_URL=https://analisai.me/api/webhooks/evolution\n`);
        process.exit(1);
    }

    const results = [];

    for (const tc of testCases) {
        process.stdout.write(`⏳ Executando ${tc.id}: ${tc.name}... `);
        const res = await runWebhookTest(tc, WEBHOOK_URL, TEST_PHONE);
        results.push(res);

        if (res.status === 'PASSED') {
            console.log(`✅ [200 OK] em ${res.elapsedMs}ms`);
        } else {
            console.log(`❌ [FALHA: HTTP ${res.httpStatus}]`);
            if (res.error) console.log(`   Detalhe: ${res.error}`);
        }

        // Intervalo de 1.5s entre mensagens para simular digitação humana
        await new Promise((r) => setTimeout(r, 1500));
    }

    console.log(`\n======================================================`);
    console.log(`📊 RELATÓRIO CONSOLIDADO`);
    console.log(`======================================================`);

    const passed = results.filter((r) => r.status === 'PASSED').length;
    const failed = results.filter((r) => r.status !== 'PASSED').length;

    console.log(`Total de Cenários: ${results.length}`);
    console.log(`Sucessos: ${passed}`);
    console.log(`Falhas/Travamentos: ${failed}`);

    if (failed === 0) {
        console.log(`\n🎉 Todos os cenários foram aceitos pelo webhook com estabilidade!\n`);
    } else {
        console.log(`\n⚠️ Atenção: Foram detectadas falhas em ${failed} cenário(s).\n`);
    }
}

main().catch(console.error);