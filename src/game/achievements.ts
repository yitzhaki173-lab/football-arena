import type { Profile } from './profile'

export interface Achievement {
  id: string
  name: string
  desc: string
  icon: string
  test: (p: Profile) => boolean
  progress?: (p: Profile) => [number, number]
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-game', name: 'שריקת פתיחה', desc: 'סיימת משחק ראשון', icon: '⚽', test: (p) => p.games >= 1 },
  { id: 'games-25', name: 'שחקן קבוע', desc: '25 משחקים', icon: '📅', test: (p) => p.games >= 25, progress: (p) => [p.games, 25] },
  { id: 'games-100', name: 'מאה הופעות', desc: '100 משחקים', icon: '💯', test: (p) => p.games >= 100, progress: (p) => [p.games, 100] },
  { id: 'streak-5', name: 'רצף של 5', desc: '5 תשובות נכונות ברצף', icon: '🔥', test: (p) => p.bestStreak >= 5 },
  { id: 'streak-10', name: 'בלתי עציר', desc: '10 תשובות נכונות ברצף', icon: '⚡', test: (p) => p.bestStreak >= 10 },
  { id: 'perfect', name: 'משחק מושלם', desc: 'כל התשובות נכונות במשחק', icon: '🎯', test: (p) => p.perfectGames >= 1 },
  { id: 'correct-250', name: 'אנציקלופדיה', desc: '250 תשובות נכונות', icon: '📚', test: (p) => p.correct >= 250, progress: (p) => [p.correct, 250] },
  { id: 'scratch-10', name: 'עין של סקאוט', desc: 'זיהוי בגירוד עם פחות מ־10% חשיפה', icon: '🔍', test: (p) => p.scratchUnder10 >= 1 },
  { id: 'who-first', name: 'מרמז אחד', desc: 'זיהית שחקן מהרמז הראשון', icon: '🧠', test: (p) => p.whoFirstClue >= 1 },
  { id: 'room-win', name: 'ניצחון ראשון בחדר', desc: 'ניצחת את החברים בחדר', icon: '🥇', test: (p) => p.roomWins >= 1 },
  { id: 'room-wins-10', name: 'מלך החבר׳ה', desc: '10 ניצחונות בחדרים', icon: '👑', test: (p) => p.roomWins >= 10, progress: (p) => [p.roomWins, 10] },
  { id: 'tournament', name: 'מחזיק הגביע', desc: 'זכית בטורניר', icon: '🏆', test: (p) => p.tournamentWins >= 1 },
  { id: 'tournament-5', name: 'שושלת', desc: '5 זכיות בטורניר', icon: '🏟️', test: (p) => p.tournamentWins >= 5, progress: (p) => [p.tournamentWins, 5] },
  { id: 'legend', name: 'אגדה', desc: 'הגעת לדרגת אגדה', icon: '🌟', test: (p) => p.xp >= 12000, progress: (p) => [p.xp, 12000] },
]

export function checkAchievements(p: Profile): string[] {
  return ACHIEVEMENTS.filter((a) => a.test(p)).map((a) => a.id)
}

export function achievementById(id: string) {
  return ACHIEVEMENTS.find((a) => a.id === id)
}
