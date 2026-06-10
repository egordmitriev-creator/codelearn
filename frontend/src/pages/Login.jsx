import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogoIcon } from '../components/Icons'

export default function Login() {
  const [form, setForm] = useState({ username:'', password:'' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const nav = useNavigate()

  const submit = async (e) => {
    e.preventDefault(); setLoading(true); setError('')
    try { await login(form.username, form.password); nav('/courses') }
    catch (err) { setError(err.response?.data?.error || 'Ошибка входа') }
    finally { setLoading(false) }
  }

  const fill = (role) => role === 'teacher'
    ? setForm({ username:'teacher', password:'teacher123' })
    : setForm({ username:'student', password:'student123' })

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'linear-gradient(135deg,#eff6ff 0%,#f0f9ff 50%,#f0fdf4 100%)' }}>
      <div style={{ width:'100%', maxWidth:400, padding:'0 24px' }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ display:'flex', justifyContent:'center', marginBottom:14 }}>
            <LogoIcon size={56} />
          </div>
          <h1 style={{ fontSize:26, fontWeight:800, color:'#0f172a', letterSpacing:'-0.5px' }}>CodeLearn</h1>
          <p style={{ color:'#64748b', marginTop:6, fontSize:14 }}>Платформа обучения программированию</p>
        </div>

        <div className="card" style={{ borderRadius:14 }}>
          <h2 style={{ marginBottom:18, fontSize:18, fontWeight:700, color:'#0f172a' }}>Вход в систему</h2>

          {error && <div style={{ background:'#fee2e2', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', color:'#991b1b', marginBottom:14, fontSize:14 }}>{error}</div>}

          <form onSubmit={submit}>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', marginBottom:5, fontSize:13, fontWeight:600, color:'#374151' }}>Имя пользователя</label>
              <input value={form.username} onChange={e => setForm(p=>({...p,username:e.target.value}))} required placeholder="Введите логин" />
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={{ display:'block', marginBottom:5, fontSize:13, fontWeight:600, color:'#374151' }}>Пароль</label>
              <input type="password" value={form.password} onChange={e => setForm(p=>({...p,password:e.target.value}))} required placeholder="••••••••" />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{ width:'100%', justifyContent:'center', padding:'10px', fontSize:14, borderRadius:9 }}>
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>

          <p style={{ textAlign:'center', marginTop:16, color:'#64748b', fontSize:13 }}>
            Нет аккаунта? <Link to="/register" style={{ color:'#2563eb', fontWeight:600 }}>Зарегистрироваться</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
