require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const fetch = require('node-fetch');

const app = express();

const PORT = process.env.PORT || 3001;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// MIDDLEWARES
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

// SESIONES
app.use(session({
    secret: process.env.SESSION_SECRET || 'oleole-secret-key-2026',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

// RUTA PRINCIPAL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// LIMPIAR HISTORIAL
app.post('/api/clear-history', (req, res) => {
    if (req.session) req.session.conversationHistory = [];
    res.json({ ok: true });
});

// CHAT IA
app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        if (!OPENROUTER_API_KEY) {
            console.error('❌ OPENROUTER_API_KEY no configurada');
            return res.status(500).json({ error: 'OPENROUTER_API_KEY no configurada' });
        }

        if (!req.session.conversationHistory) {
            req.session.conversationHistory = [];
        }

        if (messages && messages.length > 0) {
            req.session.conversationHistory.push(messages[messages.length - 1]);
        }

        const MAX_HISTORY = 10;
        const history = req.session.conversationHistory.slice(-MAX_HISTORY);

        const systemPrompt = `
Eres "OleOle", un asistente experto en protección de datos personales, con fines educativos.

**REGLAS OBLIGATORIAS:**

1. **PRIORIDAD CHILENA:** Responde basándote en la Ley 19.628 y su modificación Ley 21.719 (vigencia 1/12/2026). Cita artículos exactos cuando sea posible.

2. **CONTEXTO ESPAÑOL:** Si es relevante, añade sección "Contexto España" con resoluciones AEPD reales (PS-00297-2025, PS-00615-2025, etc.). Si no hay, dí lo claro.

3. **NO INVENTES:** Nunca inventes artículos, resoluciones o informes.

4. **AVISO LEGAL OBLIGATORIO:** Siempre termina con: "⚖️ Aviso: Respuesta educativa. Verifica en fuentes oficiales."

5. **MEMORIA:** Si repreguntas sobre el mismo tema, complementa sin repetirte.
`;

        const messagesForAI = [
            { role: 'system', content: systemPrompt },
            ...history
        ];

        // 🔥 MODELO CORRECTO: Llama 3.3 70B (gratuito)
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'HTTP-Referer': 'https://oleole-gdhk.onrender.com',
                'X-Title': 'OleOle'
            },
            body: JSON.stringify({
                model: 'meta-llama/llama-3.3-70b-instruct:free',
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
        console.error('❌ ERROR:', error);
        res.status(500).json({ error: error.message || 'Error interno' });
    }
});

// INICIAR SERVIDOR
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor corriendo en puerto ${PORT}`);
    console.log(`🤖 Modelo: Llama 3.3 70B Instruct`);
    console.log(`🔐 API Key: ${OPENROUTER_API_KEY ? '✅ OK' : '❌ FALTA'}`);
});