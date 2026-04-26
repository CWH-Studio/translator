
import React from 'react';
import type { Translation } from '../types';
import { SpeakerIcon } from './icons/SpeakerIcon';

interface ResultCardProps {
  translation: Translation;
  onPlayAudio: () => void;
  isPlaying: boolean;
}

export const ResultCard: React.FC<ResultCardProps> = ({ translation, onPlayAudio, isPlaying }) => {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02]">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{translation.language}</h3>
          <p className="text-3xl font-bold text-primary dark:text-secondary mt-1">{translation.word}</p>
          {translation.pinyin && (
            <p className="text-lg text-gray-500 dark:text-gray-400 mt-1">{translation.pinyin}</p>
          )}
        </div>
        <button
          onClick={onPlayAudio}
          className={`p-3 rounded-full transition-colors ${isPlaying ? 'bg-red-100 dark:bg-red-900 hover:bg-red-200 dark:hover:bg-red-800' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'}`}
          aria-label={isPlaying ? `Stop reading ${translation.word}` : `Listen to ${translation.word}`}
        >
          {isPlaying ? (
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" className="w-6 h-6 text-red-500 dark:text-red-400">
              <path d="M6 6h12v12H6z" />
            </svg>
          ) : (
            <SpeakerIcon className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          )}
        </button>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Explanation</h4>
        <p className="text-gray-600 dark:text-gray-300 mt-2">{translation.explanation}</p>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
         <h4 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Example</h4>
        <p className="text-gray-600 dark:text-gray-300 italic mt-2">"{translation.example}"</p>
      </div>
    </div>
  );
};
