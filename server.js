require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

app.use(session({
    secret: process.env.SESSION_SECRET || 'oleole-secret-key-2026',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/clear-history', (req, res) => {
    if (req.session) req.session.conversationHistory = [];
    res.json({ ok: true });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        if (!OPENROUTER_API_KEY) {
            console.error('❌ API Key no configurada');
            return res.status(500).json({ error: 'API Key no configurada' });
        }

        if (!req.session.conversationHistory) {
            req.session.conversationHistory = [];
        }

        if (messages && messages.length > 0) {
            req.session.conversationHistory.push(messages[messages.length - 1]);
        }

        const MAX_HISTORY = 10;
        const history = req.session.conversationHistory.slice(-MAX_HISTORY);

        const systemPrompt = `Eres "OleOle", asistente educativo de protección de datos. Prioridad: ley chilena (19.628 y 21.719). Cita artículos si puedes. Complementa con normativa española (AEPD) sin inventar. Si repreguntan sobre el mismo tema, complementa sin repetirte. Termina siempre con el aviso legal.`;

        const messagesForAI = [
            { role: 'system', content: systemPrompt },
            ...history
        ];

        // 🔥 MODELO GENÉRICO (nunca falla)
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://oleole-gdhk.onrender.com',
                'X-Title': 'OleOle'
            },
            body: JSON.stringify({
                model: 'openrouter/free',
                messages: messagesForAI,
                temperature: 0.4,
                max_tokens: 1500
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Error en OpenRouter');
        }

        const assistantMessage = data.choices[0].message;
        req.session.conversationHistory.push(assistantMessage);

        res.json({ choices: [{ message: assistantMessage }] });

    } catch (error) {
        console.error('❌ Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 📦 DEPENDENCIAS
// ============================================
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const fetch = require('node-fetch');
const fs = require('fs');

// ============================================
// 🚀 INICIALIZACIÓN
// ============================================
const app = express();
const PORT = process.env.PORT || 3001;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// ============================================
// 🔧 MIDDLEWARES
// ============================================
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

// ============================================
// 🧠 SESIONES (memoria de conversación)
// ============================================
app.use(session({
    secret: process.env.SESSION_SECRET || 'oleole-secret-key-2026',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000  // 30 días
    }
}));

// ============================================
// 📝 RUTA PRINCIPAL
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ============================================
// 🧹 LIMPIAR HISTORIAL DE CONVERSACIÓN
// ============================================
app.post('/api/clear-history', (req, res) => {
    if (req.session) {
        req.session.conversationHistory = [];
    }
    res.json({ ok: true });
});

// ============================================
// 📊 ENDPOINT DE FEEDBACK (👍 👎)
// ============================================
app.post('/api/feedback', (req, res) => {
    const { type, question, answer, timestamp } = req.body;
    
    const feedbackFile = path.join(__dirname, 'feedback.json');
    
    let feedbacks = [];
    if (fs.existsSync(feedbackFile)) {
        try {
            const data = fs.readFileSync(feedbackFile, 'utf8');
            feedbacks = JSON.parse(data);
        } catch (e) {
            feedbacks = [];
        }
    }
    
    feedbacks.push({
        type,
        question,
        answer: answer ? answer.substring(0, 500) : '',
        timestamp: timestamp || new Date().toISOString(),
        date: new Date().toISOString()
    });
    
    // Guardar solo los últimos 1000 feedbacks
    if (feedbacks.length > 1000) {
        feedbacks = feedbacks.slice(-1000);
    }
    
    fs.writeFileSync(feedbackFile, JSON.stringify(feedbacks, null, 2));
    
    console.log(`📊 Feedback recibido: ${type} - ${new Date().toISOString()}`);
    res.json({ ok: true });
});

// ============================================
// 🤖 ENDPOINT PRINCIPAL DEL CHAT
// ============================================
app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        // ============================================
        // 🔐 VALIDAR API KEY
        // ============================================
        if (!OPENROUTER_API_KEY) {
            console.error('❌ OPENROUTER_API_KEY no configurada');
            return res.status(500).json({ 
                error: 'OPENROUTER_API_KEY no configurada en el servidor' 
            });
        }

        // ============================================
        // 📝 INICIALIZAR HISTORIAL DE CONVERSACIÓN
        // ============================================
        if (!req.session.conversationHistory) {
            req.session.conversationHistory = [];
        }

        // ============================================
        // 💾 GUARDAR ÚLTIMO MENSAJE DEL USUARIO
        // ============================================
        if (messages && messages.length > 0) {
            req.session.conversationHistory.push(messages[messages.length - 1]);
        }

        // ============================================
        // 🧠 LIMITAR HISTORIAL A ÚLTIMOS 10 MENSAJES
        // ============================================
        const MAX_HISTORY = 10;
        const history = req.session.conversationHistory.slice(-MAX_HISTORY);

        // ============================================
        // 📜 SYSTEM PROMPT (PRIORIDAD LEY CHILENA)
        // ============================================
        const systemPrompt = `Eres "OleOle", un asistente experto en protección de datos personales, con fines educativos.

**REGLAS OBLIGATORIAS - LEY CHILENA (PRIORITARIA):**
1. SIEMPRE responde primero basándote en la legislación chilena.
2. Fuente principal: Ley 19.628 (sobre protección de la vida privada) y su modificación, la Ley 21.719.
3. Cita el artículo exacto cuando sea posible. Ejemplo: "En Chile, según el Artículo 12 de la Ley 19.628..."
4. Menciona que la Ley 21.719 entrará en vigencia el 1 de diciembre de 2026.
5. Si no encuentras el artículo, DÍLO CLARAMENTE: "No encuentro un artículo exacto de la ley chilena sobre este punto, pero según el espíritu de la ley..."

**REGLAS OBLIGATORIAS - CONTEXTO ESPAÑOL (SECUNDARIO):**
1. DESPUÉS de responder con ley chilena, añade "**Contexto España**" solo si es relevante.
2. Usa resoluciones REALES de la AEPD (ej: PS/00089/2019, PS-00297-2025, PS-00615-2025).
3. Si no existe resolución específica, DÍLO CLARAMENTE: "No se ha encontrado una resolución pública de la AEPD sobre este punto específico."

**REGLAS OBLIGATORIAS - PROHIBICIÓN DE INVENTAR:**
1. NUNCA inventes números de resolución, fechas, nombres de empresas o aeropuertos.
2. NUNCA inventes artículos de leyes que no hayas verificado.
3. Si no estás seguro, DÍLO CLARAMENTE.

**AVISO LEGAL OBLIGATORIO (al final de cada respuesta):**
Siempre termina con:
"⚖️ Aviso educativo: esta respuesta es informativa y no constituye asesoría legal formal. Verifique fuentes oficiales (AEPD, leychile.cl) antes de tomar decisiones."

**ESTRUCTURA DE RESPUESTA:**
1. [Chile] - Respuesta principal citando ley chilena
2. [España] - Contexto español (solo si aplica)
3. ⚖️ Aviso educativo`;

        // ============================================
        // 📨 MENSAJES PARA OPENROUTER
        // ============================================
        const messagesForAI = [
            { role: 'system', content: systemPrompt },
            ...history
        ];

        console.log('📨 Enviando request a OpenRouter...');

        // ============================================
        // 🌐 REQUEST A OPENROUTER (MODELO GRATUITO)
        // ============================================
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://oleole-gdhk.onrender.com',
                'X-Title': 'OleOle'
            },
            body: JSON.stringify({
                model: 'openrouter/free',  // 🔥 MODELO GRATUITO GENÉRICO
                messages: messagesForAI,
                temperature: 0.4,          // Más bajo = respuestas más precisas
                max_tokens: 1500
            })
        });

        console.log('📥 Status OpenRouter:', response.status);

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ Error OpenRouter:', data);
            throw new Error(data.error?.message || 'Error desconocido en OpenRouter');
        }

        const assistantMessage = data.choices[0].message;

        // ============================================
        // 💾 GUARDAR RESPUESTA DE LA IA EN EL HISTORIAL
        // ============================================
        req.session.conversationHistory.push(assistantMessage);

        // ============================================
        // 📤 RESPUESTA AL FRONTEND
        // ============================================
        res.json({
            choices: [{ message: assistantMessage }]
        });

    } catch (error) {
        console.error('❌ ERROR EN /api/chat:', error);
        res.status(500).json({ 
            error: error.message || 'Error interno del servidor' 
        });
    }
});

