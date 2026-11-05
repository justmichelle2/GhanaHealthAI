import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'outline' | 'quiet' | 'danger'
export type ButtonSize = 'small' | 'default' | 'large'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  full?: boolean
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'default',
  full = false,
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'button',
    `button-${variant}`,
    size === 'small' ? 'button-small' : size === 'large' ? 'button-large' : '',
    full ? 'button-full' : '',
    loading ? 'is-loading' : '',
    className ?? '',
  ].filter(Boolean).join(' ')

  return (
    <button className={classes} type={type} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {icon}
      {children}
    </button>
  )
}

export default Button
