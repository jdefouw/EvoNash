import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-4">EvoNash</h1>
        <p className="text-xl mb-8 text-gray-600 dark:text-gray-400">
          Evolutionary Nash Equilibrium Analyzer
        </p>
        <div className="space-y-4">
          <Link 
            href="/experiments" 
            className="block p-4 border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <h2 className="text-2xl font-semibold mb-2">Experiments</h2>
            <p>View and manage scientific experiments</p>
          </Link>
        </div>
      </div>
    </main>
  )
}
