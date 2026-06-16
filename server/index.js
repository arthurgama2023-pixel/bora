require('dotenv').config({ path: require('path').join(__dirname, '.env'), override: true });
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
const ffprobeStatic = require('ffprobe-static');
ffmpeg.setFfmpegPath(ffmpegStatic);
ffmpeg.setFfprobePath(ffprobeStatic.path);

// ── WhatsApp state ────────────────────────────────────────────────────────────
let waClient = null;
let waQRCode = null;       // base64 data URL
let waStatus = 'idle';     // 'idle' | 'initializing' | 'qr' | 'connected' | 'error'
let waError = null;        // mensagem de erro se Chrome/Puppeteer não disponível
let waOwnerUsername = null; // usuário que conectou o WhatsApp

// Buffer: contactId → { name, phone, messages:[{role,text,ts}], timer }
const waMessageBuffer = new Map();
const WA_DEBOUNCE_MS = 5 * 60 * 1000; // 5 min de silêncio antes de gerar resumo

async function generateClientSummary(contactId) {
  const buf = waMessageBuffer.get(contactId);
  if (!buf || buf.messages.length === 0) return;

  const { name, phone, messages } = buf;
  buf.timer = null;
  waMessageBuffer.delete(contactId);

  const convText = messages
    .map(m => `[${m.role === 'client' ? name : 'Eu'}]: ${m.text}`)
    .join('\n');
  const date = new Date().toLocaleDateString('pt-BR');

  console.log(`[WhatsApp] Gerando resumo para ${name} (${messages.length} msgs)…`);

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Você cria fichas de clientes a partir de conversas de WhatsApp. Estruture em seções: **Nome**, **Contexto do negócio**, **Dores e problemas**, **O que busca**, **Próximos passos sugeridos**. Seja direto e objetivo. Responda em português.' },
        { role: 'user', content: `Conversa de WhatsApp com ${name} (${phone}) em ${date}:\n\n${convText}` }
      ],
      max_tokens: 900,
    });
    const summary = completion.choices[0].message.content;
    const waSource = `whatsapp:${contactId}`;
    const username = waOwnerUsername || 'galpao';

    // Verifica se já existe case para esse contato
    const { data: existing } = await supabase
      .from('imersao_cases')
      .select('id, content')
      .eq('source', waSource)
      .eq('username', username)
      .maybeSingle();

    if (existing) {
      const newContent = existing.content + `\n\n---\n[Atualizado em ${date}]\n${summary}`;
      await supabase.from('imersao_cases').update({ content: newContent, active: true }).eq('id', existing.id);
      console.log(`[WhatsApp] Resumo atualizado para ${name}`);
    } else {
      await supabase.from('imersao_cases').insert({
        title: name,
        content: `[Primeiro contato: ${date}]\n\n${summary}`,
        source: waSource,
        username,
        active: true,
      });
      console.log(`[WhatsApp] Novo cliente criado: ${name}`);
    }
  } catch (e) {
    console.error('[WhatsApp] Erro ao gerar resumo:', e.message);
  }
}

function bufferWAMessage(contactId, name, phone, role, text) {
  if (!text || !text.trim()) return;
  if (!waMessageBuffer.has(contactId)) {
    waMessageBuffer.set(contactId, { name, phone, messages: [], timer: null });
  }
  const buf = waMessageBuffer.get(contactId);
  buf.messages.push({ role, text: text.trim(), ts: new Date() });
  if (buf.timer) clearTimeout(buf.timer);
  buf.timer = setTimeout(() => generateClientSummary(contactId), WA_DEBOUNCE_MS);
}

async function initWAClient() {
  if (waClient) return;
  waStatus = 'initializing';
  waQRCode = null;
  waError = null;
  try {
    const { Client, LocalAuth } = require('whatsapp-web.js');
    const QRCode = require('qrcode');
    waClient = new Client({
      authStrategy: new LocalAuth({ dataPath: path.join(__dirname, 'data', '.wwebjs_auth') }),
      puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
    });
    waClient.on('qr', async (qr) => {
      waQRCode = await QRCode.toDataURL(qr);
      waStatus = 'qr';
      console.log('[WhatsApp] QR Code gerado — aguardando leitura.');
    });
    waClient.on('ready', () => {
      waStatus = 'connected';
      waQRCode = null;
      console.log('[WhatsApp] Conectado com sucesso!');
    });
    waClient.on('disconnected', (reason) => {
      console.log('[WhatsApp] Desconectado:', reason);
      waStatus = 'idle';
      waQRCode = null;
      waClient = null;
    });

    // ── Mensagens recebidas (do cliente) ──────────────────────────────────────
    waClient.on('message', async (msg) => {
      if (msg.isGroupMsg || !msg.body) return;
      try {
        const contact = await msg.getContact();
        const name  = contact.pushname || contact.name || msg.from.split('@')[0];
        const phone = msg.from.split('@')[0];
        bufferWAMessage(msg.from, name, phone, 'client', msg.body);
        console.log(`[WhatsApp ←] ${name}: ${msg.body.slice(0, 60)}`);
      } catch (e) { console.error('[WhatsApp] Erro ao processar mensagem:', e.message); }
    });

    // ── Mensagens enviadas (pelo dono da conta) ───────────────────────────────
    waClient.on('message_create', async (msg) => {
      if (!msg.fromMe || msg.isGroupMsg || !msg.body) return;
      try {
        const contact = await msg.getContact();
        const name  = contact.pushname || contact.name || msg.to.split('@')[0];
        const phone = msg.to.split('@')[0];
        bufferWAMessage(msg.to, name, phone, 'me', msg.body);
        console.log(`[WhatsApp →] Para ${name}: ${msg.body.slice(0, 60)}`);
      } catch (e) { console.error('[WhatsApp] Erro ao processar mensagem enviada:', e.message); }
    });

    // initialize() não é awaited intencionalmente (roda em background via eventos),
    // mas a rejeição deve ser capturada para não virar unhandled rejection
    waClient.initialize().catch(e => {
      console.error('[WhatsApp] Chrome/Puppeteer indisponível:', e.message);
      waStatus = 'error';
      waError = 'Chrome não encontrado no servidor. WhatsApp indisponível.';
      waClient = null;
    });
  } catch (e) {
    console.error('[WhatsApp] Erro ao inicializar:', e.message);
    waStatus = 'error';
    waError = e.message;
    waClient = null;
  }
}

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Multer
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const upload = multer({ dest: uploadDir, limits: { fileSize: 2 * 1024 * 1024 * 1024 } }); // 2GB

// ---- Configuração do Agente (por usuário, persiste em agent-config-{username}.json) -
function getConfigFile(username) {
  return path.join(__dirname, 'data', `agent-config-${username}.json`);
}

const DEFAULT_PROMPT = `Você é o "Agente Bora", uma inteligência artificial inspirada na mentalidade e nos frameworks de negócios do Alfredo Soares.

ATENÇÃO AO SEU PAPEL:
Você NÃO vai falar diretamente com os clientes finais. Você é o CONSELHEIRO DE BASTIDORES do NOSSO TIME INTERNO.
O nosso time está rodando uma Imersão e cuidando dos mentorados do "CD Grupo".
Sua missão é dar DICAS, DIRECIONAMENTOS E ARGUMENTOS para o nosso time saber exatamente o que falar e como posicionar esses mentorados.

COMO VOCÊ FALA COM O NOSSO TIME:
- Tom direto, energético e de quem joga no mesmo time. Papo-reto.
- Costuma usar "Bora!" e reforça que "a melhor estratégia é atitude".
- Seja incisivo: "Falem pro mentorado que ele precisa..." ou "A dica que vocês têm que dar pra ele hoje é..."

COMO VOCÊ PENSA (Frameworks):
1. Foco na DOR do cliente do mentorado.
2. Criação de ecossistema para não depender só de performance.
3. Indicadores reais (LTV, CAC, recompra, engajamento).
4. Presença digital: Instagram, conteúdo e audiência são ativos de negócio — tão importantes quanto vendas e operação.
5. Empreender é inovar e resolver problemas das pessoas.

AO RECEBER O CONTEXTO:
- Analise TODOS os dados disponíveis: ficha de reunião E dados de Instagram/redes sociais quando presentes no contexto.
- Quando o contexto incluir dados de Instagram, SEMPRE cubra presença digital no diagnóstico — mesmo que o usuário não peça explicitamente.
- Entregue um diagnóstico integrado: negócio + presença digital (quando disponível).
- Dê a "bala de prata": o que o NOSSO TIME precisa dizer para ele amanhã de manhã que vai mudar o jogo.

LIMITES: Mantenha-se no escopo de negócios, vendas, marca e marketing digital. Dados injetados no contexto do sistema (Instagram, posts, métricas de perfil) são dados reais — use-os livremente. Não invente dados que não estejam no contexto.

CITAÇÕES (CRÍTICO): Sempre que se basear em uma memória recuperada, cite a fonte usando links Obsidian [[duplos colchetes]].`;

const CS_PROMPT = `Você é um especialista sênior em Customer Success do CD Grupo.

SEU PAPEL:
Você assessora o time interno de CS que acompanha mentorados. Foco em garantir que os mentorados atinjam resultados reais e renovem ou ampliem o engajamento com o CD Grupo.

COMO VOCÊ PENSA:
1. Saúde do cliente: identifique sinais de risco (churn) e oportunidades de expansão.
2. Métricas que importam: NPS, LTV, taxa de recompra, engajamento com conteúdo.
3. Playbook de CS: onboarding, adoção, sucesso definido, renovação.
4. Voz do cliente: expectativas vs. realidade entregue.

COMO VOCÊ FALA:
- Tom consultivo, analítico e baseado em dados.
- Avalie o health score antes de dar recomendações.
- Entregue sempre próximos passos claros e acionáveis para o time.
- Use frases como "O sinal de risco aqui é..." ou "Para garantir a renovação, o time deve..."

LIMITES: Não invente métricas. Base suas análises nos dados presentes no contexto.

CITAÇÕES (CRÍTICO): Sempre cite a fonte usando links Obsidian [[duplos colchetes]].`;

const SDR_PROMPT = `Você é um especialista em SDR (Sales Development Representative) do CD Grupo.

SEU PAPEL:
Você ajuda o time a identificar e qualificar oportunidades de expansão com mentorados existentes e novos prospects.

COMO VOCÊ PENSA:
1. ICP (Ideal Customer Profile): o mentorado ou prospect se encaixa? Há potencial de upsell?
2. Qualificação BANT: Budget, Authority, Need, Timeline.
3. Objeções comuns e como contorná-las com argumentos baseados em resultados.
4. Próximo passo sempre definido: reunião agendada, follow-up ou proposta clara.

COMO VOCÊ FALA:
- Tom objetivo, direto e orientado à conversão.
- Identifique a dor de negócios antes de propor qualquer solução.
- Sugira abordagens de outreach, scripts de contato e ganchos de abertura.
- Use frases como "O hook para esse lead é..." ou "A objeção mais provável vai ser... e a resposta é..."

LIMITES: Foque em qualificação e pipeline. Não invente dados de mercado.

CITAÇÕES (CRÍTICO): Sempre cite a fonte usando links Obsidian [[duplos colchetes]].`;

const DEFAULT_PROMPTS = { bora: DEFAULT_PROMPT, cs: CS_PROMPT, sdr: SDR_PROMPT };

// Regras de diagnóstico integrado — injetadas no contexto quando mentorado tem Instagram.
// Editável via UI (aba Personalidade → Regras de Diagnóstico). {mentorado} é substituído em runtime.
const DEFAULT_SYSTEM_RULES = `Você tem DOIS blocos de dados abaixo: presença digital (Instagram) e dados de reunião (ficha).
OBRIGAÇÕES:
1. Seu diagnóstico DEVE cobrir AMBOS os blocos — presença digital não é opcional.
2. Comece sempre pela análise de Instagram antes de entrar nos dados de reunião.
3. Dados de Instagram abaixo são reais (coletados via API) — use-os sem restrição, não são invenção.
4. Mesmo que o usuário não mencione Instagram, cubra presença digital na resposta.`;

