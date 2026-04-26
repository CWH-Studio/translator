import React, { useState, useCallback, useEffect } from 'react';
import { dictionaryLookup, textToSpeech } from './services/translationService';
import type { TranslationResult } from './types';
import { SearchIcon } from './components/icons/SearchIcon';
import { LoadingSpinner } from './components/icons/LoadingSpinner';
import { ResultCard } from './components/ResultCard';

const API_KEY_STORAGE_KEY = 'openrouter_api_key';

const App: React.FC = () => {
  const [query, setQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [translationResult, setTranslationResult] = useState<TranslationResult | null>(null);
  const [playingAudio, setPlayingAudio] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  const [showApiKeyModal, setShowApiKeyModal] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');

  useEffect(() => {
    const storedKey = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (storedKey) {
      setApiKey(storedKey);
    } else {
      setShowApiKeyModal(true);
    }
  }, []);

  const handleSaveApiKey = useCallback(() => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;
    localStorage.setItem(API_KEY_STORAGE_KEY, trimmed);
    setApiKey(trimmed);
    setShowApiKeyModal(false);
    setError(null);
  }, [apiKeyInput]);

  const handleSearch = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!apiKey) {
      setShowApiKeyModal(true);
      return;
    }
    if (!query.trim()) {
      setError('Please enter a word to translate.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setTranslationResult(null);

    try {
      const result = await dictionaryLookup(query, apiKey);
      setTranslationResult(result);
    } catch (err) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'Failed to get translation.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [query, apiKey]);

  const handlePlayAudio = useCallback(async (word: string, explanation: string, example: string, language: string) => {
    if (playingAudio === `${word}-${language}`) return;

    setPlayingAudio(`${word}-${language}`);
    try {
      await textToSpeech(word, language);
      setPlayingAudio(null);
    } catch (err) {
      console.error('Failed to play audio:', err);
      setPlayingAudio(null);
    }
  }, [playingAudio]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-sans transition-colors duration-300">
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-2">OpenRouter API Key</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Enter your OpenRouter API key to use the translator. Get a free key at{' '}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-primary underline">openrouter.ai/keys</a>.
            </p>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveApiKey()}
              placeholder="sk-or-v1-..."
              className="w-full px-4 py-3 text-base bg-gray-100 dark:bg-gray-700 border-2 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-secondary mb-4"
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              {apiKey && (
                <button
                  onClick={() => setShowApiKeyModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKeyInput.trim()}
                className="px-5 py-2 bg-primary hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      <main className="container mx-auto px-4 py-8 md:py-16">
        <header className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
            Translator
          </h1>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Instant, accurate translations between English, Malay, and Chinese.
          </p>
          <button
            onClick={() => { setApiKeyInput(apiKey); setShowApiKeyModal(true); }}
            className="mt-2 text-xs text-gray-400 dark:text-gray-500 hover:text-primary dark:hover:text-secondary underline transition-colors"
          >
            Configure API Key
          </button>
        </header>

        <div className="max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 transition-shadow duration-300">
          <form onSubmit={handleSearch} className="flex items-center gap-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Enter a word..."
              className="w-full px-5 py-3 text-lg bg-gray-100 dark:bg-gray-700 border-2 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-secondary transition-all"
              disabled={loading}
            />
            <button
              type="submit"
              className="px-5 py-3 bg-primary hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md transition-transform transform hover:scale-105 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:scale-100 flex items-center justify-center"
              disabled={loading}
            >
              {loading ? (
                <LoadingSpinner />
              ) : (
                <SearchIcon />
              )}
            </button>
          </form>
        </div>

        <div className="max-w-2xl mx-auto mt-8">
          {error && (
            <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-md" role="alert">
              <p className="font-bold">Error</p>
              <p>{error}</p>
            </div>
          )}

          {translationResult && (
            <div className="space-y-6 animate-fade-in">
              {translationResult.translations.map((trans, index) => (
                <ResultCard 
                    key={index} 
                    translation={trans}
                    onPlayAudio={() => handlePlayAudio(trans.word, trans.explanation, trans.example, trans.language)}
                    isPlaying={playingAudio === `${trans.word}-${trans.language}`}
                />
              ))}
            </div>
          )}
        </div>
      </main>
       <footer className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">
            <p>Powered by OpenRouter. Built with React & Tailwind CSS. WHStudio@2025. Version 3.0</p>
        </footer>
    </div>
  );
};

export default App;
