import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

export interface Route {
  name: string
  // Each screen reads its own params; kept loose so screens stay decoupled.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  params?: any
}

interface Nav {
  route: Route
  go: (r: Route) => void
  replace: (r: Route) => void
  back: () => void
  /** Clears the stack and shows a tab. */
  tab: (name: string) => void
  depth: number
}

const NavCtx = createContext<Nav | null>(null)

export const TABS = ['home', 'games', 'friends', 'rankings', 'profile']

/**
 * A tiny stack router. The phone's back button maps to history.back(),
 * so each push adds a history entry and popstate pops the stack.
 */
export function NavProvider({ initial, children }: { initial: Route; children: ReactNode }) {
  const [stack, setStack] = useState<Route[]>([initial])
  const stackRef = useRef(stack)
  stackRef.current = stack

  useEffect(() => {
    history.replaceState({ depth: 0 }, '')
    const onPop = () => {
      setStack((s) => (s.length > 1 ? s.slice(0, -1) : s))
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const go = useCallback((r: Route) => {
    history.pushState({ depth: stackRef.current.length }, '')
    setStack((s) => [...s, r])
  }, [])

  const replace = useCallback((r: Route) => {
    setStack((s) => [...s.slice(0, -1), r])
  }, [])

  const back = useCallback(() => {
    if (stackRef.current.length > 1) history.back()
  }, [])

  const tab = useCallback((name: string) => {
    const extra = stackRef.current.length - 1
    // Drop our pushed entries so the back button doesn't walk old screens.
    if (extra > 0) history.go(-extra)
    setStack([{ name }])
  }, [])

  const value = useMemo<Nav>(
    () => ({ route: stack[stack.length - 1], go, replace, back, tab, depth: stack.length }),
    [stack, go, replace, back, tab],
  )
  return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>
}

export function useNav(): Nav {
  const n = useContext(NavCtx)
  if (!n) throw new Error('useNav outside NavProvider')
  return n
}
