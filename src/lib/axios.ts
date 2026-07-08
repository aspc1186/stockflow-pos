import axios from 'axios'
const api = axios.create({ baseURL: '/api', timeout: 15000 })
api.interceptors.request.use(c => { const t=localStorage.getItem('pos_token'); if(t) c.headers.Authorization=`Bearer ${t}`; return c })
api.interceptors.response.use(r=>r, e => { if(e.response?.status===401){localStorage.removeItem('pos_token');localStorage.removeItem('pos_user');window.location.href='/login'} return Promise.reject(e) })
export default api
