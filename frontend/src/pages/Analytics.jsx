import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../api'
import { Icon } from '../components/Icons'

function ScoreBadge({ score }) {
  if (score == null) return <span style={{ color:'var(--text3)', fontSize:13 }}>—</span>
  const color = score >= 80 ? 'var(--green)' : score >= 50 ? 'var(--yellow)' : 'var(--red)'
  return <span style={{ fontWeight:700, color, fontSize:13 }}>{score}%</span>
}

function ProgressBar({ value, max, color = 'var(--accent)' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height:6, background:'var(--border)', borderRadius:99 }}>
        <div style={{ height:6, borderRadius:99, background: value===max ? 'var(--green)' : color, width:`${pct}%`, transition:'width 0.4s' }} />
      </div>
      <span style={{ fontSize:12, color:'var(--text3)', minWidth:40, textAlign:'right' }}>{value}/{max}</span>
    </div>
  )
}

export default function Analytics() {
  const { id } = useParams()
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeStudent, setActiveStudent] = useState(null)
  const [tab, setTab] = useState('overview') // overview | students | items

  useEffect(() => {
    Promise.all([api.get(`/courses/${id}/analytics`), api.get(`/courses/${id}`)]).then(([a, c]) => {
      setData(a.data); setCourse(c.data); setLoading(false)
    })
  }, [id])

  if (loading) return <div className="spinner" />

  const { students, modules, all_items } = data
  const totalTasks = all_items.length
  const avgAll = students.length > 0
    ? Math.round(students.filter(s=>s.avg_score!=null).reduce((a,s)=>a+(s.avg_score||0),0) / (students.filter(s=>s.avg_score!=null).length||1))
    : null

  return (
    <div className="page">
      <button className="btn btn-secondary btn-sm" onClick={()=>nav(`/courses/${id}`)} style={{ marginBottom:16 }}>← Назад к курсу</button>
      <div className="page-header">
        <div>
          <h1 className="page-title">Успеваемость</h1>
          <p style={{ color:'var(--text2)', marginTop:4 }}>{course?.title}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:28 }}>
        {[
          { label:'Студентов', value: students.length, iconName:'users', color:'var(--accent)' },
          { label:'Всего заданий', value: totalTasks, iconName:'courses', color:'var(--accent2)' },
          { label:'Средний балл', value: avgAll != null ? `${avgAll}%` : '—', iconName:'chart', color: avgAll>=80?'var(--green)':avgAll>=50?'var(--yellow)':'var(--red)' },
          { label:'Модулей', value: modules.length, iconName:'module', color:'#7c3aed' },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding:'16px 20px', textAlign:'center' }}>
            <Icon name={c.iconName} size={28} color={c.color} style={{margin:'0 auto 6px'}} />
            <div style={{ fontSize:26, fontWeight:700, color:c.color }}>{c.value}</div>
            <div style={{ fontSize:13, color:'var(--text2)', marginTop:2 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, background:'#f1f5f9', padding:4, borderRadius:10, width:'fit-content' }}>
        {[['overview','Обзор'],['students','Студенты'],['items','Задания']].map(([k,l]) => (
          <button key={k} onClick={()=>setTab(k)} style={{
            padding:'7px 18px', borderRadius:7, fontWeight:600, fontSize:14,
            background: tab===k ? 'var(--accent)' : 'transparent',
            color: tab===k ? 'white' : 'var(--text2)', border:'none', cursor:'pointer'
          }}>{l}</button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div>
          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:14 }}>По модулям</h2>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:14, marginBottom:28 }}>
            {modules.map(m => (
              <div key={m.id} className="card">
                <h3 style={{ fontWeight:600, fontSize:15, marginBottom:10 }}>{m.title}</h3>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'var(--text2)', marginBottom:10 }}>
                  <span>Количество заданий: {m.total_items}</span>
                  <ScoreBadge score={m.avg_score} />
                </div>
                <div style={{ height:6, background:'var(--border)', borderRadius:99 }}>
                  <div style={{ height:6, borderRadius:99, background: m.avg_score>=80?'var(--green)':m.avg_score>=50?'var(--yellow)':'var(--accent)', width:`${m.avg_score||0}%` }} />
                </div>
              </div>
            ))}
          </div>

          <h2 style={{ fontSize:18, fontWeight:700, marginBottom:14 }}>Активность студентов</h2>
          <div className="card" style={{ padding:0, overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--bg3)', borderBottom:'1px solid var(--border)' }}>
                  {['Студент','Выполнено','Ср. балл','Прогресс'].map(h =>
                    <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:13, color:'var(--text2)', fontWeight:600 }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id} style={{ borderBottom:'1px solid var(--border)', cursor:'pointer' }}
                    onMouseEnter={e=>e.currentTarget.style.background='var(--bg3)'}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}
                    onClick={()=>{ setActiveStudent(s.id===activeStudent?null:s.id); setTab('students') }}>
                    <td style={{ padding:'12px 16px', fontWeight:600 }}>{s.username}</td>
                    <td style={{ padding:'12px 16px', fontSize:13 }}>{s.done}/{s.total_tasks}</td>
                    <td style={{ padding:'12px 16px' }}><ScoreBadge score={s.avg_score} /></td>
                    <td style={{ padding:'12px 16px', minWidth:160 }}><ProgressBar value={s.done} max={s.total_tasks} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Students tab */}
      {tab === 'students' && (
        <div style={{ display:'grid', gridTemplateColumns: activeStudent ? '280px 1fr' : '1fr', gap:20 }}>
          <div>
            {students.map(s => (
              <div key={s.id} className="card" style={{
                marginBottom:10, cursor:'pointer', padding:'14px 16px',
                borderColor: activeStudent===s.id ? 'var(--accent)' : 'var(--border)',
                transition:'border-color 0.15s'
              }} onClick={()=>setActiveStudent(activeStudent===s.id ? null : s.id)}>
                <div style={{ fontWeight:600, marginBottom:6 }}>{s.username}</div>
                <div style={{ fontSize:13, color:'var(--text2)', marginBottom:8 }}>{s.email}</div>
                <ProgressBar value={s.done} max={s.total_tasks} />
                <div style={{ display:'flex', justifyContent:'space-between', marginTop:6, fontSize:12, color:'var(--text3)' }}>
                  <span>Средний балл</span><ScoreBadge score={s.avg_score} />
                </div>
              </div>
            ))}
          </div>

          {activeStudent && (() => {
            const s = students.find(st=>st.id===activeStudent)
            if (!s) return null
            return (
              <div>
                <div className="card" style={{ marginBottom:14 }}>
                  <h3 style={{ fontWeight:700, fontSize:18, marginBottom:4 }}>{s.username}</h3>
                  <p style={{ color:'var(--text2)', fontSize:14 }}>{s.email}</p>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginTop:14 }}>
                    {[
                      { label:'Выполнено', value:`${s.done}/${s.total_tasks}` },
                      { label:'Средний балл', value: s.avg_score!=null?`${s.avg_score}%`:'—' },
                      { label:'Прогресс', value:`${s.total_tasks>0?Math.round(s.done/s.total_tasks*100):0}%` },
                    ].map(c => (
                      <div key={c.label} style={{ background:'#f1f5f9', borderRadius:8, padding:'10px 14px', textAlign:'center' }}>
                        <div style={{ fontWeight:700, fontSize:18, color:'var(--accent)' }}>{c.value}</div>
                        <div style={{ fontSize:12, color:'var(--text2)' }}>{c.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {modules.map(m => {
                  const mItems = all_items.filter(i=>i.module_id===m.id)
                  if (!mItems.length) return null
                  return (
                    <div key={m.id} className="card" style={{ marginBottom:12 }}>
                      <h4 style={{ fontWeight:600, marginBottom:10 }}>{m.title}</h4>
                      {mItems.map(it => {
                        const sub = s.submissions[it.id]
                        return (
                          <div key={it.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderBottom:'1px solid var(--border)', fontSize:13 }}>
                            <div>
                              <span style={{ color:'var(--text2)' }}>{it.task_title || 'Задание'}</span>
                              <span style={{ fontSize:11, marginLeft:6, color:'var(--text3)', background:'var(--bg3)', padding:'1px 6px', borderRadius:99 }}>
                                {it.block_title}
                              </span>
                            </div>
                            {sub ? <ScoreBadge score={sub.score} /> : <span style={{ color:'var(--text3)', fontSize:12 }}>Не сдано</span>}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </div>
      )}

      {/* Items tab */}
      {tab === 'items' && (
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ background:'var(--bg3)', borderBottom:'1px solid var(--border)' }}>
                {['Задание','Тип','Блок','Модуль','Сдали','Ср. балл'].map(h =>
                  <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:13, color:'var(--text2)', fontWeight:600 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {all_items.map(it => {
                const subs = students.map(s=>s.submissions[it.id]).filter(Boolean)
                const done = subs.length
                const scores = subs.map(s=>s.score).filter(s=>s!=null)
                const avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null
                return (
                  <tr key={it.id} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'10px 14px', fontWeight:500, fontSize:13 }}>{it.task_title}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <span className={`badge ${it.task_type==='code'?'badge-blue':'badge-yellow'}`} style={{ fontSize:11 }}>
                        {it.task_type==='code'?'Код':'Тест'}
                      </span>
                    </td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text2)' }}>{it.block_title}</td>
                    <td style={{ padding:'10px 14px', fontSize:12, color:'var(--text2)' }}>{it.module_title}</td>
                    <td style={{ padding:'10px 14px', fontSize:13 }}>
                      <span style={{ color: done===students.length?'var(--green)':'var(--text2)' }}>{done}/{students.length}</span>
                    </td>
                    <td style={{ padding:'10px 14px' }}><ScoreBadge score={avg} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
