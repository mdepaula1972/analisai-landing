# ORDEM DE ENGENHARIA E ARQUITETURA: TRANSIÇÃO PARA CONTROLADORIA / BPO MULTITENANT COM PORTAL DO CONTADOR E TORRE DE AUDITORIA (ANALISAÍ)

Você atuará como Engenheiro de Software Principal, Arquiteto de Soluções Next.js 16/Supabase e Especialista em Segurança/Compliance LGPD.

---

### CONTEXTO E DIRETRIZ ESTRATÉGICA:
O AnalisAí.me está evoluindo de um assistente de WhatsApp puramente self-service para uma **Plataforma de Controladoria Terceirizada (BPO Financeiro)** de alta produtividade com 3 interfaces integradas:
1. **Torre de Controle Operacional (`/admin/bpo`):** Visão central do gestor (Marcos) com seletor de clientes, auditor diário cruzado e esteira rápida de conciliação.
2. **Portal do Contador Parceiro (`/contador`):** Área dedicada para escritórios contábeis visualizarem seus clientes indicados, acompanharem status de atividade (ativo/inativo), baixarem pacotes fiscais mensais (DRE, Livro Caixa, extratos e comprovantes em ZIP) e acompanharem o comissionamento mensal.
3. **Portal do Cliente Mobile / PWA (`/portal`):** Dashboard simplificado para o dono da empresa, com acesso seguro via token e métricas financeiras essenciais (sem complexidade contábil).
4. **Preservação do Autosserviço MEI:** Manter intacto o fluxo de baixo custo no WhatsApp (Start/Solo), com custos de IA e storage controlados.

---

## FASE 0: AUDITORIA DE RECONHECIMENTO (OBRIGATÓRIA)

Antes de escrever novas tabelas ou componentes, inspecione o código-fonte atual para reaproveitar estruturas:
1. Verifique `src/lib/solo/constants.ts` e `src/lib/solo/trial.ts` (constantes de cotas e limites).
2. Verifique `src/app/api/webhooks/evolution/route.ts` e `conversational-router.ts` (rotas de mensagens e fast-paths).
3. Verifique crons existentes em `src/app/api/cron/*` para evitar duplicidade de cronjobs.
4. Verifique as tabelas atuais no Supabase (`clients`, `payables_receivables`, `cash_ledger_entries`, `trial_leads`, etc.).

---

## FASE 1: MODELAGEM DE BANCO E POLÍTICAS DE RLS MULTITENANT (SUPABASE)

Crie ou atualize uma migration SQL no Supabase (`supabase/migrations/bpo_multitenant_accountant_schema.sql`):

```sql
-- 1. Enum de papéis de acesso ao sistema
DO $$ BEGIN
  CREATE TYPE system_user_role AS ENUM ('bpo_admin', 'accountant_partner', 'client_user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Tabela de Escritórios de Contabilidade Parceiros
CREATE TABLE IF NOT EXISTS accounting_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  commission_rate NUMERIC(5,2) DEFAULT 10.00, -- percentual de comissão recorrente (ex: 10%)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  active BOOLEAN DEFAULT TRUE
);

-- 3. Vínculo de Clientes ao Contador e ao Tipo de Serviço
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS service_tier TEXT DEFAULT 'self_service', -- 'self_service' | 'bpo_gestao' | 'bpo_cfo'
ADD COLUMN IF NOT EXISTS accounting_partner_id UUID REFERENCES accounting_partners(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_active_bpo BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10,2) DEFAULT 0.00;

-- 4. Perfis de Usuários Autenticados
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role system_user_role DEFAULT 'client_user',
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  accounting_partner_id UUID REFERENCES accounting_partners(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de Auditoria Operacional Diária (Torre de Controle)
CREATE TABLE IF NOT EXISTS daily_operational_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_date DATE DEFAULT CURRENT_DATE UNIQUE,
  total_active_clients INT DEFAULT 0,
  expected_reminders_count INT DEFAULT 0,
  sent_reminders_count INT DEFAULT 0,
  pending_reminders_count INT DEFAULT 0,
  inbox_docs_received_today INT DEFAULT 0,
  inbox_docs_processed_today INT DEFAULT 0,
  unmatched_bank_txs INT DEFAULT 0,
  reconciliation_mismatches JSONB DEFAULT '[]'::jsonb,
  reviewed_by_admin_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Habilitação de RLS em Tabelas Críticas
ALTER TABLE payables_receivables ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- 7. Políticas de Segurança (RLS):
-- BPO Admin: Acesso total irrestrito
CREATE POLICY bpo_admin_all_payables ON payables_receivables
FOR ALL USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'bpo_admin')
);

-- Contador: Visualiza apenas os lançamentos de empresas associadas ao seu ID
CREATE POLICY accountant_view_assigned_payables ON payables_receivables
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM clients c
    JOIN user_profiles up ON up.accounting_partner_id = c.accounting_partner_id
    WHERE up.id = auth.uid() AND up.role = 'accountant_partner' AND c.id = payables_receivables.client_id
  )
);

-- Cliente Comum: Acesso exclusivo ao seu próprio client_id
CREATE POLICY client_isolated_payables ON payables_receivables
FOR ALL USING (
  client_id = (SELECT client_id FROM user_profiles WHERE id = auth.uid() AND role = 'client_user')
);
```

