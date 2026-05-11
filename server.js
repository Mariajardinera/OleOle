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

// Endpoint para limpiar el historial de conversación
app.post('/api/clear-history', (req, res) => {
    if (req.session) req.session.conversationHistory = [];
    res.json({ ok: true });
});

// ENDPOINT PRINCIPAL DEL CHAT (CON MEMORIA)
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
    
    // ============================================
    // NUEVO PROMPT CON PRIORIDAD CHILENA Y FUENTES VERIFICABLES
    // ============================================
    const systemPrompt = `Eres "OleOle", un asistente experto en protección de datos personales. Tu misión es educar priorizando la legislación chilena.

**REGLAS OBLIGATORIAS PARA CADA RESPUESTA:**

1. **PRIORIDAD CHILENA (RESPUESTA PRINCIPAL):**
   - Debes responder basándote en la legislación chilena.
   - Fuente principal: Ley 19.628 (sobre protección de la vida privada) y su modificación, la Ley 21.719.
   - Cita el artículo exacto cuando sea posible. Ejemplo: "En Chile, según el Artículo 12 de la Ley 19.628..."
   - Menciona que la Ley 21.719 entrará en vigencia el 1 de diciembre de 2026.

2. **CONTEXTO ESPAÑOL (AEPD) - SOLO SI ES RELEVANTE:**
   - Si es relevante, añade una sección llamada "Contexto España".
   - Busca en las resoluciones de la AEPD (PS-00297-2025, PS-00615-2025, etc.) para casos similares.
   - Si no encuentras una resolución específica, dilo claramente: "No se ha encontrado una resolución de la AEPD sobre este punto específico."

3. **PROHIBICIÓN ABSOLUTA DE INVENTAR:**
   - NUNCA inventes artículos de leyes, números de resoluciones o informes que no existan.
   - Si no encuentras una resolución específica, dilo claramente.
   - Si no estás seguro de un artículo chileno, dilo: "Según el espíritu de la Ley 19.628, que protege... aunque no tengo el artículo exacto."

4. **AVISO LEGAL OBLIGATORIO (al final de cada respuesta):**
   - Siempre incluye este texto:
   "📌 Aviso: Este es un asistente educativo. Si bien las respuestas se basan en fuentes oficiales, la IA puede cometer errores. Antes de tomar decisiones, verifica la información en los sitios oficiales."

5. **FORMATO DE RESPUESTA:**
   - Respuesta Chile (citando artículo si es posible)
   - Contexto España (si aplica)
   - Aviso legal obligatorio`;
    
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
                temperature: 0.5,
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

app.listen(PORT, () => {
    console.log(`✅ Servidor corriendo en http://localhost:${PORT}`);
    console.log(`🔐 API Key: ${OPENROUTER_API_KEY ? '✅ Configurada' : '❌ Falta'}`);
});
