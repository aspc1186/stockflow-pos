import { ReactNode } from 'react'
export default function StatCard({label,value,icon,iconBg='bg-white/5'}:{label:string;value:string|number;icon?:ReactNode;iconBg?:string}){
  return <div className="card min-w-0 p-3 sm:p-4 flex items-center gap-3 sm:gap-4"><div className={`w-9 h-9 sm:w-10 sm:h-10 ${iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>{icon}</div><div className="min-w-0 flex-1"><p className="text-xs leading-tight text-surface-200/50 break-words">{label}</p><p className="mt-1 text-lg sm:text-xl leading-tight font-bold text-surface-50 break-words tabular-nums">{value}</p></div></div>
}
