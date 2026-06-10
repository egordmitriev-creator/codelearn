import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Icon, LogoIcon } from './Icons'

export default function Layout() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const handleLogout = () => { logout(); nav('/login') }

  return (
    <div style={{ display:'flex', minHeight:'100vh' }}>
      <aside style={{ width:220, background:'#1e293b', display:'flex', flexDirection:'column',
        flexShrink:0, position:'sticky', top:0, height:'100vh', boxShadow:'2px 0 12px rgba(0,0,0,0.15)' }}>
        <div style={{ padding:'18px 18px 14px', borderBottom:'1px solid #334155' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <LogoIcon size={34} />
            <span style={{ fontWeight:800, fontSize:17, color:'#f1f5f9', letterSpacing:'-0.3px' }}>CodeLearn</span>
          </div>
        </div>

        <nav style={{ flex:1, padding:'10px 10px' }}>
          <NavLink to="/courses" style={({ isActive }) => ({
            display:'flex', alignItems:'center', gap:9, padding:'9px 11px',
            borderRadius:8, color: isActive ? '#93c5fd' : '#94a3b8',
            background: isActive ? 'rgba(59,130,246,0.15)' : 'transparent',
            fontWeight: isActive ? 700 : 500, fontSize:14, marginBottom:2, transition:'all 0.15s'
          })}>
            <Icon name="courses" size={17} /> Курсы
          </NavLink>
        </nav>

        <div style={{ padding:'12px 14px', borderTop:'1px solid #334155' }}>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:10 }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'#2563eb',
              display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:700, fontSize:13, flexShrink:0 }}>
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <div style={{ overflow:'hidden' }}>
              <div style={{ fontWeight:600, fontSize:13, color:'#f1f5f9', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{user?.username}</div>
              <div style={{ fontSize:11, color:'#64748b' }}>{user?.role === 'teacher' ? 'Преподаватель' : 'Студент'}</div>
            </div>
          </div>
          <button onClick={handleLogout} style={{ width:'100%', padding:'7px 10px', background:'rgba(239,68,68,0.12)',
            color:'#f87171', border:'1px solid rgba(239,68,68,0.22)', borderRadius:7, fontWeight:600, fontSize:13,
            cursor:'pointer', transition:'all 0.15s', fontFamily:'var(--font)', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}
            onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,0.22)'}
            onMouseLeave={e=>e.currentTarget.style.background='rgba(239,68,68,0.12)'}>
            <Icon name="logout" size={14} color="#f87171" /> Выйти
          </button>
        </div>
      </aside>

      <main style={{ flex:1, overflow:'auto', background:'var(--bg)' }}>
        <Outlet />
      </main>
    </div>
  )
}
