import { GoogleGenerativeAI } from '@google/generative-ai';

export const config = {
    runtime: 'nodejs',
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        messages,
        systemPrompt,
        model,
        temperature,
        maxOutputTokens,
        apiKey,
        userMessage,
        thinkingLevel
    } = req.body;

    if (!apiKey) {
        return res.status(400).json({ error: 'API key is required' });
    }

    if (!userMessage) {
        return res.status(400).json({ error: 'User message is required' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Build generation config with thinking settings
    const generationConfig = {
        temperature: temperature ?? 0.5,
        maxOutputTokens: maxOutputTokens ?? 1000
    };

    // Configure thinking based on model version and thinkingLevel
    const modelName = model || 'gemini-2.5-flash';
    const isGemini3 = modelName.includes('gemini-3');
    const isGemini25 = modelName.includes('gemini-2.5');

    if (thinkingLevel && thinkingLevel !== 'auto') {
        if (isGemini3) {
            // Gemini 3 uses thinkingLevel: minimal, low, medium, high
            if (thinkingLevel === 'off') {
                // Gemini 3 doesn't support turning off thinking, use minimal
                generationConfig.thinkingConfig = { thinkingLevel: 'minimal' };
            } else {
                generationConfig.thinkingConfig = { thinkingLevel: thinkingLevel };
            }
        } else if (isGemini25) {
            // Gemini 2.5 uses thinkingBudget
            const budgetMap = {
                'off': 0,
                'minimal': 128,
                'low': 1024,
                'medium': 8192,
                'high': 24576
            };
            const budget = budgetMap[thinkingLevel];
            if (budget !== undefined) {
                generationConfig.thinkingConfig = { thinkingBudget: budget };
            }
        }
    }
    // 'auto' means dynamic thinking (default behavior), no explicit config needed

    try {
        const generativeModel = genAI.getGenerativeModel({
            model: modelName,
            generationConfig,
            systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined
        });

        // Convert conversation history to Gemini format
        const history = (messages || []).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        const chat = generativeModel.startChat({ history });
        const result = await chat.sendMessageStream(userMessage);

        for await (const chunk of result.stream) {
            if (chunk && typeof chunk.text === 'function') {
                const content = chunk.text();
                if (content) {
                    res.write(`data: ${JSON.stringify({ content })}\n\n`);
                }
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error('Gemini API error:', error);

        // If headers haven't been sent yet, send error response
        if (!res.headersSent) {
            return res.status(500).json({ error: error.message || 'Gemini API error' });
        }

        // If streaming has started, send error as event
        res.write(`data: ${JSON.stringify({ error: error.message || 'Gemini API error' })}\n\n`);
        res.end();
    }
}
