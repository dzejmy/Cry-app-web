import { useEffect, useState, useMemo } from 'react'
import {
  Wrench, AlertTriangle, Filter, Package, Loader2, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { useAuth } from '../../hooks/useAuth'
import { getOperatorByProfileId } from '../../lib/supabase/operators'
import { getInventoryByOperator, updateInventoryAvailability } from '../../lib/supabase/inventory'
import type { EquipmentInventory, EquipmentCategory, Operator } from '../../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<EquipmentCategory, string> = {
  ski:       'Skis',
  snowboard: 'Snowboard',
  boot:      'Boots',
  helmet:    'Helmet',
  bike:      'Bike',
  'e-bike':  'E-Bike',
}

const CATEGORY_ICONS: Record<EquipmentCategory, string> = {
  ski:       '⛷',
  snowboard: '🏂',
  boot:      '🥾',
  helmet:    '🪖',
  bike:      '🚵',
  'e-bike':  '⚡',
}

const CONDITION_LABELS: Record<string, string> = {
  new:     'New',
  good:    'Good',
  fair:    'Fair',
  retired: 'Retired',
}

const CONDITION_COLORS: Record<string, string> = {
  new:     'bg-green-100 text-green-700',
  good:    'bg-blue-100 text-blue-700',
  fair:    'bg-amber-100 text-amber-700',
  retired: 'bg-red-100 text-red-600',
}

// ── Item row ──────────────────────────────────────────────────────────────────

