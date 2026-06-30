import { cn } from '@/lib/utils'
interface P { label:string; value:string|number; icon:React.ReactNode; iconBg?:string; className?:string }
export default function StatCard({ label,value,icon,iconBg='bg-brand-600/20',className }:P) {
  return (
    <div className={cn('stat-card',className)}>
      <div className={cn('stat-icon',iconBg)}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-surface-200/50 uppercase tracking-wide font-medium mb-1">{label}</p>
        <p className="text-2xl font-bold text-surface-50 leading-none">{value}</p>
      </div>
    </div>
  )
}