---

## FASE 2: TORRE DE AUDITORIA DIÁRIA CRUZADA (`/admin/bpo/auditoria`)

O operador não pode correr o risco de esquecer de cobrar ou lembrar um cliente.

### 2.1 Endpoint de Auditoria Automática (`/api/admin/audit-daily-ops`)
Crie uma rota que rode no primeiro acesso matinal ou via cron às 08h00 BRT:
* **Cruzamento 1 (Lembretes D-0 e D-1):** Consulta todas as contas a pagar/receber vencendo hoje e amanhã. Cruza com os registros em `reminders_sent_log` ou `last_reminder_sent_at`. Se houver conta sem notificação disparada, lista como `pendente`.
* **Cruzamento 2 (Entrada WhatsApp vs Lançamentos):** Compara mídias recebidas no Supabase Storage nas últimas 24h com lançamentos criados. Avisa se há imagem parada sem conversão em despesa.
* **Cruzamento 3 (Saldo de Caixa):** Alerta discrepâncias entre saldo do extrato e soma de lançamentos.
* **Gravação:** Salva o snapshot na tabela `daily_operational_audits`.

### 2.2 Interface da Torre de Controle (`src/app/admin/bpo/page.tsx` e `/auditoria`)
* **Semáforo Operacional Matinal:**
  * 🟢 **Lembretes Disparados:** `[X / Y contas notificadas]` + Botão de ação: *"Disparar Lembretes Restantes"*.
  * 🟡 **Fila de Validação de Documentos:** Cards visuais com comprovantes recebidos pelo WhatsApp, campos extraídos pela IA e botão em 1 clique: *"Aprovar & Agendar"*.
  * 🔴 **Contas Sem Comprovante / Alertas:** Lista de saídas do extrato pendentes de justificativa do cliente.
* **Ação de Fechamento de Turno:** Botão *"Auditoria Diária Concluída"*, que carimba `reviewed_by_admin_at = NOW()`.

---

## FASE 3: PORTAL DO CONTADOR PARCEIRO (`/contador`)

O objetivo desta área é transformar os escritórios contábeis em parceiros comerciais recorrentes, dando-lhes transparência total e eliminando o trabalho braçal de fechamento.

### 3.1 Painel do Contador (`src/app/contador/dashboard/page.tsx`)
* **Autenticação:** Login protegido com perfil `role === 'accountant_partner'`.
* **Cards de Cabeçalho:**
  1. *Total de Clientes Ativos na Carteira*.
  2. *Status de Fechamento do Mês Atual* (ex: "8 de 10 clientes fechados").
  3. *Comissão Recorrente do Mês* (Cálculo automático: `Soma(monthly_fee * commission_rate / 100)`).
