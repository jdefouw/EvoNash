'use client'

export default function LiveViewLegend() {
  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Legend</h2>
      
      <div className="space-y-4">
        {/* Chart Metrics */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Convergence Velocity Chart</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-4 h-0.5 bg-blue-500" />
              <span className="text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">Average Elo</strong> - Mean Elo rating across the entire population
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-0.5 bg-purple-500" />
              <span className="text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">Peak Elo</strong> - Highest Elo rating in the population
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">Latest Generation</strong> - Current generation being processed (red pulsing dot)
              </span>
            </div>
          </div>
        </div>

        {/* Entropy Chart */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Entropy Collapse Chart</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-4 h-0.5 bg-green-500" />
              <span className="text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">Policy Entropy</strong> - Average entropy of agent action distributions (higher = more exploration)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-0.5 bg-amber-500" />
              <span className="text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">Entropy Variance</strong> - Variance in entropy across the population (lower = convergence)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-0.5 bg-green-500 border-dashed border-t-2" />
              <span className="text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">Nash Equilibrium Threshold</strong> - Entropy variance &lt; 0.01 indicates convergence (green dashed line)
              </span>
            </div>
          </div>
        </div>

        {/* Live Metrics */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Live Metrics Panel</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">Live Indicator</strong> - Green pulsing dot indicates real-time data updates
              </span>
            </div>
            <div className="text-gray-600 dark:text-gray-400 pl-5">
              <div className="mt-1"><strong className="text-gray-900 dark:text-white">Avg Elo:</strong> Population average Elo rating</div>
              <div className="mt-1"><strong className="text-gray-900 dark:text-white">Peak Elo:</strong> Highest individual agent Elo</div>
              <div className="mt-1"><strong className="text-gray-900 dark:text-white">Policy Entropy:</strong> Average action distribution entropy</div>
              <div className="mt-1"><strong className="text-gray-900 dark:text-white">Generation:</strong> Current generation number</div>
              <div className="mt-1"><strong className="text-gray-900 dark:text-white">Entropy Variance:</strong> Spread of entropy values across population</div>
              <div className="mt-1"><strong className="text-gray-900 dark:text-white">Diversity:</strong> Average Euclidean distance between agent weight vectors</div>
              <div className="mt-1"><strong className="text-gray-900 dark:text-white">Min Elo:</strong> Lowest Elo rating in population</div>
              <div className="mt-1"><strong className="text-gray-900 dark:text-white">Avg Fitness:</strong> Average fitness score (energy + survival time)</div>
            </div>
          </div>
        </div>

        {/* Live Simulation View */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Live Simulation View (Petri Dish)</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-blue-500 rounded-full opacity-80" />
              <span className="text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">Blue Circles</strong> - Neural network agents in the population
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-4 h-4">
                <div className="absolute inset-0 bg-blue-500 rounded-full opacity-80" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-3 h-0.5 bg-white" style={{ transform: 'rotate(45deg)' }} />
                </div>
              </div>
              <span className="text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">White Line</strong> - Direction indicator showing agent's facing direction and movement orientation
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full" />
              <span className="text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">Green Dots</strong> - Available food pellets (not yet consumed)
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full opacity-30" />
              <span className="text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">Red Dots</strong> - Consumed food pellets (faded, already eaten)
              </span>
            </div>
            <div className="text-gray-600 dark:text-gray-400 pl-5 text-xs mt-2">
              <p className="mt-1">The simulation shows agents (blue circles) navigating the 2D toroidal space, seeking food (green dots) to maintain energy. Agents consume food when they come into contact, converting it to energy for survival.</p>
            </div>
          </div>
        </div>

        {/* Color Reference */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Color Reference</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded" />
              <span className="text-gray-600 dark:text-gray-400">Blue (#3b82f6)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-purple-500 rounded" />
              <span className="text-gray-600 dark:text-gray-400">Purple (#8b5cf6)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded" />
              <span className="text-gray-600 dark:text-gray-400">Green (#10b981)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-amber-500 rounded" />
              <span className="text-gray-600 dark:text-gray-400">Amber (#f59e0b)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full" />
              <span className="text-gray-600 dark:text-gray-400">Red (#ef4444)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
