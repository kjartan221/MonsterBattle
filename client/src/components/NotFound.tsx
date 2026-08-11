import { Link } from 'react-router-dom';

// 404 page, shown when a route doesn't match.
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 dark:from-purple-950 dark:via-blue-950 dark:to-indigo-950 px-4">
      <div className="w-full max-w-md px-8">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/20 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">404 — Not found</h1>
          <p className="text-white/70 mb-8">
            This page doesn&apos;t exist. It may have wandered off into the wilderness.
          </p>

          <Link
            to="/battle"
            className="block w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-lg"
          >
            Return to battle
          </Link>
        </div>
      </div>
    </div>
  );
}
