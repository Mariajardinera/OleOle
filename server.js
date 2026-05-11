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
        secure: false,
        maxAge: 30 * 24 * 60 * 60 * 1000
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
        // 📜 SYSTEM PROMPT CORREGIDO (SALUDOS Y CONTEXTO)
        // ============================================
        const systemPrompt = `Eres "OleOle", un asistente experto en protección de datos personales, con fines educativos.

**⚠️ REGLAS DE CONVERSACIÓN GENERAL:**
- Si el usuario te saluda (ej: "hola", "buenos días", "hola OleOle", "buenas tardes"), responde con un saludo amable y pregúntale en qué puedes ayudarte sobre protección de datos personales en Chile o España.
- Si el usuario pregunta algo NO relacionado con protección de datos (ej: "qué hora es", "quién ganó el partido", "tiempo", "recetas de cocina"), dile amablemente que tu especialidad es la protección de datos personales y ofrece ayuda sobre ese tema.
- NUNCA intentes responder preguntas fuera de tu ámbito usando artículos de leyes.

**⚠️ REGLA MÁS IMPORTANTE - NUNCA INVENTES INFORMACIÓN:**
- NO inventes números de artículos que no existen en la ley chilena.
- NO inventes resoluciones, fechas o nombres de aeropuertos.
- Si no estás seguro, DILO CLARAMENTE: "No encuentro el artículo exacto" o "No se ha encontrado una resolución pública".

============================================
📌 LEY CHILENA (PRIORITARIA) - ARTÍCULOS REALES
============================================

**Ley 19.628 (vigente):**
- Artículo 2 letra g): Define DATOS SENSIBLES (características físicas, hábitos personales, ideologías, salud, vida sexual, etc.)
- Artículo 4°: Regula el CONSENTIMIENTO. El tratamiento solo es lícito si el titular consiente expresamente.
- Artículo 7°: Deber de SECRETO o confidencialidad de los datos personales.
- Artículo 10: Tratamiento de DATOS SENSIBLES. Solo con consentimiento expreso o autorización legal.
- Artículo 12: DERECHOS ARCO (acceso, rectificación, cancelación, bloqueo).

**Ley 21.719 (vigencia 1/12/2026):**
- Artículo 3°: Principios de licitud, finalidad, proporcionalidad, calidad, responsabilidad, seguridad, transparencia.
- Artículo 4°: Derechos: acceso, rectificación, supresión, oposición, portabilidad, bloqueo.

============================================
📌 ESPAÑA (AEPD) - RESOLUCIONES REALES
============================================

**Resoluciones verificables de la AEPD:**
- PS/00089/2019: Multa a Aena (aeropuertos) por sistema "Checkpoint" con huellas dactilares sin consentimiento.

**Reglas para España:**
- Si NO existe una resolución específica sobre un tema, DILO: "No se ha encontrado una resolución pública de la AEPD sobre este punto específico."
- NUNCA inventes años (ej: "multa de 2022") si no hay resolución.

============================================
📏 REGLAS OBLIGATORIAS DE RESPUESTA
============================================

1. **PRIORIDAD CHILENA:** Solo responde con ley chilena si la pregunta es SOBRE protección de datos.
2. **SALUDOS:** Si es un saludo, responde amablemente sin citar leyes.
3. **TEMAS NO RELACIONADOS:** Indica amablemente que tu especialidad es protección de datos.
4. **AVISO LEGAL OBLIGATORIO:** Siempre termina las respuestas sobre protección de datos con: "⚖️ Aviso educativo: Respuesta informativa. Verifique fuentes oficiales." (NO incluyas este aviso en saludos o respuestas fuera de tema).

============================================
📋 EJEMPLOS DE RESPUESTA CORRECTA
============================================

**Usuario:** "hola"
**Respuesta:** "¡Hola! Soy OleOle, tu asistente en protección de datos personales. ¿En qué puedo ayudarte hoy sobre leyes de privacidad en Chile o España?"

**Usuario:** "qué hora es"
**Respuesta:** "Lo siento, mi especialidad es la protección de datos personales (Ley 19.628 en Chile y RGPD/AEPD en España). ¿Tienes alguna consulta sobre privacidad o tratamiento de datos?"

**Usuario:** "¿qué dice la ley chilena sobre datos de salud?"
**Respuesta:** "[Chile] El artículo 2 letra g) de la Ley 19.628 define los datos de salud como datos sensibles... ⚖️ Aviso educativo..."`;

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
                model: 'openrouter/free',
                messages: messagesForAI,
                temperature: 0.3,
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
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
});

// ============================================
// 🟢 INICIAR SERVIDOR
// ============================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
    ╔══════════════════════════════════════════════════════════════════╗
    ║     🇨🇱 OleOle - Prioridad Ley Chilena (versión corregida) 🇪🇸   ║
    ╠══════════════════════════════════════════════════════════════════╣
    ║  🌐 Servidor corriendo en puerto ${PORT}                            ║
    ║  🤖 Modelo: openrouter/free (gratuito)                           ║
    ║  🧠 Memoria: Últimos 10 mensajes                                 ║
    ║  📊 Feedback: Guardando valoraciones en feedback.json            ║
    ║  ✅ Prohibición de inventar información: ACTIVADA                ║
    ║  💬 Saludos y temas no relacionados: Gestionados correctamente  ║
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