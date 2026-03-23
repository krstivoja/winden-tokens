// Button Components - Focused, single-responsibility button components
//
// Three specialized button types:
// 1. TextButton - Text-only buttons
// 2. IconTextButton - Buttons with icon + text (left/right positioning)
// 3. IconButton - Icon-only buttons (requires aria-label)
//
// Usage:
//   <TextButton variant="primary">Click me</TextButton>
//   <IconTextButton icon={<PlusIcon />}>Add Item</IconTextButton>
//   <IconButton icon={<TrashIcon />} aria-label="Delete" />

// Re-export all button components from their individual files
export { TextButton } from '../TextButton';
export type { TextButtonProps } from '../TextButton';

export { IconTextButton } from '../IconTextButton';
export type { IconTextButtonProps } from '../IconTextButton';

export { IconButton } from '../IconButton';
export type { IconButtonProps } from '../IconButton';

// Default export for convenience (text-only button is the most common)
export { TextButton as Button } from '../TextButton';
