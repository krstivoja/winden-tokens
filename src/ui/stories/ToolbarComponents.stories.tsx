import type { Meta, StoryObj } from '@storybook/react-vite';
import { AddMenu } from '../components/Toolbar/AddMenu';
import { CollectionFilters } from '../components/Toolbar/CollectionFilters';
import { ModeSelector } from '../components/Toolbar/ModeSelector';
import { VariableTypeFilters } from '../components/Toolbar/VariableTypeFilters';
import { AppProvider } from '../context/AppContext';
import { ModalProvider } from '../components/Modals/ModalContext';
import { InputModal } from '../components/Modals/InputModal';

// --- AddMenu Stories ---

const addMenuMeta = {
  title: 'Components/Toolbar/AddMenu',
  component: AddMenu,
  decorators: [
    (Story) => (
      <AppProvider>
        <ModalProvider>
          <div style={{ position: 'relative', padding: '100px' }}>
            <Story />
            <InputModal />
          </div>
        </ModalProvider>
      </AppProvider>
    ),
  ],
  tags: ['autodocs'],
  args: {
    position: { top: 100, left: 100 },
    onClose: () => console.log('Menu closed'),
  },
} satisfies Meta<typeof AddMenu>;

export default addMenuMeta;
type AddMenuStory = StoryObj<typeof addMenuMeta>;

export const Default: AddMenuStory = {};

// --- CollectionFilters Stories ---

const collectionFiltersMeta = {
  title: 'Components/Toolbar/CollectionFilters',
  component: CollectionFilters,
  decorators: [
    (Story) => (
      <AppProvider>
        <div style={{ padding: '20px' }}>
          <Story />
        </div>
      </AppProvider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof CollectionFilters>;

export { collectionFiltersMeta };

type CollectionFiltersStory = StoryObj<typeof collectionFiltersMeta>;

export const CollectionFiltersDefault: CollectionFiltersStory = {};

// --- ModeSelector Stories ---

const modeSelectorMeta = {
  title: 'Components/Toolbar/ModeSelector',
  component: ModeSelector,
  decorators: [
    (Story) => (
      <AppProvider>
        <div style={{ padding: '20px' }}>
          <Story />
        </div>
      </AppProvider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof ModeSelector>;

export { modeSelectorMeta };

type ModeSelectorStory = StoryObj<typeof modeSelectorMeta>;

export const ModeSelectorDefault: ModeSelectorStory = {};

// --- VariableTypeFilters Stories ---

const variableTypeFiltersMeta = {
  title: 'Components/Toolbar/VariableTypeFilters',
  component: VariableTypeFilters,
  decorators: [
    (Story) => (
      <AppProvider>
        <div style={{ padding: '20px' }}>
          <Story />
        </div>
      </AppProvider>
    ),
  ],
  tags: ['autodocs'],
} satisfies Meta<typeof VariableTypeFilters>;

export { variableTypeFiltersMeta };

type VariableTypeFiltersStory = StoryObj<typeof variableTypeFiltersMeta>;

export const VariableTypeFiltersDefault: VariableTypeFiltersStory = {};
