'use client'

import { useEffect, useState } from 'react'
import PetriDishViewer from './PetriDishViewer'
import { Generation, Experiment } from '@/types/protocol'

interface SimulationReplayProps {
  generations: Generation[]
  experiment: Experiment
  width?: number
  height?: number
}

export default function SimulationReplay({ 
  generations, 
  experiment,
  width = 800,
  height = 600
}: SimulationReplayProps) {
  const [currentGenerationIndex, setCurrentGenerationIndex] = useState(0)
  const [currentTick, setCurrentTick] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [animationSpeed, setAnimationSpeed] = useState(50) // ms per frame

  const ticksPerGeneration = experiment.ticks_per_generation || 750
  const totalGenerations = generations.length

  // Debug: Log when component receives generations
  useEffect(() => {
    if (totalGenerations > 0) {
      console.log(`[SimulationReplay] Loaded ${totalGenerations} generations for replay`)
    }
  }, [totalGenerations])

  // Simple seeded random number generator for deterministic positions
  const seededRandom = (seed: number) => {
    const x = Math.sin(seed) * 10000
    return x - Math.floor(x)
  }

  // Generate representative agents for a generation
  const generateAgentsForGeneration = (generation: Generation, tick: number) => {
    const populationSize = generation.population_size || experiment.population_size || 10
    const numAgents = Math.min(20, populationSize) // Show up to 20 agents for performance
    
    // Use generation number and tick as seed for consistent positioning
    const baseSeed = generation.generation_number * 10000 + tick
    
    return Array.from({ length: numAgents }, (_, i) => {
      const seed = baseSeed + i * 1000
      
      // Generate deterministic but varied positions
      const x = seededRandom(seed) * 1000
      const y = seededRandom(seed + 1) * 1000
      const angle = seededRandom(seed + 2) * Math.PI * 2
      
      // Agents move in circular/exploratory patterns
      const time = tick / ticksPerGeneration
      const radius = 50 + seededRandom(seed + 3) * 100
      const orbitSpeed = 0.01 + seededRandom(seed + 4) * 0.02
      const centerX = 500 + (seededRandom(seed + 5) - 0.5) * 200
      const centerY = 500 + (seededRandom(seed + 6) - 0.5) * 200
      
      // Calculate position with some orbital motion
      const orbitAngle = angle + time * orbitSpeed * Math.PI * 2
      const finalX = centerX + Math.cos(orbitAngle) * radius
      const finalY = centerY + Math.sin(orbitAngle) * radius
      
      // Energy decreases over time, but varies by agent
      const baseEnergy = 100 - (time * 30)
      const energyVariation = (seededRandom(seed + 7) - 0.5) * 20
      const energy = Math.max(0, baseEnergy + energyVariation)
      
      return {
        id: `agent-${generation.generation_number}-${i}`,
        x: finalX,
        y: finalY,
        angle: orbitAngle,
        energy: energy,
        vx: Math.cos(orbitAngle) * (2 + seededRandom(seed + 8) * 2),
        vy: Math.sin(orbitAngle) * (2 + seededRandom(seed + 9) * 2),
        elo: (generation.avg_elo || 1500) + (seededRandom(seed + 10) - 0.5) * 400
      }
    })
  }

  // Generate representative food for a generation
  const generateFoodForGeneration = (generation: Generation, tick: number) => {
    const numFood = 30
    const baseSeed = generation.generation_number * 10000 + tick
    
    return Array.from({ length: numFood }, (_, i) => {
      const seed = baseSeed + i * 100
      
      // Distribute food evenly across the dish
      const x = seededRandom(seed) * 1000
      const y = seededRandom(seed + 1) * 1000
      
      // Food gets consumed over time (more consumed later in generation)
      // Higher Elo generations consume food faster (better agents)
      const consumptionRate = 0.3 + (generation.avg_elo || 1500) / 2000 * 0.3
      const timeProgress = tick / ticksPerGeneration
      const consumed = seededRandom(seed + 2) < (timeProgress * consumptionRate)
      
      return {
        x: x,
        y: y,
        consumed: consumed
      }
    })
  }

  const currentGeneration = generations[currentGenerationIndex]
  const agents = currentGeneration 
    ? generateAgentsForGeneration(currentGeneration, currentTick)
    : []
  const food = currentGeneration 
    ? generateFoodForGeneration(currentGeneration, currentTick)
    : []

  // Animation loop
  useEffect(() => {
    if (!isPlaying || totalGenerations === 0) return

    const interval = setInterval(() => {
      setCurrentTick(prev => {
        const nextTick = prev + 1
        if (nextTick >= ticksPerGeneration) {
          // Move to next generation
          setCurrentGenerationIndex(prev => {
            const nextGen = prev + 1
            if (nextGen >= totalGenerations) {
              // Loop back to start
              return 0
            }
            return nextGen
          })
          return 0
        }
        return nextTick
      })
    }, animationSpeed) // Update based on animation speed

    return () => clearInterval(interval)
  }, [isPlaying, totalGenerations, ticksPerGeneration, animationSpeed])

  // Show loading state if no generations yet
  if (totalGenerations === 0) {
    return (
      <div className="relative">
        <div className="flex items-center justify-center h-[600px] bg-slate-900 rounded-lg border border-gray-700">
          <div className="text-center text-gray-400">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
            <p className="text-lg mb-2">Loading generation data...</p>
            <p className="text-sm mt-2">Animation will start once data is loaded</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <PetriDishViewer
        width={width}
        height={height}
        dishWidth={1000}
        dishHeight={1000}
        agents={agents}
        food={food}
        mode="replay"
      />
      
      {/* Status Overlay */}
      <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-sm">
        <div className="flex items-center gap-4">
          <div>
            <span className="text-gray-300">Generation: </span>
            <span className="font-bold">{currentGeneration?.generation_number ?? 0} / {totalGenerations - 1}</span>
          </div>
          <div>
            <span className="text-gray-300">Tick: </span>
            <span className="font-bold">{currentTick} / {ticksPerGeneration - 1}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs font-medium transition-colors"
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <select
              value={animationSpeed}
              onChange={(e) => setAnimationSpeed(Number(e.target.value))}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs font-medium transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <option value={100}>Slow</option>
              <option value={50}>Normal</option>
              <option value={25}>Fast</option>
              <option value={10}>Very Fast</option>
            </select>
          </div>
        </div>
      </div>

      {/* Generation Stats Overlay */}
      {currentGeneration && (
        <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg px-4 py-2 text-white text-xs">
          <div className="space-y-1">
            <div>
              <span className="text-gray-300">Avg Elo: </span>
              <span className="font-bold">{currentGeneration.avg_elo?.toFixed(1) || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-300">Peak Elo: </span>
              <span className="font-bold">{currentGeneration.peak_elo?.toFixed(1) || 'N/A'}</span>
            </div>
            <div>
              <span className="text-gray-300">Entropy: </span>
              <span className="font-bold">{currentGeneration.policy_entropy?.toFixed(3) || 'N/A'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Loop Indicator */}
      <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-sm rounded-lg px-3 py-1 text-white text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span>Looping Animation</span>
        </div>
      </div>
    </div>
  )
}
