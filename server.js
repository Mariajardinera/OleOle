require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const fetch = require('node-fetch');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.static(__dirname));

// ✅ CORREGIDO: secure: false para que funcione en Render sin HTTPS
app.use(session({
    secret: process.env.SESSION_SECRET || 'oleole-secret-key-2026',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/api/clear-history', (req, res) => {
    if (req.session) {
        req.session.conversationHistory = [];
    }
    res.json({ ok: true });
});

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
    
    if (feedbacks.length > 1000) {
        feedbacks = feedbacks.slice(-1000);
    }
    
    fs.writeFileSync(feedbackFile, JSON.stringify(feedbacks, null, 2));
    
    console.log(`📊 Feedback recibido: ${type} - ${new Date().toISOString()}`);
    res.json({ ok: true });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        if (!OPENROUTER_API_KEY) {
            console.error('❌ OPENROUTER_API_KEY no configurada');
            return res.status(500).json({ 
                error: 'OPENROUTER_API_KEY no configurada en el servidor' 
            });
        }

        if (!req.session.conversationHistory) {
            req.session.conversationHistory = [];
        }

        if (messages && messages.length > 0) {
            req.session.conversationHistory.push(messages[messages.length - 1]);
        }

        const MAX_HISTORY = 10;
        const history = req.session.conversationHistory.slice(-MAX_HISTORY);

        const systemPrompt = `Eres "OleOle", un asistente experto en protección de datos personales, con fines educativos.

**⚠️ REGLA MÁS IMPORTANTE - NUNCA INVENTES INFORMACIÓN:**
- NO inventes números de artículos que no existen en la ley chilena.
- NO inventes resoluciones, fechas o nombres de aeropuertos.
- Si no estás seguro, DILO CLARAMENTE.

============================================
📌 LEY CHILENA (PRIORITARIA) - ARTÍCULOS REALES
============================================

**Ley 19.628 (vigente):**
- Artículo 2 letra g): Define DATOS SENSIBLES
- Artículo 4°: Regula el CONSENTIMIENTO
- Artículo 7°: Deber de SECRETO
- Artículo 10: Tratamiento de DATOS SENSIBLES
- Artículo 12: DERECHOS ARCO

**Ley 21.719 (vigencia 1/12/2026):**
- Artículo 3°: Principios
- Artículo 4°: Derechos ARCO + portabilidad

============================================
📌 ESPAÑA (AEPD) - RESOLUCIONES REALES
============================================

**Resoluciones verificables:**
- PS/00089/2019: Multa a Aena por datos biométricos sin consentimiento.

**Reglas:**
- Si NO existe resolución, DILO: "No se ha encontrado una resolución pública de la AEPD"

============================================
📏 REGLAS OBLIGATORIAS DE RESPUESTA
============================================

1. PRIORIDAD CHILENA: Responde con ley chilena PRIMERO.
2. CITA ARTÍCULOS REALES: Usa SOLO los artículos listados.
3. AVISO LEGAL OBLIGATORIO: Termina con "⚖️ Aviso educativo: Respuesta informativa. Verifique fuentes oficiales."

============================================
📋 ESTRUCTURA OBLIGATORIA DE RESPUESTA
============================================

[Chile] Texto citando artículo REAL

[España] (solo si aplica)

⚖️ Aviso educativo`;

        const messagesForAI = [
            { role: 'system', content: systemPrompt },
            ...history
        ];

        console.log('📨 Enviando request a OpenRouter...');

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
                temperature: 0.3,
                max_tokens: 1500
            })
        });

        console.log('📥 Status OpenRouter:', response.status);

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Error en OpenRouter');
        }

        const assistantMessage = data.choices[0].message;
        req.session.conversationHistory.push(assistantMessage);

        res.json({ choices: [{ message: assistantMessage }] });

    } catch (error) {
        console.error('❌ ERROR EN /api/chat:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor corriendo en puerto ${PORT}`);
    console.log(`🔐 API Key: ${OPENROUTER_API_KEY ? '✅ OK' : '❌ FALTA'}`);
});