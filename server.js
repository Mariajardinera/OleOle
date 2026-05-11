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

app.use(session({
    secret: process.env.SESSION_SECRET || 'oleole-secret-key-2026',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

app.post('/api/clear-history', (req, res) => {
    if (req.session) req.session.conversationHistory = [];
    res.json({ ok: true });
});

app.post('/api/chat', async (req, res) => {
    const { messages } = req.body;
    
    if (!OPENROUTER_API_KEY) {
        console.error('❌ API Key no configurada');
        return res.status(500).json({ error: 'API Key no configurada en el servidor' });
    }
    
    // Historial de conversación (máximo 10 mensajes)
    if (!req.session.conversationHistory) {
        req.session.conversationHistory = [];
    }
    
    if (messages && messages.length > 0) {
        req.session.conversationHistory.push(messages[messages.length - 1]);
    }
    
    const MAX_HISTORY = 10;
    let history = req.session.conversationHistory.slice(-MAX_HISTORY);
    
    // ============================================
    // PROMPT MEJORADO CON PRIORIDAD CHILENA Y VERACIDAD
    // ============================================
    const systemPrompt = `Eres "OleOle", un asistente experto en protección de datos personales.

**REGLAS ABSOLUTAS - LEY CHILENA (PRIORITARIA):**
1. SIEMPRE responde primero basándote en la legislación chilena.
2. Cita el artículo EXACTO de la Ley 19.628 o 21.719 (ej: "Artículo 12 de la Ley 19.628...").
3. Si no encuentras el artículo o no estás segura, DÍLO CLARAMENTE: "No encuentro un artículo exacto de la ley chilena sobre este punto específico, pero según el espíritu de la ley..."
4. NUNCA inventes números de artículo, fechas o resoluciones que no existan.

**REGLAS ABSOLUTAS - CONTEXTO ESPAÑOL (SECUNDARIO):**
1. DESPUÉS de responder con ley chilena, añade "**Contexto España**".
2. Cita resoluciones reales de la AEPD si existen (ej: "resolución PS-00297-2025 de la AEPD...").
3. Si no hay resolución específica, DÍLO: "No se ha encontrado una resolución de la AEPD sobre este punto."

**REGLAS ABSOLUTAS - VERACIDAD Y MEMORIA:**
1. Si el usuario repregunta sobre el mismo tema, utiliza el historial de conversación para complementar y profundizar.
2. NUNCA te repitas. Si ya diste una respuesta, la siguiente debe ser complementaria.
3. Si el usuario cambia de tema, ignora el historial anterior y empieza de nuevo.
4. SIEMPRE termina con el aviso legal.

**ESTRUCTURA OBLIGATORIA DE RESPUESTA:**
**[Respuesta Chile]** - Cita artículo o explica que no existe.
**[Contexto España]** - Menciona resolución AEPD si existe.
**[Aviso legal]** - 📌 Aviso: Este es un asistente educativo. Verifica la información en las fuentes oficiales.`;

    const messagesForAI = [
        { role: 'system', content: systemPrompt },
        ...history
    ];
    
    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://oleole-gdhk.onrender.com',
                'X-Title': 'OleOle (Prioridad Chile)'
            },
            body: JSON.stringify({
                model: 'openrouter/free',
                messages: messagesForAI,
                temperature: 0.3,  // Más bajo para respuestas más precisas
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
        console.error('Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    console.log(`🔐 API Key: ${OPENROUTER_API_KEY ? '✅ Configurada' : '❌ Falta'}`);
});
