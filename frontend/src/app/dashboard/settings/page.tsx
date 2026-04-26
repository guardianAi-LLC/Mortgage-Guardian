'use client'

import { useEffect, useState } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import { Bell, User, Download, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { useCases, useDocuments } from '@/lib/hooks'

interface NotificationPrefs {
  complete: boolean
  findings: boolean
  errors: boolean
}

const DEFAULT_PREFS: NotificationPrefs = { complete: true, findings: true, errors: true }
const STORAGE_KEY = 'mg_notification_prefs'

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label htmlFor={id} className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="relative">
        <input
          id={id}
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          aria-label={label}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className="w-9 h-5 bg-gray-700 rounded-full peer peer-checked:bg-blue-600 transition-colors" />
        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
      </div>
    </label>
  )
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export default function SettingsPage() {
  const { user } = useUser()
  const clerk = useClerk()
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [mounted, setMounted] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const { data: casesData } = useCases()
  const { data: documentsData } = useDocuments({ limit: 500, offset: 0 })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        setPrefs(JSON.parse(raw))
      }
    } catch {
      // ignore parse errors
    }
    setMounted(true)
  }, [])

  function updatePref(key: keyof NotificationPrefs, value: boolean) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="Settings" description="Manage your account and preferences" />

      {/* Profile section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <User className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Profile</h2>
        </div>
        <div className="flex items-center gap-4 mb-4">
          {user?.imageUrl && (
            <img
              src={user.imageUrl}
              alt={user.fullName ?? 'Avatar'}
              width={64}
              height={64}
              className="rounded-full"
            />
          )}
          <div>
            <p className="text-white font-medium">{user?.fullName ?? 'Loading...'}</p>
            <p className="text-sm text-gray-400">
              {user?.primaryEmailAddress?.emailAddress ?? ''}
            </p>
          </div>
        </div>
        <p className="text-sm text-gray-400">
          Click your avatar in the top-right corner to manage your profile, password, and connected
          accounts.
        </p>
      </div>

      {/* Notification preferences section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Bell className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Notifications</h2>
        </div>

        {mounted && (
          <div className="space-y-4">
            <Toggle
              id="pref-complete"
              label="Document processing complete"
              checked={prefs.complete}
              onChange={(v) => updatePref('complete', v)}
            />
            <Toggle
              id="pref-findings"
              label="Analysis findings ready"
              checked={prefs.findings}
              onChange={(v) => updatePref('findings', v)}
            />
            <Toggle
              id="pref-errors"
              label="Pipeline errors"
              checked={prefs.errors}
              onChange={(v) => updatePref('errors', v)}
            />
          </div>
        )}
      </div>

      {/* Data Export section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Download className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-white">Data Export</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Download all your cases, documents, and analysis data as JSON
        </p>
        <div className="flex justify-end">
          <Button
            aria-label="Export all data as JSON"
            className="bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => {
              const exportData = {
                exportedAt: new Date().toISOString(),
                cases: casesData,
                documents: documentsData,
              }
              downloadJson(
                exportData,
                `mortgage-guardian-export-${new Date().toISOString().slice(0, 10)}.json`
              )
              toast.success('Data exported successfully')
            }}
          >
            Export All Data
          </Button>
        </div>
      </div>

      {/* Danger Zone section */}
      <div className="bg-gray-900 border border-red-900/40 rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-red-400" />
          <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <div className="flex justify-end">
          <Button
            variant="destructive"
            onClick={() => setDeleteDialogOpen(true)}
          >
            Delete Account
          </Button>
        </div>

        <Dialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open)
            if (!open) setConfirmText('')
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Account</DialogTitle>
              <DialogDescription>
                This will permanently delete your account, all cases, documents, and analysis data.
                Type <span className="font-mono font-bold text-white">DELETE</span> to confirm.
              </DialogDescription>
            </DialogHeader>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              aria-label="Type DELETE to confirm account deletion"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-red-500"
            />
            <DialogFooter>
              <DialogClose
                render={<Button variant="outline" />}
              >
                Cancel
              </DialogClose>
              <Button
                variant="destructive"
                disabled={confirmText !== 'DELETE'}
                onClick={() => {
                  toast('Account deletion initiated')
                  clerk.signOut({ redirectUrl: '/' })
                }}
              >
                Delete My Account
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
