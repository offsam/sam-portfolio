'use client'

import { useEffect, useRef } from 'react'
import { Tektur, Unbounded } from 'next/font/google'

const tektur = Tektur({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
})

const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: ['600', '700', '800'],
})

export type Lang = 'eng' | 'esp' | 'rus'

const COPY: Record<Lang, { intro: string; words: string[] }> = {
  rus: {
    intro: 'Превращаю хаос в',
    words: ['сайт', 'видео', 'приложение', 'решение для вашего бизнеса'],
  },
  eng: {
    intro: 'Turning chaos into',
    words: ['a website', 'a video', 'an app', 'a solution for your business'],
  },
  esp: {
    intro: 'Transformo el caos en',
    words: ['un sitio web', 'un video', 'una app', 'una solución para tu negocio'],
  },
}

const INTRO_CHAR_MS    = 55
const TYPE_CHAR_MS     = 75
const HOLD_MS          = 2800
const DELETE_CHAR_MS   = 95
const WORD_GAP_MS      = 500
const INTRO_PAUSE_MS   = 520
/** Доп. пауза перед словом «приложение» (индекс 2 в цикле). */
const APP_WORD_EXTRA_DELAY_MS = 1000

type Phase =
  | 'intro'
  | 'intro_pause'
  | 'type'
  | 'hold'
  | 'delete'
  | 'word_gap'
  | 'app_delay'

interface TwMachine {
  phase: Phase
  charIdx: number
  wordIdx: number
  acc: number
  deleteText: string
}

interface TypewriterPanelProps {
  visible: boolean
  lang: Lang | null
  textZoneRef: React.MutableRefObject<{ active: boolean; leftX: number }>
}

function freshMachine(): TwMachine {
  return { phase: 'intro', charIdx: 0, wordIdx: 0, acc: 0, deleteText: '' }
}

