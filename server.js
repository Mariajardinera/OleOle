require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3002;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Configuración de sesiones (para almacenar el historial por usuario)
app.use(session({
    secret: process.env.SESSION_SECRET || 'oleole-secret-key-2026',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

// Endpoint para guardar preferencia de publicidad
app.post('/api/ads-consent', (req, res) => {
    const { consentType } = req.body;
    req.session.adsPreference = consentType;
    console.log(`📢 Preferencia guardada: ${consentType}`);
    res.json({ ok: true });
});

// Endpoint para limpiar el historial de conversación
app.post('/api/clear-history', (req, res) => {
    if (req.session) {
        req.session.conversationHistory = [];
    }
    console.log('🧹 Historial de conversación limpiado');
    res.json({ ok: true });
});

// ENDPOINT PRINCIPAL DEL CHAT (CON MEMORIA)
app.post('/api/chat', async (req, res) => {
    const { messages: newMessages } = req.body;
    
    if (!OPENROUTER_API_KEY) {
        console.error('❌ API Key no configurada');
        return res.status(500).json({ error: 'API Key no configurada en el servidor' });
    }
    
    // 🔥 GESTIÓN DEL HISTORIAL (memoria de conversación)
    // Inicializar historial en la sesión si no existe
    if (!req.session.conversationHistory) {
        req.session.conversationHistory = [];
    }
    
    // Agregar el nuevo mensaje del usuario al historial
    if (newMessages && newMessages.length > 0) {
        req.session.conversationHistory.push(newMessages[newMessages.length - 1]);
    }
    
    // Limitar el historial a los últimos 10 mensajes (para no saturar el contexto)
    const MAX_HISTORY = 10;
    let history = req.session.conversationHistory.slice(-MAX_HISTORY);
    
    // System prompt (instrucciones fijas del bot)
    const systemPrompt = `
Eres "OleOle", un asistente experto en protección de datos. Tu misión es educativa.

**NORMATIVA CHILENA (PRIORITARIA):**
- Ley 19.628 (actual hasta 30/11/2026) y Ley 21.719 (vigencia 1/12/2026).
- Cita siempre el artículo chileno que corresponda.

**FUENTES ESPAÑOLAS / AEPD (CONSULTA SECUNDARIA):**
- Las Guías, Criterios Jurídicos y Resoluciones de la AEPD.
- Tu conocimiento sobre el RGPD y la LOPDGDD.

**ESTRUCTURA DE RESPUESTA:**
1. **Respuesta prioritaria con la Ley Chilena:** Explica el punto y cita el artículo.
2. **Complemento con la AEPD:** Menciona si la AEPD ha establecido criterios, guías o resoluciones relevantes.
3. **Aviso final OBLIGATORIO:** "📌 *Aviso: Este bot tiene fines exclusivamente educativos. La normativa chilena 21.719 entrará en vigencia el 1 de diciembre de 2026. Antes de tomar decisiones, consulta las fuentes oficiales.*"

**REGLAS IMPORTANTES SOBRE EL CONTEXTO:**
- Cuando el usuario repregunte sobre el mismo tema, NO repitas la misma información. En su lugar, **complementa o profundiza** en lo que ya has dicho.
- Si el usuario pregunta "¿y qué más?", "¿alguna otra cosa?", "¿me puedes dar más detalles?", amplía tu respuesta anterior.
- Si el usuario contrapregunta sobre un punto específico, enfócate en ese punto sin repetir toda la respuesta previa.
- **NO** digas frases como "Como mencioné anteriormente..." o "Como ya te dije...". Simplemente continúa naturalmente.
- Si la conversación cambia de tema, ignora el historial anterior y empieza de nuevo.
`;

    // Construir el array de mensajes para OpenAI: system prompt + historial
    const messagesForAI = [
        { role: 'system', content: systemPrompt },
        ...history  // Aquí va el historial de la conversación
    ];
    
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'http://localhost:3002',
                'X-Title': 'OleOle (Chile + España)'
            },
            body: JSON.stringify({
                model: 'openrouter/free',
                messages: messagesForAI,
                temperature: 0.6,
                max_tokens: 1300
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'Error en OpenRouter');
        }
        
        // Guardar la respuesta del asistente en el historial
        const assistantMessage = data.choices[0].message;
        req.session.conversationHistory.push(assistantMessage);
        
        res.json({
            choices: [{ message: assistantMessage }]
        });
        
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════════════════════════╗
    ║     🇨🇱 OléOle - Prioridad Ley Chilena (con memoria) 🇪🇸         ║
    ╠══════════════════════════════════════════════════════════════════╣
    ║  🌐 http://localhost:${PORT}                                      ║
    ║  ⚖️  Chile: Ley 19.628 (vigente) y Ley 21.719 (2026)            ║
    ║  🇪🇸 España: Criterios, Guías y Resoluciones AEPD                ║
    ║  🧠 Memoria: El bot recuerda los últimos ${10} mensajes           ║
    ║  🔐 API Key: ${OPENROUTER_API_KEY ? '✅ Configurada' : '❌ Falta'}                    ║
    ╚══════════════════════════════════════════════════════════════════╝
    `);
});
