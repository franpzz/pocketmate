'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppState } from '@/context/AppStateContext'
import { useTheme } from '@/context/ThemeContext'
import s from './Sidebar.module.css'

const NAV_MAIN = [
  { href: '/dashboard',    icon: '◈', label: 'Dashboard' },
  { href: '/transactions', icon: '↕', label: 'Transactions' },
  { href: '/insights',     icon: '▤', label: 'Insights' },
  { href: '/log',          icon: '+', label: 'Log expense' },
]
const NAV_PLAN = [
  { href: '/whatif',       icon: '◎', label: 'What-if' },
  { href: '/shopping',     icon: '⊞', label: 'Shopping list' },
  { href: '/ask',          icon: '✦', label: 'Ask PocketMate' },
]
const NAV_ACCOUNT = [
  { href: '/settings',     icon: '⚙', label: 'Settings' },
]

interface Props {
  onClose?: () => void
}

export default function Sidebar({ onClose }: Props) {
  const pathname = usePathname()
  const { profile } = useAppState()
  const { theme, toggle } = useTheme()

  const initials = (profile?.name ?? 'U').charAt(0).toUpperCase()

  function navLink(href: string, icon: string, label: string) {
    const active = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link
        key={href}
        href={href}
        className={`${s.navItem} ${active ? s.active : ''}`}
        onClick={onClose}
      >
        <span className={s.icon}>{icon}</span>
        {label}
      </Link>
    )
  }

  return (
    <aside className={s.sidebar}>
      <div className={s.logo}>PocketMate</div>

      <div className={s.section}>Overview</div>
      {NAV_MAIN.map(({ href, icon, label }) => navLink(href, icon, label))}

      <div className={s.section}>Planning</div>
      {NAV_PLAN.map(({ href, icon, label }) => navLink(href, icon, label))}

      <div className={s.section}>Account</div>
      {NAV_ACCOUNT.map(({ href, icon, label }) => navLink(href, icon, label))}

      <div className={s.footer}>
        <button className={s.themeBtn} onClick={toggle}>
          {theme === 'dark' ? '☀ Light mode' : '🌙 Dark mode'}
        </button>
        <div className={s.userPill}>
          <div className={s.avatar}>{initials}</div>
          <div>
            <div className={s.userName}>{profile?.name ?? '—'}</div>
            <div className={s.userSub}>PocketMate</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
