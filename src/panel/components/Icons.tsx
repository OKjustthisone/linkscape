/** 行内小图标（内联 SVG，随 currentColor 着色）。 */

import { logoUrl } from '../../shared/ui-utils'

export function LogoMark(): JSX.Element {
  return (
    <span className="ls-logo" aria-label="Linkscape">
      <img className="ls-logo-image" src={logoUrl()} alt="" />
    </span>
  )
}

export function FolderIcon({ size = 16 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M1.5 3.5c0-.55.45-1 1-1h3.2c.26 0 .5.1.68.28L7.2 3.5h6.3c.55 0 1 .45 1 1v7.5c0 .55-.45 1-1 1H2.5c-.55 0-1-.45-1-1v-8.5z" />
    </svg>
  )
}

export function BookmarkIcon({ size = 16 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M4 2h8a1 1 0 0 1 1 1v11l-5-3-5 3V3a1 1 0 0 1 1-1z" />
    </svg>
  )
}

export function CaretIcon({ size = 10 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 10 10"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3 2l4 3-4 3z" />
    </svg>
  )
}

export function StarIcon({ filled, size = 14 }: { filled: boolean; size?: number }): JSX.Element {
  return (
    <span
      className="ls-star-glyph"
      style={{ fontSize: size, lineHeight: 1 }}
      aria-hidden="true"
    >
      {filled ? '★' : '☆'}
    </span>
  )
}

export function SearchIcon({ size = 13 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L14 14" />
    </svg>
  )
}

export function CloseIcon({ size = 13 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 3l10 10M13 3L3 13" />
    </svg>
  )
}

export function ExternalIcon({ size = 13 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 3H3.5A1.5 1.5 0 0 0 2 4.5v8A1.5 1.5 0 0 0 3.5 14h8a1.5 1.5 0 0 0 1.5-1.5V10" />
      <path d="M9 2h5v5" />
      <path d="M14 2L7.5 8.5" />
    </svg>
  )
}

export function GearIcon({ size = 13 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.55"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19.43 12.98c.04-.32.07-.65.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.37-.31-.6-.22l-2.49 1a7.7 7.7 0 0 0-1.69-.98l-.38-2.65A.51.51 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.38 2.65a7.7 7.7 0 0 0-1.69.98l-2.49-1c-.23-.08-.48 0-.6.22l-2 3.46c-.12.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.37.31.6.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.38-2.65a7.7 7.7 0 0 0 1.69-.98l2.49 1c.23.08.48 0 .6-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65Z" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  )
}

export function MoreIcon({ size = 14 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="3" cy="8" r="1.35" />
      <circle cx="8" cy="8" r="1.35" />
      <circle cx="13" cy="8" r="1.35" />
    </svg>
  )
}

export function RefreshIcon({ size = 14 }: { size?: number }): JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13.2 5.8A5.5 5.5 0 1 0 13.5 9" />
      <path d="M13.2 2.8v3.4H9.8" />
    </svg>
  )
}