export default function TypewriterPanel({ visible, lang, textZoneRef }: TypewriterPanelProps) {
  const introElRef     = useRef<HTMLParagraphElement>(null)
  const cycleTextRef   = useRef<HTMLSpanElement>(null)
  const machineRef     = useRef<TwMachine>(freshMachine())
  const langRef        = useRef<Lang | null>(null)
  const rafRef         = useRef(0)
  const lastTsRef      = useRef(0)
  const runningRef     = useRef(false)

  useEffect(() => {
    langRef.current = lang
  }, [lang])

  useEffect(() => {
    if (!visible || !lang) {
      runningRef.current = false
      cancelAnimationFrame(rafRef.current)
      textZoneRef.current.active = false
      machineRef.current = freshMachine()
      if (introElRef.current) introElRef.current.textContent = ''
      if (cycleTextRef.current) cycleTextRef.current.textContent = ''
      return
    }

    runningRef.current = true
    lastTsRef.current = performance.now()
    langRef.current = lang
    textZoneRef.current.active = true
    machineRef.current = freshMachine()
    if (introElRef.current) introElRef.current.textContent = ''
    if (cycleTextRef.current) cycleTextRef.current.textContent = ''

    const phaseDelay = (phase: Phase): number => {
      switch (phase) {
        case 'intro':
          return INTRO_CHAR_MS
        case 'intro_pause':
          return INTRO_PAUSE_MS
        case 'type':
          return TYPE_CHAR_MS
        case 'hold':
          return HOLD_MS
        case 'delete':
          return DELETE_CHAR_MS
        case 'word_gap':
          return WORD_GAP_MS
        case 'app_delay':
          return APP_WORD_EXTRA_DELAY_MS
      }
    }

    const advance = (m: TwMachine) => {
      const choice = langRef.current
      if (!choice) return

      switch (m.phase) {
        case 'intro': {
          const intro = COPY[choice].intro
          if (m.charIdx >= intro.length) return
          m.charIdx++
          if (introElRef.current) introElRef.current.textContent = intro.slice(0, m.charIdx)
          if (m.charIdx >= intro.length) {
            m.phase = 'intro_pause'
            m.acc = 0
          }
          return
        }

        case 'intro_pause': {
          m.phase = 'type'
          m.charIdx = 0
          m.acc = 0
          if (cycleTextRef.current) cycleTextRef.current.textContent = ''
          return
        }

        case 'type': {
          const word = COPY[choice].words[m.wordIdx]
          if (m.charIdx >= word.length) return
          m.charIdx++
          if (cycleTextRef.current) cycleTextRef.current.textContent = word.slice(0, m.charIdx)
          if (m.charIdx >= word.length) {
            m.phase = 'hold'
            m.acc = 0
          }
          return
        }

        case 'hold': {
          m.phase = 'delete'
          m.acc = 0
          m.deleteText = cycleTextRef.current?.textContent ?? ''
          return
        }

        case 'delete': {
          if (m.deleteText.length <= 0) {
            m.phase = 'word_gap'
            m.acc = 0
            if (cycleTextRef.current) cycleTextRef.current.textContent = ''
            return
          }
          m.deleteText = m.deleteText.slice(0, -1)
          if (cycleTextRef.current) cycleTextRef.current.textContent = m.deleteText
          return
        }

        case 'word_gap': {
          m.wordIdx = (m.wordIdx + 1) % COPY[choice].words.length
          if (m.wordIdx === 2) {
            m.phase = 'app_delay'
          } else {
            m.phase = 'type'
          }
          m.charIdx = 0
          m.acc = 0
          if (cycleTextRef.current) cycleTextRef.current.textContent = ''
          return
        }

        case 'app_delay': {
          m.phase = 'type'
          m.charIdx = 0
          m.acc = 0
          return
        }
      }
    }

    const tick = (now: number) => {
      if (!runningRef.current) return

      const dt = Math.min(now - lastTsRef.current, 50)
      lastTsRef.current = now

      const m = machineRef.current
      m.acc += dt

      const delay = phaseDelay(m.phase)
      if (m.acc >= delay) {
        m.acc -= delay
        if (m.phase === 'hold' || m.phase === 'intro_pause' || m.phase === 'word_gap' || m.phase === 'app_delay') {
          m.acc = 0
        }
        advance(m)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)

    return () => {
      runningRef.current = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [visible, lang, textZoneRef])

  if (!visible || !lang) return null

  return (
    <div
      className={`${tektur.className} ${unbounded.className}`}
      style={{
        position: 'absolute',
        left: 'clamp(1.5rem, 5vw, 3.5rem)',
        top: 'clamp(2rem, 14vh, 4.5rem)',
        maxWidth: 'min(58vw, 720px)',
        zIndex: 10,
        pointerEvents: 'none',
      }}
    >
      <div>
        <p
          ref={introElRef}
          className="tw-intro"
          style={{
            fontFamily: tektur.style.fontFamily,
            fontSize: 'clamp(1.35rem, 2.35vw, 1.95rem)',
            fontWeight: 500,
            letterSpacing: '0.09em',
            color: 'rgba(168, 198, 255, 0.72)',
            lineHeight: 1.4,
            margin: 0,
            minHeight: '1.4em',
          }}
        />
        <p
          className="tw-cycle"
          style={{
            fontFamily: unbounded.style.fontFamily,
            fontSize: 'clamp(2.35rem, 5.2vw, 4.5rem)',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
            margin: '0.75rem 0 0',
            minHeight: '1.05em',
          }}
        >
          <span ref={cycleTextRef} className="tw-cycle-text" />
          <span className="tw-cursor">▮</span>
        </p>
      </div>
      <style>{`
        .tw-intro {
          text-shadow:
            0 0 14px rgba(90, 150, 255, 0.35),
            0 0 28px rgba(50, 90, 200, 0.15);
        }
        .tw-cycle-text {
          background: linear-gradient(
            118deg,
            #ffffff 0%,
            #c8e0ff 38%,
            #ffd9a8 72%,
            #ffb86c 100%
          );
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          filter:
            drop-shadow(0 0 14px rgba(130, 190, 255, 0.55))
            drop-shadow(0 0 32px rgba(255, 170, 90, 0.18));
        }
        .tw-cursor {
          animation: tw-blink 0.9s step-end infinite;
          margin-left: 0.08em;
          font-family: ${tektur.style.fontFamily};
          font-size: 0.72em;
          font-weight: 600;
          vertical-align: 0.06em;
          color: rgba(255, 190, 120, 0.92);
          filter: drop-shadow(0 0 10px rgba(255, 160, 80, 0.7));
        }
        @keyframes tw-blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  )
}
