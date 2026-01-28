import OpenAI from 'openai';

export const config = {
    runtime: 'nodejs',
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { messages, model, temperature, max_tokens, apiKey } = req.body;

    if (!apiKey) {
        return res.status(400).json({ error: 'API key is required' });
    }

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
    }

    const openai = new OpenAI({
        apiKey: apiKey,
    });

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    try {
        const stream = await openai.chat.completions.create({
            model: model || 'gpt-3.5-turbo',
            messages,
            temperature: temperature ?? 0.5,
            max_tokens: max_tokens ?? 1000,
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (error) {
        console.error('OpenAI API error:', error);

        // If headers haven't been sent yet, send error response
        if (!res.headersSent) {
            return res.status(500).json({ error: error.message || 'OpenAI API error' });
        }

        // If streaming has started, send error as event
        res.write(`data: ${JSON.stringify({ error: error.message || 'OpenAI API error' })}\n\n`);
        res.end();
    }
}
