import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Icon } from '../components/Icons'
import api from '../api'

const BLOCK_TYPE_META = {
  theory:     { label:'Теория',    icon:'book',       color:'#0891b2', bg:'rgba(8,145,178,0.08)'   },
  practice:   { label:'Практика',  icon:'code',       color:'#059669', bg:'rgba(5,150,105,0.08)'   },
  assessment: { label:'Оценочный', icon:'checkSquare',color:'#d97706', bg:'rgba(217,119,6,0.08)'   },
}

function ModuleProgress({ blocks }) {
  const items = blocks.flatMap(b => b.items.filter(i => i.item_type === 'task'))
  if (!items.length) return null
  const done = items.filter(i => i.my_submission?.status === 'graded').length
  const pct = Math.round((done / items.length) * 100)
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'var(--text3)', marginBottom:4 }}>
        <span>Прогресс</span><span>{done}/{items.length} заданий</span>
      </div>
      <div style={{ height:4, background:'#e2e8f0', borderRadius:99 }}>
        <div style={{ height:4, background: pct===100 ? 'var(--green)' : 'var(--accent)', borderRadius:99, width:`${pct}%`, transition:'width 0.4s' }} />
      </div>
    </div>
  )
}

export default function CourseDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const [course, setCourse] = useState(null)
  const [modules, setModules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreateModule, setShowCreateModule] = useState(false)
  const [moduleForm, setModuleForm] = useState({ title:'', description:'', deadline:'' })
  const [expanded, setExpanded] = useState({})

  const load = async () => {
    const [c, m] = await Promise.all([api.get(`/courses/${id}`), api.get(`/courses/${id}/modules`)])
    setCourse(c.data); setModules(m.data)
    const exp = {}; m.data.forEach(m => { exp[m.id] = true }); setExpanded(exp)
    setLoading(false)
  }
  useEffect(() => { load() }, [id])

  const createModule = async (e) => {
    e.preventDefault()
    await api.post(`/courses/${id}/modules`, moduleForm)
    setModuleForm({ title:'', description:'', deadline:'' }); setShowCreateModule(false); load()
  }

  const deleteModule = async (mid, e) => {
    e.stopPropagation()
    if (!confirm('Удалить модуль со всем содержимым?')) return
    await api.delete(`/modules/${mid}`); load()
  }

  const toggle = (mid) => setExpanded(p => ({ ...p, [mid]: !p[mid] }))

  if (loading) return <div className="spinner" />

  return (
    <div className="page">
      <button className="btn btn-secondary btn-sm" onClick={() => nav('/courses')} style={{ marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
        <Icon name="chevronRight" size={13} style={{ transform:'rotate(180deg)' }} /> Назад
      </button>
      <div className="page-header">
        <div>
          <h1 className="page-title">{course?.title}</h1>
          <p style={{ color:'var(--text2)', marginTop:4, fontSize:14 }}>Преподаватель: {course?.teacher_name}</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {user.role === 'teacher' && <>
            <button className="btn btn-secondary" onClick={() => nav(`/courses/${id}/analytics`)}>
              <Icon name="chart" size={15} /> Успеваемость
            </button>
            <button className="btn btn-primary" onClick={() => setShowCreateModule(true)}>
              <Icon name="plus" size={15} color="white" /> Модуль
            </button>
          </>}
        </div>
      </div>

      {course?.description && (
        <div className="card" style={{ marginBottom:20, padding:'12px 18px' }}>
          <p style={{ color:'var(--text2)', fontSize:14 }}>{course.description}</p>
        </div>
      )}

      {showCreateModule && (
        <div className="card" style={{ marginBottom:20 }}>
          <h3 style={{ fontWeight:700, marginBottom:14 }}>Новый модуль</h3>
          <form onSubmit={createModule}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
              <div><label style={{ display:'block', marginBottom:5, fontSize:13, fontWeight:600, color:'var(--text2)' }}>Название</label>
                <input value={moduleForm.title} onChange={e=>setModuleForm(p=>({...p,title:e.target.value}))} required /></div>
              <div><label style={{ display:'block', marginBottom:5, fontSize:13, fontWeight:600, color:'var(--text2)' }}>Срок выполнения</label>
                <input type="date" value={moduleForm.deadline} onChange={e=>setModuleForm(p=>({...p,deadline:e.target.value}))} /></div>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', marginBottom:5, fontSize:13, fontWeight:600, color:'var(--text2)' }}>Описание</label>
              <textarea value={moduleForm.description} onChange={e=>setModuleForm(p=>({...p,description:e.target.value}))} rows={2} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn btn-primary" type="submit">Создать</button>
              <button className="btn btn-secondary" type="button" onClick={()=>setShowCreateModule(false)}>Отмена</button>
            </div>
          </form>
        </div>
      )}

      {modules.length === 0 ? (
        <div className="empty-state">
          <Icon name="module" size={44} color="#cbd5e1" style={{ margin:'0 auto 14px' }} />
          <h3>Модулей пока нет</h3>
          {user.role==='teacher' && <p>Нажмите «+ Модуль» чтобы начать</p>}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {modules.map((m, mi) => {
            const isOpen = expanded[m.id]
            const deadline = m.deadline ? new Date(m.deadline) : null
            const overdue = deadline && deadline < new Date()
            return (
              <div key={m.id} className="card" style={{ padding:0, overflow:'hidden' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', cursor:'pointer', background:'#f8fafc', borderBottom: isOpen ? '1px solid var(--border)' : 'none' }}
                  onClick={() => toggle(m.id)}>
                  <div style={{ width:30, height:30, borderRadius:8, background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, color:'white', flexShrink:0, fontSize:13 }}>{mi+1}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                      <span style={{ fontWeight:700, fontSize:15 }}>{m.title}</span>
                      {deadline && (
                        <span style={{ fontSize:12, display:'flex', alignItems:'center', gap:4,
                          color: overdue ? '#991b1b' : '#64748b',
                          background: overdue ? '#fee2e2' : '#f1f5f9',
                          padding:'2px 8px', borderRadius:99, border: overdue ? '1px solid #fca5a5' : 'none' }}>
                          <Icon name="calendar" size={11} color={overdue ? '#991b1b' : '#64748b'} />
                          {overdue ? 'Просрочен:' : 'До:'} {m.deadline}
                        </span>
                      )}
                    </div>
                    {m.description && <p style={{ fontSize:13, color:'var(--text2)', marginTop:2 }}>{m.description}</p>}
                    {user.role === 'student' && <ModuleProgress blocks={m.blocks} />}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    {user.role === 'teacher' && <>
                      <button className="btn btn-primary btn-sm" onClick={e=>{e.stopPropagation();nav(`/modules/${m.id}`)}}>Редактировать</button>
                      <button className="btn btn-danger btn-sm" onClick={e=>deleteModule(m.id,e)}><Icon name="trash" size={13} color="white" /></button>
                    </>}
                    {user.role === 'student' && (
                      <button className="btn btn-primary btn-sm" onClick={e=>{e.stopPropagation();nav(`/modules/${m.id}`)}}>
                        Открыть <Icon name="chevronRight" size={13} color="white" />
                      </button>
                    )}
                    <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={18} color="var(--text3)" />
                  </div>
                </div>

                {isOpen && (
                  <div style={{ padding:'12px 18px 14px', display:'flex', flexDirection:'column', gap:7 }}>
                    {m.blocks.length === 0 ? (
                      <p style={{ color:'var(--text3)', fontSize:13 }}>Блоков пока нет</p>
                    ) : m.blocks.map(b => {
                      const meta = BLOCK_TYPE_META[b.block_type] || BLOCK_TYPE_META.theory
                      const taskItems = b.items.filter(i => i.item_type === 'task')
                      const theoryItems = b.items.filter(i => i.item_type === 'theory')
                      const done = taskItems.filter(i => i.my_submission?.status === 'graded').length
                      return (
                        <div key={b.id} style={{ display:'flex', alignItems:'center', gap:11, padding:'9px 13px',
                          background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:8,
                          cursor:'pointer', transition:'border-color 0.15s' }}
                          onMouseEnter={e=>e.currentTarget.style.borderColor=meta.color}
                          onMouseLeave={e=>e.currentTarget.style.borderColor='#e2e8f0'}
                          onClick={()=>nav(`/modules/${m.id}`)}>
                          <div style={{ width:30, height:30, borderRadius:7, background:meta.bg,
                            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <Icon name={meta.icon} size={15} color={meta.color} />
                          </div>
                          <div style={{ flex:1 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                              <span style={{ fontWeight:600, fontSize:14 }}>{b.title}</span>
                              <span style={{ fontSize:11, fontWeight:600, padding:'2px 8px', borderRadius:99,
                                background:meta.bg, color:meta.color }}>{meta.label}</span>
                            </div>
                            <div style={{ fontSize:12, color:'var(--text3)', marginTop:2, display:'flex', gap:10 }}>
                              {theoryItems.length > 0 && <span>{theoryItems.length} теор.</span>}
                              {taskItems.length > 0 && <span>{taskItems.length} задан.</span>}
                              {taskItems.length > 0 && user.role==='student' && (
                                <span style={{ color: done===taskItems.length ? 'var(--green)' : 'var(--text3)', display:'flex', alignItems:'center', gap:3 }}>
                                  {done===taskItems.length && <Icon name="check" size={11} color="var(--green)" />} {done}/{taskItems.length}
                                </span>
                              )}
                            </div>
                          </div>
                          <Icon name="chevronRight" size={15} color="var(--text3)" />
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
