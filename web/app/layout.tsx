import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EvoNash - Evolutionary Nash Equilibrium Analyzer',
  description: 'Scientific experiment platform for comparing Static vs Adaptive mutation rates',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
