import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export type AlertTone = 'info' | 'success' | 'warning' | 'error'

type AlertProps = {
  tone?: AlertTone
  children: ReactNode
  className?: string
}

const toneRole: Record<AlertTone, 'status' | 'alert'> = {
  info: 'status',
  success: 'status',
  warning: 'status',
  error: 'alert',
}

const toneIcon: Record<AlertTone, IconName> = {
  info: 'info',
  success: 'check',
  warning: 'alert',
  error: 'alert',
}

export function Alert({ tone = 'info', children, className }: AlertProps) {
  return (
    <p className={`alert alert-${tone}${className ? ` ${className}` : ''}`} role={toneRole[tone]}>
      <Icon name={toneIcon[tone]} size={18} />
      <span>{children}</span>
    </p>
  )
}

export default Alert
