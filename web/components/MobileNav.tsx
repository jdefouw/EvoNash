"use client";

import { useState } from "react";
import Link from "next/link";

export default function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Hamburger button — visible only on small screens */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label="Toggle menu"
      >
        <svg
          className="w-5 h-5 text-gray-600 dark:text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Desktop nav links — hidden on mobile */}
      <div className="hidden md:flex items-center gap-2">
        <Link
          href="/overview"
          className="px-3.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
        >
          Overview
        </Link>
        <Link
          href="/experiments"
          className="px-3.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
        >
          Experiments
        </Link>
        <Link
          href="/experiments/new"
          className="px-3.5 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          New Experiment
        </Link>
      </div>

      {/* Mobile dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 md:hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-200/60 dark:border-gray-700/60 shadow-lg animate-fade-in">
          <div className="max-w-7xl mx-auto px-6 py-3 flex flex-col gap-1">
            <Link
              href="/overview"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
            >
              Overview
            </Link>
            <Link
              href="/experiments"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-all"
            >
              Experiments
            </Link>
            <Link
              href="/experiments/new"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-center"
            >
              New Experiment
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
