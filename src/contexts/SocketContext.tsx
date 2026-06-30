import React,{createContext,useContext,useEffect,useRef,useState} from 'react'
import {io,Socket} from 'socket.io-client'
import {useAuth} from './AuthContext'
interface SocketCtx{socket:Socket|null;connected:boolean;on:(e:string,cb:(d:unknown)=>void)=>void;off:(e:string,cb:(d:unknown)=>void)=>void;emit:(e:string,d?:unknown)=>void}
const SocketContext=createContext<SocketCtx|null>(null)
export function SocketProvider({children}:{children:React.ReactNode}){
  const {user}=useAuth();const socketRef=useRef<Socket|null>(null);const [connected,setConnected]=useState(false)
  useEffect(()=>{
    if(!user?.token)return
    const url=import.meta.env.VITE_SOCKET_URL||''
    if(!url)return
    const s=io(url,{auth:{token:user.token},transports:['websocket'],reconnectionAttempts:5})
    s.on('connect',()=>setConnected(true));s.on('disconnect',()=>setConnected(false))
    socketRef.current=s
    return()=>{s.disconnect();socketRef.current=null;setConnected(false)}
  },[user?.token])
  const on=(e:string,cb:(d:unknown)=>void)=>socketRef.current?.on(e,cb)
  const off=(e:string,cb:(d:unknown)=>void)=>socketRef.current?.off(e,cb)
  const emit=(e:string,d?:unknown)=>socketRef.current?.emit(e,d)
  return <SocketContext.Provider value={{socket:socketRef.current,connected,on,off,emit}}>{children}</SocketContext.Provider>
}
export function useSocket(){const c=useContext(SocketContext);if(!c)throw new Error('useSocket');return c}
