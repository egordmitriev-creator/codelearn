import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api'

export default function Register() {
  const [form, setForm] = useState({ username:'', email:'', password:'', role:'student' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const nav = useNavigate()

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try { await api.post('/auth/register', form); nav('/login') }
    catch (err) { setError(err.response?.data?.error || 'Ошибка регистрации') }
    finally { setLoading(false) }
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'linear-gradient(135deg, #eff6ff 0%, #f0f9ff 50%, #f0fdf4 100%)' }}>
      <div style={{ width:'100%', maxWidth:420, padding:'0 24px' }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ width:56, height:56, borderRadius:16, background:'#2563eb', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>⌨️</div>
          <h1 style={{ fontSize:24, fontWeight:800, color:'#0f172a' }}>Регистрация</h1>
        </div>
        <div className="card" style={{ borderRadius:16 }}>
          {error && <div style={{ background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', color:'#991b1b', marginBottom:16, fontSize:14 }}>{error}</div>}
          <form onSubmit={submit}>
            {[['username','Имя пользователя','text'],['email','Email','email'],['password','Пароль','password']].map(([k,l,t]) => (
              <div key={k} style={{ marginBottom:14 }}>
                <label style={{ display:'block', marginBottom:6, fontSize:14, fontWeight:600, color:'#374151' }}>{l}</label>
                <input type={t} value={form[k]} onChange={e => setForm(p=>({...p,[k]:e.target.value}))} required />
              </div>
            ))}
            <div style={{ marginBottom:22 }}>
              <label style={{ display:'block', marginBottom:6, fontSize:14, fontWeight:600, color:'#374151' }}>Роль</label>
              <select value={form.role} onChange={e => setForm(p=>({...p,role:e.target.value}))}>
                <option value="student">🎓 Студент</option>
                <option value="teacher">👨‍🏫 Преподаватель</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width:'100%', justifyContent:'center', padding:'11px', fontSize:15, borderRadius:10 }}>
              {loading ? 'Создание...' : 'Создать аккаунт'}
            </button>
          </form>
          <p style={{ textAlign:'center', marginTop:18, color:'#64748b', fontSize:14 }}>
            Уже есть аккаунт? <Link to="/login" style={{ color:'#2563eb', fontWeight:600 }}>Войти</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
