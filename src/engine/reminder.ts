// Lembrete diário via calendário do celular. Um PWA sem servidor não consegue agendar notificações
// com o app fechado; um evento diário com alarme no calendário funciona no iPhone e no Android.

export const APP_URL = 'https://caiozuniga.github.io/ingles-app/'
const TITLE = 'Inglês — Fluent'

const pad = (n: number) => String(n).padStart(2, '0')

/** Próxima ocorrência do horário (hoje, se ainda não passou; senão amanhã), em horário local "flutuante". */
function firstStart(time: string, minutes: number, now = new Date()) {
  const [h, m] = time.split(':').map(Number)
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m)
  if (d <= now) d.setDate(d.getDate() + 1)
  const end = new Date(d.getTime() + minutes * 60000)
  const fmt = (x: Date) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`
  return { start: fmt(d), end: fmt(end) }
}

export function reminderIcs(time: string, minutes: number, now = new Date()): string {
  const { start, end } = firstStart(time, minutes, now)
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Fluent//ingles-app//PT',
    'BEGIN:VEVENT',
    `UID:fluent-daily-${stamp}@ingles-app`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    'RRULE:FREQ=DAILY',
    `SUMMARY:${TITLE}`,
    `DESCRIPTION:Sua sessão diária de inglês: ${APP_URL}`,
    `URL:${APP_URL}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `DESCRIPTION:${TITLE}`,
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

export function googleCalendarUrl(time: string, minutes: number, now = new Date()): string {
  const { start, end } = firstStart(time, minutes, now)
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: TITLE,
    dates: `${start}/${end}`,
    recur: 'RRULE:FREQ=DAILY',
    details: `Sua sessão diária de inglês: ${APP_URL}`,
  })
  return `https://calendar.google.com/calendar/render?${q}`
}
