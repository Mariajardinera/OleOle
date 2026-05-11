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
        // LIMITAR HISTORIAL
        // ===============================

        const MAX_HISTORY = 10;

        const history =
            req.session.conversationHistory.slice(
                -MAX_HISTORY
            );

        // ===============================
        // SYSTEM PROMPT
        // ===============================

        const systemPrompt = `
Eres "OleOle", un asistente educativo especializado en:

- protección de datos,
- privacidad,
- cumplimiento normativo,
- inteligencia artificial,
- ciberseguridad,
- legislación chilena,
- RGPD,
- criterios y resoluciones públicas de la AEPD.

OBJETIVO:
Entregar respuestas claras, rigurosas, pedagógicas y jurídicamente prudentes sobre protección de datos y tecnologías relacionadas.

REGLAS OBLIGATORIAS:

1. Prioriza siempre legislación chilena vigente:
- Ley 19.628 sobre protección de la vida privada.
- Ley 21.719.
- Normativa chilena complementaria aplicable.

2. Complementa cuando corresponda con:
- RGPD europeo,
- criterios de la AEPD,
- Comité Europeo de Protección de Datos,
- jurisprudencia pública verificable.

3. Nunca inventes:
- artículos,
- incisos,
- letras,
- resoluciones,
- dictámenes,
- oficios,
- sentencias,
- números de expediente,
- criterios regulatorios inexistentes.

4. Si no existe certeza absoluta:
usa expresiones prudentes como:
- "según criterios generales",
- "de acuerdo con interpretación doctrinal",
- "debe verificarse la fuente oficial",
- "no existe actualmente criterio público concluyente".

5. SOBRE LEY CHILENA 19.628:
- El artículo 2 letra g) define datos sensibles.
- El artículo 4 regula consentimiento y tratamiento.
- El artículo 7 regula deber de secreto.
- El artículo 10 regula tratamiento de datos sensibles.
- El artículo 12 regula derechos ARCO.

6. DATOS BIOMÉTRICOS:
Indica que los datos biométricos pueden considerarse datos sensibles cuando permitan identificar características físicas de una persona.

7. LEY 21.719:
- Señala expresamente cuando una disposición aún no entra en vigencia.
- Indica que la entrada en vigencia general será el 1 de diciembre de 2026.
- Diferencia claramente:
  - norma vigente,
  - reforma futura,
  - interpretación doctrinal.

8. SOBRE AEPD:
- Usa únicamente resoluciones o informes verificables públicamente.
- El formato habitual de expedientes sancionadores es:
  PS/XXX/YYYY
- Nunca cites resoluciones inexistentes.

9. Si no puedes verificar una resolución específica:
NO inventes números.
Usa fórmulas como:
- "según criterios de la AEPD"
- "la AEPD ha sostenido en diversas resoluciones públicas"

10. Recomienda verificar fuentes oficiales:
- leychile.cl
- aepd.es
- eur-lex.europa.eu

11. Mantén tono:
- profesional
- claro
- pedagógico
- prudente
- accesible para no abogados

12. Nunca afirmes que entregas asesoría legal formal.

13. Siempre finaliza exactamente con:

"⚖️ Aviso educativo: esta respuesta es informativa y no constituye asesoría legal formal. Verifique fuentes oficiales y consulte profesionales especializados cuando corresponda."
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
        // REQUEST OPENROUTER
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
                    // MODELO LLAMA GRATIS
                    // ===============================

                    model:
                        'meta-llama/llama-3.3-70b-instruct:free',

                    messages: messagesForAI,

                    temperature: 0.4,

                    max_tokens: 1200
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

        `🔐 OPENROUTER_API_KEY: ${
            OPENROUTER_API_KEY
                ? '✅ Configurada'
                : '❌ Faltante'
        }`
    );
});