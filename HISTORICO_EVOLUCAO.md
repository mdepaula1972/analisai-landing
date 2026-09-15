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

| Plano | Valor Mensal | Valor Anual (20% OFF) | Volume Docs/mês | CNPJs | Conciliação Bancária | Degustação Gratuita |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **AnalisAí Start** | R$ 39,90 | R$ 383,04 (R$ 31,92/mês) | 15 docs | 1 | Avulsa sob demanda (+R$ 37/mês) | 1 doc |
| **AnalisAí Solo** ⭐ | R$ 87,99 | R$ 844,70 (R$ 70,39/mês) | 30 docs | 1 | Mensal (1 conta bancária) | 1 doc |
| **AnalisAí Solo Plus** | R$ 157,99 | R$ 1.516,70 (R$ 126,39/mês) | 60 docs | 1 | Mensal (1 conta bancária) | 1 doc |
| **AnalisAí Pro** 🏢 | R$ 297,00 | R$ 2.851,20 (R$ 237,60/mês) | 500 docs | Até 2 | Semanal (até 2 contas bancárias) | Até 10 docs |
| **AnalisAí Super** 🚀 | R$ 597,00 | R$ 5.731,20 (R$ 477,60/mês) | 1.000 docs | Até 4 | Semanal/Contínua (até 4 contas bancárias) | Até 50 docs |

### Serviços Avulsos sob Demanda:
- **DRE Agrupado Multi-CNPJ:** R$ 27,99 por cada CNPJ adicional (consolidação contábil unificada).
- **Conciliação Bancária Extra:** R$ 37,00 por conta/mês.
- **Análise de Caixa Avulsa (Qual conta adiar):** R$ 14,90.
- **Pacote Extra de 20 Documentos:** R$ 14,90 (validade de 60 dias).
- **Raio-X de Fornecedores:** R$ 59,90.
- **Certificado Digital A1:** R$ 170,00.

---

## 3. Linha do Tempo das Versões

### [v2.4.0] — Grade Expandida, Conciliação Proativa & Lançamentos Conversacionais
- **Inclusão dos Planos Pro e Super:** Modelagem digital de alta performance para substituir e digitalizar o antigo BPO humano tradicional.
- **DRE Agrupado Multi-CNPJ:** Módulo avulso de R$ 27,99 por empresa extra para holdings, filiais e sócios com múltiplos negócios.
- **Degustação Escalada (1 doc, 10 docs no Pro, 50 docs no Super):** Suporte a contagem de cota de testes na tabela `trial_leads` do Supabase.
- **Cofre Digital como Argumento de Venda:** Na degustação gratuita, salvam-se apenas os dados cadastrais (sem armazenar fotos pesadas em bucket); nos planos pagos, os documentos ficam arquivados permanentemente em cofre na nuvem.
- **Anti-Duplicação Boleto x Nota Fiscal:** Vinculação automática do código de barras à parcela existente de NF aberta por matching inteligente de fornecedor, vencimento e valor.
- **Lançamento Conversacional por Texto/Áudio:** O robô identifica a intenção financeira em linguagem natural, faz bate-bola amigável de campos faltantes e registra contas a pagar e contas a receber.
- **Cron de Conciliação Bancária Proativa:** Rota `/api/cron/bank-reconciliation-reminders` que dispara pedidos de extrato toda segunda-feira (para Pro e Super) e no 1º dia do mês (para Solo e Solo Plus).
- **Segurança Psicológica no System Instruction:** Normalização sem alarme de contas vencidas, postura de parceiro de trincheira e proibição de upsell comercial sob vulnerabilidade financeira.

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
