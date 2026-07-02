import { Menu, Bell } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user } = useAuth()
  return (
    <header className="h-14 bg-surface-800 border-b border-white/5 flex items-center justify-between px-4 flex-shrink-0">
      <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-surface-200/60">
        <Menu className="w-5 h-5"/>
      </button>
      <div className="flex-1"/>
      <div className="flex items-center gap-3">
        <button className="p-2 rounded-lg hover:bg-white/5 text-surface-200/40">
          <Bell className="w-4 h-4"/>
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-brand-600/30 flex items-center justify-center">
            <span className="text-[11px] font-bold text-brand-300">{user?.nombre?.[0]??'U'}</span>
          </div>
          <span className="text-sm text-surface-200/70 hidden sm:block">{user?.nombre}</span>
        </div>
      </div>
    </header>
  )
}