function InventoryRow({
  item, onUpdate,
}: {
  item: EquipmentInventory
  onUpdate: (id: string, qty: number) => void
}) {
  const qtyOut     = Math.max(0, item.quantity_total - item.quantity_available)
  const allOut     = item.quantity_available === 0 && item.quantity_total > 0
  const partialOut = qtyOut > 0 && !allOut
  const [editing, setEditing] = useState(false)
  const [val, setVal]         = useState(String(item.quantity_available))
  const [saving, setSaving]   = useState(false)

  async function handleSave() {
    const n = parseInt(val)
    if (isNaN(n) || n < 0 || n > item.quantity_total) {
      toast.error(`Must be 0–${item.quantity_total}`)
      return
    }
    setSaving(true)
    try {
      await updateInventoryAvailability(item.id, n)
      onUpdate(item.id, n)
      setEditing(false)
      toast.success('Updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={[
      'bg-white rounded-xl border shadow-sm p-4 transition-colors',
      allOut     ? 'border-red-200 bg-red-50/40' :
      partialOut ? 'border-amber-200 bg-amber-50/30' : 'border-gray-100',
    ].join(' ')}>
      <div className="flex items-start gap-3">
        {/* Icon + name */}
        <div className="shrink-0 w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl">
          {CATEGORY_ICONS[item.category] ?? '📦'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-gray-900">
              {item.brand} {item.model}
            </p>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${CONDITION_COLORS[item.condition] ?? 'bg-gray-100 text-gray-500'}`}>
              {CONDITION_LABELS[item.condition] ?? item.condition}
            </span>
            {allOut && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                <AlertTriangle className="w-2.5 h-2.5" />
                All out
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {CATEGORY_LABELS[item.category]} · Size {item.size}
          </p>

          {/* Quantity display / edit */}
          <div className="flex items-center gap-3 mt-2.5">
            <div className="flex-1">
              <div className="flex items-center gap-3 text-xs text-gray-600 mb-1.5">
                <span>Total: <span className="font-semibold text-gray-900">{item.quantity_total}</span></span>
                <span>Out: <span className={`font-semibold ${qtyOut > 0 ? 'text-orange-600' : 'text-gray-900'}`}>{qtyOut}</span></span>
                {!editing && (
                  <span>Available: <span className={`font-semibold ${allOut ? 'text-red-600' : 'text-green-700'}`}>{item.quantity_available}</span></span>
                )}
              </div>
              {/* Capacity bar */}
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${allOut ? 'bg-red-500' : partialOut ? 'bg-amber-400' : 'bg-green-500'}`}
                  style={{ width: `${Math.min(100, (qtyOut / item.quantity_total) * 100)}%` }}
                />
              </div>
            </div>

            {!editing ? (
              <button
                onClick={() => { setVal(String(item.quantity_available)); setEditing(true) }}
                className="text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors shrink-0"
              >
                Update qty
              </button>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <div>
                  <label className="text-[10px] text-gray-400 block mb-0.5">Available</label>
                  <input
                    type="number"
                    min={0}
                    max={item.quantity_total}
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm font-semibold text-center focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="text-xs font-semibold text-white bg-violet-600 hover:bg-violet-700 px-3 py-1.5 rounded-lg disabled:opacity-50"
                  >
                    {saving ? '…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {item.notes && (
        <p className="text-xs text-gray-400 mt-2 pl-13">{item.notes}</p>
      )}
    </div>
  )
}

// ── Summary bar ───────────────────────────────────────────────────────────────

function SummaryBar({ inventory }: { inventory: EquipmentInventory[] }) {
  const totalItems = inventory.length
  const totalOut   = inventory.reduce((sum, i) => sum + Math.max(0, i.quantity_total - i.quantity_available), 0)
  const allOutItems = inventory.filter((i) => i.quantity_available === 0 && i.quantity_total > 0)

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {[
        { label: 'Item types',   value: totalItems,        color: 'bg-gray-50 border-gray-100',     icon: Package,       iconColor: 'text-gray-500' },
        { label: 'Units out',    value: totalOut,          color: 'bg-amber-50 border-amber-100',   icon: Wrench,        iconColor: 'text-amber-600' },
        { label: 'Fully out',    value: allOutItems.length, color: allOutItems.length > 0 ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100', icon: AlertTriangle, iconColor: allOutItems.length > 0 ? 'text-red-500' : 'text-gray-400' },
      ].map(({ label, value, color, icon: Icon, iconColor }) => (
        <div key={label} className={`rounded-2xl border p-3 ${color}`}>
          <Icon className={`w-4 h-4 mb-1.5 ${iconColor}`} />
          <p className="text-xl font-bold text-gray-900">{value}</p>
          <p className="text-[10px] text-gray-500">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type CategoryFilter = EquipmentCategory | 'all'

const CATEGORY_TABS: { id: CategoryFilter; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'ski',       label: '⛷ Ski' },
  { id: 'snowboard', label: '🏂 Board' },
  { id: 'boot',      label: '🥾 Boot' },
  { id: 'helmet',    label: '🪖 Helmet' },
  { id: 'bike',      label: '🚵 Bike' },
  { id: 'e-bike',    label: '⚡ E-Bike' },
]

export default function EquipmentTracker() {
  const { user } = useAuth()
  const [operator, setOperator]   = useState<Operator | null>(null)
  const [inventory, setInventory] = useState<EquipmentInventory[]>([])
  const [loading, setLoading]     = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [showOutOnly, setShowOutOnly]       = useState(false)

  useEffect(() => {
    if (!user) return

    async function load() {
      try {
        const op = await getOperatorByProfileId(user!.id)
        if (!op) { setLoading(false); return }
        setOperator(op)
        const inv = await getInventoryByOperator(op.id)
        setInventory(inv)
      } catch (err) {
        toast.error('Could not load inventory')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  function handleUpdate(id: string, qty: number) {
    setInventory((prev) => prev.map((i) => i.id === id ? { ...i, quantity_available: qty } : i))
  }

  const filtered = useMemo(() => {
    let list = inventory
    if (categoryFilter !== 'all') list = list.filter((i) => i.category === categoryFilter)
    if (showOutOnly) list = list.filter((i) => i.quantity_total - i.quantity_available > 0)
    return list
  }, [inventory, categoryFilter, showOutOnly])

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-16 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Equipment</h1>
            <p className="text-xs text-gray-500">Track inventory and rentals</p>
          </div>
          <button
            onClick={() => setShowOutOnly((v) => !v)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors ${
              showOutOnly ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            {showOutOnly ? 'Out only' : 'All'}
          </button>
        </div>
      </div>

      <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 h-24 animate-pulse" />
            ))}
          </div>
        ) : !operator ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <AlertCircle className="w-10 h-10" />
            <p className="text-sm">No operator profile linked</p>
          </div>
        ) : (
          <>
            <SummaryBar inventory={inventory} />

            {/* Category tabs */}
            <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide">
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all border ${
                    categoryFilter === tab.id
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-white text-gray-600 border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm font-medium text-gray-600">
                  {inventory.length === 0
                    ? 'No equipment inventory found'
                    : showOutOnly
                    ? 'No items currently out in this category'
                    : 'No items in this category'}
                </p>
                {inventory.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
                    Add equipment inventory in your Supabase dashboard to track items here.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-xs text-gray-400">{filtered.length} item type{filtered.length !== 1 ? 's' : ''}</p>
                {filtered.map((item) => (
                  <InventoryRow key={item.id} item={item} onUpdate={handleUpdate} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
