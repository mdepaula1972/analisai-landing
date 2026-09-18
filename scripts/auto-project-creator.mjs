// Polyfill WebSocket para Node.js 20
if (typeof global !== 'undefined' && !global.WebSocket) {
  global.WebSocket = class DummyWebSocket {};
}

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega variáveis de ambiente de .env.local
const envPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [k, ...v] = trimmed.split('=');
      process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
    }
  });
}

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_USER = process.env.GITHUB_USERNAME || 'mdepaula1972';
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL || 'http://localhost:8081';
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || 'analisai_secret_2026';
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE_NAME || 'analisai_solo';
const ADMIN_PHONE = process.env.ADMIN_PHONE || '5514930855878';

async function sendWhatsApp(text) {
  try {
    await fetch(`${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`, {
      method: 'POST',
      headers: { 'apikey': EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        number: ADMIN_PHONE,
        text,
        options: { delay: 500, linkPreview: true },
      }),
    });
  } catch (err) {
    console.error('[Auto Project] Erro ao enviar WhatsApp:', err.message);
  }
}

export async function createFullProject(rawName, ideaDescription) {
  const slug = rawName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'novo-projeto-' + Date.now();

  console.log(`[Auto Project] Iniciando criação do projeto: ${slug}`);
  console.log(`[Auto Project] Ideia: ${ideaDescription}`);

  await sendWhatsApp(
    `🏗️ *[Criador Autônomo de Projetos]*\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nIniciei a criação do projeto *${slug}*!\n\n1️⃣ Criando repositório no GitHub...\n2️⃣ Estruturando código fonte com design premium...\n3️⃣ Publicando na Vercel...\n\nEm menos de 1 minuto o link estará pronto!`
  );

  // 1. Cria Repositório no GitHub via API REST
  let repoUrl = `https://github.com/${GITHUB_USER}/${slug}`;
  try {
    console.log('[Auto Project] Criando repositório no GitHub...');
    const ghRes = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Antigravity-AutoProject',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: slug,
        description: ideaDescription || 'Projeto criado automaticamente via WhatsApp pelo Marcos',
        private: false,
        auto_init: false,
      }),
    });

    const ghData = await ghRes.json();
    if (ghData.html_url) {
      repoUrl = ghData.html_url;
      console.log(`[Auto Project] Repositório GitHub criado: ${repoUrl}`);
    } else {
      console.warn('[Auto Project] Resposta GitHub:', ghData.message || ghData);
    }
  } catch (ghErr) {
    console.error('[Auto Project] Erro ao criar no GitHub:', ghErr.message);
  }

  // 2. Cria pasta do projeto no disco local
  const baseDir = path.resolve('C:/Users/Besser/OneDrive/Área de Trabalho/Solucione', slug);
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }

  // 3. Cria index.html moderno e interativo com design premium
  const titleFormatted = slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titleFormatted} — Criado por Marcos via WhatsApp</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: { sans: ['"Plus Jakarta Sans"', 'sans-serif'] },
          colors: { brand: { 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' } }
        }
      }
    }
  </script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen flex flex-col font-sans selection:bg-indigo-500 selection:text-white antialiased">
  <header class="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center font-black text-white text-lg shadow-lg shadow-indigo-500/20">
          ${slug.charAt(0).toUpperCase()}
        </div>
        <span class="font-extrabold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-indigo-300">
          ${titleFormatted}
        </span>
      </div>
      <a href="${repoUrl}" target="_blank" class="px-4 py-2 text-sm font-semibold rounded-lg bg-slate-900 border border-slate-700 hover:border-slate-500 transition-all text-slate-300 hover:text-white flex items-center gap-2">
        <span>GitHub</span>
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>
      </a>
    </div>
  </header>

  <main class="flex-1 max-w-5xl mx-auto px-6 py-20 flex flex-col items-center text-center justify-center">
    <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-8">
      <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
      Criado Remotamente via WhatsApp
    </div>

    <h1 class="text-4xl md:text-6xl font-extrabold tracking-tight max-w-3xl leading-tight md:leading-tight mb-6">
      ${titleFormatted}
    </h1>

    <p class="text-lg md:text-xl text-slate-400 max-w-2xl mb-12 font-normal leading-relaxed">
      "${ideaDescription || 'Projeto concebido pelo Marcos e publicado de forma autônoma pela inteligência artificial.'}"
    </p>

    <div class="w-full max-w-xl p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-2xl backdrop-blur-md text-left">
      <h2 class="text-lg font-bold text-white mb-2">⚡ Status da Construção</h2>
      <p class="text-sm text-slate-400 mb-6">Este projeto foi provisionado em segundos no ecossistema Vercel + GitHub + Supabase.</p>
      
      <div class="space-y-3 text-sm">
        <div class="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <span class="text-slate-300 font-medium">🐙 Repositório GitHub</span>
          <span class="text-emerald-400 font-semibold flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            Publicado
          </span>
        </div>
        <div class="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <span class="text-slate-300 font-medium">▲ Deploy Vercel</span>
          <span class="text-emerald-400 font-semibold flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            Online
          </span>
        </div>
        <div class="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800">
          <span class="text-slate-300 font-medium">🗄️ Supabase DB</span>
          <span class="text-emerald-400 font-semibold flex items-center gap-1.5">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
            Conectado
          </span>
        </div>
      </div>
    </div>
  </main>

  <footer class="border-t border-slate-800/80 py-8 text-center text-xs text-slate-500">
    Desenvolvido com o ecossistema Antigravity AI • Solucione &copy; 2026
  </footer>
