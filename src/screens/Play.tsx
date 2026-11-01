import { useEffect, useState } from 'react'
import { loadContent, selectItems, type Items } from '../data/content'
import { recordGame, getProfile } from '../game/profile'
import type { GameOutcome } from '../game/types'
import type { GameConfig, ScratchEntry } from '../types'
import { useNav } from '../nav'
import { TopBar } from '../components/ui'
import { Trivia } from './games/Trivia'
import { Who } from './games/Who'
import { Scratch } from './games/Scratch'

export function GameHost({
  config,
  seed,
  onDone,
  onProgress,
  onQuit,
  shared,
  fixed,
  custom,
}: {
  config: GameConfig
  seed: number
  onDone: (o: GameOutcome) => void
  onProgress?: (p: { index: number; score: number; norm: number }) => void
  onQuit?: () => void
  /** In a room everyone must get the same items, so seen-history is ignored. */
  shared?: boolean
  /** Items the room host already picked for this round. */
  fixed?: Items | null
  /** A personal scratch puzzle a friend made for the room. */
  custom?: ScratchEntry | null
}) {
  const [items, setItems] = useState<Items | null>(null)

  useEffect(() => {
    let live = true
    loadContent().then((c) => {
      if (!live) return
      if (custom && config.mode === 'scratch') {
        setItems({ kind: 'scratch', list: [custom] })
        return
      }
      if (fixed?.list?.length) {
        setItems(fixed)
        return
      }
      setItems(selectItems(c, config, seed, shared ? undefined : getProfile().seenAt))
    })
    return () => {
      live = false
    }
    // room snapshots hand us fresh objects each update; compare by value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(config), seed, shared, custom?.id])

  if (!items) {
    return (
      <div className="splash">
        <div className="ball">⚽</div>
      </div>
    )
  }
  if (items.list.length === 0) {
    return (
      <div className="screen full">
        <TopBar title="אין עדיין תוכן" onBack={onQuit} />
        <div className="empty">
          {config.mode === 'scratch' ? 'התמונות לגירוד עוד בדרך. בינתיים אפשר לשחק בשאר המצבים.' : 'אין מספיק שאלות לבחירה הזו. נסה נושא או רמה אחרים.'}
        </div>
      </div>
    )
  }
  const common = { config, seed, onDone, onProgress, onQuit }
  if (items.kind === 'who') return <Who {...common} items={items.list} />
  if (items.kind === 'scratch') return <Scratch {...common} items={items.list} />
  return <Trivia {...common} items={items.list} />
}

export function Play({ config, seed }: { config: GameConfig; seed: number }) {
  const nav = useNav()
  return (
    <GameHost
      config={config}
      seed={seed}
      onQuit={nav.back}
      onDone={(o) => {
        const result = { mode: config.mode, topics: config.topics, level: config.level, score: o.score, correct: o.correct, total: o.total, at: Date.now() }
        const { xp, unlocked } = recordGame(result, { streak: o.bestStreak, scratchUnder10: o.scratchUnder10, whoFirstClue: o.whoFirstClue, seenIds: o.seenIds })
        nav.replace({ name: 'results', params: { config, outcome: o, xp, unlocked } })
      }}
    />
  )
}
