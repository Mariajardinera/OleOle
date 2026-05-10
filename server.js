require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;
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

app.post('/api/chat', async (req, res) => {
    const { messages } = req.body;
    
    if (!OPENROUTER_API_KEY) {
        console.error('❌ API Key no configurada en el servidor');
        return res.status(500).json({ error: 'API Key no configurada' });
    }
    
    if (!req.session.conversationHistory) {
        req.session.conversationHistory = [];
    }
    
    if (messages && messages.length > 0) {
        req.session.conversationHistory.push(messages[messages.length - 1]);
    }
    
    const MAX_HISTORY = 10;
    let history = req.session.conversationHistory.slice(-MAX_HISTORY);
    
    const systemPrompt = `Eres "OleOle", un asistente experto en protección de datos. Tu misión es educativa.
    Priorizas la ley chilena (19.628 vigente hasta 30/11/2026 y 21.719 desde 1/12/2026).
    Complementas con las Guías, Criterios y Resoluciones de la AEPD (España).
    Respondes en español, citas artículos chilenos cuando es posible.
    Al final de cada respuesta añades: "📌 Aviso: Este bot tiene fines exclusivamente educativos."`;
    
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
                'HTTP-Referer': 'https://oleole.onrender.com',
                'X-Title': 'OleOle'
            },
            body: JSON.stringify({
                model: 'openrouter/free',
                messages: messagesForAI,
                temperature: 0.6,
                max_tokens: 1300
            })
        });
        
        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || 'Error en OpenRouter');
        
        const assistantMessage = data.choices[0].message;
        req.session.conversationHistory.push(assistantMessage);
        
        res.json({ choices: [{ message: assistantMessage }] });
        
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/clear-history', (req, res) => {
    if (req.session) req.session.conversationHistory = [];
    res.json({ ok: true });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    console.log(`🔐 API Key: ${OPENROUTER_API_KEY ? '✅ Configurada' : '❌ Falta'}`);
});
