'use client'

import { useRouter } from 'next/navigation'
import { useAppState } from '@/context/AppStateContext'
import s from './GuestBanner.module.css'

export default function GuestBanner() {
  const { isGuest } = useAppState()
  const router = useRouter()

  if (!isGuest) return null

  function exitGuest() {
    // Clear guest cookie
    document.cookie = 'pm_guest=1; path=/; max-age=0'
    // Clear guest data
    localStorage.removeItem('pm_guest_data')
    router.push('/login')
    router.refresh()
  }

  return (
    <div className={s.banner}>
      <span className={s.icon}>👀</span>
      <div className={s.text}>
        <div className={s.title}>Guest mode</div>
        <div className={s.sub}>Data is stored locally — create an account to save it securely.</div>
      </div>
      <div className={s.actions}>
        <button className={s.btnCreate} onClick={() => router.push('/signup')}>
          Create account
        </button>
        <button className={s.btnExit} onClick={exitGuest}>
          Exit
        </button>
      </div>
    </div>
  )
}
