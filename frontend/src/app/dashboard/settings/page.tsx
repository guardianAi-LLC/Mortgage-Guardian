'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { Bell } from 'lucide-react'
import { PageHeader } from '@/components/page-header'

interface NotificationPrefs {
  complete: boolean
  findings: boolean
  errors: boolean
}

const DEFAULT_PREFS: NotificationPrefs = { complete: true, findings: true, errors: true }
const STORAGE_KEY = 'mg_notification_prefs'

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only peer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className="w-9 h-5 bg-gray-700 rounded-full peer peer-checked:bg-blue-600 transition-colors" />
        <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4" />
      </div>
    </label>
  )
}

export default function SettingsPage() {
  const { user } = useUser()
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS)
  const [mounted, setMounted] = useState(false)

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
        <h2 className="text-lg font-semibold text-white mb-4">Profile</h2>
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
              label="Document processing complete"
              checked={prefs.complete}
              onChange={(v) => updatePref('complete', v)}
            />
            <Toggle
              label="Analysis findings ready"
              checked={prefs.findings}
              onChange={(v) => updatePref('findings', v)}
            />
            <Toggle
              label="Pipeline errors"
              checked={prefs.errors}
              onChange={(v) => updatePref('errors', v)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
