'use client';

import React, { useState } from 'react';
import DanceCanvas from '../components/DanceCanvas';
import ScoreBoard from '../components/ScoreBoard';

export default function Home() {
  const [url, setUrl] = useState('');
  const [youtubeId, setYoutubeId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState('Ready');

  const parseVideoId = (inputUrl: string) => {
    let id = '';
    try {
      if (inputUrl.includes('v=')) {
        id = inputUrl.split('v=')[1].split('&')[0];
      } else if (inputUrl.includes('youtu.be/')) {
        id = inputUrl.split('youtu.be/')[1].split('?')[0];
      } else if (inputUrl.includes('shorts/')) {
        id = inputUrl.split('shorts/')[1].split('?')[0];
      }
    } catch (e) {
      console.error(e);
    }
    return id;
  };

  const handleStart = () => {
    const id = parseVideoId(url);
    if (id) {
      setYoutubeId(id);
    } else {
      alert("Invalid YouTube URL");
    }
  };

  const handlePreset = (presetUrl: string) => {
    setUrl(presetUrl);
    const id = parseVideoId(presetUrl);
    if (id) setYoutubeId(id);
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

            <div className="w-full max-w-lg mt-12">
              <h3 className="text-gray-400 font-semibold mb-4 text-sm uppercase tracking-wider text-center">Sample Playlist</h3>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handlePreset('https://www.youtube.com/shorts/PucaCQG8L18')}
                  className="flex items-center gap-4 p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-purple-500/50 rounded-xl transition-all group text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                    📱
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-200 group-hover:text-purple-400 transition-colors">Sample Short</div>
                    <div className="text-xs text-gray-500">YouTube Shorts Format</div>
                  </div>
                  <div className="text-gray-600 group-hover:text-purple-400 transition-colors">
                    Play
                  </div>
                </button>

                <button
                  onClick={() => handlePreset('https://www.youtube.com/watch?v=jWQx2f-CErU')}
                  className="flex items-center gap-4 p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-pink-500/50 rounded-xl transition-all group text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                    🎵
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-200 group-hover:text-pink-400 transition-colors">Sample Video</div>
                    <div className="text-xs text-gray-500">Standard YouTube Video</div>
                  </div>
                  <div className="text-gray-600 group-hover:text-pink-400 transition-colors">
                    Play
                  </div>
                </button>

                <button
                  onClick={() => handlePreset('https://www.youtube.com/shorts/Kp93BPSC70I')}
                  className="flex items-center gap-4 p-4 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-yellow-500/50 rounded-xl transition-all group text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-yellow-500/10 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                    👟
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-200 group-hover:text-yellow-400 transition-colors">HipHop Dancing Video</div>
                    <div className="text-xs text-gray-500">YouTube Shorts Format</div>
                  </div>
                  <div className="text-gray-600 group-hover:text-yellow-400 transition-colors">
                    Play
                  </div>
                </button>
              </div>
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
