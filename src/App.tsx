import { useEffect, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { ToastHost } from './components/ui'
import { loadContent } from './data/content'
import { useProfile } from './game/profile'
import { NavProvider, TABS, useNav, type Route } from './nav'
import { Games } from './screens/Games'
import { Home } from './screens/Home'
import { Onboarding } from './screens/Onboarding'
import { Play } from './screens/Play'
import { Achievements, Profile, Rankings, Settings } from './screens/ProfileScreens'
import { Results } from './screens/Results'
import { Friends, Room, RoomCreate, RoomJoin } from './screens/Rooms'
import { Setup } from './screens/Setup'

function Screen({ route }: { route: Route }) {
  const p = route.params ?? {}
  switch (route.name) {
    case 'home':
      return <Home />
    case 'games':
      return <Games />
    case 'friends':
      return <Friends />
    case 'rankings':
      return <Rankings />
    case 'profile':
      return <Profile />
    case 'settings':
      return <Settings />
    case 'achievements':
      return <Achievements />
    case 'setup':
      return <Setup mode={p.mode} />
    case 'play':
      return <Play config={p.config} seed={p.seed} />
    case 'results':
      return <Results {...p} />
    case 'room-create':
      return <RoomCreate {...p} />
    case 'room-join':
      return <RoomJoin code={p.code} />
    case 'room':
      return <Room code={p.code} />
    default:
      return <Home />
  }
}

function Shell() {
  const nav = useNav()
  const isTab = TABS.includes(nav.route.name)
  return (
    <>
      <Screen key={`${nav.depth}-${nav.route.name}`} route={nav.route} />
      {isTab && <BottomNav current={nav.route.name} />}
      <ToastHost />
    </>
  )
}

/** A link like ?join=123456 opens that room after the profile exists. */
function initialRoute(): Route {
  const code = new URLSearchParams(location.search).get('join')
  if (code && /^\d{6}$/.test(code)) return { name: 'room-join', params: { code } }
  return { name: 'home' }
}

export default function App() {
  const profile = useProfile()
  const [ready, setReady] = useState(false)
  const [start] = useState(initialRoute)

  useEffect(() => {
    // show the splash briefly while content warms up
    const t = setTimeout(() => setReady(true), 700)
    loadContent().finally(() => setReady(true))
    return () => clearTimeout(t)
  }, [])

  if (!ready)
    return (
      <div className="splash">
        <div className="col" style={{ alignItems: 'center' }}>
          <div className="ball">⚽</div>
          <div style={{ fontWeight: 900, fontSize: 24 }}>Football Arena</div>
        </div>
      </div>
    )

  return (
    <div className="app">
      {!profile.nickname ? (
        <Onboarding onDone={() => {}} />
      ) : (
        <NavProvider initial={start}>
          <Shell />
        </NavProvider>
      )}
    </div>
  )
}