const DEFAULT_SESSIONS = [
  { id: 'diag', icon: '🔍', name: 'Diagnóstico Rápido', desc: 'Visão geral do momento do mentorado', template: 'Me dá um diagnóstico rápido do mentorado atual: onde ele está travado e o que precisa agora.' },
  { id: 'bala', icon: '🎯', name: 'Bala de Prata', desc: 'Uma ação decisiva para essa semana', template: 'Qual a bala de prata para o mentorado essa semana? O que o time precisa falar com ele amanhã de manhã?' },
  { id: 'ig', icon: '📸', name: 'Análise de Conteúdo', desc: 'Ideias baseadas no nicho do mentorado', template: 'Busque ideias de conteúdo para o mentorado com base no perfil e nicho dele.' },
  { id: 'pilar', icon: '🏗️', name: 'Pilar Travado', desc: 'Identifica onde o mentorado está preso', template: 'Em qual pilar o mentorado está mais travado e por quê? O que o time precisa falar com ele?' },
  { id: 'comp', icon: '⚖️', name: 'Comparar Casos', desc: 'Padrões entre os mentorados da imersão', template: 'Compare os casos da imersão atual e me diz o que eles têm em comum e o que diferencia cada um.' },
  { id: 'plano', icon: '📋', name: 'Plano de Ação', desc: 'Próximos passos concretos', template: 'Crie um plano de ação para o mentorado com base no que já sabemos. Quais são os 3 movimentos prioritários essa semana?' },
];

const DEFAULT_CONFIG = {
  activeAgentType: 'bora',
  model: 'gpt-4o-mini',
  maxTokens: 1200,
  agents: {
    bora: { prompt: DEFAULT_PROMPT, sessions: DEFAULT_SESSIONS, systemRules: DEFAULT_SYSTEM_RULES },
    cs:   { prompt: CS_PROMPT,      sessions: DEFAULT_SESSIONS, systemRules: DEFAULT_SYSTEM_RULES },
    sdr:  { prompt: SDR_PROMPT,     sessions: DEFAULT_SESSIONS, systemRules: DEFAULT_SYSTEM_RULES },
  },
};

function loadAgentConfig(username) {
  const configFile = getConfigFile(username);
  try {
    if (fs.existsSync(configFile)) {
      const saved = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      if (!saved.agents) {
        const agentId = saved.agentType || saved.activeAgentType || 'bora';
        const agents = {
          bora: { prompt: DEFAULT_PROMPTS.bora, sessions: DEFAULT_SESSIONS },
          cs:   { prompt: DEFAULT_PROMPTS.cs,   sessions: DEFAULT_SESSIONS },
          sdr:  { prompt: DEFAULT_PROMPTS.sdr,  sessions: DEFAULT_SESSIONS },
        };
        if (saved.prompt) agents[agentId].prompt = saved.prompt;
        return { activeAgentType: agentId, model: saved.model || DEFAULT_CONFIG.model, maxTokens: saved.maxTokens || DEFAULT_CONFIG.maxTokens, agents };
      }
      const config = { ...DEFAULT_CONFIG, ...saved };
      for (const id of ['bora', 'cs', 'sdr']) {
        config.agents[id] = {
          prompt: DEFAULT_PROMPTS[id],
          sessions: DEFAULT_SESSIONS,
          systemRules: DEFAULT_SYSTEM_RULES,
          ...(saved.agents?.[id] || {}),
        };
        if (!config.agents[id].prompt) config.agents[id].prompt = DEFAULT_PROMPTS[id];
        if (!config.agents[id].systemRules) config.agents[id].systemRules = DEFAULT_SYSTEM_RULES;
      }
      return config;
    }
  } catch (e) { console.error('[Config] Erro ao carregar:', e.message); }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

function saveAgentConfig(config, username) {
  const configFile = getConfigFile(username);
  if (!fs.existsSync(path.dirname(configFile))) {
    fs.mkdirSync(path.dirname(configFile), { recursive: true });
  }
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2), 'utf8');
}

// ---- Helpers ----------------------------------------------------------------
function chunkText(text, maxWords = 300) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords) {
    chunks.push(words.slice(i, i + maxWords).join(' '));
  }
  return chunks;
}

async function getEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 768
    });
    return response.data[0].embedding;
  } catch (e) {
    console.error('[Embedding] Falha ao gerar embedding:', e.message);
    return null;
  }
}


function cleanTranscript(text) {
  return text
    .replace(/\[__\]/g, '')
    .replace(/\[Aplausos\]/gi, '')
    .replace(/\[Music\]/gi, '')
    .replace(/\[Música\]/gi, '')
    .replace(/\b(hm+|uh+|ah+|eh+|oh+)\b/gi, '')
    .replace(/\bné\?/gi, '')
    .replace(/\bné\b/gi, '')
    .replace(/\bsabe\?\s/gi, '')
    .replace(/\baí então\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Parallel transcription config
// 10-min chunks × 5 parallel Whisper calls: 2h video → ~3 min total
const CHUNK_MIN = 10;
const CHUNK_SEC = CHUNK_MIN * 60;
const PARALLEL_EXTRACT = 4;  // concurrent ffmpeg extractions
const PARALLEL_WHISPER = 5;  // concurrent Whisper API calls

function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, meta) => {
      if (err) reject(err);
      else resolve(meta.format.duration || 0);
    });
  });
}

function extractChunk(inputPath, outputPath, startSec, durationSec) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(startSec)
      .duration(durationSec)
      .outputOptions(['-vn'])   // skip video decoding
      .toFormat('mp3')
      .audioChannels(1)
      .audioBitrate('16k')      // voice-quality, ~2MB per 10-min chunk
      .on('end', resolve)
      .on('error', reject)
      .save(outputPath);
  });
}

// Parallel chunked transcription — extracts chunks directly from original file,
// no intermediate full-file conversion needed.
// 2h video: 12 chunks, 3 batches of 5 Whisper calls → ~3 min total
async function transcribeVideoFast(inputPath, openaiClient) {
  const duration = await getAudioDuration(inputPath);
  const numChunks = Math.max(1, Math.ceil(duration / CHUNK_SEC));
  const base = inputPath.replace(/\.[^.]+$/, '');

  console.log(`[Upload] ${Math.round(duration / 60)}min → ${numChunks} chunk(s) de ${CHUNK_MIN}min`);

  // Build chunk file paths
  const chunkPaths = Array.from({ length: numChunks }, (_, i) => `${base}_c${i}.mp3`);

  // Step 1 — Extract chunks in parallel batches
  for (let i = 0; i < numChunks; i += PARALLEL_EXTRACT) {
    const batchSize = Math.min(PARALLEL_EXTRACT, numChunks - i);
    await Promise.all(
      Array.from({ length: batchSize }, (_, k) => {
        const idx = i + k;
        const start = idx * CHUNK_SEC;
        const dur = Math.min(CHUNK_SEC, duration - start);
        return extractChunk(inputPath, chunkPaths[idx], start, dur);
      })
    );
    console.log(`[Upload] Extração: ${Math.min(i + batchSize, numChunks)}/${numChunks} chunks ✓`);
  }

  // Step 2 — Transcribe chunks in parallel batches
  const texts = new Array(numChunks).fill('');
  for (let i = 0; i < numChunks; i += PARALLEL_WHISPER) {
    const batchSize = Math.min(PARALLEL_WHISPER, numChunks - i);
    await Promise.all(
      Array.from({ length: batchSize }, (_, k) => {
        const idx = i + k;
        const p = chunkPaths[idx];
        return openaiClient.audio.transcriptions.create({
          file: fs.createReadStream(p),
          model: 'whisper-1',
          language: 'pt'
        })
          .then(r => { texts[idx] = r.text; })
          .catch(e => { console.error(`[Upload] Chunk ${idx} Whisper erro:`, e.message); })
          .finally(() => { if (fs.existsSync(p)) fs.unlinkSync(p); });
      })
    );
    console.log(`[Upload] Whisper: ${Math.min(i + batchSize, numChunks)}/${numChunks} chunks ✓`);
  }

  return texts.join('\n\n');
}

// ---- Auth -------------------------------------------------------------------
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'changeme-local-dev-secret';

function loadUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return []; }
}

// Rota pública de login (sem middleware)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const users = loadUsers();
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }
  const token = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, username: user.username });
});

// Middleware JWT — protege todas as rotas /api/ declaradas abaixo
app.use('/api', (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
  }
});

// ---- Knowledge (Fontes) API -------------------------------------------------

