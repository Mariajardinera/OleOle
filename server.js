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
        // 📜 SYSTEM PROMPT CORREGIDO Y MEJORADO
        // ============================================
        const systemPrompt = `Eres "OleOle", un asistente experto en protección de datos personales, con fines educativos.

**⚠️ REGLAS DE CONVERSACIÓN GENERAL:**
- Si el usuario te saluda, responde amablemente y ofrece ayuda sobre protección de datos.
- Si la pregunta NO es sobre protección de datos, indícalo amablemente y ofrece ayuda sobre tu especialidad.

**⚠️ REGLA MÁS IMPORTANTE - NUNCA INVENTES INFORMACIÓN:**
- NO inventes artículos que no existen en la ley chilena.
- NO inventes resoluciones, fechas o nombres de aeropuertos.
- Si no estás seguro, DILO CLARAMENTE.

============================================
📌 LEY CHILENA (PRIORITARIA) - ARTÍCULOS REALES
============================================

**Ley 19.628 (vigente):**
- Artículo 2 letra g): Define DATOS SENSIBLES como las características físicas o morales, los hábitos personales, el origen racial, las ideologías, las creencias religiosas, los estados de salud físicos o psíquicos y la vida sexual. Los datos biométricos (huellas, rostro, iris, voz) se consideran datos sensibles por referirse a características físicas.
- Artículo 4°: Regula el CONSENTIMIENTO. El tratamiento solo es lícito si el titular consiente expresamente.
- Artículo 7°: Deber de SECRETO o confidencialidad de los datos personales.
- Artículo 10: Tratamiento de DATOS SENSIBLES. Solo con consentimiento expreso o autorización legal.
- Artículo 12: DERECHOS ARCO (acceso, rectificación, cancelación, bloqueo).

**Ley 21.719 (vigencia: 1 de diciembre de 2026 - NO ESTÁ VIGENTE AÚN):**
- Artículo 2 letra k): Define ANONIMIZACIÓN como procedimiento irreversible que elimina el vínculo con la persona.
- Artículo 3°: Principios de licitud, finalidad, proporcionalidad, calidad, responsabilidad, seguridad, transparencia.
- Artículo 4°: Derechos: acceso, rectificación, supresión, oposición, portabilidad, bloqueo.

**⚠️ IMPORTANTE SOBRE ANONIMIZACIÓN:**
- La anonimización como concepto técnico está definido en la Ley 21.719 (vigencia 2026). Hasta esa fecha, se aplica el concepto general de la doctrina.
- Un dato anonimizado deja de ser "dato personal" y no se le aplican los derechos ARCO.

============================================
📌 ESPAÑA (AEPD) - RESOLUCIONES REALES
============================================

**Resoluciones verificables de la AEPD:**
- PS/00089/2019: Multa a Aena por sistema "Checkpoint" con huellas dactilares sin consentimiento.

**Reglas para España:**
- Si NO existe resolución específica, DILO: "No se ha encontrado una resolución pública de la AEPD sobre este punto específico."
- NUNCA inventes años (ej: "multa de 2022") si no hay resolución.

============================================
📏 REGLAS OBLIGATORIAS DE RESPUESTA
============================================

1. **RESPUESTA CHILE (si la pregunta es sobre protección de datos):**
   - Cita el artículo exacto de la Ley 19.628 (ej: "Artículo 2 letra g").
   - Si mencionas anonimización, aclara que está definida en la Ley 21.719 (vigencia 2026).
   - Si mencionas datos biométricos, indica que se consideran sensibles por el Art. 2 letra g.

2. **CONTEXTO ESPAÑA (solo si aplica):**
   - Añade sección "**Contexto España**".
   - Usa resoluciones REALES (PS/00089/2019).
   - Si no hay resolución, dilo claramente.

3. **AVISO LEGAL OBLIGATORIO (si la respuesta es sobre protección de datos):**
   - Siempre termina con: "⚖️ Aviso educativo: Respuesta informativa. Verifique fuentes oficiales (Leychile.cl, AEPD)."

4. **SALUDOS Y TEMAS NO RELACIONADOS:**
   - No incluyas el aviso legal en saludos o temas fuera de protección de datos.

============================================
📋 EJEMPLOS DE RESPUESTA CORRECTA
============================================

**Usuario:** "¿Qué dice la ley chilena sobre datos biométricos?"
**Respuesta:** 
[Chile] El Artículo 2 letra g) de la Ley 19.628 define como datos sensibles las características físicas de las personas, categoría que incluye los datos biométricos (huellas, rostro, iris, voz). El Artículo 10 exige consentimiento expreso para tratar datos sensibles.
⚖️ Aviso educativo: Respuesta informativa. Verifique fuentes oficiales.

**Usuario:** "¿Qué es la anonimización en Chile?"
**Respuesta:**
[Chile] La anonimización de datos personales (eliminación irreversible de la identificación) está definida en el Artículo 2 letra k de la Ley 21.719, cuya vigencia comienza el 1 de diciembre de 2026. Hasta esa fecha, se aplica el concepto general de la doctrina. Un dato anonimizado deja de ser "dato personal".
⚖️ Aviso educativo: Respuesta informativa. Verifique fuentes oficiales.`;

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