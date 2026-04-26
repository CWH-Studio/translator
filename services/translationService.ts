import type { TranslationResult } from '../types';

interface TTSResponse {
  success: boolean;
  audioData?: string | null;
  contentType?: string;
  source?: string;
  useClientTTS?: boolean;
  clientLang?: string;
  clientVoice?: string;
  error?: string;
}

export async function dictionaryLookup(text: string, apiKey: string): Promise<TranslationResult> {
  try {
    const response = await fetch('/api/dictionary-lookup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, apiKey }),
    });

    if (!response.ok) {
      const error = (await response.json()) as { error?: string };
      throw new Error(error.error || 'Dictionary lookup failed');
    }

    const data: TranslationResult = await response.json();
    return data;
  } catch (error) {
    console.error('Dictionary lookup error:', error);
    throw error;
  }
}

// Client-side TTS function with improved voice selection
async function playClientTTS(text: string, lang: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!window.speechSynthesis) {
      reject(new Error('Text-to-speech not supported in this browser'));
      return;
    }

    const getWebSpeechLangCode = (language: string): string => {
      switch (language.toLowerCase()) {
        case 'malay':
        case 'ms-my':
          return 'ms-MY';
        case 'chinese':
        case 'zh-cn':
          return 'zh-CN';
        case 'english':
        case 'en-us':
        default:
          return 'en-US';
      }
    };

    const selectBestVoice = (targetLang: string): SpeechSynthesisVoice | null => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) return null;
      
      const langPrefix = targetLang.split('-')[0];
      const matchingVoices = voices.filter(v => v.lang.startsWith(langPrefix));
      
      if (matchingVoices.length === 0) return null;
      
      const googleVoice = matchingVoices.find(v => 
        v.name.toLowerCase().includes('google') && !v.name.toLowerCase().includes('uk')
      );
      if (googleVoice) return googleVoice;
      
      const microsoftVoice = matchingVoices.find(v => 
        v.name.toLowerCase().includes('microsoft') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('david')
      );
      if (microsoftVoice) return microsoftVoice;
      
      const nativeVoice = matchingVoices.find(v => v.localService);
      if (nativeVoice) return nativeVoice;
      
      return matchingVoices[0];
    };

    const speak = () => {
      const utterance = new SpeechSynthesisUtterance(text);
      const targetLang = getWebSpeechLangCode(lang);
      utterance.lang = targetLang;
      
      const bestVoice = selectBestVoice(targetLang);
      if (bestVoice) {
        utterance.voice = bestVoice;
        console.log(`Using voice: ${bestVoice.name} for ${targetLang}`);
      }
      
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => resolve('');
      utterance.onerror = (event) => {
        reject(new Error(`Speech synthesis failed: ${event.error}`));
      };

      window.speechSynthesis.speak(utterance);
    };

    const voices = window.speechSynthesis.getVoices();
    if (voices.length === 0) {
      window.speechSynthesis.onvoiceschanged = () => {
        speak();
      };
    } else {
      speak();
    }
  });
}

export async function textToSpeech(text: string, language: string): Promise<string> {
  try {
    const response = await fetch('/api/text-to-speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text, language }),
    });

    if (response.ok) {
      const result: TTSResponse = await response.json();
      
      // Server says use client-side TTS
      if (result.useClientTTS) {
        console.log('Server requested client-side TTS:', result.clientLang);
        return await playClientTTS(text, result.clientLang || language);
      }

      // Play server-side generated audio
      if (result.success && result.audioData) {
        const audio = new Audio(`data:${result.contentType};base64,${result.audioData}`);
        
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error('Audio playback failed'));
          audio.play().catch(reject);
        });
        
        console.log(`TTS source: ${result.source || 'server-proxy'}`);
        return '';
      }
    }
  } catch (error) {
    console.log('Server-side TTS failed:', error);
  }
  
  console.log('Falling back to Web Speech API');
  return playClientTTS(text, language);
}
