import type { ReactElement } from 'react'
import { useNav } from '../nav'

const items: { name: string; label: string; icon: ReactElement }[] = [
  {
    name: 'home',
    label: 'בית',
    icon: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  },
  {
    name: 'games',
    label: 'משחקים',
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7l3.5 2.5-1.3 4h-4.4l-1.3-4z" />
      </>
    ),
  },
  {
    name: 'friends',
    label: 'חברים',
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M16.5 14.5c2.6.2 4.4 2 5 5" />
      </>
    ),
  },
  {
    name: 'rankings',
    label: 'דירוגים',
    icon: <path d="M4 20V11h4v9M10 20V5h4v15M16 20v-6h4v6" />,
  },
  {
    name: 'profile',
    label: 'פרופיל',
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c1-4.5 4.3-6.5 8-6.5s7 2 8 6.5" />
      </>
    ),
  },
]

export function BottomNav({ current }: { current: string }) {
  const nav = useNav()
  return (
    <nav className="nav">
      {items.map((it) => (
        <button key={it.name} className={current === it.name ? 'on' : ''} onClick={() => nav.tab(it.name)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {it.icon}
          </svg>
          {it.label}
        </button>
      ))}
    </nav>
  )
}
