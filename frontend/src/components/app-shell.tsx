'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { UserButton } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Sidebar } from '@/components/sidebar'
import { GlobalSearch } from '@/components/global-search'
import { ThemeToggle } from '@/components/theme-toggle'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-md">Skip to content</a>
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Main area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger
                render={
                  <Button variant="ghost" size="icon" className="md:hidden text-muted-foreground" aria-label="Open navigation menu" />
                }
              >
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side="left" className="w-60 p-0 bg-background border-border">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SheetDescription className="sr-only">Main navigation menu</SheetDescription>
                <Sidebar className="border-r-0" />
              </SheetContent>
            </Sheet>

            <GlobalSearch />
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <UserButton
              appearance={{
                elements: {
                  avatarBox: 'h-8 w-8',
                },
              }}
            />
          </div>
        </header>

        {/* Content */}
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
