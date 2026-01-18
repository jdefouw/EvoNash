'use client'

import { useState, useRef, useEffect } from 'react'

interface TooltipProps {
  content: string
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
}

export default function Tooltip({ 
  content, 
  children, 
  position = 'top',
  delay = 300 
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
      updatePosition()
    }, delay)
  }

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
    setTooltipPosition(null)
  }

  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const scrollX = window.scrollX || window.pageXOffset
    const scrollY = window.scrollY || window.pageYOffset

    let top = 0
    let left = 0

    switch (position) {
      case 'top':
        top = triggerRect.top + scrollY - tooltipRect.height - 8
        left = triggerRect.left + scrollX + (triggerRect.width / 2) - (tooltipRect.width / 2)
        break
      case 'bottom':
        top = triggerRect.bottom + scrollY + 8
        left = triggerRect.left + scrollX + (triggerRect.width / 2) - (tooltipRect.width / 2)
        break
      case 'left':
        top = triggerRect.top + scrollY + (triggerRect.height / 2) - (tooltipRect.height / 2)
        left = triggerRect.left + scrollX - tooltipRect.width - 8
        break
      case 'right':
        top = triggerRect.top + scrollY + (triggerRect.height / 2) - (tooltipRect.height / 2)
        left = triggerRect.right + scrollX + 8
        break
    }

    // Keep tooltip within viewport
    const padding = 8
    if (left < padding) left = padding
    if (left + tooltipRect.width > window.innerWidth - padding) {
      left = window.innerWidth - tooltipRect.width - padding
    }
    if (top < padding) top = padding
    if (top + tooltipRect.height > window.innerHeight + scrollY - padding) {
      top = triggerRect.top + scrollY - tooltipRect.height - 8
    }

    setTooltipPosition({ top, left })
  }

  useEffect(() => {
    if (isVisible) {
      updatePosition()
      const handleResize = () => updatePosition()
      const handleScroll = () => updatePosition()
      window.addEventListener('resize', handleResize)
      window.addEventListener('scroll', handleScroll, true)
      return () => {
        window.removeEventListener('resize', handleResize)
        window.removeEventListener('scroll', handleScroll, true)
      }
    }
  }, [isVisible])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-block"
        role="button"
        tabIndex={0}
        aria-describedby={isVisible ? 'tooltip' : undefined}
      >
        {children}
      </div>
      {isVisible && (
        <div
          ref={tooltipRef}
          id="tooltip"
          role="tooltip"
          className={`fixed z-50 px-3 py-2 text-sm text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg pointer-events-none transition-opacity duration-200 ${
            isVisible ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            top: tooltipPosition?.top ?? -9999,
            left: tooltipPosition?.left ?? -9999,
            maxWidth: '300px',
          }}
        >
          {content}
          <div
            className={`absolute w-0 h-0 border-4 ${
              position === 'top'
                ? 'top-full left-1/2 -translate-x-1/2 border-t-gray-900 dark:border-t-gray-700 border-x-transparent border-b-transparent'
                : position === 'bottom'
                ? 'bottom-full left-1/2 -translate-x-1/2 border-b-gray-900 dark:border-b-gray-700 border-x-transparent border-t-transparent'
                : position === 'left'
                ? 'left-full top-1/2 -translate-y-1/2 border-l-gray-900 dark:border-l-gray-700 border-y-transparent border-r-transparent'
                : 'right-full top-1/2 -translate-y-1/2 border-r-gray-900 dark:border-r-gray-700 border-y-transparent border-l-transparent'
            }`}
          />
        </div>
      )}
    </>
  )
}
