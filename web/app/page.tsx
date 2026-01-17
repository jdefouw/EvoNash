import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            EvoNash
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
            Evolutionary Nash Equilibrium Analyzer
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Adaptive vs. Static Mutation: Quantifying Acceleration in Convergence to Nash Equilibrium
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <Link 
            href="/experiments" 
            className="block p-8 border-2 border-gray-200 dark:border-gray-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all bg-white dark:bg-gray-800"
          >
            <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-white">
              Experiments
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              View and manage scientific experiments. Track convergence velocity, policy entropy, and statistical significance.
            </p>
          </Link>
          
          <div className="p-8 border-2 border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800">
            <h2 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-white">
              System Status
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Worker Status:</span>
                <span className="text-green-600 dark:text-green-400">Ready</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">Database:</span>
                <span className="text-green-600 dark:text-green-400">Connected</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            About This Project
          </h3>
          <p className="text-sm text-blue-800 dark:text-blue-200">
            EvoNash is a distributed high-performance computing platform designed to test whether 
            dynamic mutation rates (scaled by fitness) accelerate convergence to Nash Equilibrium 
            compared to traditional static mutation rates in genetic neural networks.
          </p>
        </div>
      </div>
    </main>
  )
}
