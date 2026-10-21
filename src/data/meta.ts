import type { GameMode, Level, TopicId } from '../types'

export const TOPICS: { id: TopicId; name: string; sub: string; color: string }[] = [
  { id: 'ligat-haal', name: 'ליגת העל', sub: 'ליגת העל, גביע המדינה וקבוצות ישראליות באירופה', color: '#3b82f6' },
  { id: 'ucl', name: 'ליגת האלופות', sub: 'כולל גביע אירופה לאלופות', color: '#a78bfa' },
  { id: 'top5', name: 'טופ 5 ליגות', sub: 'אנגליה, ספרד, איטליה, גרמניה וצרפת', color: '#f97316' },
  { id: 'national', name: 'נבחרות', sub: 'מונדיאל, יורו וקופה אמריקה', color: '#22c55e' },
]

export const ALL_TOPICS: TopicId[] = TOPICS.map((t) => t.id)

export function topicName(t: TopicId): string {
  return TOPICS.find((x) => x.id === t)?.name ?? t
}

/** "כל הנושאים", one name, or the names joined. Old saved games may have no list. */
export function topicsName(topics?: TopicId[]): string {
  const list = TOPICS.filter((t) => topics?.includes(t.id))
  if (!list.length || list.length === TOPICS.length) return 'כל הנושאים'
  return list.map((t) => t.name).join(' + ')
}

export const LEVELS: { id: Level; name: string }[] = [
  { id: 'medium', name: 'בינוני' },
  { id: 'hard', name: 'קשה' },
  { id: 'expert', name: 'מומחה' },
]

export function levelName(l: Level): string {
  return LEVELS.find((x) => x.id === l)?.name ?? l
}

export const MODES: { id: GameMode; name: string; desc: string }[] = [
  { id: 'trivia', name: 'טריוויה', desc: '10 שאלות, 6 תשובות, 15 שניות לשאלה' },
  { id: 'quick', name: 'משחק מהיר', desc: '5 שאלות, 10 שניות, בונוס על מהירות' },
  { id: 'who', name: 'מי השחקן', desc: 'תמונה מטושטשת ועד 5 רמזים. כל רמז מחדד אותה' },
  { id: 'scratch', name: 'גרד וגלה', desc: 'מגרדים תמונה ומשלימים את השם מאותיות' },
]

export function modeName(m: GameMode): string {
  return MODES.find((x) => x.id === m)?.name ?? m
}

export const AVATARS = ['⚽', '🧤', '🥅', '🏆', '🎯', '🔥', '⚡', '🦁', '🦅', '🐺', '👑', '🚀']
