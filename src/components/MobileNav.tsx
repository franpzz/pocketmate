'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/context/ThemeContext'
import Sidebar from './Sidebar'
import s from './MobileNav.module.css'

const BOTTOM_NAV = [
  { href: '/dashboard', icon: '◈', label: 'Home' },
  { href: '/log',       icon: '+', label: 'Log' },
  { href: '/shopping',  icon: '⊞', label: 'Shop' },
  { href: '/ask',       icon: '✦', label: 'Ask' },
  { href: '/settings',  icon: '⚙', label: 'Settings' },
]

export default function MobileNav() {
  const pathname = usePathname()
  const { theme, toggle } = useTheme()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      {/* Mobile top header */}
      <header className={s.mobileHeader}>
        <img src="/Logo.png" alt="PocketMate" className={s.mobLogo} />
        <div className={s.mobRight}>
          <button className={s.themeBtn} onClick={toggle}>
            {theme === 'dark' ? '☀' : '🌙'}
          </button>
          <button
            className={`${s.hamburger} ${drawerOpen ? s.open : ''}`}
            onClick={() => setDrawerOpen(v => !v)}
            aria-label="Menu"
          >
            <span /><span /><span />
          </button>
        </div>
      </header>

      {/* Drawer overlay */}
      <div
        className={`${s.overlay} ${drawerOpen ? s.visible : ''}`}
        onClick={() => setDrawerOpen(false)}
      />

      {/* Drawer sidebar */}
      {drawerOpen && (
        <div className={s.drawer}>
          <Sidebar onClose={() => setDrawerOpen(false)} />
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className={s.bottomNav}>
        <div className={s.bottomNavInner}>
          {BOTTOM_NAV.map(({ href, icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href} className={`${s.bnavItem} ${active ? s.active : ''}`}>
                <span className={s.bnavIcon}>{icon}</span>
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
