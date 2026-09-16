# HISTÓRICO DE EVOLUÇÃO E GUIA GERAL DO ANALISAÍ SOLO

Este documento reúne, em linguagem simples, transparente e direta, toda a trajetória de desenvolvimento e as regras de negócio do **AnalisAí Solo**. Ele serve como guia permanente para qualquer pessoa — técnica ou leiga — entender exatamente o que o sistema faz, quais planos existem e como cada peça funciona.

> **Padrão de Versionamento Oficial:**
> O aplicativo adota versão centralizada em `src/lib/version.ts`.
> Todo commit e deploy no Git/Vercel é obrigatoriamente prefixado com a versão ativa (ex: `[v2.4.0]: Descrição da alteração`).

---

## 1. Visão Geral do Produto

O **AnalisAí Solo** é um assistente financeiro e contábil inteligente que roda 100% diretamente no **WhatsApp**. Ele elimina planilhas manuais, digitação de códigos de barras e a necessidade de instalar aplicativos pesados.

### O que o robô faz no dia a dia:
1. **Leitura Instantânea (Visão Computacional & IA):** O empresário envia uma foto ou PDF de boleto ou nota fiscal e a IA (Gemini 2.5 Flash) decodifica fornecedor, valor, vencimento e código de barras em menos de 15 segundos.
2. **Lançamentos por Voz e Texto:** O cliente pode mandar áudio ou mensagem de texto (ex: *"Pagar fornecedor de tintas R$ 450 no dia 28"* ou *"Receber R$ 1.500 do cliente Pedro amanhã"*). Se faltar algum dado essencial (valor, favorecido ou vencimento), o robô conduz um bate-bola acolhedor para completar o cadastro.
3. **Contas a Pagar e Contas a Receber:** Registra tanto saídas quanto entradas financeiras, permitindo prever o saldo real de caixa e alimentar o DRE.
4. **Lembretes Diários Pontuais (às 10h BRT):** Avisa com precisão na véspera e no dia do vencimento, entregando o código de barras ou chave Pix pronto para copiar e pagar no app do banco.
5. **Anti-Duplicação Inteligente de Boletos e NFs:** Quando o cliente envia uma Nota Fiscal a prazo, o robô cadastra todas as parcelas futuras. Quando o boleto bancário correspondente chega dias depois, o robô reconhece o valor e vencimento e anexa o código de barras à parcela existente, sem duplicar o lançamento no caixa!
6. **Conciliação Bancária Proativa:** O robô solicita ativamente o extrato bancário (PDF ou OFX) na frequência do plano para conferir tarifas, débitos e créditos contra o Livro Caixa.
7. **Segurança Psicológica Absoluta:** Trata contas atrasadas como parte normal da rotina das PMEs, sem alarmes falsos, sermões ou julgamentos. Em momentos de aperto de caixa, o robô prioriza orientar sem nunca empurrar vendas inoportunas.

---

## 2. Grade de Planos Digitais & Regras de Conciliação

Todos os planos do AnalisAí são 100% digitais, automáticos e escaláveis:

| Plano | Valor Mensal | Valor Anual (Economia) | Franquia Lançamentos/mês | CNPJs | Conciliação Bancária | Degustação Inicial |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **AnalisAí Start** | R$ 39,90 | R$ 383,04 (R$ 31,92/mês) | 15 lançamentos | 1 | Avulsa sob demanda (+R$ 37/mês) | 1 lançamento |
| **AnalisAí Solo** ⭐ | R$ 87,99 | R$ 844,70 (R$ 70,39/mês) | 30 lançamentos | 1 | Mensal (1 conta bancária) | 1 lançamento |
| **AnalisAí Solo Plus** | R$ 157,99 | R$ 1.516,70 (R$ 126,39/mês) | 60 lançamentos | 1 | Mensal (1 conta bancária) | 1 lançamento |
| **AnalisAí Pro** 🏢 | R$ 297,00 | R$ 2.851,20 (R$ 237,60/mês) | 500 lançamentos | Até 2 | Semanal (até 2 contas bancárias) | Até 10 lançamentos |
| **AnalisAí Super** 🚀 | R$ 597,00 | R$ 5.731,20 (R$ 477,60/mês) | 1.000 lançamentos | Até 4 | Semanal/Contínua (até 4 contas bancárias) | Até 50 lançamentos |

### Serviços Avulsos sob Demanda:
- **DRE Agrupado Multi-CNPJ:** R$ 27,99 por cada CNPJ adicional (consolidação contábil unificada).
- **Conciliação Bancária Extra:** R$ 37,00 por conta/mês.
- **Análise de Caixa Avulsa (Qual conta adiar):** R$ 14,90.
- **Pacote Extra (+20 Lançamentos):** R$ 14,90 (validade de 60 dias, válido para texto, áudio, fotos e PDFs).
- **Raio-X de Fornecedores:** R$ 59,90.
- **Certificado Digital A1:** R$ 170,00.