* **Tabela de Clientes Indicados:**
  * Colunas: *Razão Social / CNPJ*, *Regime Tributário*, *Status BPO (Ativo / Inativo / Alerta)*, *Última Conciliação*, *Documentação do Mês*, *Ações*.
* **Ações em 1 Clique por Cliente:**
  * **"Baixar Pacote Fiscal":** Faz download direto do arquivo ZIP contendo:
    * Livro Caixa do mês em PDF formatado;
    * DRE Financeira analítica;
    * Arquivo CSV padronizado pronto para importação contábil (Domínio, Questor, Alterdata);
    * Pasta organizada com os PDFs e imagens de todos os comprovantes arquivados.
  * **"Espelho de Movimentação":** Visualização em modo leitura das entradas, saídas e conciliações do cliente sem permissão de alteração.

---

## FASE 4: RÉGUA DE AUTOMAÇÕES E RELATÓRIOS PROGRAMADOS

Audite e garanta o funcionamento das crons em `src/app/api/cron/*`:

1. **Lembretes de Vencimento D-1 e D-0:**
   * Diariamente às 10h00 BRT (`src/app/api/cron/payment-reminders/route.ts`).
   * Envia as contas vencendo no dia e no dia seguinte com a linha digitável ou chave Pix em bloco destacado pronto para cópia em 1 toque.
2. **Radar Semanal de Liquidez (Fluxo de Caixa):**
   * Toda segunda-feira às 08h30 BRT (`src/app/api/cron/weekly-cashflow/route.ts`).
   * Envia no WhatsApp resumo com: Contas a Receber da semana, Contas a Pagar, Saldo Líquido Previsto e os 3 maiores vencimentos.
3. **Fechamento e DRE Mensal (Todo dia 5):**
   * Todo dia 5 às 09h00 BRT (`src/app/api/cron/monthly-closing/route.ts`).
   * Compila o mês anterior, gera o PDF da DRE, notifica o cliente e disponibiliza o download no Portal do Contador e no Portal do Cliente.

---

## FASE 5: RECURSOS DE ALTO VALOR ("CFO STRATEGY")

Para justificar mensalidades de R$ 900 a R$ 2.500/mês e encantar o cliente:
1. **Auditoria de Mistura PF x PJ (`patrimonial-advisor.ts`):**
   * No fechamento mensal, quantifica o total de despesas pessoais pagas com dinheiro da empresa e emite o alerta educativo no relatório.
2. **Economia em Juros Evitados:**
   * Exibe no fechamento: *"🛡️ Proteção de Pontualidade: 100% dos seus compromissos foram lembrados e pagos no prazo. Economia estimada em juros/multas: R$ [Valor]"*.
3. **Alerta Preditivo de Caixa Crítico (D+15 / D+30):**
   * Se as saídas agendadas superarem os recebíveis futuros + saldo atual, emite alerta preventivo na Torre de Controle do BPO para que o gestor oriente o cliente com antecedência.

---

## FASE 6: PORTAL DO CLIENTE PWA MOBILE-FIRST (`/portal`)

* Interface otimizada para smartphones com suporte a PWA (`manifest.json`):
  * **Card 1:** Saldo Conciliado Hoje.
  * **Card 2:** Contas que Vencem nos Próximos 7 Dias (com botão copiar linha digitável).
  * **Card 3:** Resumo de Lucro dos últimos 3 meses (DRE simplificada).
  * **Botão Flutuante:** "Enviar Comprovante no WhatsApp" (link direto para a conversa).
* Isolamento absoluto via RLS: o cliente não acessa parâmetros de outros clientes nem a visão administrativa.

---

## REGRAS DE PRESERVAÇÃO E TESTES DE BUILD:
1. **Preservação de Autosserviço:** Não remova ou desative as rotas e limites dos clientes do plano Trial / Start / Solo. Eles continuam existindo de forma autônoma.
2. **Validação Rigorosa:**
   * Verifique a integridade dos tipos TypeScript.
   * Execute `npm run build` no terminal. O build deve compilar com código 0, gerando todas as rotas estáticas e dinâmicas sem erros de tipagem ou quebra de dependências.