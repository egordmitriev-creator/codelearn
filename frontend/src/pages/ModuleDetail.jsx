import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api'
import { renderMarkdown, mdCss } from '../lib/markdown'
import { Icon } from '../components/Icons'

const BLOCK_META = {
  theory:     { label:'Теория',    icon:'book',        color:'#0891b2', bg:'rgba(8,145,178,0.08)'  },
  practice:   { label:'Практика',  icon:'code',        color:'#059669', bg:'rgba(5,150,105,0.08)'  },
  assessment: { label:'Оценочный', icon:'checkSquare', color:'#d97706', bg:'rgba(217,119,6,0.08)'  },
}

const TASK_TYPE_META = {
  code:  { label:'Код',          iconName:'code',  badge:'badge-blue'   },
  quiz:  { label:'Один ответ',   iconName:'quiz',  badge:'badge-yellow' },
  multi: { label:'Множ. выбор',  iconName:'multi', badge:'badge-cyan'   },
  text:  { label:'Ввод ответа',  iconName:'text',  badge:'badge-green'  },
}

function MdView({ content }) {
  return <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
}

function CodeEditor({ value, onChange, readOnly }) {
  const ta = useRef()
  return (
    <textarea ref={ta} value={value} onChange={e => onChange(e.target.value)} readOnly={readOnly}
      style={{ width:'100%', minHeight:200, background:'#0d1117', color:'#e6edf3',
        fontFamily:'var(--mono)', fontSize:13, padding:14, border:'none',
        borderRadius:8, resize:'vertical', lineHeight:1.6, outline:'none' }}
      onKeyDown={e => {
        if (e.key === 'Tab') {
          e.preventDefault()
          const s = e.target.selectionStart
          const v = value.substring(0, s) + '    ' + value.substring(e.target.selectionEnd)
          onChange(v)
          setTimeout(() => { ta.current.selectionStart = ta.current.selectionEnd = s + 4 }, 0)
        }
      }} />
  )
}