// ============================================
// 🟢 INICIAR SERVIDOR
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ╔══════════════════════════════════════════════════════════════════╗
    ║     🇨🇱 OleOle - Prioridad Ley Chilena (versión completa) 🇪🇸    ║
    ╠══════════════════════════════════════════════════════════════════╣
    ║  🌐 Servidor corriendo en puerto ${PORT}                            ║
    ║  🤖 Modelo: openrouter/free (genérico gratuito)                  ║
    ║  🧠 Memoria: Últimos ${10} mensajes                                ║
    ║  📊 Feedback: Guardando valoraciones en feedback.json            ║
    ║  🔐 API Key: ${OPENROUTER_API_KEY ? '✅ CONFIGURADA' : '❌ FALTANTE'}              ║
    ╚══════════════════════════════════════════════════════════════════╝
    `);
});

// ============================================
// 🛑 MANEJO DE ERRORES NO CAPTURADOS
// ============================================
process.on('uncaughtException', (err) => {
    console.error('💥 Error no capturado:', err);
    process.exit(1);
});

process.on('unhandledRejection', (reason) => {
    console.error('💥 Promesa rechazada no manejada:', reason);
    process.exit(1);
});

process.on('SIGTERM', () => {
    console.log('🛑 Señal SIGTERM recibida, cerrando servidor...');
    process.exit(0);
});