import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icons'
import api from '../api'

export default function Courses() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ title:'', description:'' })

  const load = () => api.get('/courses').then(r => setCourses(r.data)).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const create = async (e) => {
    e.preventDefault()
    await api.post('/courses', form)
    setForm({ title:'', description:'' }); setShowCreate(false); load()
  }

  const enroll = async (id) => { await api.post(`/courses/${id}/enroll`); load() }

  if (loading) return <div className="spinner" />

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Курсы</h1>
          <p style={{ color:'var(--text2)', marginTop:4, fontSize:14 }}>
            {user.role === 'teacher' ? 'Управляйте своими курсами' : 'Ваши учебные курсы'}
          </p>
        </div>
        {user.role === 'teacher' && (
          <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
            <Icon name="plus" size={15} color="white" /> Создать курс
          </button>
        )}
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom:22 }}>
          <h3 style={{ fontWeight:700, marginBottom:14 }}>Новый курс</h3>
          <form onSubmit={create}>
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block', marginBottom:5, fontSize:13, fontWeight:600, color:'var(--text2)' }}>Название</label>
              <input value={form.title} onChange={e => setForm(p=>({...p,title:e.target.value}))} required placeholder="Название курса" />
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', marginBottom:5, fontSize:13, fontWeight:600, color:'var(--text2)' }}>Описание</label>
              <textarea value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))} rows={2} placeholder="Краткое описание..." />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary" type="submit">Создать</button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowCreate(false)}>Отмена</button>
            </div>
          </form>
        </div>
      )}

      {courses.length === 0 ? (
        <div className="empty-state">
          <Icon name="courses" size={44} color="#cbd5e1" style={{ margin:'0 auto 14px' }} />
          <h3 style={{ marginBottom:8, fontWeight:700 }}>Курсов пока нет</h3>
          <p style={{ color:'var(--text3)' }}>{user.role === 'teacher' ? 'Создайте первый курс' : 'Курсы появятся здесь после записи'}</p>
        </div>
      ) : (
        <div className="grid-2">
          {courses.map(c => (
            <div key={c.id} className="card" style={{ cursor:'pointer', transition:'all 0.2s', display:'flex', flexDirection:'column', gap:12 }}
              onMouseEnter={e => { e.currentTarget.style.borderColor='var(--accent)'; e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.boxShadow='0 8px 24px rgba(37,99,235,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='none'; e.currentTarget.style.boxShadow='var(--shadow)' }}
              onClick={() => nav(`/courses/${c.id}`)}>
              <h3 style={{ fontWeight:700, fontSize:16, color:'var(--text)', lineHeight:1.3 }}>{c.title}</h3>
              <p style={{ color:'var(--text2)', fontSize:14, lineHeight:1.55, flex:1 }}>{c.description || 'Нет описания'}</p>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:10, borderTop:'1px solid var(--border)' }}>
                <div style={{ display:'flex', gap:12 }}>
                  <span style={{ fontSize:13, color:'var(--text3)', display:'flex', alignItems:'center', gap:5 }}>
                    <Icon name="users" size={13} color="var(--text3)" />{c.teacher_name}
                  </span>
                  <span style={{ fontSize:13, color:'var(--text3)', display:'flex', alignItems:'center', gap:5 }}>
                    <Icon name="users" size={13} color="var(--text3)" />{c.student_count || 0}
                  </span>
                </div>
                {user.role === 'student' && !c.enrolled
                  ? <button className="btn btn-primary btn-sm" onClick={e => { e.stopPropagation(); enroll(c.id) }}>Записаться</button>
                  : <span style={{ fontSize:13, fontWeight:600, color:'var(--accent)', display:'flex', alignItems:'center', gap:4 }}>Открыть <Icon name="chevronRight" size={13} color="var(--accent)" /></span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