function RunResults({ results, passed, total, all_passed, runner }) {
  return (
    <div style={{ background:'#f8fafc', border:'1.5px solid #e2e8f0', borderRadius:10, padding:'14px 16px', marginTop:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
        <span style={{ fontWeight:600, fontSize:14 }}>Результат проверки</span>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <span style={{ fontSize:11, color:'var(--text3)', background:'var(--bg3)', padding:'2px 8px', borderRadius:99 }}>
            {runner === 'docker' ? 'Docker' : 'Python'}
          </span>
          <span className={`badge ${all_passed ? 'badge-green' : 'badge-red'}`}>{passed}/{total} тестов</span>
        </div>
      </div>
      {results.map((r, i) => (
        <div key={i} style={{ padding:'8px 10px', borderRadius:6, marginBottom:6, fontSize:13,
          background: r.passed ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
          border:`1px solid ${r.passed ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <span style={{ fontFamily:'var(--mono)', color:'var(--text2)' }}>
              Тест {i+1}: ввод <code style={{ color:'var(--accent2)' }}>{r.input || '—'}</code>
              {' → '}<code style={{ color: r.passed ? 'var(--green)' : 'var(--red)' }}>{r.got || '(пусто)'}</code>
              <span style={{ color:'var(--text3)' }}> (ожид: <code>{r.expected}</code>)</span>
            </span>
            <span>{r.passed ? '✓' : '✗'}</span>
          </div>
          {r.error && <div style={{ fontSize:11, color:'var(--red)', fontFamily:'var(--mono)', marginTop:4 }}>{r.error}</div>}
        </div>
      ))}
      {all_passed && <div style={{ padding:'8px 12px', background:'rgba(16,185,129,0.1)', borderRadius:6, color:'var(--green)', fontWeight:600, textAlign:'center', marginTop:4 }}>Все видимые тесты пройдены!</div>}
    </div>
  )
}

function SubmitResult({ score, result, taskType }) {
  if (score == null) return null
  const ok = score >= 80
  return (
    <div style={{ padding:'12px 16px', borderRadius:8, marginTop:10,
      background: ok ? '#f0fdf4' : '#fef2f2',
      border:`1.5px solid ${ok ? '#86efac' : '#fca5a5'}` }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontWeight:600 }}>Результат сдачи</span>
        <span style={{ fontSize:22, fontWeight:700, color: ok ? 'var(--green)' : 'var(--red)' }}>{score}%</span>
      </div>
      {taskType === 'quiz' && result && (
        <p style={{ color: result.correct ? 'var(--green)' : 'var(--red)', fontSize:14 }}>
          {result.correct ? 'Правильно!' : `Неверно. Правильный ответ: ${result.expected}`}
        </p>
      )}
      {taskType === 'multi' && result && (
        <div style={{ fontSize:13 }}>
          <p style={{ color: result.correct ? 'var(--green)' : 'var(--yellow)', marginBottom:6 }}>
            {result.correct ? 'Все правильно!' : `Частичный результат`}
          </p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {result.correct_answers?.map((a, i) => {
              const wasSelected = result.selected?.includes(a)
              return <span key={i} style={{ padding:'3px 10px', borderRadius:99, fontSize:12, fontWeight:600,
                background: wasSelected ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.1)',
                color: wasSelected ? 'var(--green)' : 'var(--red)' }}>
                {wasSelected ? '✓' : '✗'} {a}
              </span>
            })}
            {result.selected?.filter(s => !result.correct_answers?.includes(s)).map((a,i) => (
              <span key={`wrong-${i}`} style={{ padding:'3px 10px', borderRadius:99, fontSize:12, fontWeight:600,
                background:'rgba(239,68,68,0.1)', color:'var(--red)' }}>✗ {a} (лишний)</span>
            ))}
          </div>
        </div>
      )}
      {taskType === 'text' && result && (
        <p style={{ color: result.correct ? 'var(--green)' : 'var(--red)', fontSize:14 }}>
          {result.correct ? `Верно! Ответ «${result.answer}» принят.` : `Неверно. Ваш ответ: «${result.answer}»`}
        </p>
      )}
      {taskType === 'code' && result?.results && (
        <div>{result.results.map((r, i) => (
          <div key={i} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0', borderBottom:'1px solid var(--border)', fontFamily:'var(--mono)', color:'var(--text2)' }}>
            <span>{r.hidden ? 'Скрытый тест' : `Ввод: ${r.input}`}</span>
            <span>{r.passed ? '✓' : '✗'}</span>
          </div>
        ))}</div>
      )}
    </div>
  )
}

// ── TASK ITEM (student view) ──────────────────────────────────────────────────
function TaskItem({ item, readOnly, onSaved }) {
  const tt = item.task_type
  const savedContent = item.my_submission?.content

  const [code, setCode]           = useState(savedContent && tt === 'code' ? savedContent : '# Ваш код здесь\n\n')
  const [selected, setSelected]   = useState(savedContent && tt === 'quiz' ? savedContent : '')
  const [multiSel, setMultiSel]   = useState(() => {
    if (savedContent && tt === 'multi') { try { return JSON.parse(savedContent) } catch { return [] } }
    return []
  })
  const [textAns, setTextAns]     = useState(savedContent && tt === 'text' ? savedContent : '')

  const [running, setRunning]     = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [runRes, setRunRes]       = useState(null)
  const [subRes, setSubRes]       = useState(null)
  const [subErr, setSubErr]       = useState('')

  const sub  = item.my_submission
  const used = sub?.attempts || 0
  const mx   = item.max_attempts || 0
  const left = mx > 0 ? mx - used : null
  const exhausted = left !== null && left <= 0

  const toggleMulti = (opt) => {
    if (readOnly || exhausted) return
    setMultiSel(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt])
  }

  const doRun = async () => {
    setRunning(true); setRunRes(null)
    const r = await api.post(`/items/${item.id}/run`, { code })
    setRunRes(r.data); setRunning(false)
  }

  const doSubmit = async () => {
    setSubmitting(true); setSubRes(null); setSubErr('')
    try {
      const content = tt === 'code' ? code
        : tt === 'multi' ? JSON.stringify(multiSel)
        : tt === 'text'  ? textAns
        : selected
      const r = await api.post(`/items/${item.id}/submit`, { content })
      setSubRes(r.data); onSaved?.()
    } catch (e) { setSubErr(e.response?.data?.error || 'Ошибка') }
    setSubmitting(false)
  }

  const ttMeta = TASK_TYPE_META[tt] || TASK_TYPE_META.quiz
  const opts = item.options || []

  const canSubmit = !exhausted && !submitting && (
    tt === 'code'  ? true :
    tt === 'quiz'  ? selected !== '' :
    tt === 'multi' ? multiSel.length > 0 :
    textAns.trim() !== ''
  )

  return (
    <div style={{ marginBottom:20, paddingBottom:20, borderBottom:'1px solid var(--border)' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
        <span style={{ fontWeight:700, fontSize:15 }}>{item.task_title}</span>
        <span className={`badge ${ttMeta.badge}`} style={{display:'inline-flex',alignItems:'center',gap:5}}><Icon name={ttMeta.iconName} size={11} />{ttMeta.label}</span>
        {item.deadline && <span style={{ fontSize:12, color:'var(--text3)' }}>📅 {item.deadline}</span>}
        {mx > 0 && !readOnly && (
          <span style={{ fontSize:12, fontWeight:600, padding:'2px 9px', borderRadius:99,
            color: exhausted ? 'var(--red)' : 'var(--text3)',
            background: exhausted ? 'rgba(239,68,68,0.1)' : 'var(--bg3)' }}>
            {used}/{mx} попыток
          </span>
        )}
        {sub?.status === 'graded' && (
          <span className={`badge ${(sub.score||0)>=80 ? 'badge-green' : (sub.score||0)>=50 ? 'badge-yellow' : 'badge-red'}`}>
            {(sub.score||0) >= 80 ? '✓' : '✗'} {sub.score}%
          </span>
        )}
      </div>

      {/* Description */}
      <div style={{ color:'var(--text2)', lineHeight:1.75, marginBottom:14 }}>
        <MdView content={item.task_description} />
      </div>

      {/* ── CODE ── */}
      {tt === 'code' && (<>
        {item.test_cases?.filter(t => !t.hidden).length > 0 && (
          <div style={{ marginBottom:10 }}>
            {item.test_cases.filter(t => !t.hidden).map((tc, i) => (
              <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr', background:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:6, overflow:'hidden', marginBottom:6, fontSize:13 }}>
                <div style={{ padding:'8px 12px', borderRight:'1px solid #e2e8f0' }}>
                  <div style={{ fontSize:10, color:'var(--text3)', marginBottom:2, textTransform:'uppercase', letterSpacing:1 }}>Ввод</div>
                  <code style={{ fontFamily:'var(--mono)', color:'var(--accent2)', whiteSpace:'pre' }}>{tc.input || '(пусто)'}</code>
                </div>
                <div style={{ padding:'8px 12px' }}>
                  <div style={{ fontSize:10, color:'var(--text3)', marginBottom:2, textTransform:'uppercase', letterSpacing:1 }}>Вывод</div>
                  <code style={{ fontFamily:'var(--mono)', color:'var(--green)', whiteSpace:'pre' }}>{tc.expected}</code>
                </div>
              </div>
            ))}
            {item.test_cases?.filter(t => t.hidden).length > 0 && (
              <p style={{ fontSize:12, color:'var(--text3)' }}>+{item.test_cases.filter(t => t.hidden).length} скрытых</p>
            )}
          </div>
        )}
        <CodeEditor value={code} onChange={setCode} readOnly={readOnly} />
        {!readOnly && !exhausted && (
          <div style={{ display:'flex', gap:8, marginTop:8 }}>
            <button className="btn btn-secondary btn-sm" onClick={doRun} disabled={running}>
              {running ? '⏳ Запуск...' : '▶ Проверить'}
            </button>
            <button className="btn btn-success btn-sm" onClick={doSubmit} disabled={!canSubmit}>
              {submitting ? 'Отправка...' : `Сдать${mx > 0 && left !== null ? ` (${left})` : ''}`}
            </button>
          </div>
        )}
        {runRes && <RunResults {...runRes} />}
      </>)}

      {/* ── QUIZ (single choice) ── */}
      {tt === 'quiz' && (<>
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
          {opts.map((opt, i) => (
            <label key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', cursor: readOnly || exhausted ? 'default' : 'pointer',
              background: selected === opt ? '#eff6ff' : '#f8fafc',
              border:`1.5px solid ${selected === opt ? '#2563eb' : '#e2e8f0'}`,
              borderRadius:8, transition:'all 0.15s', opacity: exhausted ? 0.6 : 1 }}>
              <input type="radio" name={`q_${item.id}`} value={opt} checked={selected === opt}
                onChange={() => { if (!readOnly && !exhausted) setSelected(opt) }}
                disabled={readOnly || exhausted} style={{ width:'auto', accentColor:'var(--accent)' }} />
              <span style={{ fontSize:14 }}>{opt}</span>
            </label>
          ))}
        </div>
        {!readOnly && !exhausted && selected && (
          <button className="btn btn-primary btn-sm" onClick={doSubmit} disabled={!canSubmit}>
            {submitting ? 'Отправка...' : `Отправить${mx > 0 && left !== null ? ` (${left})` : ''}`}
          </button>
        )}
      </>)}

      {/* ── MULTI (multiple choice) ── */}
      {tt === 'multi' && (<>
        <p style={{ fontSize:13, color:'var(--text3)', marginBottom:8 }}>Выберите все правильные варианты:</p>
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
          {opts.map((opt, i) => {
            const checked = multiSel.includes(opt)
            return (
              <label key={i} onClick={() => toggleMulti(opt)} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                cursor: readOnly || exhausted ? 'default' : 'pointer',
                background: checked ? '#ecfeff' : '#f8fafc',
                border:`1.5px solid ${checked ? '#0891b2' : '#e2e8f0'}`,
                borderRadius:8, transition:'all 0.15s', opacity: exhausted ? 0.6 : 1, userSelect:'none' }}>
                <div style={{ width:18, height:18, borderRadius:4, border:`2px solid ${checked ? '#06b6d4' : 'var(--text3)'}`,
                  background: checked ? '#06b6d4' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'all 0.15s' }}>
                  {checked && <span style={{ color:'white', fontSize:12, lineHeight:1 }}>✓</span>}
                </div>
                <span style={{ fontSize:14 }}>{opt}</span>
              </label>
            )
          })}
        </div>
        {!readOnly && !exhausted && (
          <button className="btn btn-primary btn-sm" onClick={doSubmit} disabled={!canSubmit}>
            {submitting ? 'Отправка...' : `Отправить${mx > 0 && left !== null ? ` (${left})` : ''}`}
          </button>
        )}
      </>)}

      {/* ── TEXT (free input) ── */}
      {tt === 'text' && (<>
        <div style={{ marginBottom:10 }}>
          <input value={textAns} onChange={e => { if (!readOnly && !exhausted) setTextAns(e.target.value) }}
            readOnly={readOnly || exhausted} placeholder="Введите ваш ответ..."
            style={{ background: readOnly || exhausted ? 'var(--bg3)' : 'var(--bg3)', opacity: exhausted ? 0.6 : 1 }}
            onKeyDown={e => { if (e.key === 'Enter' && canSubmit) doSubmit() }} />
          <p style={{ fontSize:12, color:'var(--text3)', marginTop:5 }}>Нажмите Enter или кнопку для отправки</p>
        </div>
        {!readOnly && !exhausted && (
          <button className="btn btn-primary btn-sm" onClick={doSubmit} disabled={!canSubmit}>
            {submitting ? 'Отправка...' : `Отправить${mx > 0 && left !== null ? ` (${left})` : ''}`}
          </button>
        )}
      </>)}

      {/* Exhausted */}
      {exhausted && (
        <div style={{ padding:'8px 12px', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:7, color:'#991b1b', fontSize:13, fontWeight:600, marginTop:6 }}>
          Лимит попыток исчерпан
        </div>
      )}

      {subErr && <div style={{ marginTop:8, padding:'8px 12px', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:7, color:'#991b1b', fontSize:13 }}>{subErr}</div>}
      {subRes && <SubmitResult score={subRes.score} result={subRes.result} taskType={tt} />}
      {!subRes && sub?.status === 'graded' && (
        <SubmitResult score={sub.score} result={sub.result ? JSON.parse(sub.result) : null} taskType={tt} />
      )}
    </div>
  )
}

// ── BLOCK PANEL ───────────────────────────────────────────────────────────────
function BlockPanel({ block, isTeacher, onRefresh }) {
  const meta = BLOCK_META[block.block_type] || BLOCK_META.theory
  const [open, setOpen]           = useState(true)
  const [showAddItem, setShowAddItem] = useState(false)
  const [itemType, setItemType]   = useState('theory')
  const [preview, setPreview]     = useState(false)

  const [theoryForm, setTheoryForm] = useState({ theory_title:'', theory_content:'' })
  const emptyTask = () => ({
    task_title:'', task_description:'', task_type:'code', max_attempts:0, deadline:'',
    test_cases:[{ input:'', expected:'', hidden:false }],
    options:['','','',''],
    correct_answer:'',
    correct_answers:[],   // for multi
    accepted_answers:[''] // for text (list of acceptable strings)
  })
  const [taskForm, setTaskForm] = useState(emptyTask())

  const addTC = () => setTaskForm(p => ({ ...p, test_cases:[...p.test_cases, { input:'', expected:'', hidden:false }] }))
  const updTC = (i, k, v) => setTaskForm(p => { const t=[...p.test_cases]; t[i]={...t[i],[k]:v}; return {...p,test_cases:t} })
  const remTC = (i) => setTaskForm(p => ({ ...p, test_cases:p.test_cases.filter((_,j) => j!==i) }))

  const addAccepted = () => setTaskForm(p => ({ ...p, accepted_answers:[...p.accepted_answers, ''] }))
  const updAccepted = (i, v) => setTaskForm(p => { const a=[...p.accepted_answers]; a[i]=v; return {...p,accepted_answers:a} })
  const remAccepted = (i) => setTaskForm(p => ({ ...p, accepted_answers:p.accepted_answers.filter((_,j)=>j!==i) }))

  const toggleCorrectMulti = (opt) => setTaskForm(p => ({
    ...p,
    correct_answers: p.correct_answers.includes(opt)
      ? p.correct_answers.filter(x => x !== opt)
      : [...p.correct_answers, opt]
  }))

  const saveItem = async () => {
    let payload = { item_type: itemType }
    if (itemType === 'theory') {
      payload = { ...payload, ...theoryForm }
    } else {
      payload = { ...payload, ...taskForm, max_attempts: parseInt(taskForm.max_attempts) || 0 }
      if (taskForm.task_type === 'code') {
        payload.test_cases = taskForm.test_cases.filter(t => t.expected)
        payload.options = []; payload.correct_answer = null; payload.correct_answers = []
      } else if (taskForm.task_type === 'quiz') {
        payload.options = taskForm.options.filter(o => o.trim())
        payload.test_cases = []; payload.correct_answers = []
      } else if (taskForm.task_type === 'multi') {
        payload.options = taskForm.options.filter(o => o.trim())
        payload.correct_answers = taskForm.correct_answers
        payload.test_cases = []; payload.correct_answer = null
      } else if (taskForm.task_type === 'text') {
        payload.correct_answers = taskForm.accepted_answers.filter(a => a.trim())
        payload.options = []; payload.test_cases = []; payload.correct_answer = null
      }
    }
    await api.post(`/blocks/${block.id}/items`, payload)
    setShowAddItem(false); setTaskForm(emptyTask()); setTheoryForm({ theory_title:'', theory_content:'' })
    onRefresh()
  }

  const delItem = async (iid) => {
    if (!confirm('Удалить элемент?')) return
    await api.delete(`/items/${iid}`); onRefresh()
  }

  const delBlock = async () => {
    if (!confirm('Удалить блок?')) return
    await api.delete(`/blocks/${block.id}`); onRefresh()
  }

  const tt = taskForm.task_type

  return (
    <div className="card" style={{ padding:0, overflow:'hidden', marginBottom:16, borderColor: open ? meta.color : 'var(--border)', transition:'border-color 0.2s' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', cursor:'pointer', background: open ? meta.bg : 'var(--bg2)' }}
        onClick={() => setOpen(p => !p)}>
        <Icon name={meta.icon} size={18} color={meta.color} />
        <div style={{ flex:1 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontWeight:700, fontSize:15 }}>{block.title}</span>
            <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:99, background:meta.bg, color:meta.color, border:`1px solid ${meta.color}40` }}>{meta.label}</span>
          </div>
          <span style={{ fontSize:12, color:'var(--text3)' }}>
            {block.items.filter(i => i.item_type==='theory').length} теор. · {block.items.filter(i => i.item_type==='task').length} задан.
          </span>
        </div>
        {isTeacher && <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); delBlock() }}>Удалить</button>}
        <span style={{ color:'var(--text3)', fontSize:18, transition:'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none' }}>›</span>
      </div>

      {open && (
        <div style={{ padding:'16px 20px' }}>
          {block.items.length === 0 && !showAddItem && (
            <p style={{ color:'var(--text3)', fontSize:13, marginBottom:12 }}>Элементов пока нет</p>
          )}

          {block.items.map(item => (
            <div key={item.id}>
              {item.item_type === 'theory' ? (
                <div style={{ marginBottom:20, paddingBottom:20, borderBottom:'1px solid var(--border)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                    <Icon name="book" size={15} color="#0891b2" />
                    <span style={{ fontWeight:700, fontSize:15 }}>{item.theory_title}</span>
                    {isTeacher && <button onClick={() => delItem(item.id)} className="btn btn-danger btn-sm" style={{ marginLeft:'auto' }}>Удалить</button>}
                  </div>
                  <MdView content={item.theory_content} />
                </div>
              ) : (
                <div style={{ position:'relative' }}>
                  {isTeacher && <button onClick={() => delItem(item.id)} className="btn btn-danger btn-sm" style={{ position:'absolute', right:0, top:0, zIndex:1 }}>Удалить</button>}
                  <TaskItem item={item} readOnly={isTeacher} onSaved={onRefresh} />
                </div>
              )}
            </div>
          ))}

          {/* Add item form */}
          {isTeacher && (showAddItem ? (
            <div style={{ background:'#f8fafc', borderRadius:10, padding:16, marginTop:8, border:'1.5px solid #e2e8f0' }}>
              <div style={{ display:'flex', gap:8, marginBottom:14 }}>
                {['theory','task'].map(t => (
                  <button key={t} onClick={() => setItemType(t)}
                    className={`btn btn-sm ${itemType === t ? 'btn-primary' : 'btn-secondary'}`}>
                    {t === 'theory' ? 'Теория' : 'Задание'}
                  </button>
                ))}
              </div>

              {/* ── THEORY FORM ── */}
              {itemType === 'theory' && (<>
                <div style={{ marginBottom:10 }}>
                  <label style={{ display:'block', marginBottom:5, fontSize:13, color:'var(--text2)' }}>Заголовок</label>
                  <input value={theoryForm.theory_title} onChange={e => setTheoryForm(p => ({...p,theory_title:e.target.value}))} />
                </div>
                <div style={{ marginBottom:10 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <label style={{ fontSize:13, color:'var(--text2)' }}>Содержимое (Markdown)</label>
                    <button className="btn btn-secondary btn-sm" onClick={() => setPreview(p => !p)}>{preview ? 'Редактор' : 'Представление'}</button>
                  </div>
                  {preview
                    ? <div className="card" style={{ minHeight:120, padding:14 }}><MdView content={theoryForm.theory_content}/></div>
                    : <textarea value={theoryForm.theory_content} onChange={e => setTheoryForm(p => ({...p,theory_content:e.target.value}))} rows={8}
                        style={{ fontFamily:'var(--mono)', fontSize:13 }} placeholder={'## Заголовок\n\nТекст с **жирным** и `кодом`\n\n```python\nprint("Hello!")\n```'} />}
                </div>
              </>)}

              {/* ── TASK FORM ── */}
              {itemType === 'task' && (<>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                  <div>
                    <label style={{ display:'block', marginBottom:5, fontSize:13, color:'var(--text2)' }}>Заголовок</label>
                    <input value={taskForm.task_title} onChange={e => setTaskForm(p => ({...p,task_title:e.target.value}))} />
                  </div>
                  <div>
                    <label style={{ display:'block', marginBottom:5, fontSize:13, color:'var(--text2)' }}>Тип задания</label>
                    <select value={taskForm.task_type} onChange={e => setTaskForm(p => ({...p,task_type:e.target.value,correct_answers:[],correct_answer:''}))}>
                      <option value="code">Код (Python)</option>
                      <option value="quiz">Один правильный ответ</option>
                      <option value="multi">Множественный выбор</option>
                      <option value="text">Ввод ответа (строка)</option>
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom:10 }}>
                  <label style={{ display:'block', marginBottom:5, fontSize:13, color:'var(--text2)' }}>Условие (Markdown)</label>
                  <textarea value={taskForm.task_description} onChange={e => setTaskForm(p => ({...p,task_description:e.target.value}))} rows={3} />
                </div>

                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                  <div>
                    <label style={{ display:'block', marginBottom:5, fontSize:13, color:'var(--text2)' }}>Макс. попыток (0 = ∞)</label>
                    <input type="number" min="0" value={taskForm.max_attempts} onChange={e => setTaskForm(p => ({...p,max_attempts:e.target.value}))} />
                  </div>
                  <div>
                    <label style={{ display:'block', marginBottom:5, fontSize:13, color:'var(--text2)' }}>Срок выполнения</label>
                    <input type="date" value={taskForm.deadline} onChange={e => setTaskForm(p => ({...p,deadline:e.target.value}))} />
                  </div>
                </div>

                {/* CODE */}
                {tt === 'code' && (<>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <label style={{ fontSize:13, color:'var(--text2)', fontWeight:600 }}>Тест-кейсы</label>
                    <button className="btn btn-secondary btn-sm" onClick={addTC}>+ Добавить</button>
                  </div>
                  {taskForm.test_cases.map((tc, i) => (
                    <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto auto', gap:8, marginBottom:6, alignItems:'center' }}>
                      <input value={tc.input} onChange={e => updTC(i,'input',e.target.value)} placeholder="Ввод" style={{ fontFamily:'var(--mono)', fontSize:12 }} />
                      <input value={tc.expected} onChange={e => updTC(i,'expected',e.target.value)} placeholder="Ожидаемый вывод" style={{ fontFamily:'var(--mono)', fontSize:12 }} />
                      <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, color:'var(--text2)', whiteSpace:'nowrap', cursor:'pointer' }}>
                        <input type="checkbox" checked={tc.hidden} onChange={e => updTC(i,'hidden',e.target.checked)} style={{ width:'auto' }} /> Скрыт
                      </label>
                      {taskForm.test_cases.length > 1 && <button onClick={() => remTC(i)} style={{ background:'none', color:'var(--red)', fontSize:16 }}>×</button>}
                    </div>
                  ))}
                </>)}

                {/* QUIZ — single */}
                {tt === 'quiz' && (<>
                  <label style={{ display:'block', marginBottom:8, fontSize:13, color:'var(--text2)', fontWeight:600 }}>
                    Варианты ответов <span style={{ color:'var(--text3)', fontWeight:400 }}>(кружок = правильный)</span>
                  </label>
                  {taskForm.options.map((opt, i) => (
                    <div key={i} style={{ display:'flex', gap:8, marginBottom:6, alignItems:'center' }}>
                      <input type="radio" name="corr_q" checked={taskForm.correct_answer === opt && opt !== ''}
                        onChange={() => opt && setTaskForm(p => ({...p,correct_answer:p.options[i]}))} style={{ width:'auto', flexShrink:0 }} />
                      <input value={opt} onChange={e => { const o=[...taskForm.options]; o[i]=e.target.value; setTaskForm(p=>({...p,options:o})) }} placeholder={`Вариант ${i+1}`} />
                    </div>
                  ))}
                </>)}

                {/* MULTI — multiple correct */}
                {tt === 'multi' && (<>
                  <label style={{ display:'block', marginBottom:8, fontSize:13, color:'var(--text2)', fontWeight:600 }}>
                    Варианты ответов <span style={{ color:'var(--text3)', fontWeight:400 }}>(галочки = правильные, можно несколько)</span>
                  </label>
                  {taskForm.options.map((opt, i) => (
                    <div key={i} style={{ display:'flex', gap:8, marginBottom:6, alignItems:'center' }}>
                      <div onClick={() => opt && toggleCorrectMulti(opt)} style={{
                        width:18, height:18, borderRadius:4, flexShrink:0, cursor:'pointer',
                        border:`2px solid ${taskForm.correct_answers.includes(opt) && opt ? '#06b6d4' : 'var(--text3)'}`,
                        background: taskForm.correct_answers.includes(opt) && opt ? '#06b6d4' : 'transparent',
                        display:'flex', alignItems:'center', justifyContent:'center'
                      }}>
                        {taskForm.correct_answers.includes(opt) && opt && <span style={{ color:'white', fontSize:11 }}>✓</span>}
                      </div>
                      <input value={opt} onChange={e => {
                        const o=[...taskForm.options]; const old=o[i]; o[i]=e.target.value
                        // Update correct_answers if this option was marked correct
                        const ca = taskForm.correct_answers.map(a => a===old ? e.target.value : a)
                        setTaskForm(p=>({...p,options:o,correct_answers:ca}))
                      }} placeholder={`Вариант ${i+1}`} />
                    </div>
                  ))}
                  {taskForm.correct_answers.length > 0 && (
                    <p style={{ fontSize:12, color:'var(--accent2)', marginTop:4 }}>
                      ✓ Правильные: {taskForm.correct_answers.filter(Boolean).join(', ')}
                    </p>
                  )}
                </>)}

                {/* TEXT — free input with multiple accepted answers */}
                {tt === 'text' && (<>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                    <label style={{ fontSize:13, color:'var(--text2)', fontWeight:600 }}>
                      Допустимые ответы <span style={{ color:'var(--text3)', fontWeight:400 }}>(без учёта регистра)</span>
                    </label>
                    <button className="btn btn-secondary btn-sm" onClick={addAccepted}>+ Добавить</button>
                  </div>
                  {taskForm.accepted_answers.map((ans, i) => (
                    <div key={i} style={{ display:'flex', gap:8, marginBottom:6, alignItems:'center' }}>
                      <input value={ans} onChange={e => updAccepted(i, e.target.value)} placeholder={`Допустимый ответ ${i+1} (напр. «42» или «сорок два»)`} />
                      {taskForm.accepted_answers.length > 1 && <button onClick={() => remAccepted(i)} style={{ background:'none', color:'var(--red)', fontSize:16, flexShrink:0 }}>×</button>}
                    </div>
                  ))}
                  <p style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>Студент должен ввести один из этих вариантов (регистр не важен)</p>
                </>)}
              </>)}

              <div style={{ display:'flex', gap:8, marginTop:14 }}>
                <button className="btn btn-primary btn-sm" onClick={saveItem}>Сохранить</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setShowAddItem(false); setTaskForm(emptyTask()) }}>Отмена</button>
              </div>
            </div>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAddItem(true)} style={{ marginTop:4 }}>+ Добавить элемент</button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── MODULE DETAIL PAGE ────────────────────────────────────────────────────────
export default function ModuleDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const nav = useNavigate()
  const isTeacher = user.role === 'teacher'

  const [mod, setMod]         = useState(null)
  const [loading, setLoading] = useState(true)
  const [showAddBlock, setShowAddBlock] = useState(false)
  const [blockForm, setBlockForm]       = useState({ title:'', block_type:'theory' })
  const [runner, setRunner]   = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const infoRes = await api.get('/info')
      setRunner(infoRes.data.runner)
    } catch(e) {}
    try {
      const coursesRes = await api.get('/courses')
      for (const course of coursesRes.data) {
        const modsRes = await api.get(`/courses/${course.id}/modules`)
        const found = modsRes.data.find(m => m.id === parseInt(id))
        if (found) { setMod({ ...found, course_id: course.id, course_title: course.title }); break }
      }
    } catch(e) {}
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  const addBlock = async (e) => {
    e.preventDefault()
    await api.post(`/modules/${id}/blocks`, blockForm)
    setBlockForm({ title:'', block_type:'theory' }); setShowAddBlock(false); load()
  }

  if (loading) return <div className="spinner" />
  if (!mod) return <div className="page"><p>Модуль не найден</p></div>

  return (
    <div className="page" style={{ maxWidth:900 }}>
      <style>{mdCss}</style>
      <button className="btn btn-secondary btn-sm" onClick={() => nav(`/courses/${mod.course_id}`)} style={{ marginBottom:16, display:'flex', alignItems:'center', gap:6 }}>
        <Icon name="chevronRight" size={13} style={{transform:'rotate(180deg)'}} /> {mod.course_title}
      </button>

      <div className="page-header">
        <div>
          <h1 className="page-title">{mod.title}</h1>
          {mod.description && <p style={{ color:'var(--text2)', marginTop:4 }}>{mod.description}</p>}
          {mod.deadline && <p style={{ fontSize:13, color:'var(--text3)', marginTop:4 }}>Срок выполнения: {mod.deadline}</p>}
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          {runner && (
            <span style={{ fontSize:12, color:'var(--text3)', background:'#f1f5f9', padding:'4px 10px', borderRadius:99, display:'flex', alignItems:'center', gap:5, border:'1px solid #e2e8f0' }}>
              <Icon name={runner==='docker'?'docker':'snake'} size={13} color='var(--text3)' />{runner === 'docker' ? 'Docker' : 'subprocess'}
            </span>
          )}
          {isTeacher && <button className="btn btn-primary" onClick={() => setShowAddBlock(true)}>+ Блок</button>}
        </div>
      </div>

      {showAddBlock && (
        <div className="card" style={{ marginBottom:20 }}>
          <h3 style={{ fontWeight:600, marginBottom:14 }}>Новый блок</h3>
          <form onSubmit={addBlock}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
              <div>
                <label style={{ display:'block', marginBottom:6, fontSize:14, color:'var(--text2)' }}>Название *</label>
                <input value={blockForm.title} onChange={e => setBlockForm(p => ({...p,title:e.target.value}))} required />
              </div>
              <div>
                <label style={{ display:'block', marginBottom:6, fontSize:14, color:'var(--text2)' }}>Тип блока</label>
                <select value={blockForm.block_type} onChange={e => setBlockForm(p => ({...p,block_type:e.target.value}))}>
                  <option value="theory">Теория</option>
                  <option value="practice">Практика</option>
                  <option value="assessment">Оценочный</option>
                </select>
              </div>
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-primary" type="submit">Создать</button>
              <button className="btn btn-secondary" type="button" onClick={() => setShowAddBlock(false)}>Отмена</button>
            </div>
          </form>
        </div>
      )}

      {mod.blocks.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📦</div>
          <h3>Блоков пока нет</h3>
          {isTeacher && <p>Нажмите «+ Блок» чтобы добавить первый</p>}
        </div>
      ) : (
        mod.blocks.map(block => (
          <BlockPanel key={block.id} block={block} isTeacher={isTeacher} onRefresh={load} />
        ))
      )}
    </div>
  )
}
