// Shared button variant styles
// Used by IconButton, IconTextButton, and TextButton

export const buttonVariants = {
  primary: 'bg-primary text-white hover:bg-primary/80 active:bg-primary/90 cursor-pointer',
  secondary: 'bg-base-3 text-text hover:bg-base-3 active:bg-base-3 cursor-pointer',
  danger: 'bg-danger text-base hover:bg-danger/80 active:bg-danger/90 cursor-pointer',
  ghost: 'bg-transparent text-text hover:bg-base-2 active:bg-base-3 cursor-pointer',
  outline: 'bg-transparent text-text border border-border hover:bg-base-2 active:bg-base-3 cursor-pointer',
} as const;

export type ButtonVariant = keyof typeof buttonVariants;
