import React,{createContext,useContext,useState,useEffect,useCallback} from 'react'
import type {AuthUser} from '@/types'
import api from '@/lib/axios'
interface AuthCtx {
  user:AuthUser|null;loading:boolean
  login:(u:string,p:string)=>Promise<void>;logout:()=>void
  refreshUser:()=>Promise<void>;isRole:(...r:string[])=>boolean
  isSuperAdmin:boolean;isAdmin:boolean
}
const AuthContext=createContext<AuthCtx|null>(null)
export function AuthProvider({children}:{children:React.ReactNode}){
  const [user,setUser]=useState<AuthUser|null>(null)
  const [loading,setLoading]=useState(true)
  useEffect(()=>{
    const s=localStorage.getItem('pos_user'),t=localStorage.getItem('pos_token')
    if(s&&t){try{setUser({...JSON.parse(s),token:t})}catch{localStorage.removeItem('pos_user');localStorage.removeItem('pos_token')}}
    setLoading(false)
  },[])
  const login=useCallback(async(username:string,password:string)=>{
    const {data}=await api.post<{user:AuthUser;token:string}>('/auth/login',{username,password})
    localStorage.setItem('pos_token',data.token);localStorage.setItem('pos_user',JSON.stringify(data.user))
    setUser({...data.user,token:data.token})
  },[])
  const logout=useCallback(()=>{
    localStorage.removeItem('pos_token');localStorage.removeItem('pos_user');setUser(null);window.location.href='/login'
  },[])
  const refreshUser=useCallback(async()=>{
    try{const {data}=await api.get<AuthUser>('/auth/me');const t=localStorage.getItem('pos_token')||''
    const u={...data,token:t};localStorage.setItem('pos_user',JSON.stringify(u));setUser(u)}catch{logout()}
  },[logout])
  const isRole=useCallback((...r:string[])=>!!user?.rol&&r.includes(user.rol.nombre),[user])
  const isSuperAdmin=user?.rol?.nombre==='superadmin'
  const isAdmin=user?.rol?.nombre==='admin'||isSuperAdmin
  return <AuthContext.Provider value={{user,loading,login,logout,refreshUser,isRole,isSuperAdmin,isAdmin}}>{children}</AuthContext.Provider>
}
export function useAuth(){const c=useContext(AuthContext);if(!c)throw new Error('useAuth');return c}