---

## 3. Linha do Tempo das Versões

### [v2.4.3] — Quadro de Sócios (QSA), Alerta Sócio vs Terceiro, Monitor de Dividendos (<50k) & Blindagem de Caixa no Referral
- **Quadro de Sócios (QSA) & Tabela `client_partners`:**
  - Sincronização gratuita com a BrasilAPI via CNPJ para mapear os sócios da empresa.
  - Diferenciação cirúrgica entre **Boleto do Sócio** (confusão patrimonial -> Pró-labore) e **Boleto de Terceiro Desconhecido** (risco crítico de 35% de IRRF por pagamento sem causa perante a Receita Federal).
- **Monitor Acumulado Diário de Dividendos (< R$ 50k/mês):**
  - Módulo `dividend-tracker.ts` que calcula o total de retiradas de lucros/pró-labore no mês corrente.
  - Barra de progresso visual (`[████████░░░░░░░░] 40%`) e alertas preventivos com base no teto de monitoramento fiscal e da e-Financeira (R$ 50.000,00).
  - Integrado aos comandos `!status`, `!dividendos` e `!lucros` no WhatsApp.
- **Blindagem de Caixa no Programa de Indicação (Regra de Ativação Prévia):**
  - Ajuste na RPC `evaluate_referral_exemption`: o indicador **obrigatoriamente deve ter pago a 1ª mensalidade** (`asaas_payment_id IS NOT NULL`) para ativar o benefício.
  - Elimina qualquer risco de "loop gratuito/pirâmide" sem entrada de receita no caixa: cada cliente traz dinheiro antes de usufruir da isenção.
  - Banner e teasers antecipados na Landing Page e no menu pós-degustação comunicando a regra com total transparência e alto poder de conversão.

### [v2.4.2] — Blindagem de Demanda no DB, Programa de Indicação Automático & Consultoria Patrimonial
- **Estatísticas de Demanda no DB (Fila de Espera Pro & Super):** 
  - Criação da tabela `plan_waitlist`, da tabela agregada `plan_waitlist_stats` e da view executiva `v_plan_waitlist_summary` no Supabase via Migration 012.
  - Trigger em tempo real no PostgreSQL sincronizando empresas aguardando e receita mensal potencial reprimida (MRR).
  - Alerta instantâneo no WhatsApp do administrador (Marcos) a cada novo interessado registrado.
  - Comando Admin `!waitlist` e `!demanda` para consulta imediata de estatísticas consolidadas no WhatsApp.
- **Programa de Indicação 100% Automático e Ativo:**
  - Vínculo automático de leads que chegam via link de indicação (`linkReferralLead`).
  - Qualificação automática no Webhook do Asaas no momento da confirmação do primeiro pagamento (`qualifyReferralOnPayment`).
  - Execução da RPC `evaluate_referral_exemption`: quem indica 3 pagantes ativos no mesmo plano ou superior ganha isenção de 100% da mensalidade (`is_referral_exempt = true`).
  - Regra de ouro da continuidade: se um dos 3 indicados cancelar ou atrasar, a isenção cai automaticamente.
  - Comando `!indicar` no WhatsApp para qualquer cliente acompanhar seu saldo de indicados e gerar seu link exclusivo.
- **Blindagem Patrimonial Pedagógica (1 CNPJ + 1 CPF no Solo Plus):**
  - Módulo `patrimonial-advisor.ts` com normalização de acentos e detecção de despesas de Pessoa Física (escola, condomínio residencial, farmácia, etc.).
  - Orientação consultiva didática e acolhedora orientando a transferência prévia da conta PJ para a PF como Pró-Labore ou Lucro antes de pagar o boleto pessoal.
  - Atualização do card do plano Solo Plus (R$ 157,99) na Landing Page destacando `1 CNPJ + 1 CPF Integrados`.
- **Posicionamento Sob Demanda dos Planos Corporativos:**
  - Planos Pro (R$ 297) e Super (R$ 597) posicionados como "Sob Demanda • Vagas Restritas" na Landing Page, com direcionamento para WhatsApp do bot alimentando a lista de espera.
- **Bateria de Testes Automatizados (15 de 15 Aprovados):** Validação metódica da lista de espera, regra de indicação, consultoria patrimonial e degustação MEI.

### [v2.4.1] — Degustação Silenciosa por Porte, Anti-Abuso e Lembretes Educativos
- **Classificação Tributária Automática:** Módulo `tax-classifier.ts` com consulta à BrasilAPI e fallback heurístico para identificar o perfil tributário do lead sem atrito.
- **Cotas Proporcionais de Degustação:**
  - **CPF (Pessoa Física):** 1 degustação de demonstração.
  - **MEI:** 3 degustações para validação da rotina dos planos Start/Solo.
  - **Simples Nacional / EPP / Médio Porte:** até 10 degustações para teste em lote corporativo sem canibalizar os planos Pro e Super.
