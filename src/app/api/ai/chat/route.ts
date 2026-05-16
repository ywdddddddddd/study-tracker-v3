// POST /api/ai/chat — proxy to DeepSeek (primary) with SiliconFlow fallback
// API keys live ONLY on the server. Never exposed to the client.

// Default keys — set your own via DEEPSEEK_API_KEY / SILICONFLOW_API_KEY env vars
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = 'deepseek-v4-pro';

const SILICONFLOW_KEY = process.env.SILICONFLOW_API_KEY || '';
const SILICONFLOW_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const SILICONFLOW_MODEL = 'deepseek-ai/DeepSeek-R1';

const FALLBACK_STATUSES = new Set([408, 429, 402]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, model: requestedModel, stream } = body;

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'messages array required' }, { status: 400 });
    }

    const doFetch = async (url: string, key: string, model: string) => {
      if (!key) throw new Error('API key not configured');
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: requestedModel || model,
          messages,
          stream: stream !== false,
          max_tokens: 4096,
          ...(model === DEEPSEEK_MODEL ? { thinking: { type: 'enabled' }, reasoning_effort: 'max' } : {}),
        }),
      });
    };

    // Try primary first
    let res = await doFetch(DEEPSEEK_URL, DEEPSEEK_KEY, DEEPSEEK_MODEL);

    // Fallback on 408/429/402
    if (!res.ok && FALLBACK_STATUSES.has(res.status)) {
      console.warn(`Primary returned ${res.status}, trying fallback...`);
      res = await doFetch(SILICONFLOW_URL, SILICONFLOW_KEY, SILICONFLOW_MODEL);
    }

    if (!res.ok) {
      const text = await res.text();
      return Response.json({ error: `Upstream error ${res.status}: ${text}` }, { status: 502 });
    }

    // Stream response back to client
    if (stream !== false && res.body) {
      return new Response(res.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming
    const data = await res.json();
    return Response.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return Response.json({ error: msg }, { status: 500 });
  }
}