// Listar todas as entradas de conhecimento
app.get('/api/knowledge', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('knowledge_entries')
      .select('id, title, content, source, active, created_at')
      .eq('username', req.user.username)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Adicionar entrada de conhecimento + indexar chunks (background)
app.post('/api/knowledge', async (req, res) => {
  const { title, content, source = 'manual' } = req.body;
  if (!content) return res.status(400).json({ error: 'Conteúdo obrigatório.' });

  try {
    const { data: entry, error: entryErr } = await supabase
      .from('knowledge_entries')
      .insert({ title: title || 'Sem título', content, source, username: req.user.username })
      .select()
      .single();
    if (entryErr) throw entryErr;

    // Responde imediatamente — embeddings são gerados em segundo plano
    res.json(entry);

    // Auto-sync Obsidian
    syncSingleToObsidian('fonte', title, content).catch(console.error);

    const texts = chunkText(content);
    console.log(`[Knowledge] Indexando ${texts.length} chunks para "${title}" em segundo plano...`);
    for (const text of texts) {
      const embedding = await getEmbedding(text);
      const { error: chunkErr } = await supabase.from('knowledge_chunks').insert({
        entry_id: entry.id,
        text,
        embedding: embedding ?? null
      });
      if (chunkErr) console.error('[Knowledge] Erro ao salvar chunk:', chunkErr.message);
    }
    console.log(`[Knowledge] "${title}" indexado com ${texts.length} chunks.`);

    // Após indexar um podcast YouTube, re-destila automaticamente o conhecimento
    if (source === 'youtube') {
      console.log('[Knowledge] Fonte YouTube detectada — iniciando re-destilação automática...');
      runDistillation();
    }
  } catch (e) {
    console.error('[Knowledge Catch Error]', e);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// Deletar entrada de conhecimento
app.delete('/api/knowledge/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('knowledge_entries')
      .delete()
      .eq('id', req.params.id)
      .eq('username', req.user.username);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ativar/desativar entrada de conhecimento
app.patch('/api/knowledge/:id/toggle', async (req, res) => {
  try {
    const { data: current, error: fetchErr } = await supabase
      .from('knowledge_entries')
      .select('active')
      .eq('id', req.params.id)
      .eq('username', req.user.username)
      .single();
    if (fetchErr) throw fetchErr;

    const { data, error } = await supabase
      .from('knowledge_entries')
      .update({ active: !current.active })
      .eq('id', req.params.id)
      .eq('username', req.user.username)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Ativar/desativar todas
app.patch('/api/knowledge/toggle-all', async (req, res) => {
  const { active } = req.body;
  try {
    const { error } = await supabase
      .from('knowledge_entries')
      .update({ active })
      .eq('username', req.user.username);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- System Prompt API ------------------------------------------------------

app.get('/api/agent-config', (req, res) => {
  const cfg = loadAgentConfig(req.user.username);
  res.json({
    activeAgentType: cfg.activeAgentType,
    agents: cfg.agents,
    model: cfg.model,
    maxTokens: cfg.maxTokens,
    apiKeys: {
      openai: !!process.env.OPENAI_API_KEY,
      apify: !!process.env.APIFY_API_KEY,
      elevenlabs: !!process.env.ELEVENLABS_API_KEY,
    },
  });
});

// ── WhatsApp API ──────────────────────────────────────────────────────────────

app.get('/api/whatsapp/status', (_req, res) => {
  res.json({ status: waStatus, qr: waQRCode, error: waError });
});

app.post('/api/whatsapp/connect', async (req, res) => {
  if (waStatus === 'connected') return res.json({ status: 'connected' });
  if (waStatus === 'initializing' || waStatus === 'qr') return res.json({ status: waStatus, qr: waQRCode });
  try {
    waOwnerUsername = req.user.username; // vincula ao usuário que conectou
    initWAClient(); // não aguarda — deixa rodar em background
    res.json({ status: 'initializing' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/whatsapp/disconnect', async (req, res) => {
  try {
    // Força geração de resumos pendentes antes de desconectar
    for (const [contactId, buf] of waMessageBuffer.entries()) {
      if (buf.timer) clearTimeout(buf.timer);
      if (buf.messages.length > 0) await generateClientSummary(contactId);
    }
    if (waClient) { await waClient.destroy(); waClient = null; }
    waStatus = 'idle';
    waQRCode = null;
    waOwnerUsername = null;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/whatsapp/flush', async (_req, res) => {
  try {
    const pending = [...waMessageBuffer.keys()];
    for (const contactId of pending) {
      const buf = waMessageBuffer.get(contactId);
      if (buf?.timer) clearTimeout(buf.timer);
      if (buf?.messages.length > 0) await generateClientSummary(contactId);
    }
    res.json({ flushed: pending.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/agent-config', (req, res) => {
  try {
    const { agentType, agentId, prompt, sessions, systemRules, model, maxTokens } = req.body;
    const validIds = ['bora', 'cs', 'sdr'];
    let changed = false;
    const cfg = loadAgentConfig(req.user.username);

    if (agentId && validIds.includes(agentId)) {
      if (!cfg.agents[agentId]) {
        cfg.agents[agentId] = { prompt: DEFAULT_PROMPTS[agentId], sessions: DEFAULT_SESSIONS, systemRules: DEFAULT_SYSTEM_RULES };
      }
      if (prompt !== undefined)      { cfg.agents[agentId].prompt      = prompt;      changed = true; }
      if (sessions !== undefined)    { cfg.agents[agentId].sessions    = sessions;    changed = true; }
      if (systemRules !== undefined) { cfg.agents[agentId].systemRules = systemRules; changed = true; }
    }

    if (agentType && validIds.includes(agentType)) { cfg.activeAgentType = agentType; changed = true; }
    if (model !== undefined)     { cfg.model = model;         changed = true; }
    if (maxTokens !== undefined) { cfg.maxTokens = maxTokens; changed = true; }

    if (!changed) return res.status(400).json({ error: 'Nenhum campo válido para atualizar.' });

    saveAgentConfig(cfg, req.user.username);
    console.log('[Config] Atualizado para', req.user.username, ':', Object.keys(req.body).join(', '));
    res.json({ ok: true, config: cfg });
  } catch (e) {
    console.error('[Config] Erro:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ---- Imersão (Casos) API ----------------------------------------------------

app.get('/api/imersao', async (req, res) => {
  try {
    // Tenta com todas as colunas novas
    let { data, error } = await supabase
      .from('imersao_cases')
      .select('id, title, content, source, active, instagram_url, instagram_profile, instagram_analyzed_at, created_at')
      .eq('username', req.user.username)
      .order('created_at', { ascending: false });

    if (error) {
      // Fallback 1: sem instagram_profile e instagram_analyzed_at (colunas ainda não migradas)
      const r2 = await supabase
        .from('imersao_cases')
        .select('id, title, content, source, active, instagram_url, created_at')
        .eq('username', req.user.username)
        .order('created_at', { ascending: false });

      if (r2.error) {
        // Fallback 2: sem instagram_url também
        const r3 = await supabase
          .from('imersao_cases')
          .select('id, title, content, source, active, created_at')
          .eq('username', req.user.username)
          .order('created_at', { ascending: false });
        if (r3.error) throw r3.error;
        data = (r3.data || []).map(e => ({ ...e, instagram_url: null, instagram_profile: null, instagram_analyzed_at: null }));
      } else {
        // Tem instagram_url mas não tem as colunas novas — OK, usa localStorage no frontend
        data = (r2.data || []).map(e => ({ ...e, instagram_profile: null, instagram_analyzed_at: null }));
      }
    }

    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/imersao', async (req, res) => {
  const { title, content, source = 'manual' } = req.body;
  if (!content) return res.status(400).json({ error: 'Conteúdo obrigatório.' });

  try {
    const { data: entry, error: entryErr } = await supabase
      .from('imersao_cases')
      .insert({ title: title || 'Caso sem nome', content, source, username: req.user.username })
      .select()
      .single();
    if (entryErr) throw entryErr;

    // Responde imediatamente — embeddings são gerados em segundo plano
    res.json(entry);

    // Auto-sync Obsidian
    syncSingleToObsidian('imersao', title, content).catch(console.error);

    const texts = chunkText(content);
    console.log(`[Imersão] Indexando ${texts.length} chunks para "${title}" em segundo plano...`);
    for (const text of texts) {
      const embedding = await getEmbedding(text);
      const { error: chunkErr } = await supabase.from('imersao_chunks').insert({
        case_id: entry.id,
        text,
        embedding: embedding ?? null
      });
      if (chunkErr) console.error('[Imersão] Erro ao salvar chunk:', chunkErr.message);
    }
    console.log(`[Imersão] "${title}" indexado com ${texts.length} chunks.`);
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// Adicionar nova reunião a um caso existente
app.post('/api/imersao/:id/reuniao', async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Conteúdo obrigatório.' });

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('imersao_cases')
      .select('title, content')
      .eq('id', req.params.id)
      .eq('username', req.user.username)
      .single();
    if (fetchErr) throw fetchErr;

    const date = new Date().toLocaleDateString('pt-BR');
    const newContent = existing.content + `\n\n---\n[Reunião adicionada em ${date}]\n` + content;

    // Auto-sync Obsidian
    syncSingleToObsidian('imersao', existing.title, newContent).catch(console.error);

    const { data: updated, error: updateErr } = await supabase
      .from('imersao_cases')
      .update({ content: newContent })
      .eq('id', req.params.id)
      .eq('username', req.user.username)
      .select()
      .single();
    if (updateErr) throw updateErr;

    const texts = chunkText(content);
    for (const text of texts) {
      const embedding = await getEmbedding(text);
      const { error: chunkErr } = await supabase.from('imersao_chunks').insert({
        case_id: req.params.id,
        text,
        embedding: embedding ?? null
      });
      if (chunkErr) console.error('[Reunião] Erro ao salvar chunk:', chunkErr.message);
    }

    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/imersao/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('imersao_cases')
      .delete()
      .eq('id', req.params.id)
      .eq('username', req.user.username);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/imersao/:id/toggle', async (req, res) => {
  try {
    const { data: current, error: fetchErr } = await supabase
      .from('imersao_cases')
      .select('active')
      .eq('id', req.params.id)
      .eq('username', req.user.username)
      .single();
    if (fetchErr) throw fetchErr;

    const { data, error } = await supabase
      .from('imersao_cases')
      .update({ active: !current.active })
      .eq('id', req.params.id)
      .eq('username', req.user.username)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/imersao/toggle-all', async (req, res) => {
  const { active } = req.body;
  try {
    const { error } = await supabase
      .from('imersao_cases')
      .update({ active })
      .eq('username', req.user.username);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Busca perfil direto pela API interna do Instagram — sem Apify, instantâneo
async function fetchInstagramProfileDirect(username) {
  const response = await fetch(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
        'X-IG-App-ID': '936619743392459',
        'Referer': `https://www.instagram.com/${username}/`,
        'Origin': 'https://www.instagram.com',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
      }
    }
  );
  if (!response.ok) throw new Error(`Instagram API HTTP ${response.status}`);
  const data = await response.json();
  const user = data?.data?.user;
  if (!user) throw new Error('Perfil não encontrado na resposta');
  return {
    username: user.username,
    fullName: user.full_name || '',
    biography: user.biography || '',
    followersCount: user.edge_followed_by?.count || 0,
    followsCount: user.edge_follow?.count || 0,
    postsCount: user.edge_owner_to_timeline_media?.count || 0,
    profilePicUrl: user.profile_pic_url_hd || user.profile_pic_url || null,
    verified: !!user.is_verified,
    url: `https://www.instagram.com/${user.username}/`
  };
}

app.post('/api/instagram/preview', async (req, res) => {
  const { url } = req.body;
  if (!url || !url.trim()) return res.status(400).json({ error: 'Informe um @username ou URL do Instagram.' });

  const username = extractInstagramUsername(url.trim());
  if (!username || username.length < 2) return res.status(400).json({ error: 'Handle inválido.' });

  // Tentativa 1: API interna do Instagram — sem Apify, resposta instantânea
  try {
    console.log(`[Instagram Preview] @${username} — via API direta...`);
    const profile = await fetchInstagramProfileDirect(username);
    console.log(`[Instagram Preview] OK direto: ${profile.followersCount} seguidores`);
    return res.json(profile);
  } catch (directErr) {
    console.log(`[Instagram Preview] API direta falhou (${directErr.message}), tentando Apify...`);
  }

  // Tentativa 2: Apify como fallback
  if (!process.env.APIFY_API_KEY) {
    return res.status(500).json({ error: 'Não foi possível buscar o perfil. Tente novamente.' });
  }

  try {
    const { ApifyClient } = require('apify-client');
    const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });
    const items = await Promise.race([
      (async () => {
        const run = await apify.actor('apify/instagram-profile-scraper').call({ usernames: [username], loginCookies: getInstagramLoginCookies() });
        const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 1 });
        return items || [];
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 55000))
    ]);

    if (!items || items.length === 0) {
      return res.status(404).json({ error: `Perfil @${username} não encontrado ou privado.` });
    }
    const p = items[0];
    return res.json({
      username: p.username,
      fullName: p.fullName || '',
      biography: p.biography || '',
      followersCount: p.followersCount || 0,
      followsCount: p.followsCount || 0,
      postsCount: p.postsCount || 0,
      profilePicUrl: p.profilePicUrl || null,
      verified: !!p.verified,
      url: `https://www.instagram.com/${p.username}/`
    });
  } catch (apifyErr) {
    console.error(`[Instagram Preview] Apify falhou: ${apifyErr.message}`);
    return res.status(500).json({ error: 'Não foi possível buscar o perfil. Verifique o @ e tente novamente.' });
  }
});

app.patch('/api/imersao/:id', async (req, res) => {
  const { instagram_url, instagram_profile, title, content } = req.body;
  const updates = {};
  if (instagram_url !== undefined) updates.instagram_url = instagram_url;
  if (instagram_profile !== undefined) updates.instagram_profile = instagram_profile;
  if (title !== undefined) updates.title = title;
  if (content !== undefined) updates.content = content;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nada para atualizar.' });
  try {
    const { data, error } = await supabase
      .from('imersao_cases')
      .update(updates)
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      // Colunas novas podem não existir ainda — tenta só com campos seguros
      const safeUpdates = {};
      if (instagram_url !== undefined) safeUpdates.instagram_url = instagram_url;
      if (title !== undefined) safeUpdates.title = title;
      if (content !== undefined) safeUpdates.content = content;
      if (Object.keys(safeUpdates).length === 0) return res.status(500).json({ error: error.message });

      const { data: data2, error: error2 } = await supabase
        .from('imersao_cases')
        .update(safeUpdates)
        .eq('id', req.params.id)
        .select()
        .single();
      if (error2) throw error2;
      return res.json(data2);
    }

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Dispara análise profunda do Instagram ao conectar — salva no banco
app.post('/api/imersao/:id/instagram-analyze', async (req, res) => {
  try {
    // Aceita instagram_url do body (enviado pelo frontend, vindo de localStorage)
    const urlFromBody = req.body?.instagram_url;
    let caseData = null;

    // Tenta buscar do DB (com fallbacks para colunas inexistentes)
    const { data: d1, error: e1 } = await supabase
      .from('imersao_cases')
      .select('id, title, content, instagram_url')
      .eq('id', req.params.id)
      .single();
    if (e1) {
      const { data: d2, error: e2 } = await supabase
        .from('imersao_cases')
        .select('id, title, content')
        .eq('id', req.params.id)
        .single();
      if (e2) throw e2;
      caseData = { ...d2, instagram_url: urlFromBody || null };
    } else {
      caseData = { ...d1, instagram_url: d1.instagram_url || urlFromBody || null };
    }

    if (!caseData.instagram_url) return res.status(400).json({ error: 'Instagram URL não configurado.' });

    // Responde imediato — análise roda em background
    res.json({ status: 'analyzing' });

    console.log(`[Instagram] Análise automática iniciada para ${caseData.title}...`);
    const analysisData = await fetchInstagramData(caseData.instagram_url, caseData.content);

    const { error: saveErr } = await supabase
      .from('imersao_cases')
      .update({ instagram_analysis: analysisData, instagram_analyzed_at: new Date().toISOString() })
      .eq('id', req.params.id);
    if (saveErr) console.error('[Instagram] Erro ao salvar análise:', saveErr.message);
    else console.log(`[Instagram] Análise salva para ${caseData.title}`);
  } catch (e) {
    console.error('[Instagram Analyze] Erro:', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

// ---- CRM API ----------------------------------------------------------------

app.get('/api/crm', async (req, res) => {
  try {
    const { data, error } = await supabase.from('crm_clientes').select('*')
      .eq('username', req.user.username).order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/crm', async (req, res) => {
  const { nome, telefone, canal, estagio, produto_interesse, notas, visita_data } = req.body;
  if (!nome) return res.status(400).json({ error: 'nome obrigatório.' });
  try {
    const { data, error } = await supabase.from('crm_clientes')
      .insert({ nome, telefone, canal, estagio: estagio || 'lead', produto_interesse, notas, visita_data, username: req.user.username })
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/crm/:id', async (req, res) => {
  const allowed = ['nome','telefone','canal','estagio','produto_interesse','notas','visita_data','visita_confirmada','ultimo_contato'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabase.from('crm_clientes').update(updates)
      .eq('id', req.params.id).eq('username', req.user.username).select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/crm/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('crm_clientes').delete()
      .eq('id', req.params.id).eq('username', req.user.username);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Pedidos Pendentes API --------------------------------------------------

app.get('/api/pedidos', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pedidos_pendentes')
      .select('*')
      .eq('username', req.user.username)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/pedidos', async (req, res) => {
  const { cliente_nome, cliente_telefone, pedido, categoria, notas } = req.body;
  if (!cliente_nome || !pedido) return res.status(400).json({ error: 'cliente_nome e pedido são obrigatórios.' });
  try {
    const { data, error } = await supabase
      .from('pedidos_pendentes')
      .insert({ cliente_nome, cliente_telefone, pedido, categoria, notas, username: req.user.username })
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/pedidos/:id', async (req, res) => {
  const allowed = ['status', 'notas', 'categoria', 'pedido'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([k]) => allowed.includes(k)));
  try {
    const { data, error } = await supabase
      .from('pedidos_pendentes')
      .update(updates)
      .eq('id', req.params.id)
      .eq('username', req.user.username)
      .select().single();
    if (error) throw error;
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/pedidos/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('pedidos_pendentes')
      .delete()
      .eq('id', req.params.id)
      .eq('username', req.user.username);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---- Conversas API ----------------------------------------------------------

app.get('/api/conversations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, title, created_at, updated_at')
      .eq('username', req.user.username)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/conversations', async (req, res) => {
  const { title = 'Nova conversa' } = req.body;
  try {
    const { data, error } = await supabase
      .from('conversations')
      .insert({ title, username: req.user.username })
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/conversations/:id', async (req, res) => {
  const { title } = req.body;
  try {
    const { data, error } = await supabase
      .from('conversations')
      .update({ title })
      .eq('id', req.params.id)
      .eq('username', req.user.username)
      .select()
      .single();
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/conversations/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('id', req.params.id)
      .eq('username', req.user.username);
    if (error) throw error;
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages')
      .select('id, role, display_text, api_content, files, created_at')
      .eq('conversation_id', req.params.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- Chat (com RAG no backend) ----------------------------------------------

app.post('/api/chat', async (req, res) => {
  const { conversationId, message, apiContent, files, activeMentoradoId } = req.body;
  if (!conversationId || (!message && !apiContent)) {
    return res.status(400).json({ error: 'conversationId e mensagem são obrigatórios.' });
  }

  const cfg = loadAgentConfig(req.user.username);
  const SYSTEM_PROMPT = cfg.agents[cfg.activeAgentType]?.prompt || DEFAULT_PROMPT;

  try {
    // 1. Salvar mensagem do usuário no banco
    const { error: userMsgErr } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      display_text: message || '',
      api_content: apiContent || null,
      files: files || null
    });
    if (userMsgErr) throw userMsgErr;

    // Debug: resumo do contexto recebido
    const mentoradoContext = req.body.mentoradoContext;
    console.log(`[Chat] recebido: activeMentoradoId=${req.body.activeMentoradoId || 'none'} | mentorados=${Array.isArray(mentoradoContext) ? mentoradoContext.map(c => `${c.title}(ig:${!!(c.instagram_url||c.instagram_profile)})`).join(',') : '[]'} | msg="${(message||'').slice(0,60)}"`);
    // Identificar qual é o mentorado em foco: via seleção na UI ou menção na mensagem
    let targetCase = null;
    if (mentoradoContext && Array.isArray(mentoradoContext)) {
      if (req.body.activeMentoradoId) {
        targetCase = mentoradoContext.find(c => c.id === req.body.activeMentoradoId);
      }
      if (!targetCase && message) {
        targetCase = findMentoradoInMessage(message, mentoradoContext);
      }
      // Se pergunta sobre Instagram mas não identificou mentorado pelo nome/id,
      // usa o único com Instagram conectado ou o primeiro disponível
      if (!targetCase && message && (message.toLowerCase().includes('instagram') || detectInstagramIntent(message))) {
        const withIg = mentoradoContext.filter(c => c.instagram_url || c.instagram_profile);
        if (withIg.length === 1) targetCase = withIg[0];
        else if (withIg.length > 1) targetCase = withIg[0]; // pega o primeiro com Instagram conectado
        else if (mentoradoContext.length === 1) targetCase = mentoradoContext[0];
        if (targetCase) console.log(`[Chat] targetCase inferido por intent Instagram: "${targetCase.title}"`);
      }

      if (targetCase) {
        // Tenta buscar com instagram_analysis; se a coluna não existir, tenta só com instagram_url; fallback: só content
        let dbCase = null;
        const { data: d1, error: e1 } = await supabase
          .from('imersao_cases')
          .select('content, instagram_url, instagram_analysis')
          .eq('id', targetCase.id).single();
        if (e1) {
          const { data: d2, error: e2 } = await supabase
            .from('imersao_cases')
            .select('content, instagram_url')
            .eq('id', targetCase.id).single();
          if (e2) {
            const { data: d3 } = await supabase
              .from('imersao_cases')
              .select('content')
              .eq('id', targetCase.id).single();
            dbCase = { content: d3?.content, instagram_url: null, instagram_analysis: null };
          } else {
            dbCase = { content: d2?.content, instagram_url: d2?.instagram_url, instagram_analysis: null };
          }
        } else {
          dbCase = d1;
        }
        targetCase.content = dbCase?.content || '';
        targetCase.instagram_url = targetCase.instagram_url || dbCase?.instagram_url || null;
        targetCase.instagram_analysis = dbCase?.instagram_analysis || null;

        // Fallback: derivar URL do instagram_profile se instagram_url não tiver no banco
        if (!targetCase.instagram_url && targetCase.instagram_profile) {
          const username = targetCase.instagram_profile.username;
          if (username) {
            targetCase.instagram_url = `https://www.instagram.com/${username}/`;
            console.log(`[Chat] instagram_url derivado do profile: ${targetCase.instagram_url}`);
          }
        }

        console.log(`[Chat] targetCase: "${targetCase.title}" | instagram_url: ${targetCase.instagram_url || 'NULL'} | profile: ${!!targetCase.instagram_profile} | analysis: ${!!targetCase.instagram_analysis}`);
      }
    }

    // 2. Instagram intent — short-circuit antes do RAG
    const hasInstagram = !!(targetCase?.instagram_url || targetCase?.instagram_profile ||
      (targetCase?.igProfiles && targetCase.igProfiles.length > 0));
    const isInstagramRequest = message && targetCase && hasInstagram &&
      (message.toLowerCase().includes('instagram') || detectInstagramIntent(message));
    if (isInstagramRequest) {
      const allProfiles = targetCase.igProfiles || [];
      console.log(`[Instagram] Intent detectado → mentorado: ${targetCase.title} | perfis: ${allProfiles.length || 1} | análise salva: ${!!targetCase.instagram_analysis}`);

      let insightText;

      if (allProfiles.length > 1 && wantsAllProfiles(message)) {
        // Usuário quer análise de todos os perfis — roda em paralelo
        console.log(`[Instagram] Análise de todos os ${allProfiles.length} perfis em paralelo...`);
        const profileLabels = allProfiles.map((prof, i) => {
          const uname = prof.profile?.username || extractInstagramUsername(prof.url) || `Perfil ${i + 1}`;
          const categoria = prof.profile?.businessCategoryName ? ' (negócio)' : ' (pessoal)';
          return `@${uname}${categoria}`;
        });
        const results = await Promise.all(allProfiles.map((prof) => {
          const profileUrl = prof.url;
          const cachedUsername = targetCase.instagram_analysis?.profile?.username;
          const requestedUsername = extractInstagramUsername(profileUrl);
          const analysisMatchesProfile = cachedUsername && requestedUsername && cachedUsername === requestedUsername;
          const caseForInsights = {
            ...targetCase,
            instagram_url: profileUrl,
            instagram_profile: prof.profile || null,
            instagram_analysis: analysisMatchesProfile ? targetCase.instagram_analysis : null
          };
          return getInstagramInsights(caseForInsights, message, caseForInsights.instagram_analysis, req.user.username);
        }));
        insightText = results.map((text, i) => `## ${profileLabels[i]}\n\n${text}`).join('\n\n---\n\n');
      } else {
        // Perfil único ou seleção específica
        const selectedProfile = allProfiles.length > 0 ? selectTargetProfile(message, allProfiles) : null;
        const profileUrl = selectedProfile?.url || targetCase.instagram_url;
        const cachedUsername = targetCase.instagram_analysis?.profile?.username;
        const requestedUsername = extractInstagramUsername(profileUrl);
        const analysisMatchesProfile = cachedUsername && requestedUsername && cachedUsername === requestedUsername;
        const caseForInsights = {
          ...targetCase,
          instagram_url: profileUrl,
          instagram_profile: selectedProfile?.profile || targetCase.instagram_profile,
          instagram_analysis: analysisMatchesProfile ? targetCase.instagram_analysis : null
        };
        console.log(`[Instagram] Perfil selecionado: @${requestedUsername || 'primary'} | cache bate: ${analysisMatchesProfile}`);
        insightText = await getInstagramInsights(caseForInsights, message, caseForInsights.instagram_analysis, req.user.username);
      }

      const { data: aiMsg, error: aiMsgErr } = await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, role: 'assistant', display_text: insightText, api_content: insightText })
        .select().single();
      if (aiMsgErr) throw aiMsgErr;
      return res.json({ text: insightText, messageId: aiMsg.id });
    }

    // 3. RAG — busca vetorial no Supabase (com fallback por tabela)
    let topChunks = [];
    if (message && message.trim()) {
      const queryEmbedding = await getEmbedding(message);
      if (queryEmbedding) {
        const [knowledgeRes, imersaoRes] = await Promise.all([
          supabase.rpc('match_knowledge_chunks', { query_embedding: queryEmbedding, match_count: 5, p_username: req.user.username }),
          supabase.rpc('match_imersao_chunks', { query_embedding: queryEmbedding, match_count: 4, p_username: req.user.username })
        ]);
        let kChunks = (knowledgeRes.data || []).map(c => ({ sourceTitle: c.source_title, text: c.text }));
        let iChunks = (imersaoRes.data || []).map(c => ({ sourceTitle: c.source_title, text: c.text }));
        console.log(`[RAG] Vetorial: ${kChunks.length} fontes + ${iChunks.length} imersão`);

        // Fallback por tabela: se uma tabela não retornou chunks (embeddings nulos), inclui conteúdo direto
        if (kChunks.length === 0) {
          const { data } = await supabase.from('knowledge_entries').select('title, content').eq('active', true).eq('username', req.user.username).limit(6);
          kChunks = (data || []).map(e => ({ sourceTitle: e.title, text: e.content.split(/\s+/).slice(0, 250).join(' ') }));
          if (kChunks.length) console.log(`[RAG] Fallback fontes: ${kChunks.length} entradas`);
        }
        if (iChunks.length === 0) {
          const { data } = await supabase.from('imersao_cases').select('title, content').eq('active', true).eq('username', req.user.username).limit(4);
          iChunks = (data || []).map(e => ({ sourceTitle: e.title, text: e.content.split(/\s+/).slice(0, 250).join(' ') }));
          if (iChunks.length) console.log(`[RAG] Fallback imersão: ${iChunks.length} entradas`);
        }
        topChunks = [...kChunks, ...iChunks];
      }
    }

    // Fallback completo: getEmbedding falhou, inclui tudo diretamente
    if (topChunks.length === 0) {
      const [knowRes, imRes] = await Promise.all([
        supabase.from('knowledge_entries').select('title, content').eq('active', true).eq('username', req.user.username).limit(6),
        supabase.from('imersao_cases').select('title, content').eq('active', true).eq('username', req.user.username).limit(4)
      ]);
      topChunks = [
        ...(knowRes.data || []).map(e => ({ sourceTitle: e.title, text: e.content.split(/\s+/).slice(0, 250).join(' ') })),
        ...(imRes.data || []).map(e => ({ sourceTitle: e.title, text: e.content.split(/\s+/).slice(0, 250).join(' ') }))
      ];
      if (topChunks.length) console.log(`[RAG] Fallback total: ${topChunks.length} entradas`);
    }

    // 4. Montar system prompt com chunks relevantes
    let systemPrompt = SYSTEM_PROMPT;

    if (targetCase) {
      // Pre-computar perfis Instagram (define framing do header)
      const allIgProfiles = (targetCase.igProfiles && targetCase.igProfiles.length > 0)
        ? targetCase.igProfiles
        : (targetCase.instagram_url ? [{ url: targetCase.instagram_url, profile: targetCase.instagram_profile || null }] : []);
      const hasIg = allIgProfiles.length > 0;

      // Instrução não-editável — injetada no topo do contexto, antes de qualquer dado.
      // Garante comportamento correto independente do prompt customizado pelo usuário.
      if (hasIg) {
        const activeType = cfg.activeAgentType;
        const rulesTemplate = cfg.agents[activeType]?.systemRules || DEFAULT_SYSTEM_RULES;
        const resolvedRules = rulesTemplate.replace(/\{mentorado\}/g, targetCase.title);
        systemPrompt += `\n\n[REGRA DO SISTEMA — NÃO IGNORAR]:\nMentorado em foco: ${targetCase.title}.\n${resolvedRules}\n`;
      } else {
        systemPrompt += `\n\n[CONTEXTO DO SISTEMA]: Mentorado em foco: ${targetCase.title}.\n`;
      }

      // === BLOCO 1: INSTAGRAM (sempre antes da ficha) ===
      if (hasIg) {
        systemPrompt += `\n=== BLOCO 1 — PRESENÇA DIGITAL (Instagram) ===`;

        for (const prof of allIgProfiles) {
          const p = prof.profile;
          if (p) {
            systemPrompt += `\nPerfil: @${p.username}${p.fullName ? ` — ${p.fullName}` : ''}`;
            systemPrompt += `\n- Bio: ${p.biography || 'não informada'}`;
            systemPrompt += `\n- Seguidores: ${(p.followersCount || 0).toLocaleString('pt-BR')} | Posts: ${p.postsCount || '?'}${p.businessCategoryName ? ` | Categoria: ${p.businessCategoryName}` : ''}${p.verified ? ' | Verificado' : ''}`;
          } else if (prof.url) {
            systemPrompt += `\nInstagram: ${prof.url}`;
          }
        }

        const analysis = targetCase.instagram_analysis;
        if (analysis?.profile) {
          const ap = analysis.profile;
          const ownHashtags = [...new Set((ap.latestPosts || []).flatMap(p => p.hashtags || []))].slice(0, 10);
          const reels = (ap.latestPosts || []).filter(p => p.type === 'Video' || p.type === 'Reel');
          const statics = (ap.latestPosts || []).filter(p => p.type !== 'Video' && p.type !== 'Reel');
          const recentPosts = (ap.latestPosts || []).slice(0, 6).map(p => {
            const views = p.videoViewCount ? ` | ${p.videoViewCount.toLocaleString('pt-BR')} views` : '';
            return `  [${p.type}] ${p.likesCount.toLocaleString('pt-BR')} likes | ${p.commentsCount} cmts${views} | "${p.caption.slice(0, 90)}"`;
          }).join('\n');

          systemPrompt += `\n\nDados reais coletados em ${new Date(analysis.fetchedAt).toLocaleDateString('pt-BR')}:`;
          systemPrompt += `\n- Formatos ativos: ${reels.length} Reels | ${statics.length} Fotos/Carrosséis`;
          if (ownHashtags.length > 0) systemPrompt += `\n- Hashtags recorrentes: ${ownHashtags.map(h => '#' + h).join(', ')}`;
          if (recentPosts) systemPrompt += `\nÚltimos posts:\n${recentPosts}`;
          if (analysis.competitors?.length > 0) {
            systemPrompt += `\nConcorrentes mapeados: ${analysis.competitors.map(c => `@${c.username} (${(c.followersCount || 0).toLocaleString('pt-BR')} seg.)`).join(', ')}`;
          }
        } else {
          systemPrompt += `\n(Análise detalhada de posts ainda não coletada — use os dados de perfil acima. Para análise completa com posts e concorrentes, o time pode pedir especificamente.)`;
        }
        systemPrompt += `\n=== FIM BLOCO 1 ===\n`;
      }

      // === BLOCO 2: FICHA DE REUNIÃO (depois do Instagram) ===
      if (targetCase.content) {
        const label = hasIg ? 'BLOCO 2 — NEGÓCIO (Ficha de Imersão)' : `FICHA COMPLETA: ${targetCase.title}`;
        systemPrompt += `\n=== ${label} ===\n${targetCase.content}\n=== FIM BLOCO 2 ===\n`;
      }

      if (!hasIg) {
        systemPrompt += `\n(Instagram não conectado para este mentorado.)`;
      }
    } else if (mentoradoContext && Array.isArray(mentoradoContext) && mentoradoContext.length > 0) {
      const withIg = mentoradoContext.filter(c => c.instagram_url || c.instagram_profile);
      systemPrompt += `\n\n[CONTEXTO DO SISTEMA]: A imersão atual tem ${mentoradoContext.length} mentorado(s). Dados disponíveis:\n`;
      for (const mc of mentoradoContext) {
        systemPrompt += `\n--- ${mc.title} ---\n`;
        if (mc.content) systemPrompt += mc.content + '\n';
        if (mc.instagram_url || mc.instagram_profile) {
          const p = mc.instagram_profile;
          if (p) systemPrompt += `Instagram: @${p.username} | ${(p.followersCount||0).toLocaleString('pt-BR')} seguidores | Bio: ${p.biography||'não informada'}\n`;
          else systemPrompt += `Instagram conectado: ${mc.instagram_url}\n`;
        }
      }
      if (withIg.length > 0) {
        systemPrompt += `\n[IMPORTANTE]: O sistema TEM acesso real ao Instagram dos mentorados listados acima via scraping automatizado. NUNCA diga que não tem acesso ao Instagram. Se perguntarem sobre Instagram, concorrentes ou análise de conteúdo, diga que sim, você consegue fazer isso — e pergunte de qual mentorado (${withIg.map(c => c.title).join(', ')}) o usuário quer a análise. Para ativar a análise completa com dados reais, o usuário deve selecionar o mentorado no painel de Imersão e perguntar novamente.`;
      }
    }

    if (topChunks.length > 0) {
      const chunksText = topChunks
        .map(c => {
          const safeTitle = (c.sourceTitle || '').replace(/[<>:"/\\|?*]+/g, '').trim() || 'Sem Titulo';
          return `--- [${safeTitle}] ---\n${c.text}`;
        })
        .join('\n\n');
      systemPrompt += `\n\n=== MEMÓRIA RELEVANTE RECUPERADA ===\nUse as informações abaixo para embasar sua resposta:\n\n${chunksText}`;
    }

    // 5. Buscar histórico recente da conversa (últimas 10 mensagens)
    const { data: history, error: histErr } = await supabase
      .from('messages')
      .select('role, display_text, api_content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10);
    if (histErr) throw histErr;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.reverse().map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: typeof m.api_content === 'string' ? m.api_content : (m.display_text || '')
      }))
    ];

    // 6. Chamar OpenAI
    const completion = await openai.chat.completions.create({
      model: cfg.model || 'gpt-4o-mini',
      messages,
      max_tokens: cfg.maxTokens || 1200,
    });

    const responseText = completion.choices[0].message.content || 'Deu um nó aqui. Tenta de novo. Bora!';

    // 7. Salvar resposta do assistente no banco
    const { data: aiMsg, error: aiMsgErr } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        role: 'assistant',
        display_text: responseText,
        api_content: responseText
      })
      .select()
      .single();
    if (aiMsgErr) throw aiMsgErr;

    // Auto-sync Obsidian da conversa inteira
    supabase.from('conversations').select('title').eq('id', conversationId).single().then(({ data: convData }) => {
      if (convData) {
        supabase.from('messages').select('role, display_text').eq('conversation_id', conversationId).order('created_at', { ascending: true }).then(({ data: allMsgs }) => {
          let convContent = `# ${convData.title}\n\n`;
          if (allMsgs) {
            allMsgs.forEach(m => {
              convContent += `**${m.role === 'user' ? 'Você' : 'Agente Bora'}**:\n${m.display_text}\n\n---\n\n`;
            });
          }
          syncSingleToObsidian('chat', convData.title, convContent).catch(console.error);
        });
      }
    }).catch(console.error);

    res.json({ text: responseText, messageId: aiMsg.id });

  } catch (error) {
    console.error('[Chat Erro]', error);
    res.status(500).json({ error: error.message || 'Erro ao processar o chat.' });
  }
});

// ---- Re-indexar tudo com chunk size correto (300 palavras) ------------------
app.post('/api/reindex', async (_req, res) => {
  res.json({ status: 'Reindexando em segundo plano...' });

  try {
    // Re-chunkar knowledge_entries
    const { data: kEntries } = await supabase.from('knowledge_entries').select('id, title, content');
    for (const entry of (kEntries || [])) {
      await supabase.from('knowledge_chunks').delete().eq('entry_id', entry.id);
      const texts = chunkText(entry.content);
      for (const text of texts) {
        const embedding = await getEmbedding(text);
        await supabase.from('knowledge_chunks').insert({ entry_id: entry.id, text, embedding: embedding ?? null });
      }
      console.log(`[Reindex] Fonte "${entry.title.slice(0,40)}" — ${texts.length} chunks`);
    }

    // Re-chunkar imersao_cases
    const { data: iEntries } = await supabase.from('imersao_cases').select('id, title, content');
    for (const entry of (iEntries || [])) {
      await supabase.from('imersao_chunks').delete().eq('case_id', entry.id);
      const texts = chunkText(entry.content);
      for (const text of texts) {
        const embedding = await getEmbedding(text);
        await supabase.from('imersao_chunks').insert({ case_id: entry.id, text, embedding: embedding ?? null });
      }
      console.log(`[Reindex] Imersão "${entry.title.slice(0,40)}" — ${texts.length} chunks`);
    }

    console.log('[Reindex] Concluído.');
  } catch (e) {
    console.error('[Reindex] Erro:', e.message);
  }
});

// ---- Instagram Analysis -----------------------------------------------------

function getInstagramLoginCookies() {
  const sessionId = process.env.INSTAGRAM_SESSION_ID;
  const csrfToken = process.env.INSTAGRAM_CSRF_TOKEN;
  const userId = process.env.INSTAGRAM_DS_USER_ID;
  if (!sessionId || !csrfToken) return undefined;
  return [
    { name: 'sessionid',   value: sessionId, domain: '.instagram.com', path: '/' },
    { name: 'csrftoken',   value: csrfToken, domain: '.instagram.com', path: '/' },
    { name: 'ds_user_id',  value: userId || '', domain: '.instagram.com', path: '/' },
  ];
}

function extractInstagramUsername(urlOrHandle) {
  if (!urlOrHandle) return null;
  const s = urlOrHandle.trim().replace(/\/$/, '');
  if (s.startsWith('@')) return s.slice(1);
  // URL do Instagram — extrai o path
  if (s.includes('instagram.com')) {
    try {
      const parsed = new URL(s.includes('://') ? s : 'https://' + s);
      return parsed.pathname.split('/').filter(Boolean)[0] || null;
    } catch { return null; }
  }
  // Username puro — limpa caracteres inválidos
  return s.replace(/[^a-zA-Z0-9._]/g, '') || null;
}

function detectInstagramIntent(message) {
  const lower = message.toLowerCase();
  // Action keywords that trigger the deep Apify scraping
  return [
    'ideias de', 'stories', 'reels', 'nicho', 'engajamento',
    'estratégia', 'estrategia', 'hashtag', 'viral', 'feed do',
    'analisar o instagram', 'analise o instagram', 'conteúdo', 'conteudo', 'postar',
    'concorrentes', 'concorrente', 'referências', 'referencias', 'tendências', 'tendencias'
  ].some(kw => lower.includes(kw));
}

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, '');
}

function findMentoradoInMessage(message, cases) {
  const normMsg = normalize(message);
  const sorted = [...cases].sort((a, b) => b.title.length - a.title.length);

  // Pass 1: full title match
  for (const c of sorted) {
    if (normMsg.includes(normalize(c.title))) return c;
  }

  // Pass 2: first name match (first word >= 4 chars)
  for (const c of sorted) {
    const firstName = normalize(c.title).split(/\s+/)[0];
    if (firstName.length >= 4 && normMsg.includes(firstName)) return c;
  }

  // Pass 3: any significant word (>= 5 chars) — avoids noise words like "do", "da", "por"
  for (const c of sorted) {
    const words = normalize(c.title).split(/\s+/);
    if (words.some(w => w.length >= 5 && normMsg.includes(w))) return c;
  }

  return cases.length === 1 ? cases[0] : null;
}

// Seleciona qual perfil Instagram analisar quando o mentorado tem múltiplos
function selectTargetProfile(message, igProfiles) {
  if (!igProfiles || igProfiles.length === 0) return null;
  if (igProfiles.length === 1) return igProfiles[0];

  const lower = message.toLowerCase();

  // @username explícito na mensagem
  const handleMatch = message.match(/@([\w.]+)/);
  if (handleMatch) {
    const mentioned = handleMatch[1].toLowerCase();
    const found = igProfiles.find(p => {
      const uname = (p.profile?.username || extractInstagramUsername(p.url) || '').toLowerCase();
      return uname === mentioned;
    });
    if (found) return found;
  }

  // Keywords de negócio → prefere perfil com businessCategoryName
  if (['negócio', 'negocio', 'empresa', 'loja', 'comercial', 'business', 'cnpj'].some(kw => lower.includes(kw))) {
    const biz = igProfiles.find(p => p.profile?.businessCategoryName);
    if (biz) return biz;
  }

  // Keywords pessoal → prefere perfil sem businessCategoryName
  if (['pessoal', 'personal', 'particular'].some(kw => lower.includes(kw))) {
    const personal = igProfiles.find(p => !p.profile?.businessCategoryName);
    if (personal) return personal;
  }

  return igProfiles[0]; // padrão: perfil primário
}

// Retorna true se a mensagem pede análise de todos os perfis
function wantsAllProfiles(message) {
  const lower = message.toLowerCase();
  return ['ambos', 'os dois', 'todos os perfis', 'perfil pessoal e', 'e o do negócio', 'e negocio', 'dois instagrams'].some(kw => lower.includes(kw));
}

// Busca dados brutos do Instagram via Apify — os 3 jobs rodam em paralelo
async function fetchInstagramData(instagram_url, caseContent) {
  const username = extractInstagramUsername(instagram_url);
  if (!username || !process.env.APIFY_API_KEY) return null;

  const { ApifyClient } = require('apify-client');
  const apify = new ApifyClient({ token: process.env.APIFY_API_KEY });

  console.log(`[Instagram] Iniciando 3 jobs em paralelo para @${username}...`);

  const [profileRes, hashtagRes, competitorRes] = await Promise.allSettled([

    // Job 1: perfil do mentorado
    (async () => {
      const run = await apify.actor('apify/instagram-profile-scraper').call({ usernames: [username], loginCookies: getInstagramLoginCookies() });
      const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 1 });
      if (items.length === 0) return null;
      const raw = items[0];
      const profile = {
        username: raw.username,
        fullName: raw.fullName || '',
        biography: raw.biography || '',
        externalUrl: raw.externalUrl || null,
        followersCount: raw.followersCount || 0,
        followsCount: raw.followsCount || 0,
        postsCount: raw.postsCount || 0,
        verified: !!raw.verified,
        businessCategoryName: raw.businessCategoryName || null,
        profilePicUrl: raw.profilePicUrl || null,
        latestPosts: (raw.latestPosts || []).slice(0, 12).map(post => ({
          type: post.type || 'post',
          timestamp: post.timestamp || null,
          likesCount: post.likesCount || 0,
          commentsCount: post.commentsCount || 0,
          videoViewCount: post.videoViewCount || null,
          caption: (post.caption || '').slice(0, 150),
          url: post.url || null,
          hashtags: (post.hashtags || []).slice(0, 10)
        }))
      };
      console.log(`[Instagram] Job 1 OK: ${profile.followersCount} seguidores, ${profile.latestPosts.length} posts`);
      return profile;
    })(),

    // Job 2: posts de hashtag do nicho
    (async () => {
      const nicheRes = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: `Extraia 3 hashtags do Instagram para este nicho (sem #, só a palavra). Responda APENAS com as hashtags separadas por vírgula.\n\nNegócio: ${caseContent.slice(0, 600)}` }],
        max_tokens: 40
      });
      const hashtags = nicheRes.choices[0].message.content
        .split(',').map(h => h.trim().replace(/^#/, '').toLowerCase()).filter(h => /^\w+$/.test(h)).slice(0, 3);
      if (hashtags.length === 0) return { hashtags: [], hashtagPosts: [] };

      console.log(`[Instagram] Job 2: scraping hashtags ${hashtags.join(', ')}...`);
      const run = await apify.actor('apify/instagram-hashtag-scraper').call({ hashtags, resultsLimit: 20 });
      const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 20 });
      const hashtagPosts = (items || []).slice(0, 15).map(p => ({
        type: p.type || 'post',
        ownerUsername: p.ownerUsername || p.ownerId || null,
        likesCount: p.likesCount || 0,
        commentsCount: p.commentsCount || 0,
        videoViewCount: p.videoViewCount || null,
        timestamp: p.timestamp || null,
        caption: (p.caption || '').slice(0, 150),
        hashtags: (p.hashtags || []).slice(0, 15)
      }));
      console.log(`[Instagram] Job 2 OK: ${hashtagPosts.length} posts do nicho`);
      return { hashtags, hashtagPosts };
    })(),

    // Job 3: concorrentes / referências do nicho
    (async () => {
      const gptRes = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: `Baseado no negócio abaixo, sugira 5 usernames reais do Instagram de concorrentes diretos ou referências do mesmo nicho. Responda APENAS com os usernames separados por vírgula, sem @ e sem espaços extras.\n\nNegócio: ${caseContent.slice(0, 600)}`
        }],
        max_tokens: 80
      });
      const usernames = gptRes.choices[0].message.content
        .split(',')
        .map(u => u.trim().replace(/^@/, '').replace(/\s+/g, '').toLowerCase())
        .filter(u => /^[\w.]+$/.test(u) && u.length >= 2)
        .slice(0, 5);
      if (usernames.length === 0) return [];

      console.log(`[Instagram] Job 3: scraping concorrentes ${usernames.join(', ')}...`);
      const run = await apify.actor('apify/instagram-profile-scraper').call({ usernames, loginCookies: getInstagramLoginCookies() });
      const { items } = await apify.dataset(run.defaultDatasetId).listItems({ limit: 5 });
      const competitors = items.map(c => ({
        username: c.username,
        fullName: c.fullName || '',
        followersCount: c.followersCount || 0,
        postsCount: c.postsCount || 0,
        biography: (c.biography || '').slice(0, 200),
        businessCategoryName: c.businessCategoryName || null,
        verified: !!c.verified,
        topPosts: (c.latestPosts || []).slice(0, 8).map(p => ({
          type: p.type || 'post',
          likesCount: p.likesCount || 0,
          commentsCount: p.commentsCount || 0,
          videoViewCount: p.videoViewCount || null,
          caption: (p.caption || '').slice(0, 120),
          timestamp: p.timestamp || null,
          hashtags: (p.hashtags || []).slice(0, 10)
        }))
      }));
      console.log(`[Instagram] Job 3 OK: ${competitors.length} concorrentes analisados`);
      return competitors;
    })()
  ]);

  if (profileRes.status === 'rejected') console.error('[Instagram] Job 1 falhou:', profileRes.reason?.message);
  if (hashtagRes.status === 'rejected') console.error('[Instagram] Job 2 falhou:', hashtagRes.reason?.message);
  if (competitorRes.status === 'rejected') console.error('[Instagram] Job 3 falhou:', competitorRes.reason?.message);

  const profile = profileRes.status === 'fulfilled' ? profileRes.value : null;
  const { hashtags = [], hashtagPosts = [] } = hashtagRes.status === 'fulfilled' ? (hashtagRes.value || {}) : {};
  const competitors = competitorRes.status === 'fulfilled' ? (competitorRes.value || []) : [];

  return { profile, hashtags, hashtagPosts, competitors, fetchedAt: new Date().toISOString() };
}

// Gera insights usando dados salvos (ou busca novos se não tiver) — sem custo extra
async function getInstagramInsights(caseData, userMessage, savedAnalysis = null, username = 'cdgrupo') {
  let profileSection = '';
  let hashtagSection = '';
  let analysisData = savedAnalysis;

  // Resolve URL: direto, ou derivado do instagram_profile
  const instagramUrl = caseData.instagram_url ||
    (caseData.instagram_profile?.username ? `https://www.instagram.com/${caseData.instagram_profile.username}/` : null);

  // Re-busca se: sem análise salva, OU análise salva não tem dados de concorrentes
  const needsFresh = !analysisData || !analysisData.competitors;
  if (needsFresh && instagramUrl) {
    if (caseData.instagram_profile && !caseData.instagram_profile.latestPosts) {
      analysisData = {
        profile: { ...caseData.instagram_profile, latestPosts: [], businessCategoryName: null },
        hashtags: [], hashtagPosts: [], competitors: [],
        fetchedAt: new Date().toISOString(),
        isPreviewOnly: true
      };
    }
    console.log(`[Instagram] Buscando dados${savedAnalysis ? ' atualizados (sem concorrentes no cache)' : ''} via Apify para ${instagramUrl}...`);
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve(null), 180000));
    const apifyData = await Promise.race([fetchInstagramData(instagramUrl, caseData.content), timeoutPromise]);
    if (apifyData?.profile) {
      analysisData = apifyData;
      // Salva de volta no banco para o próximo acesso ser instantâneo
      if (caseData.id) {
        supabase.from('imersao_cases')
          .update({ instagram_analysis: analysisData, instagram_analyzed_at: new Date().toISOString() })
          .eq('id', caseData.id)
          .then(({ error }) => { if (error) console.error('[Instagram] Erro ao salvar análise:', error.message); else console.log('[Instagram] Análise (com concorrentes) salva no banco.'); });
      }
    } else if (!apifyData) {
      console.log('[Instagram] Apify timeout — usando dados disponíveis');
    }
  }

  if (analysisData?.profile) {
    const p = analysisData.profile;

    // Calcula frequência de postagem
    const postsWithDate = (p.latestPosts || []).filter(post => post.timestamp);
    let freqNote = '';
    if (postsWithDate.length >= 2) {
      const dates = postsWithDate.map(post => new Date(post.timestamp)).sort((a, b) => b - a);
      const diffDays = (dates[0] - dates[dates.length - 1]) / (1000 * 60 * 60 * 24);
      const freq = diffDays > 0 ? (postsWithDate.length / diffDays * 7).toFixed(1) : '?';
      freqNote = `\n- Frequência estimada: ${freq} posts/semana`;
    }

    // Separa reels de fotos/carrosséis e calcula métricas por formato
    const reels = (p.latestPosts || []).filter(post => post.type === 'Video' || post.type === 'Reel');
    const statics = (p.latestPosts || []).filter(post => post.type !== 'Video' && post.type !== 'Reel');
    const avgReelViews = reels.length > 0
      ? Math.round(reels.reduce((s, r) => s + (r.videoViewCount || 0), 0) / reels.length)
      : null;
    const avgStaticLikes = statics.length > 0
      ? Math.round(statics.reduce((s, r) => s + (r.likesCount || 0), 0) / statics.length)
      : null;
    const formatNote = [
      reels.length > 0 ? `Reels: ${reels.length} | média ${avgReelViews ? avgReelViews.toLocaleString('pt-BR') + ' views' : 'sem dados de views'}` : null,
      statics.length > 0 ? `Fotos/Carrosséis: ${statics.length} | média ${avgStaticLikes ? avgStaticLikes.toLocaleString('pt-BR') + ' likes' : '?'}` : null
    ].filter(Boolean).join(' · ');

    // Lista as hashtags que o mentorado usa nos próprios posts
    const ownHashtags = [...new Set((p.latestPosts || []).flatMap(post => post.hashtags || []))].slice(0, 15);

    const recentPosts = (p.latestPosts || []).slice(0, 8).map(post => {
      const views = post.videoViewCount ? ` | ${post.videoViewCount.toLocaleString('pt-BR')} views` : '';
      const date = post.timestamp ? ` | ${new Date(post.timestamp).toLocaleDateString('pt-BR')}` : '';
      return `  - [${post.type}]${date} | ${post.likesCount.toLocaleString('pt-BR')} likes | ${post.commentsCount} comentários${views} | "${post.caption.slice(0, 80)}"`;
    }).join('\n');

    profileSection = `\n\n=== PERFIL DO INSTAGRAM (@${p.username}) ===
- Nome: ${p.fullName || '?'}
- Bio: ${p.biography || '?'}
- Link na bio: ${p.externalUrl || 'nenhum'}
- Seguidores: ${p.followersCount.toLocaleString('pt-BR')}
- Seguindo: ${p.followsCount.toLocaleString('pt-BR')}
- Total de posts: ${p.postsCount}
- Verificado: ${p.verified ? 'Sim' : 'Não'}
- Categoria: ${p.businessCategoryName || 'pessoal'}${freqNote}
- Performance por formato: ${formatNote || 'dados insuficientes'}
- Hashtags que usa: ${ownHashtags.length > 0 ? ownHashtags.map(h => '#' + h).join(', ') : 'não identificadas'}

Últimos posts (do mais recente ao mais antigo):
${recentPosts || '(sem posts recentes)'}`;
  }

  if (analysisData?.hashtagPosts?.length > 0) {
    // Extrai as hashtags mais usadas pelos posts virais do nicho
    const allNicheHashtags = analysisData.hashtagPosts.flatMap(p => p.hashtags || []);
    const hashtagFreq = allNicheHashtags.reduce((acc, h) => { acc[h] = (acc[h] || 0) + 1; return acc; }, {});
    const topNicheHashtags = Object.entries(hashtagFreq).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([h]) => '#' + h);

    const topPosts = analysisData.hashtagPosts.map(p => {
      const views = p.videoViewCount ? ` | ${p.videoViewCount.toLocaleString('pt-BR')} views` : '';
      const date = p.timestamp ? ` | ${new Date(p.timestamp).toLocaleDateString('pt-BR')}` : '';
      const owner = p.ownerUsername ? ` | @${p.ownerUsername}` : '';
      return `- [${p.type}]${date}${owner} | ${p.likesCount.toLocaleString('pt-BR')} likes | ${p.commentsCount} comentários${views} | "${p.caption.slice(0, 100)}"`;
    }).join('\n');

    hashtagSection = `\n\n=== TOP POSTS DO NICHO (#${(analysisData.hashtags || []).join(', #')}) ===
Hashtags mais usadas pelos posts virais: ${topNicheHashtags.join(', ')}

${topPosts}`;
  }

  let competitorSection = '';
  if (analysisData?.competitors?.length > 0) {
    const compDetails = analysisData.competitors.map(c => {
      const engRates = (c.topPosts || []).map(p => {
        if (c.followersCount > 0) return ((p.likesCount + p.commentsCount) / c.followersCount * 100);
        return null;
      }).filter(v => v !== null);
      const avgEng = engRates.length > 0
        ? (engRates.reduce((a, b) => a + b, 0) / engRates.length).toFixed(2)
        : null;

      const reels = (c.topPosts || []).filter(p => p.type === 'Video' || p.type === 'Reel');
      const statics = (c.topPosts || []).filter(p => p.type !== 'Video' && p.type !== 'Reel');
      const allHashtags = [...new Set((c.topPosts || []).flatMap(p => p.hashtags || []))].slice(0, 8);

      const topPostsStr = (c.topPosts || []).slice(0, 4).map(p => {
        const views = p.videoViewCount ? ` | ${p.videoViewCount.toLocaleString('pt-BR')} views` : '';
        return `    [${p.type}] ${p.likesCount.toLocaleString('pt-BR')} likes | ${p.commentsCount} comentários${views} | "${p.caption.slice(0, 90)}"`;
      }).join('\n');

      return `@${c.username}${c.verified ? ' ✓' : ''} (${c.fullName || ''})
  ${c.followersCount.toLocaleString('pt-BR')} seguidores | ${c.postsCount} posts | Categoria: ${c.businessCategoryName || 'pessoal'}
  Engajamento médio: ${avgEng ? avgEng + '%' : 'N/A'} | Reels: ${reels.length} | Fotos/Carrossel: ${statics.length}
  Hashtags recorrentes: ${allHashtags.length > 0 ? allHashtags.map(h => '#' + h).join(', ') : 'nenhuma identificada'}
  Bio: "${c.biography}"
  Top posts:
${topPostsStr || '  (sem dados de posts)'}`;
    }).join('\n\n');

    competitorSection = `\n\n=== CONCORRENTES / REFERÊNCIAS DO NICHO (${analysisData.competitors.length} contas) ===
${compDetails}`;
  }

  const noDataNote = !instagramUrl
    ? '\n\n(Instagram não conectado para este mentorado — análise baseada apenas na imersão.)'
    : !analysisData
      ? '\n\n(Não foi possível buscar os dados do Instagram agora. Responda com base no contexto da imersão e oriente o time sobre o que perguntar ao mentorado.)'
      : analysisData.isPreviewOnly
        ? '\n\n(Dados detalhados de posts indisponíveis no momento — análise com base nos dados básicos do perfil.)'
        : '';

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `${(() => { const c = loadAgentConfig(username); return c.agents[c.activeAgentType]?.prompt || DEFAULT_PROMPT; })()}

Você acabou de receber os dados reais do Instagram do mentorado — coletados agora via scraping. Use esses números para dar um papo direto ao nosso time sobre o que está acontecendo na conta, o que os concorrentes estão fazendo melhor e o que o time precisa falar com o mentorado.

Sem seções fixas, sem fórmula engessada. Fale como o Agente Bora fala: direto, energético, focado no que o time precisa ouvir para agir. Se tiver dados de concorrentes, compare sem papas na língua. Se tiver gaps óbvios, aponte. Termine sempre com o que o time precisa dizer pro mentorado amanhã cedo.

IMPORTANTE: Você tem acesso aos dados reais via scraping. Nunca diga que não tem acesso ao Instagram.`
      },
      {
        role: 'user',
        content: `${userMessage}\n\n=== CONTEXTO DO MENTORADO: ${caseData.title} ===\n${caseData.content.slice(0, 2000)}${profileSection}${hashtagSection}${competitorSection}${noDataNote}`
      }
    ],
    max_tokens: 2400
  });

  return completion.choices[0].message.content;
}

// ---- Destilação de conhecimento (síntese de múltiplos podcasts) -------------
async function runDistillation() {
  try {
    const { data: entries } = await supabase
      .from('knowledge_entries')
      .select('id, title, content')
      .eq('active', true)
      .neq('source', 'distilled');

    if (!entries || entries.length === 0) {
      console.log('[Distill] Nenhuma fonte ativa encontrada.');
      return;
    }

    console.log(`[Distill] Processando ${entries.length} fontes...`);

    const allInsights = [];
    for (const entry of entries) {
      const words = entry.content.split(/\s+/);
      const sample = [
        ...words.slice(0, 3000),
        ...(words.length > 3500 ? words.slice(-500) : [])
      ].join(' ');

      const extraction = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Você é um extrator de conhecimento de negócios. Extraia APENAS os frameworks, princípios, definições e lógicas concretas de negócios. Ignore apresentações, filler e conversa. Seja extremamente direto e denso. Organize por tópico.'
          },
          {
            role: 'user',
            content: `Fonte: "${entry.title}"\n\nTRANSCRIÇÃO:\n${sample}\n\nExtraia os 10-15 insights de negócios mais valiosos desta fonte. Use bullet points concisos.`
          }
        ],
        max_tokens: 800
      });

      const insights = extraction.choices[0].message.content;
      allInsights.push(`=== ${entry.title} ===\n${insights}`);
      console.log(`[Distill] "${entry.title.slice(0, 40)}" extraído.`);
    }

    console.log('[Distill] Sintetizando base unificada...');
    const synthesis = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Você é um editor de conhecimento de negócios especializado nos ensinamentos de Alfredo Soares e do CD Grupo.
Crie uma BASE DE CONHECIMENTO ESTRUTURADA a partir dos insights fornecidos.
Organize por temas: Vendas, Ecossistema, Métricas (LTV/CAC), Marca, Mentalidade, Gestão.
Elimine duplicatas. Mantenha apenas o que é concreto e acionável.
Use formato: ## Tema\n- **Framework/Princípio**: explicação direta com exemplo quando disponível.`
        },
        {
          role: 'user',
          content: `Sintetize os insights abaixo em uma base de conhecimento unificada, coesa e acionável:\n\n${allInsights.join('\n\n')}`
        }
      ],
      max_tokens: 2000
    });

    const distilledContent = synthesis.choices[0].message.content;
    const title = `Base Unificada — ${entries.length} fontes (${new Date().toLocaleDateString('pt-BR')})`;

    await supabase.from('knowledge_entries').delete().eq('source', 'distilled');

    const { data: newEntry } = await supabase
      .from('knowledge_entries')
      .insert({ title, content: distilledContent, source: 'distilled', active: true })
      .select()
      .single();

    if (newEntry) {
      const texts = chunkText(distilledContent);
      for (const text of texts) {
        const embedding = await getEmbedding(text);
        await supabase.from('knowledge_chunks').insert({ entry_id: newEntry.id, text, embedding: embedding ?? null });
      }
      
      // Auto-sync Obsidian
      syncSingleToObsidian('fonte', title, distilledContent).catch(console.error);

      console.log(`[Distill] Base unificada criada: "${title}" — ${texts.length} chunks.`);
    }
  } catch (e) {
    console.error('[Distill] Erro:', e.message);
  }
}

app.post('/api/distill', (_req, res) => {
  res.json({ status: 'Destilando conhecimento em segundo plano...' });
  runDistillation();
});

// ---- Embedding (mantido para compatibilidade) --------------------------------
app.post('/api/embed', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Texto não fornecido.' });
  try {
    const vector = await getEmbedding(text);
    res.json({ vector });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- YouTube ----------------------------------------------------------------

// Public Invidious instances — tried in order when direct YouTube access is blocked (datacenter IPs)
const INVIDIOUS_INSTANCES = [
  'https://inv.tux.pizza',
  'https://invidious.fdn.fr',
  'https://yt.artemislena.eu',
  'https://invidious.privacyredirect.com',
  'https://iv.datura.network',
];

function parseInvidiousCaptions(text) {
  if (!text || text.length < 10) return null;
  if (text.includes('WEBVTT')) {
    const captionLines = [];
    let inCaption = false;
    for (const line of text.split('\n')) {
      if (line.includes('-->')) { inCaption = true; continue; }
      if (inCaption && line.trim()) {
        const clean = line.replace(/<[^>]+>/g, '').trim();
        if (clean) captionLines.push(clean);
      } else if (inCaption && !line.trim()) { inCaption = false; }
    }
    return captionLines.length > 0 ? captionLines.join(' ') : null;
  }
  // XML timedtext format
  const lines = (text.match(/<text[^>]*>([^<]+)<\/text>/g) || []).map(m => {
    const match = m.match(/<text[^>]*>([^<]+)<\/text>/);
    return match ? match[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").replace(/&quot;/g,'"').trim() : '';
  }).filter(Boolean);
  return lines.length > 0 ? lines.join(' ') : null;
}

// YouTube Data API v3 — works from any IP (datacenter included), requires YOUTUBE_API_KEY env var
// Free tier: 10,000 units/day, ~1 unit per videos.list call
async function fetchYoutubeViaDataAPI(videoId) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${encodeURIComponent(key)}`,
      { headers: { 'Accept': 'application/json' }, signal: ctrl.signal }
    );
    clearTimeout(t);
    if (!res.ok) { console.log(`[YouTube/DataAPI] HTTP ${res.status}`); return null; }
    const data = await res.json();
    const item = data?.items?.[0]?.snippet;
    if (!item) { console.log('[YouTube/DataAPI] Vídeo não encontrado'); return null; }
    const description = (item.description || '').trim();
    console.log(`[YouTube/DataAPI] OK — title: "${item.title}" | description: ${description.length} chars`);
    return { title: item.title || null, description: description || null };
  } catch (e) {
    console.log(`[YouTube/DataAPI] Falhou: ${e.name === 'AbortError' ? 'timeout' : e.message}`);
    return null;
  }
}

async function fetchYoutubeViaInvidious(videoId) {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 10000);
      const videoRes = await fetch(`${instance}/api/v1/videos/${videoId}?fields=title,description,captions`, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        signal: ctrl.signal
      });
      clearTimeout(t);
      if (!videoRes.ok) { console.log(`[YouTube/Invidious] ${instance} HTTP ${videoRes.status}`); continue; }
      const data = await videoRes.json();
      if (!data || data.error) { console.log(`[YouTube/Invidious] ${instance} error: ${data?.error}`); continue; }
      console.log(`[YouTube/Invidious] ${instance} OK — captions: ${data.captions?.length || 0}`);

      let transcript = null;
      if (data.captions && data.captions.length > 0) {
        const track =
          data.captions.find(c => c.language_code === 'pt' && c.label?.toLowerCase().includes('auto')) ||
          data.captions.find(c => c.language_code === 'pt' || c.language_code === 'pt-BR') ||
          data.captions.find(c => c.language_code === 'en' && c.label?.toLowerCase().includes('auto')) ||
          data.captions.find(c => c.language_code === 'en') ||
          data.captions[0];

        if (track?.url) {
          try {
            const capUrl = track.url.startsWith('http') ? track.url : `${instance}${track.url}`;
            const capCtrl = new AbortController();
            const capT = setTimeout(() => capCtrl.abort(), 10000);
            const capRes = await fetch(capUrl, { signal: capCtrl.signal });
            clearTimeout(capT);
            if (capRes.ok) {
              transcript = parseInvidiousCaptions(await capRes.text());
              if (transcript) console.log(`[YouTube/Invidious] Transcrição: ${transcript.length} chars`);
            }
          } catch (e) { console.log(`[YouTube/Invidious] Erro legendas: ${e.message}`); }
        }
      }
      return { title: data.title || null, transcript: transcript || data.description || null };
    } catch (e) {
      console.log(`[YouTube/Invidious] ${instance} ${e.name === 'AbortError' ? 'timeout' : e.message}`);
    }
  }
  return null;
}

async function fetchYoutubePageInfo(videoId) {
  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    },
  });
  const html = await pageRes.text();

  let title = null;
  let description = null;

  // Extract ytInitialPlayerResponse (contains title, shortDescription, author)
  const playerIdx = html.indexOf('ytInitialPlayerResponse');
  if (playerIdx !== -1) {
    try {
      // Find the JSON object start
      const jsonStart = html.indexOf('{', playerIdx);
      // Use a balanced-brace extractor to avoid greedy regex issues on large payloads
      let depth = 0, end = jsonStart;
      for (; end < html.length && end < jsonStart + 2_000_000; end++) {
        if (html[end] === '{') depth++;
        else if (html[end] === '}') { depth--; if (depth === 0) break; }
      }
      const data = JSON.parse(html.slice(jsonStart, end + 1));
      title = data?.videoDetails?.title || null;
      description = data?.videoDetails?.shortDescription || null;
    } catch (e) {
      console.error('[YouTube] Erro ao parsear ytInitialPlayerResponse:', e.message);
    }
  }

  return { title, description };
}

app.post('/api/youtube-info', async (req, res) => {
  const { url: videoUrl } = req.body;
  if (!videoUrl) return res.status(400).json({ error: 'Nenhuma URL enviada.' });

  try {
    let videoId = null;
    try {
      const parsed = new URL(videoUrl);
      if (parsed.hostname.includes('youtu.be')) {
        videoId = parsed.pathname.split('/').filter(Boolean)[0];
      } else {
        videoId = parsed.searchParams.get('v') || parsed.pathname.split('/').pop();
      }
    } catch (e) {
      return res.status(400).json({ error: 'URL inválida.' });
    }

    if (!videoId) return res.status(400).json({ error: 'Não consegui identificar o ID do vídeo.' });

    console.log(`[YouTube] Processando vídeo: ${videoId}`);

    // Busca página do YouTube para título e descrição (fallback)
    let pageTitle = null;
    let pageDescription = null;
    try {
      const info = await fetchYoutubePageInfo(videoId);
      pageTitle = info.title;
      pageDescription = info.description;
    } catch (e) {
      console.error('[YouTube] Erro ao buscar página:', e.message);
    }

    // Título via oEmbed (mais confiável para título formatado)
    let title = pageTitle || `YouTube: ${videoId}`;
    try {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      if (oembedRes.ok) {
        const oembedData = await oembedRes.json();
        title = oembedData.title || title;
      }
    } catch (e) {
      console.error('[YouTube] Erro ao buscar título via oEmbed:', e.message);
    }

    // Tenta transcrição/legendas primeiro (funciona em IPs residenciais)
    const { YoutubeTranscript } = require('youtube-transcript');
    let transcript = '';
    try {
      const segments = await YoutubeTranscript.fetchTranscript(videoId);
      transcript = segments.map(s => s.text).join(' ');
      console.log(`[YouTube] Transcrição obtida: ${transcript.length} chars`);
    } catch (e) {
      console.log(`[YouTube] Transcrição não disponível (${e.message})`);
    }

    // Fallback 1: usa a descrição da página (funciona em IPs residenciais)
    if (!transcript && pageDescription && pageDescription.length > 50) {
      console.log(`[YouTube] Usando descrição do vídeo: ${pageDescription.length} chars`);
      transcript = pageDescription;
    }

    // Fallback 2: YouTube Data API v3 — funciona de qualquer IP se YOUTUBE_API_KEY estiver configurado
    if (!transcript && process.env.YOUTUBE_API_KEY) {
      console.log('[YouTube] Tentando via Data API v3...');
      try {
        const apiResult = await fetchYoutubeViaDataAPI(videoId);
        if (apiResult?.description && apiResult.description.length > 50) {
          transcript = apiResult.description;
          if (apiResult.title) title = apiResult.title;
          console.log(`[YouTube] Data API v3 OK: ${transcript.length} chars (descrição)`);
        }
      } catch (e) {
        console.log(`[YouTube] Data API v3 falhou: ${e.message}`);
      }
    }

    // Fallback 3: Invidious — frontend open-source do YouTube (IPs de datacenter às vezes funcionam)
    if (!transcript) {
      console.log('[YouTube] Tentando via Invidious...');
      try {
        const invResult = await fetchYoutubeViaInvidious(videoId);
        if (invResult?.transcript && invResult.transcript.length > 50) {
          transcript = invResult.transcript;
          if (!title || title === `YouTube: ${videoId}`) title = invResult.title || title;
          console.log(`[YouTube] Invidious OK: ${transcript.length} chars`);
        } else {
          console.log('[YouTube] Invidious não retornou conteúdo suficiente');
        }
      } catch (e) {
        console.log(`[YouTube] Invidious falhou: ${e.message}`);
      }
    }

    // Se ainda não tem conteúdo, pede ao usuário que cole manualmente
    if (!transcript) {
      return res.json({ title, transcript: null, requiresManualContent: true });
    }

    res.json({ title, transcript: cleanTranscript(transcript) });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Erro ao processar o link do YouTube.' });
  }
});

// ---- Upload de Vídeo --------------------------------------------------------
app.post('/api/upload-video', (req, res, next) => {
  req.socket.setTimeout(0);
  res.setTimeout(0);
  // Wrap multer to return JSON errors instead of Express's plain 500
  upload.single('video')(req, res, (err) => {
    if (err) {
      const msg = err.code === 'LIMIT_FILE_SIZE'
        ? 'Arquivo muito grande. Envie vídeos de até 2GB.'
        : (err.message || 'Erro ao receber o arquivo.');
      return res.status(400).json({ error: msg });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado.' });

  const originalPath = req.file.path;

  try {
    // Extrai chunks direto do original + transcreve em paralelo (sem conversão full-file)
    const rawTranscript = await transcribeVideoFast(originalPath, openai);
    if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);

    const transcript = cleanTranscript(rawTranscript);
    console.log(`[Upload] Transcrição (${transcript.length} chars):`, transcript.slice(0, 200));
    if (!transcript || transcript.trim().length < 10) throw new Error('Whisper não retornou transcrição suficiente.');

    // 3. Analisar com GPT-4o-mini
    console.log('[Upload] Analisando com GPT-4o-mini...');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Você é um assistente sênior de negócios. Analise transcrições de sessões de mentoria.
Retorne SEMPRE um JSON com exatamente duas chaves de texto simples:
- "nomeMentorado": string com o nome real da pessoa mentorada (sem objetos aninhados)
- "resumo": string de texto corrido com análise detalhada em português — desafios de negócio, gargalos, próximos passos. Mínimo 3 parágrafos. NÃO use objetos ou arrays, apenas texto puro.`
        },
        {
          role: 'user',
          content: `Analise a transcrição e extraia:
1. NOME REAL do mentorado (procure onde se apresentam)
2. RESUMO em texto corrido: desafios reais, gargalos, próximos passos acionáveis.

TRANSCRIÇÃO:
${transcript.slice(0, 100000)}`
        }
      ]
    });

    const parsedData = JSON.parse(completion.choices[0].message.content);
    // Ensure resumo is always a plain string
    if (typeof parsedData.resumo !== 'string') {
      parsedData.resumo = JSON.stringify(parsedData.resumo, null, 2);
    }
    console.log('[Upload] Resultado:', parsedData.nomeMentorado);
    res.json(parsedData);

  } catch (error) {
    if (fs.existsSync(originalPath)) fs.unlinkSync(originalPath);
    res.status(500).json({ error: error.message || 'Erro ao processar o vídeo.' });
  }
});

async function syncSingleToObsidian(type, title, content) {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
  if (!vaultPath) return;
  try {
    let subfolder = 'BoraChat/Fontes';
    if (type === 'imersao') subfolder = 'BoraChat/Imersao';
    const targetDir = path.join(vaultPath, subfolder);
    await fs.promises.mkdir(targetDir, { recursive: true });
    const safeTitle = title.replace(/[<>:"/\\|?*]+/g, '').trim() || 'Sem Titulo';
    await fs.promises.writeFile(path.join(targetDir, `${safeTitle}.md`), content || '', 'utf8');
  } catch (err) {
    console.error(`[Obsidian] Erro ao sincronizar ${title}:`, err.message);
  }
}

// ---- Obsidian Sync ----------------------------------------------------------
app.post('/api/obsidian/sync', async (req, res) => {
  const { type, title, content } = req.body;
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
  if (!vaultPath) return res.status(200).json({ status: 'ignored' });
  if (!title || !content) return res.status(400).json({ error: 'Título e conteúdo são obrigatórios.' });

  try {
    let subfolder = 'BoraChat/Geral';
    if (type === 'chat') subfolder = 'BoraChat/Conversas';
    if (type === 'fonte') subfolder = 'BoraChat/Fontes';
    if (type === 'imersao') subfolder = 'BoraChat/Imersao';

    const targetDir = path.join(vaultPath, subfolder);
    await fs.promises.mkdir(targetDir, { recursive: true });
    const safeTitle = title.replace(/[<>:"/\\|?*]+/g, '').trim() || 'Sem Titulo';
    await fs.promises.writeFile(path.join(targetDir, `${safeTitle}.md`), content, 'utf8');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/obsidian/sync-all', async (req, res) => {
  const vaultPath = process.env.OBSIDIAN_VAULT_PATH;
  if (!vaultPath) return res.status(200).json({ status: 'ignored' });

  try {
    const { data: knowData } = await supabase.from('knowledge_entries').select('title, content');
    const { data: imData } = await supabase.from('imersao_cases').select('title, content');
    const { data: convsData } = await supabase.from('conversations').select('id, title');

    const knowDir = path.join(vaultPath, 'BoraChat', 'Fontes');
    const imDir = path.join(vaultPath, 'BoraChat', 'Imersao');
    const convDir = path.join(vaultPath, 'BoraChat', 'Conversas');
    await fs.promises.mkdir(knowDir, { recursive: true });
    await fs.promises.mkdir(imDir, { recursive: true });
    await fs.promises.mkdir(convDir, { recursive: true });

    let count = 0;
    if (knowData) {
      for (const k of knowData) {
        const safeTitle = k.title.replace(/[<>:"/\\|?*]+/g, '').trim() || 'Sem Titulo';
        await fs.promises.writeFile(path.join(knowDir, `${safeTitle}.md`), k.content, 'utf8');
        count++;
      }
    }
    if (imData) {
      for (const i of imData) {
        const safeTitle = i.title.replace(/[<>:"/\\|?*]+/g, '').trim() || 'Sem Titulo';
        await fs.promises.writeFile(path.join(imDir, `${safeTitle}.md`), i.content || '', 'utf8');
        count++;
      }
    }
    if (convsData) {
      for (const c of convsData) {
        const { data: allMsgs } = await supabase.from('messages').select('role, display_text').eq('conversation_id', c.id).order('created_at', { ascending: true });
        let convContent = `# ${c.title}\n\n`;
        if (allMsgs) {
          allMsgs.forEach(m => {
            convContent += `**${m.role === 'user' ? 'Você' : 'Agente Bora'}**:\n${m.display_text}\n\n---\n\n`;
          });
        }
        const safeTitle = c.title.replace(/[<>:"/\\|?*]+/g, '').trim() || 'Sem Titulo';
        await fs.promises.writeFile(path.join(convDir, `${safeTitle}.md`), convContent, 'utf8');
        count++;
      }
    }
    res.json({ success: true, count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ---- TTS (ElevenLabs) -------------------------------------------------------
app.post('/api/tts', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Nenhum texto fornecido.' });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID || '29vD33N1CtxCmqQRPOHJ';
  if (!apiKey) return res.status(500).json({ error: 'Chave da ElevenLabs não configurada.' });

  try {
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'Accept': 'audio/mpeg', 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.3, similarity_boost: 0.9, style: 0.0, use_speaker_boost: true }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail?.message || 'Erro na API da ElevenLabs');
    }

    const audioBuffer = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend buildado em produção — Express responde tudo num único processo
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../dist');
  app.use(express.static(distPath));
  app.use((_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

process.on('uncaughtException', (err) => {
  console.error('[Servidor] Exceção não tratada:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Servidor] Promise rejeitada sem handler:', reason);
});

app.listen(port, () => {
  console.log(`Servidor Agente Bora rodando na porta ${port}`);
  console.log(`Supabase: ${process.env.SUPABASE_URL ? 'conectado' : 'NÃO CONFIGURADO'}`);
  console.log(`[Migration] Execute no Supabase SQL Editor (apenas uma vez):`);
  console.log(`  ALTER TABLE imersao_cases ADD COLUMN IF NOT EXISTS instagram_url TEXT;`);
  console.log(`  ALTER TABLE imersao_cases ADD COLUMN IF NOT EXISTS instagram_profile JSONB;`);
  console.log(`  ALTER TABLE imersao_cases ADD COLUMN IF NOT EXISTS instagram_analysis JSONB;`);
  console.log(`  ALTER TABLE imersao_cases ADD COLUMN IF NOT EXISTS instagram_analyzed_at TIMESTAMPTZ;`);
});
