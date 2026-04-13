import { ThemeProvider } from '@/context/ThemeContext'
import { AppStateProvider } from '@/context/AppStateContext'
import Sidebar from '@/components/Sidebar'
import MobileNav from '@/components/MobileNav'
import GuestBanner from '@/components/GuestBanner'
import s from './shell.module.css'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AppStateProvider>
        {/* Mobile: sticky header + bottom nav + drawer */}
        <MobileNav />

        <div className={s.appRoot}>
          {/* Desktop sidebar */}
          <div className={s.sidebarWrap}>
            <Sidebar />
          </div>

          <main className={s.main}>
            <GuestBanner />
            {children}
          </main>
        </div>
      </AppStateProvider>
    </ThemeProvider>
  )
}
