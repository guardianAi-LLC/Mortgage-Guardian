'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-label="Toggle theme" className="text-muted-foreground"><Moon className="h-4 w-4" /></Button>
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      className="text-muted-foreground hover:text-foreground"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  )
}