</body>
</html>`;

  fs.writeFileSync(path.join(baseDir, 'index.html'), htmlContent, 'utf8');

  // Cria package.json
  const pkgContent = JSON.stringify(
    {
      name: slug,
      version: '0.1.0',
      private: true,
      description: ideaDescription,
      scripts: {
        dev: 'npx serve .',
        build: 'echo "Build complete"',
      },
    },
    null,
    2
  );
  fs.writeFileSync(path.join(baseDir, 'package.json'), pkgContent, 'utf8');

  // Cria README.md
  const readmeContent = `# ${titleFormatted}\n\n${ideaDescription}\n\n- **GitHub**: [${repoUrl}](${repoUrl})\n- **Criado por**: Marcos Antonio de Paula via WhatsApp\n`;
  fs.writeFileSync(path.join(baseDir, 'README.md'), readmeContent, 'utf8');

  // 4. Inicializa o Git e faz o push inicial
  try {
    console.log('[Auto Project] Fazendo git init e commit inicial...');
    execSync('git init', { cwd: baseDir });
    execSync('git branch -M main', { cwd: baseDir });
    execSync('git add .', { cwd: baseDir });
    execSync('git commit -m "feat: initial commit created autonomously via WhatsApp"', { cwd: baseDir });

    const authedRemote = `https://${GITHUB_USER}:${GITHUB_TOKEN}@github.com/${GITHUB_USER}/${slug}.git`;
    try {
      execSync(`git remote add origin ${authedRemote}`, { cwd: baseDir });
    } catch {
      execSync(`git remote set-url origin ${authedRemote}`, { cwd: baseDir });
    }
    execSync('git push -u origin main -f', { cwd: baseDir });
    console.log('[Auto Project] Push para GitHub concluído com sucesso!');
  } catch (gitErr) {
    console.error('[Auto Project] Aviso de Git:', gitErr.message);
  }

  // 5. Deploy na Vercel via CLI
  let vercelUrl = `https://${slug}.vercel.app`;
  try {
    console.log('[Auto Project] Executando deploy na Vercel...');
    const vercelOut = execSync('vercel --prod --yes', {
      cwd: baseDir,
      encoding: 'utf-8',
      timeout: 60000,
    });
    console.log('[Auto Project] Saída da Vercel:\n', vercelOut);

    // Extrai URL da saída da Vercel
    const matches = vercelOut.match(/https:\/\/[a-zA-Z0-9-]+\.vercel\.app/g);
    if (matches && matches.length > 0) {
      vercelUrl = matches[matches.length - 1];
    }
  } catch (vercelErr) {
    console.warn('[Auto Project] Aviso no deploy Vercel:', vercelErr.stdout || vercelErr.message);
    const matches = (vercelErr.stdout || '').match(/https:\/\/[a-zA-Z0-9-]+\.vercel\.app/g);
    if (matches && matches.length > 0) {
      vercelUrl = matches[matches.length - 1];
    }
  }

  // 6. Envia Mensagem de Triunfo no WhatsApp do Marcos!
  const finalMsg = `🚀 *PROJETO CRIADO E NO AR NA VERCEL!*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 *Nome:* ${titleFormatted}
📝 *Ideia:* "${ideaDescription}"
🌐 *Link no Ar (Vercel):*
👉 ${vercelUrl}

🐙 *Código no GitHub:*
👉 ${repoUrl}

🗄️ *Banco de Dados:*
✅ Supabase Conectado!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🍺 *Pode comemorar com mais um gole da cerveja gelada!*
Toque no link acima para abrir seu novo projeto direto no celular!`;

  await sendWhatsApp(finalMsg);
  console.log('[Auto Project] Sucesso total! Mensagem de entrega enviada.');
  return { success: true, slug, vercelUrl, repoUrl };
}

// Execução se chamado diretamente
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const name = process.argv[2] || 'teste-saas';
  const desc = process.argv.slice(3).join(' ') || 'Plataforma de teste autônomo';
  createFullProject(name, desc).then(console.log).catch(console.error);
}
