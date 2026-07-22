import type { StockLevel } from '../data/strings'

const CONFIG: Record<StockLevel, { label: string; className: string; dot: string }> = {
  'in-stock': { label: 'In stock', className: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300', dot: 'bg-green-500' },
  'low-stock': { label: 'Low stock', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300', dot: 'bg-amber-500' },
  unavailable: { label: 'Currently unavailable', className: 'bg-gray-200 text-gray-700 dark:bg-white/10 dark:text-gray-300', dot: 'bg-gray-400' },
}

export default function StockBadge({ stock }: { stock: StockLevel }) {
  const c = CONFIG[stock]
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${c.className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} aria-hidden="true" />
      {c.label}
    </span>
  )
}
