// Shared button variant styles
// Used by IconButton, IconTextButton, and TextButton

export const buttonVariants = {
  primary: 'bg-blue-500 text-white hover:bg-blue-600 active:bg-blue-700',
  secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 active:bg-gray-400',
  danger: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700',
  ghost: 'bg-transparent text-gray-700 hover:bg-gray-100 active:bg-gray-200',
} as const;

export type ButtonVariant = keyof typeof buttonVariants;
