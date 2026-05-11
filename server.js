require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const fetch = require('node-fetch');

const app = express();

const PORT = process.env.PORT || 3001;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// ===============================
// MIDDLEWARES
// ===============================

app.use(cors());

app.use(express.json({
    limit: '2mb'
}));

app.use(express.static(__dirname));

// ===============================
// SESIONES
// ===============================

app.use(session({
    secret: process.env.SESSION_SECRET || 'oleole-secret-key-2026',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));

// ===============================
// RUTA PRINCIPAL
// ===============================

app.get('/', (req, res) => {

    res.sendFile(
        path.join(__dirname, 'index.html')
    );
});

// ===============================
// LIMPIAR HISTORIAL
// ===============================

app.post('/api/clear-history', (req, res) => {

    if (req.session) {

        req.session.conversationHistory = [];
    }

    res.json({
        ok: true
    });
});

// ===============================
// CHAT IA
// ===============================

app.post('/api/chat', async (req, res) => {

    try {

        const { messages } = req.body;

        // ===============================
        // VALIDAR API KEY
        // ===============================

        if (!OPENROUTER_API_KEY) {

            console.error(
                '❌ OPENROUTER_API_KEY no configurada'
            );

            return res.status(500).json({
                error: 'OPENROUTER_API_KEY no configurada'
            });
        }

        // ===============================
        // INICIALIZAR HISTORIAL
        // ===============================

        if (!req.session.conversationHistory) {

            req.session.conversationHistory = [];
        }

        // ===============================
        // GUARDAR ÚLTIMO MENSAJE USUARIO
        // ===============================

        if (
            messages &&
            messages.length > 0
        ) {

            req.session.conversationHistory.push(
                messages[messages.length - 1]
            );
        }

        // ===============================
        // LIMITAR HISTORIAL (ÚLTIMOS 10 MENSAJES)
        // ===============================

        const MAX_HISTORY = 10;

        const history =
            req.session.conversationHistory.slice(
                -MAX_HISTORY
            );

        // ===============================
        // SYSTEM PROMPT (PRIORIDAD LEY CHILENA)
        // ===============================

        const systemPrompt = `
Eres "OleOle", un asistente experto en protección de datos personales, con fines educativos.

**REGLAS OBLIGATORIAS PARA CADA RESPUESTA:**

**1. PRIORIDAD CHILENA (RESPUESTA PRINCIPAL):**
- Debes responder basándote en la legislación chilena.
- Fuente principal: Ley 19.628 (sobre protección de la vida privada) y su modificación, la Ley 21.719.
- Cita el artículo exacto cuando sea posible. Ejemplo: "En Chile, según el Artículo 12 de la Ley 19.628..."
- Menciona que la Ley 21.719 entrará en vigencia el 1 de diciembre de 2026.

**2. CONTEXTO ESPAÑOL (AEPD) - SOLO SI ES RELEVANTE:**
- Si es relevante, añade una sección llamada "**Contexto España**".
- Busca en las resoluciones de la AEPD (PS-00297-2025, PS-00615-2025, etc.) para casos similares.
- Si no encuentras una resolución específica, dilo claramente: "No se ha encontrado una resolución de la AEPD sobre este punto específico."

**3. PROHIBICIÓN ABSOLUTA DE INVENTAR:**
- NUNCA inventes artículos de leyes, números de resoluciones o informes que no existan.
- Si no encuentras una resolución específica, dilo claramente.
- Si no estás seguro de un artículo chileno, dilo: "Según el espíritu de la Ley 19.628, que protege... aunque no tengo el artículo exacto."

**4. AVISO LEGAL OBLIGATORIO (al final de cada respuesta):**
Siempre incluye este texto:
"⚖️ Aviso educativo: esta respuesta es informativa y no constituye asesoría legal formal. Verifique fuentes oficiales y consulte profesionales especializados cuando corresponda."

**5. MEMORIA Y COHERENCIA:**
- Si el usuario repregunta sobre el mismo tema, utiliza el historial de la conversación para complementar y profundizar.
- NUNCA te repitas. Si ya diste una respuesta, la siguiente debe ser complementaria.
- Si el usuario cambia de tema, ignora el historial anterior y empieza de nuevo.

**6. ESTRUCTURA DE RESPUESTA:**
1. Respuesta Chile (citando artículo si es posible)
2. Contexto España (si aplica)
3. Aviso legal obligatorio
`;

        // ===============================
        // MENSAJES IA
        // ===============================

        const messagesForAI = [

            {
                role: 'system',
                content: systemPrompt
            },

            ...history
        ];

        console.log(
            '📨 Enviando request a OpenRouter...'
        );

        // ===============================
        // REQUEST OPENROUTER (LLAMA 3 - 70B)
        // ===============================

        const response = await fetch(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                method: 'POST',

                headers: {
                    'Content-Type': 'application/json',

                    'Authorization':
                        `Bearer ${OPENROUTER_API_KEY}`,

                    'HTTP-Referer':
                        'https://oleole-gdhk.onrender.com',

                    'X-Title':
                        'OleOle'
                },

                body: JSON.stringify({

                    // ===============================
                    // MODELO LLAMA 3 - 70B (GRATUITO)
                    // ===============================

                    model:
                        'meta-llama/llama-3-70b-instruct:free',

                    messages: messagesForAI,

                    temperature: 0.4,

                    max_tokens: 1500
                })
            }
        );

        console.log(
            '📥 Status OpenRouter:',
            response.status
        );

        const data =
            await response.json();

        console.log(
            '📦 Respuesta OpenRouter:',
            JSON.stringify(data, null, 2)
        );

        // ===============================
        // VALIDAR RESPUESTA
        // ===============================

        if (!response.ok) {

            throw new Error(

                data.error?.message ||

                'Error desconocido OpenRouter'
            );
        }

        const assistantMessage =
            data.choices[0].message;

        // ===============================
        // GUARDAR RESPUESTA IA
        // ===============================

        req.session.conversationHistory.push(
            assistantMessage
        );

        // ===============================
        // RESPUESTA FRONTEND
        // ===============================

        res.json({

            choices: [

                {
                    message: assistantMessage
                }
            ]
        });

    } catch (error) {

        console.error(
            '❌ ERROR SERVIDOR:',
            error
        );

        res.status(500).json({

            error:
                error.message ||
                'Error interno servidor'
        });
    }
});

// ===============================
// INICIAR SERVIDOR
// ===============================

app.listen(PORT, '0.0.0.0', () => {

    console.log(
        `✅ Servidor corriendo en puerto ${PORT}`
    );

    console.log(
        `🤖 Modelo: Llama 3 (70B) - Meta`
    );

    console.log(
        `🧠 Memoria: Últimos 10 mensajes`
    );

    console.log(
        `🔐 OPENROUTER_API_KEY: ${
            OPENROUTER_API_KEY
                ? '✅ Configurada'
                : '❌ Faltante'
        }`
    );
});