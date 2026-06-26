'use client'

import { Tektur } from 'next/font/google'
import type { Lang } from '@/components/TypewriterPanel'

const tektur = Tektur({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600'],
})

export type ServiceShape = 'video' | 'site' | 'app' | 'business'
export type CometHoverTint = ServiceShape | 'default'

const WORDS: Record<Lang, { shape: ServiceShape; label: string }[]> = {
  rus: [
    { shape: 'video', label: 'видео' },
    { shape: 'site', label: 'сайт' },
    { shape: 'app', label: 'приложение' },
    { shape: 'business', label: 'решение для бизнеса' },
  ],
  eng: [
    { shape: 'video', label: 'a video' },
    { shape: 'site', label: 'a website' },
    { shape: 'app', label: 'an app' },
    { shape: 'business', label: 'a business solution' },
  ],
  esp: [
    { shape: 'video', label: 'un video' },
    { shape: 'site', label: 'un sitio web' },
    { shape: 'app', label: 'una app' },
    { shape: 'business', label: 'solución de negocio' },
  ],
}

const PROGRESS_TICKS = 10
const WORD_STAGGER_MS = 0.14

interface ServiceIconsRowProps {
  visible: boolean
  lang: Lang | null
  selectedShape: ServiceShape | null
  buildingShape: ServiceShape | null
  buildProgress: number
  onSelectShape: (shape: ServiceShape) => void
  onHoverShape: (shape: ServiceShape) => void
  onLeaveShape: () => void
}

export default function ServiceIconsRow({
  visible,
  lang,
  selectedShape,
  buildingShape,
  buildProgress,
  onSelectShape,
  onHoverShape,
  onLeaveShape,
}: ServiceIconsRowProps) {
  if (!visible || !lang) return null

  const items = WORDS[lang]

  return (
    <nav
      className="service-words-col"
      aria-label="Services"
      style={{
        position: 'absolute',
        left: 'clamp(1.5rem, 5vw, 3.5rem)',
        top: 'clamp(46vh, 50vh, 54vh)',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 'clamp(0.55rem, 1.6vh, 0.95rem)',
        pointerEvents: 'auto',
      }}
    >
      {items.map(({ shape, label }, idx) => {
        const active = selectedShape === shape
        const building = buildingShape === shape
        const showProgress = building
        const fillPct = Math.round(buildProgress * 100)

        return (
          <div
            key={shape}
            className="service-word-row service-word-row--cosmic-in"
            style={{ animationDelay: `${idx * WORD_STAGGER_MS}s` }}
          >
            <button
              type="button"
              className={`service-word-btn${active ? ' service-word-btn--active' : ''}`}
              onClick={() => onSelectShape(shape)}
              onMouseEnter={() => onHoverShape(shape)}
              onMouseLeave={onLeaveShape}
            >
              {label}
            </button>
            {showProgress && (
              <div className="service-word-progress-wrap">
                <div
                  className="service-word-progress"
                  role="progressbar"
                  aria-valuenow={fillPct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${label} — ${fillPct}%`}
                >
                  <div className="service-word-progress-track">
                    {Array.from({ length: PROGRESS_TICKS }, (_, i) => (
                      <span key={i} className="service-word-progress-tick" />
                    ))}
                  </div>
                  <div
                    className="service-word-progress-fill"
                    style={{ width: `${fillPct}%` }}
                  />
                </div>
                <span className="service-word-progress-pct">{fillPct}%</span>
              </div>
            )}
          </div>
        )
      })}
      <style>{`
        .service-word-row {
          display: flex;
          align-items: center;
          gap: clamp(0.55rem, 1.2vw, 0.85rem);
        }
        .service-word-row--cosmic-in {
          opacity: 0;
          filter: blur(10px);
          transform: translateX(-18px) translateY(6px);
          animation: service-cosmic-signal 0.85s cubic-bezier(0.22, 0.82, 0.28, 1) forwards;
        }
        .service-word-btn {
          padding: 0;
          margin: 0;
          border: none;
          background: none;
          text-align: left;
          font-family: ${tektur.style.fontFamily};
          font-size: clamp(1.35rem, 2.35vw, 1.95rem);
          font-weight: 500;
          letter-spacing: 0.09em;
          line-height: 1.35;
          color: rgba(110, 118, 132, 0.42);
          text-shadow: none;
          transition: color 0.28s, text-shadow 0.28s, transform 0.28s;
          transform: none;
        }
        .service-word-btn:hover {
          color: rgba(168, 198, 255, 0.72);
          text-shadow:
            0 0 14px rgba(90, 150, 255, 0.35),
            0 0 28px rgba(50, 90, 200, 0.15);
        }
        .service-word-btn--active {
          color: rgba(168, 198, 255, 0.72);
          text-shadow:
            0 0 14px rgba(90, 150, 255, 0.35),
            0 0 28px rgba(50, 90, 200, 0.15);
          transform: translateX(4px);
        }
        .service-word-btn--active:hover {
          color: rgba(210, 228, 255, 0.96);
          text-shadow:
            0 0 14px rgba(90, 150, 255, 0.45),
            0 0 28px rgba(50, 90, 200, 0.2);
        }
        .service-word-progress-wrap {
          display: flex;
          align-items: center;
          gap: clamp(0.35rem, 0.8vw, 0.55rem);
          opacity: 0;
          animation: service-progress-in 0.35s ease-out 0.05s forwards;
        }
        .service-word-progress {
          position: relative;
          width: clamp(3.2rem, 7vw, 5rem);
          height: 4px;
          flex-shrink: 0;
        }
        .service-word-progress-pct {
          font-family: ${tektur.style.fontFamily};
          font-size: clamp(0.72rem, 1.1vw, 0.88rem);
          font-weight: 500;
          letter-spacing: 0.06em;
          color: rgba(150, 195, 255, 0.82);
          min-width: 2.4rem;
          text-shadow: 0 0 8px rgba(90, 150, 255, 0.35);
        }
        .service-word-progress-track {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 1px;
        }
        .service-word-progress-tick {
          width: 1px;
          height: 3px;
          background: rgba(90, 140, 220, 0.22);
          box-shadow: 0 0 4px rgba(60, 110, 200, 0.12);
        }
        .service-word-progress-fill {
          position: absolute;
          left: 0;
          top: 50%;
          height: 2px;
          transform: translateY(-50%);
          background: linear-gradient(
            90deg,
            rgba(80, 150, 255, 0.35) 0%,
            rgba(140, 200, 255, 0.85) 55%,
            rgba(200, 230, 255, 0.95) 100%
          );
          box-shadow:
            0 0 6px rgba(90, 160, 255, 0.45),
            0 0 14px rgba(50, 100, 220, 0.2);
          transition: width 0.08s linear;
        }
        @keyframes service-cosmic-signal {
          0% {
            opacity: 0;
            filter: blur(12px) brightness(1.8);
            transform: translateX(-22px) translateY(8px);
            letter-spacing: 0.22em;
          }
          35% {
            opacity: 0.45;
            filter: blur(5px) brightness(1.35);
            color: rgba(140, 190, 255, 0.55);
          }
          70% {
            opacity: 0.88;
            filter: blur(1px) brightness(1.1);
          }
          100% {
            opacity: 1;
            filter: blur(0) brightness(1);
            transform: translateX(0) translateY(0);
          }
        }
        @keyframes service-progress-in {
          from {
            opacity: 0;
            transform: translateX(-6px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </nav>
  )
}
