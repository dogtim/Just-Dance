'use client';

import React, { useState } from 'react';
import DanceCanvas from '../components/DanceCanvas';
import ScoreBoard from '../components/ScoreBoard';

export default function Home() {
  const [url, setUrl] = useState('');
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('Ready');

  const handleStart = () => {
    // Simple ID extraction
    // Supports: https://www.youtube.com/watch?v=VIDEO_ID
    // and https://youtu.be/VIDEO_ID
    let id = '';
    try {
      if (url.includes('v=')) {
        id = url.split('v=')[1].split('&')[0];
      } else if (url.includes('youtu.be/')) {
        id = url.split('youtu.be/')[1].split('?')[0];
      }
    } catch (e) {
      console.error(e);
    }

    if (id) {
      setYoutubeId(id);
    } else {
      alert("Invalid YouTube URL");
    }
  };

  const handleScoreUpdate = (points: number, newFeedback: string) => {
    setScore(prev => prev + points);
    setFeedback(newFeedback);
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-purple-500 selection:text-white">
      {/* Navbar / Header */}
      <header className="p-6 flex justify-between items-center border-b border-gray-800 bg-gray-900/50 backdrop-blur-lg sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="text-4xl">🕺</span>
          <h1 className="text-3xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 hover:scale-105 transition-transform cursor-default">
            JUST DANCE AI
          </h1>
        </div>

        {youtubeId && (
          <div className="hidden md:block">
            <ScoreBoard score={score} feedback={feedback} />
          </div>
        )}
      </header>

      <main className="container mx-auto p-4 md:p-8 flex flex-col items-center gap-8">

        {/* Setup / Input Section */}
        {!youtubeId && (
          <div className="w-full max-w-2xl flex flex-col gap-6 items-center mt-20 animate-in fade-in slide-in-from-bottom-10 duration-700">
            <div className="text-center space-y-4">
              <h2 className="text-5xl font-bold leading-tight">
                Dance like no one is watching.<br />
                <span className="text-gray-500">But AI is.</span>
              </h2>
              <p className="text-xl text-gray-400">
                Paste a YouTube link and start your real-time scoring session.
              </p>
            </div>

            <div className="flex w-full gap-2 p-2 bg-gray-900 rounded-full border border-gray-700 shadow-2xl focus-within:border-purple-500 transition-colors">
              <input
                type="text"
                placeholder="Paste YouTube URL here (e.g. https://www.youtube.com/watch?v=...)"
                className="flex-1 bg-transparent px-6 py-4 outline-none text-lg placeholder:text-gray-600"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleStart()}
              />
              <button
                onClick={handleStart}
                className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full font-bold text-lg hover:opacity-90 transition-opacity whitespace-nowrap"
              >
                Let's Party
              </button>
            </div>

            <div className="flex gap-4 mt-8">
              {/* Quick Suggestions using chips */}
              <button onClick={() => setUrl('https://www.youtube.com/watch?v=gT5N_lGvjkc')} className="px-4 py-2 bg-gray-800 rounded-full hover:bg-gray-700 text-sm transition-colors border border-gray-700">
                🎵 Rasputin
              </button>
              <button onClick={() => setUrl('https://www.youtube.com/watch?v=zJ47wWpGjK8')} className="px-4 py-2 bg-gray-800 rounded-full hover:bg-gray-700 text-sm transition-colors border border-gray-700">
                🎵 Waka Waka
              </button>
            </div>
          </div>
        )}

        {/* Game Active Section */}
        {youtubeId && (
          <div className="w-full h-full flex flex-col gap-6 animate-in zoom-in-95 duration-500">
            <div className="flex justify-between items-center md:hidden">
              <ScoreBoard score={score} feedback={feedback} />
            </div>

            <DanceCanvas youtubeId={youtubeId} onScoreUpdate={handleScoreUpdate} />

            <button
              onClick={() => { setYoutubeId(null); setScore(0); }}
              className="self-center px-6 py-2 text-gray-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors"
            >
              Stop Session
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
