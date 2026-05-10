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

app.post('/api/chat', async (req, res) => {
    const { messages } = req.body;
    
    if (!OPENROUTER_API_KEY) {
        console.error('❌ API Key no configurada');
        return res.status(500).json({ error: 'API Key no configurada en el servidor' });
    }
    
    // Historial de conversación
    if (!req.session.conversationHistory) {
        req.session.conversationHistory = [];
    }
    
    if (messages && messages.length > 0) {
        req.session.conversationHistory.push(messages[messages.length - 1]);
    }
    
    const MAX_HISTORY = 10;
    let history = req.session.conversationHistory.slice(-MAX_HISTORY);
    
    // 🔥 PROMPT COMPLETO CON PRIORIDAD CHILENA
    const systemPrompt = `
Eres "OleOle", un asistente experto en protección de datos personales. Tu misión es educar priorizando la legislación chilena.

**REGLAS OBLIGATORIAS PARA CADA RESPUESTA:**

1. **PRIORIDAD CHILENA**: Antes de cualquier otra cosa, busca en la Ley 19.628 o en la Ley 21.719 chilena.
   - **Cita el artículo exacto** si es posible (ej. "Artículo 12 de la Ley 19.628...").
   - Si la ley chilena no regula un punto específico, dilo claramente.

2. **COMPLEMENTO EUROPEO (Referencia Didáctica)**: Solo después de dar la respuesta chilena, añade al final:
   "**Complemento desde la práctica europea:** En el RGPD / España, esto se regula de [manera similar/diferente] porque [explicación breve]."
   - No des el complemento si la ley chilena es idéntica.

3. **AVISO LEGAL OBLIGATORIO**: Al terminar CADA respuesta, incluye:
   "📌 *Aviso importante: Esta respuesta utiliza como fuente primordial la legislación chilena publicada en el Diario Oficial (Ley 19.628 y Ley 21.719). La referencia al RGPD y a la AEPD tiene un fin meramente didáctico y comparativo.*"

**CONOCIMIENTO NORMATIVO:**
- Chile: Ley 19.628 y Ley 21.719. Consejo para la Transparencia es la autoridad.
- Europa: RGPD 2016/679, LOPDGDD española y guías AEPD.

**ESTRUCTURA DE RESPUESTA:**
1. Respuesta citando ley chilena.
2. (Opcional) Breve comparativa europea.
3. Aviso legal obligatorio.
`;
    
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
                'X-Title': 'OleOle (Prioridad Chile)'
            },
            body: JSON.stringify({
                model: 'openrouter/free',
                messages: messagesForAI,
                temperature: 0.5,
                max_tokens: 1300
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

app.post('/api/clear-history', (req, res) => {
    if (req.session) req.session.conversationHistory = [];
    res.json({ ok: true });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`
    ╔═════════════════════════════════════════════════════════════════════╗
    ║     🇨🇱 ¡OléOle - Prioridad Ley Chilena! 🇨🇱                         ║
    ╠═════════════════════════════════════════════════════════════════════╣
    ║  🌐 http://localhost:${PORT}                                           ║
    ║  ⚖️  Fuente primaria: Leyes 19.628 y 21.719                         ║
    ║  📚 Fuente secundaria: RGPD y AEPD (comparativa)                    ║
    ║  🔐 API Key: ${OPENROUTER_API_KEY ? '✅ Configurada' : '❌ Falta'}                          ║
    ╚═════════════════════════════════════════════════════════════════════╝
    `);
});
