'use client'

import { useEffect, useState, useRef } from 'react'

interface AnimatedCounterProps {
  value: number
  duration?: number
  decimals?: number
  prefix?: string
  suffix?: string
  className?: string
}

export default function AnimatedCounter({ 
  value, 
  duration = 1000, 
  decimals = 2,
  prefix = '',
  suffix = '',
  className = ''
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const startTimeRef = useRef<number | null>(null)
  const startValueRef = useRef(value)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const startValue = startValueRef.current
    const endValue = value
    const startTime = performance.now()
    startTimeRef.current = startTime
    startValueRef.current = value

    const animate = (currentTime: number) => {
      if (!startTimeRef.current) return

      const elapsed = currentTime - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const currentValue = startValue + (endValue - startValue) * easeOutQuart
      
      setDisplayValue(currentValue)

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate)
      } else {
        setDisplayValue(endValue)
      }
    }

    if (startValue !== endValue) {
      animationFrameRef.current = requestAnimationFrame(animate)
    } else {
      setDisplayValue(endValue)
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [value, duration])

  const formattedValue = typeof displayValue === 'number' && !isNaN(displayValue)
    ? displayValue.toFixed(decimals)
    : '0.00'

  return (
    <span className={className}>
      {prefix}{formattedValue}{suffix}
    </span>
  )
}
