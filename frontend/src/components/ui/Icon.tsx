import type { SVGProps } from 'react'

export type IconName =
  | 'menu' | 'close' | 'edit' | 'share' | 'trash' | 'plus' | 'home' | 'sparkle'
  | 'clock' | 'user' | 'check' | 'chevron-left' | 'chevron-right' | 'send'
  | 'info' | 'clipboard' | 'grid' | 'alert' | 'lock' | 'plus-circle'

type IconProps = SVGProps<SVGSVGElement> & { name: IconName; size?: number; label?: string }

const paths: Record<IconName, JSX.Element> = {
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  edit: <path d="M12 20h9M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4Z" />,
  share: <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />,
  trash: <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  'plus-circle': <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  home: <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1Z" />,
  sparkle: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  user: <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8Z" />,
  check: <path d="M20 6L9 17l-5-5" />,
  'chevron-left': <path d="M15 18l-6-6 6-6" />,
  'chevron-right': <path d="M9 18l6-6-6-6" />,
  send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4Z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>,
  clipboard: <><path d="M9 5h6a1 1 0 011 1v1H8V6a1 1 0 011-1Z" /><path d="M8 6H6a2 2 0 00-2 2v11a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-2M9 12h6M9 16h4" /></>,
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  alert: <><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0Z" /><path d="M12 9v4M12 17h.01" /></>,
  lock: <><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 118 0v4" /></>,
}

export function Icon({ name, size = 20, label, className, ...rest }: IconProps) {
  const decorative = !label
  return (
    <svg
      className={className ? `icon ${className}` : 'icon'}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={label}
      focusable="false"
      {...rest}
    >
      {paths[name]}
    </svg>
  )
}

export default Icon
