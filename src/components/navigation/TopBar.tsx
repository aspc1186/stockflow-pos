import { Menu, Bell, Wifi, WifiOff } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useSocket } from '@/contexts/SocketContext'
import { formatDate } from '@/lib/utils'
export default function TopBar({ onMenuClick }: { onMenuClick: ()=>void }) {
  const { user } = useAuth(); const { connected } = useSocket()
  return (
    <header className="h-14 bg-surface-800/50 border-b border-white/5 flex items-center justify-between px-4 flex-shrink-0">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-surface-200/60"><Menu className="w-5 h-5" /></button>
        <p className="hidden sm:block text-xs text-surface-200/40 capitalize">{formatDate(new Date(),"dd 'de' MMMM yyyy")}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${connected?'bg-emerald-500/10 text-emerald-400':'bg-red-500/10 text-red-400'}`}>
          {connected?<Wifi className="w-3 h-3" />:<WifiOff className="w-3 h-3" />}
          <span className="hidden sm:inline">{connected?'En línea':'Sin conexión'}</span>
        </div>
        <button className="p-2 rounded-lg hover:bg-white/5 text-surface-200/60"><Bell className="w-5 h-5" /></button>
        <div className="flex items-center gap-2 pl-2 border-l border-white/5">
          <div className="w-7 h-7 rounded-full bg-brand-600/30 flex items-center justify-center"><span className="text-xs font-bold text-brand-300">{user?.nombre?.[0]??'U'}</span></div>
          <span className="hidden sm:block text-sm text-surface-200/80 max-w-[120px] truncate">{user?.nombre}</span>
        </div>
      </div>
    </header>
  )
}
