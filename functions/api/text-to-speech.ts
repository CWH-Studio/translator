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

export async function onRequestPost(context: { request: Request; env: Env }): Promise<Response> {
  const { request } = context;
  
  // Common headers for all responses (CORS is critical for mobile)
  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    const { text, language }: TTSRequest = await request.json();
    
    if (!text || !language) {
      return new Response(
        JSON.stringify({ success: false, error: 'Text and language are required' } as TTSErrorResponse),
        { 
          status: 400,
          headers: corsHeaders
        }
      );
    }

    // Map languages to Google Translate language codes
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

    // Use Google Translate TTS for ALL languages
    // This provides consistency, reliability, and free access without API keys
    try {
      const encodedText = encodeURIComponent(text);
      const googleTTSUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${targetLang}&q=${encodedText}`;
      
      const ttsResponse = await fetch(googleTTSUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (ttsResponse.ok) {
        const audioArrayBuffer = await ttsResponse.arrayBuffer();
        const audioBuffer = new Uint8Array(audioArrayBuffer);
        
        // Convert to base64 in chunks to avoid max call stack size exceeded
        let binary = '';
        const chunkSize = 8192;
        for (let i = 0; i < audioBuffer.length; i += chunkSize) {
          const chunk = audioBuffer.subarray(i, i + chunkSize);
          binary += String.fromCharCode(...chunk);
        }
        const base64Audio = btoa(binary);
        
        return new Response(
          JSON.stringify({
            success: true,
            audioData: base64Audio,
            contentType: 'audio/mpeg',
            source: `google-translate-${targetLang}`
          } as TTSSuccessResponse),
          { 
            headers: corsHeaders
          }
        );
      } else {
        throw new Error(`Google TTS failed with status: ${ttsResponse.status}`);
      }
    } catch (ttsError) {
      console.error(`Google TTS failed for ${targetLang}:`, ttsError);
      // Fall through to client-side fallback
    }

    // Fallback to client-side TTS if server-side method fails
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
      {
        status: 200,
        headers: corsHeaders
      }
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
      {
        status: 500,
        headers: corsHeaders
      }
    );
  }
}