- **Degustação Silenciosa (Anti-Abuso):** O robô não expõe publicamente contadores de cota gratuita; quando o lead atinge o teto do seu porte, o sistema bloqueia gentilmente e apresenta o plano com fit perfeito para ele.
- **Lembretes Estratégicos em Duas Etapas com Transparência Contratual:**
  - **Na Véspera (D-1 às 10h):** Alívio de não ser pego de surpresa, valor do Livro Caixa em PDF e delimitação de que comandos de voz são a partir do Plano Solo.
  - **No Vencimento (D-0 às 10h):** Urgência de pagamento, código de barras limpo, e discriminação clara de que conciliação mensal pertence ao Solo Plus e conciliação semanal e multi-CNPJ são exclusivos dos Planos Pro e Super.
- **Landing Page Alinhada:** FAQ e CTAs atualizados com nova grade digital e conceito de lançamentos.

### [v2.4.0] — Grade Expandida, Transição para Lançamentos & Regras Contratuais
- **Transição de "Documentos" para "Lançamentos":** Todas as interações que inserem contas a pagar/receber no Livro Caixa (seja via foto, PDF, comando de áudio ou texto digitado) são computadas no limite mensal contratual com total transparência ao cliente.
- **Termos de Uso e Contrato Modular Atualizados:** Inclusão formal da Cláusula 2.4 no Contrato e Seção 3.1 nos Termos de Uso esclarecendo a definição de Lançamento e a igualdade de canais de entrada.
- **Inclusão dos Planos Pro e Super:** Modelagem digital de alta performance para substituir e digitalizar o antigo BPO humano tradicional com links reais do Asaas.
- **DRE Agrupado Multi-CNPJ:** Módulo avulso de R$ 27,99 por empresa extra para holdings, filiais e sócios com múltiplos negócios.
- **Degustação Escalada & Flexível:** Suporte a fotos, PDFs e textos na degustação de novos leads (`trial_leads`).
- **Cofre Digital como Argumento de Venda:** Na degustação gratuita, salvam-se os dados contábeis; nos planos pagos, os comprovantes ficam arquivados permanentemente na nuvem.
- **Anti-Duplicação Boleto x Nota Fiscal:** Vinculação automática do código de barras à parcela existente de NF aberta por matching inteligente de fornecedor, vencimento e valor.
- **Lançamento Conversacional por Texto/Áudio com Dedução de Cota:** O robô identifica a intenção financeira em linguagem natural, faz bate-bola de dados faltantes (sem debitar cota no esclarecimento) e, ao cadastrar, deduz da cota do plano informando os lançamentos restantes. Se esgotado, oferece o Pacote Extra (+20 Lançamentos por R$ 14,90) ou upgrade.
- **Cron de Conciliação Bancária Proativa:** Rota `/api/cron/bank-reconciliation-reminders` que dispara pedidos de extrato toda segunda-feira (para Pro e Super) e no 1º dia do mês (para Solo e Solo Plus).

### [v2.3.0] — Idempotência e Horário Oficial de Brasília
- Ajuste do cron de lembretes para às 10:00 pontual de Brasília (13:00 UTC no Vercel Crons).
- Criação da coluna `last_reminder_sent_at` na tabela `payables_receivables` para garantir idempotência e impedir envios duplicados no mesmo dia.
- Correção do download de mídias criptografadas da Evolution API v2.3.7 na degustação gratuita (envio do objeto completo `{ key, message }`).

### [v2.2.0] — Relatório Oficial em PDF e Identidade Visual
- Criação do gerador de PDF executivo A4 em conformidade contábil (`pdf-lib`).
- Inclusão do logotipo horizontal oficial da Solucione / AnalisAí em base64.
- Suporte a acentuação correta em português do Brasil (WinAnsiEncoding sanitizado).
- Destaque em vermelho para contas vencidas com cálculo automático de dias de mora.

### [v2.1.0] — Integração WhatsApp Evolution API
- Instalação e homologação do container Docker com a Evolution API v2.3.7.
- Configuração do túnel Cloudflare seguro para comunicação bidirecional com a Vercel.
- Leitura multimodal de imagens e documentos via Google Gemini 2.5 Flash.

### [v2.0.0] — Modelagem do AnalisAí Solo no WhatsApp
- Transição da operação manual de BPO para inteligência artificial no WhatsApp.
- Integração com gateway de pagamentos Asaas (assinaturas recorrentes e produtos avulsos).

---
*Documento mantido e atualizado a cada versão pelo time de engenharia AnalisAí.*
