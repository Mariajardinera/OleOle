const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.json({
        message: 'Test funcionando',
        hasApiKey: !!process.env.OPENROUTER_API_KEY,
        nodeEnv: process.env.NODE_ENV,
        port: PORT
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Test corriendo en puerto ${PORT}`);
    console.log(`🔑 API Key presente: ${!!process.env.OPENROUTER_API_KEY}`);
});