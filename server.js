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

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor corriendo en puerto ${PORT}`);
    console.log(`🔐 API Key: ${OPENROUTER_API_KEY ? '✅ OK' : '❌ FALTA'}`);
});