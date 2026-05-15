import { useEffect, useRef, useState } from 'react'
import {
  Building2, Globe, Phone, Mail, MapPin, Upload,
  Loader2, AlertCircle, X, Plus, CheckCircle2,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase/client'
import { getOperatorByProfileId, updateOperator } from '../../lib/supabase/operators'
import { getOperatorResortIds, addOperatorResort, removeOperatorResort } from '../../lib/supabase/operators'
import { getResorts } from '../../lib/supabase/resorts'
import type { Operator, Resort } from '../../types'

// ── Logo uploader ─────────────────────────────────────────────────────────────

function LogoUploader({
  operatorId, logoUrl, onUploaded,
}: {
  operatorId: string
  logoUrl: string | null
  onUploaded: (url: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2 MB')
      return
    }
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `logos/${operatorId}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('operator-assets')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr

      const { data } = supabase.storage.from('operator-assets').getPublicUrl(path)
      const url = `${data.publicUrl}?t=${Date.now()}`
      await updateOperator(operatorId, { logo_url: url })
      onUploaded(url)
      toast.success('Logo updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
        ) : (
          <Building2 className="w-8 h-8 text-gray-300" />
        )}
      </div>
      <div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 text-sm font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Uploading…' : 'Upload logo'}
        </button>
        <p className="text-[10px] text-gray-400 mt-1">PNG, JPG up to 2 MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
    </div>
  )
}

// ── Resort link manager ───────────────────────────────────────────────────────

function ResortManager({
  operatorId,
  linkedIds,
  allResorts,
  onAdd,
  onRemove,
}: {
  operatorId: string
  linkedIds: string[]
  allResorts: Resort[]
  onAdd: (id: string) => void
  onRemove: (id: string) => void
}) {
  const [busy, setBusy] = useState<string | null>(null)
  const [showPicker, setShowPicker] = useState(false)

  const linked   = allResorts.filter((r) => linkedIds.includes(r.id))
  const unlinked = allResorts.filter((r) => !linkedIds.includes(r.id))

  async function handleAdd(resortId: string) {
    setBusy(resortId)
    try {
      await addOperatorResort(operatorId, resortId)
      onAdd(resortId)
      toast.success('Resort added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(null)
      setShowPicker(false)
    }
  }

  async function handleRemove(resortId: string) {
    setBusy(resortId)
    try {
      await removeOperatorResort(operatorId, resortId)
      onRemove(resortId)
      toast.success('Resort removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-2">
      {linked.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">No resorts linked yet.</p>
      ) : (
        linked.map((r) => (
          <div key={r.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
            <MapPin className="w-4 h-4 text-violet-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{r.name}</p>
              <p className="text-xs text-gray-400">{r.country}</p>
            </div>
            <button
              onClick={() => handleRemove(r.id)}
              disabled={busy === r.id}
              className="text-red-400 hover:text-red-600 transition-colors disabled:opacity-40 p-1"
            >
              {busy === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            </button>
          </div>
        ))
      )}

      {unlinked.length > 0 && (
        <>
          <button
            onClick={() => setShowPicker((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-2 rounded-xl transition-colors w-full justify-center"
          >
            <Plus className="w-3.5 h-3.5" />
            Add resort
          </button>

          {showPicker && (
            <div className="space-y-1.5 bg-white border border-gray-100 rounded-xl p-2 shadow-sm">
              {unlinked.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleAdd(r.id)}
                  disabled={busy === r.id}
                  className="flex items-center gap-3 w-full text-left px-3 py-2 rounded-lg hover:bg-violet-50 transition-colors disabled:opacity-40"
                >
                  {busy === r.id
                    ? <Loader2 className="w-4 h-4 animate-spin text-violet-500 shrink-0" />
                    : <CheckCircle2 className="w-4 h-4 text-gray-300 shrink-0" />
                  }
                  <div>
                    <p className="text-sm font-medium text-gray-800">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.country}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
      <h2 className="text-sm font-bold text-gray-700">{title}</h2>
      {children}
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text', placeholder, multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  multiline?: boolean
}) {
  const base = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-gray-300'
  return (
    <div>
      <label className="text-[11px] font-semibold text-gray-500 block mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={`${base} resize-none`}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={base}
        />
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function OperatorProfile() {
  const { user } = useAuth()
  const [operator, setOperator]     = useState<Operator | null>(null)
  const [allResorts, setAllResorts] = useState<Resort[]>([])
  const [linkedIds, setLinkedIds]   = useState<string[]>([])
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)

  // Form state
  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [website, setWebsite]     = useState('')
  const [phone, setPhone]         = useState('')
  const [email, setEmail]         = useState('')
  const [logoUrl, setLogoUrl]     = useState<string | null>(null)

  useEffect(() => {
    if (!user) return

    async function load() {
      try {
        const op = await getOperatorByProfileId(user!.id)
        if (!op) { setLoading(false); return }
        setOperator(op)
        setName(op.name)
        setDesc(op.description ?? '')
        setWebsite(op.website_url ?? '')
        setPhone(op.phone ?? '')
        setEmail(op.email ?? '')
        setLogoUrl(op.logo_url ?? null)

        const [resorts, ids] = await Promise.all([
          getResorts(),
          getOperatorResortIds(op.id),
        ])
        setAllResorts(resorts)
        setLinkedIds(ids)
      } catch (err) {
        toast.error('Could not load profile')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  async function handleSave() {
    if (!operator) return
    if (!name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const updated = await updateOperator(operator.id, {
        name: name.trim(),
        description: description.trim() || null,
        website_url: website.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
      } as Parameters<typeof updateOperator>[1])
      setOperator(updated)
      toast.success('Profile saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-7 h-7 animate-spin text-violet-500" />
      </div>
    )
  }

  if (!operator) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400 gap-3 px-8 text-center">
        <AlertCircle className="w-10 h-10" />
        <p className="font-medium text-gray-600">No operator profile found</p>
        <p className="text-sm">Contact support to link your account to an operator.</p>
      </div>
    )
  }

  const isDirty =
    name !== operator.name ||
    description !== (operator.description ?? '') ||
    website !== (operator.website_url ?? '') ||
    phone !== (operator.phone ?? '') ||
    email !== (operator.email ?? '')

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-16 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Operator Profile</h1>
            <p className="text-xs text-gray-500">{operator.name}</p>
          </div>
          {isDirty && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 px-4 py-2 rounded-xl disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">

        {/* Logo */}
        <Section title="Logo">
          <LogoUploader
            operatorId={operator.id}
            logoUrl={logoUrl}
            onUploaded={setLogoUrl}
          />
        </Section>

        {/* Company info */}
        <Section title="Company info">
          <Field label="Company name" value={name} onChange={setName} placeholder="e.g. Alpine Adventures" />
          <Field label="Description" value={description} onChange={setDesc} placeholder="Tell customers what makes you special…" multiline />
        </Section>

        {/* Contact */}
        <Section title="Contact">
          <Field label="Website" value={website} onChange={setWebsite} type="url" placeholder="https://example.com" />
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300 pointer-events-none mt-3" />
          </div>
          <Field label="Phone" value={phone} onChange={setPhone} type="tel" placeholder="+421 900 000 000" />
          <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="hello@example.com" />
        </Section>

        {/* Resorts */}
        <Section title="Resorts served">
          <ResortManager
            operatorId={operator.id}
            linkedIds={linkedIds}
            allResorts={allResorts}
            onAdd={(id) => setLinkedIds((prev) => [...prev, id])}
            onRemove={(id) => setLinkedIds((prev) => prev.filter((x) => x !== id))}
          />
        </Section>

        {/* Status */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${operator.verified ? 'bg-green-500' : 'bg-amber-400'}`} />
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {operator.verified ? 'Verified operator' : 'Pending verification'}
            </p>
            <p className="text-xs text-gray-400">
              {operator.verified
                ? 'Your profile is visible to customers.'
                : 'Verification is in progress. Contact support if this takes too long.'}
            </p>
          </div>
        </div>

        {/* Quick info */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: Phone, label: 'Phone', value: operator.phone ?? '—' },
            { icon: Mail, label: 'Email', value: operator.email ?? '—' },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 p-3 flex gap-2">
              <Icon className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-gray-400">{label}</p>
                <p className="text-xs font-medium text-gray-800 truncate">{value}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}
