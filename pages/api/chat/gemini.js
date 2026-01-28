import { GoogleGenAI } from '@google/genai';

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

    const ai = new GoogleGenAI({ apiKey });

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Build generation config with thinking settings
    const modelName = model || 'gemini-2.5-flash';
    const isGemini3 = modelName.includes('gemini-3');
    const isGemini25 = modelName.includes('gemini-2.5');

    // Build config object
    const configObj = {
        temperature: temperature ?? 0.5,
        maxOutputTokens: maxOutputTokens ?? 1000
    };

    // Add system instruction if provided
    if (systemPrompt) {
        configObj.systemInstruction = systemPrompt;
    }

    // Configure thinking based on model version and thinkingLevel
    if (thinkingLevel && thinkingLevel !== 'auto') {
        if (isGemini3) {
            // Gemini 3 uses thinkingLevel: minimal, low, medium, high
            if (thinkingLevel === 'off') {
                // Gemini 3 doesn't support turning off thinking, use minimal
                configObj.thinkingConfig = { thinkingLevel: 'minimal' };
            } else {
                configObj.thinkingConfig = { thinkingLevel: thinkingLevel };
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
                configObj.thinkingConfig = { thinkingBudget: budget };
            }
        }
    }
    // 'auto' means dynamic thinking (default behavior), no explicit config needed

    try {
        // Convert conversation history to Gemini format
        const history = (messages || []).map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }));

        // Create chat session with new API
        const chat = ai.chats.create({
            model: modelName,
            config: configObj,
            history: history
        });

        // Send message with streaming
        const stream = await chat.sendMessageStream({
            message: userMessage
        });

        for await (const chunk of stream) {
            if (chunk && chunk.text) {
                const content = chunk.text;
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
