import { AppShell } from '@/components/app-shell'
import { Toaster } from 'sonner'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AppShell>
      {children}
      <Toaster position="bottom-right" theme="dark" richColors />
    </AppShell>
  )
}
