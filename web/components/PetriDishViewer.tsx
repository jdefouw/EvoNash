'use client'

interface Agent {
  id: string
  x: number
  y: number
  angle: number
  energy: number
  vx: number
  vy: number
  elo: number
}

interface Food {
  x: number
  y: number
  consumed: boolean
}

interface PetriDishViewerProps {
  width: number
  height: number
  dishWidth: number
  dishHeight: number
  agents: Agent[]
  food: Food[]
  mode?: 'live' | 'replay'
}

export default function PetriDishViewer({
  width,
  height,
  dishWidth,
  dishHeight,
  agents,
  food,
  mode = 'live'
}: PetriDishViewerProps) {
  return (
    <div className="relative bg-slate-900 rounded-lg border border-gray-700" style={{ width, height }}>
      <svg width={width} height={height} className="absolute inset-0">
        {/* Food */}
        {food.map((f, i) => (
          <g key={`food-${i}`}>
            <title>{f.consumed ? 'Consumed food pellets - red dots (faded) represent food that has already been eaten by agents' : 'Available food pellets - green dots represent unconsumed food that agents can collect for energy'}</title>
            <circle
              cx={(f.x / dishWidth) * width}
              cy={(f.y / dishHeight) * height}
              r={3}
              fill={f.consumed ? '#ef4444' : '#22c55e'}
              opacity={f.consumed ? 0.3 : 1}
              className="cursor-help"
            />
          </g>
        ))}
        
        {/* Agents */}
        {agents.map((agent) => (
          <g key={agent.id}>
            <title>Neural network agents in the population - blue circles represent individual AI agents navigating the environment</title>
            <circle
              cx={(agent.x / dishWidth) * width}
              cy={(agent.y / dishHeight) * height}
              r={8}
              fill="#3b82f6"
              opacity={0.8}
              className="cursor-help"
            />
            <line
              x1={(agent.x / dishWidth) * width}
              y1={(agent.y / dishHeight) * height}
              x2={(agent.x / dishWidth) * width + Math.cos(agent.angle) * 15}
              y2={(agent.y / dishHeight) * height + Math.sin(agent.angle) * 15}
              stroke="#ffffff"
              strokeWidth={2}
            />
          </g>
        ))}
      </svg>
      <div className="absolute bottom-2 left-2 text-xs text-gray-400">
        {agents.length} agents, {food.filter(f => !f.consumed).length} food
      </div>
    </div>
  )
}
