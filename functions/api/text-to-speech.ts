// Server-side TTS using Google Translate (Unofficial)
// Provides consistent, natural-sounding voices for all languages with mobile support

interface Env {}

interface TTSRequest {
  text: string;
  language: string;
}

interface TTSSuccessResponse {
  success: true;
  audioData: string;
  contentType: string;
  source: string;
}

interface TTSErrorResponse {
  success: false;
  error: string;
  useClientTTS?: boolean;
  clientLang?: string;
}

// Split text into chunks at sentence boundaries, respecting max length
function splitTextIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  // Split on sentence-ending punctuation
  const sentences = text.split(/(?<=[.!?。！？])\s*/);
  let current = '';

  for (const sentence of sentences) {
    if (!sentence.trim()) continue;
    if (current.length + sentence.length + 1 <= maxLen) {
      current += (current ? ' ' : '') + sentence;
    } else {
      if (current) chunks.push(current);
      // If a single sentence exceeds maxLen, split by words
      if (sentence.length > maxLen) {
        const words = sentence.split(/\s+/);
        current = '';
        for (const word of words) {
          if (current.length + word.length + 1 <= maxLen) {
            current += (current ? ' ' : '') + word;
          } else {
            if (current) chunks.push(current);
            current = word;
          }
        }
      } else {
        current = sentence;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request } = context;
  
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    const { text, language }: TTSRequest = await request.json();
    
    if (!text || !language) {
      return new Response(
        JSON.stringify({ success: false, error: 'Text and language are required' } as TTSErrorResponse),
        { status: 400, headers: corsHeaders }
      );
    }

    let targetLang = 'en';
    switch (language.toLowerCase()) {
      case 'malay':
      case 'ms':
        targetLang = 'ms';
        break;
      case 'chinese':
      case 'zh':
      case 'zh-cn':
        targetLang = 'zh-CN';
        break;
      case 'english':
      case 'en':
      case 'en-us':
      default:
        targetLang = 'en';
        break;
    }

    try {
      const chunks = splitTextIntoChunks(text, 180);
      const audioChunks: Uint8Array[] = [];

      for (const chunk of chunks) {
        const encodedText = encodeURIComponent(chunk);
        const googleTTSUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${targetLang}&q=${encodedText}`;
        
        const ttsResponse = await fetch(googleTTSUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        if (!ttsResponse.ok) {
          throw new Error(`Google TTS failed with status: ${ttsResponse.status}`);
        }

        const audioArrayBuffer = await ttsResponse.arrayBuffer();
        audioChunks.push(new Uint8Array(audioArrayBuffer));
      }

      // Concatenate all audio chunks
      const totalLength = audioChunks.reduce((sum, c) => sum + c.length, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const c of audioChunks) {
        combined.set(c, offset);
        offset += c.length;
      }

      // Convert to base64 in chunks to avoid max call stack size
      let binary = '';
      const batchSize = 8192;
      for (let i = 0; i < combined.length; i += batchSize) {
        const slice = combined.subarray(i, i + batchSize);
        binary += String.fromCharCode(...slice);
      }
      const base64Audio = btoa(binary);

      return new Response(
        JSON.stringify({
          success: true,
          audioData: base64Audio,
          contentType: 'audio/mpeg',
          source: `google-translate-${targetLang}`
        } as TTSSuccessResponse),
        { headers: corsHeaders }
      );
    } catch (ttsError) {
      console.error(`Google TTS failed for ${targetLang}:`, ttsError);
    }

    // Fallback to client-side TTS
    const langMap: { [key: string]: string } = {
      'english': 'en-US',
      'malay': 'ms-MY',
      'chinese': 'zh-CN'
    };

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Server-side TTS unavailable',
        useClientTTS: true,
        clientLang: langMap[language.toLowerCase()] || 'en-US'
      } as TTSErrorResponse),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('TTS API error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Internal server error',
        useClientTTS: true,
        clientLang: 'en-US'
      } as TTSErrorResponse),
      { status: 500, headers: corsHeaders }
    );
  }
}