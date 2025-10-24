'use client';

import { useState } from 'react';

export default function HomePage() {
  const [clicks, setClicks] = useState(0);

  const handleClick = () => {
    setClicks(clicks + 1);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 dark:from-purple-950 dark:via-blue-950 dark:to-indigo-950">
      <div className="flex flex-col items-center gap-6">
        <h1 className="text-4xl font-bold text-white mb-8">Monster Battle</h1>

        <button
          onClick={handleClick}
          className="w-64 h-64 bg-gradient-to-br from-red-500 to-purple-600 rounded-2xl shadow-2xl hover:scale-105 active:scale-95 transition-transform duration-150 flex items-center justify-center cursor-pointer border-4 border-white/20 hover:border-white/40"
        >
          <div className="text-center">
            <div className="text-6xl mb-4">👾</div>
            <p className="text-white text-xl font-bold">Click to Attack!</p>
          </div>
        </button>

        <div className="mt-4 px-8 py-3 bg-black/30 rounded-lg border border-white/20">
          <p className="text-white text-lg">
            Clicks: <span className="font-bold text-yellow-400">{clicks}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
