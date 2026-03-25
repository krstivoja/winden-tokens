// SegmentedControl component stories

import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SegmentedControl } from '../components/common/SegmentedControl';
import { RefreshIcon } from '../components/Icons';

const meta = {
  title: 'Components/SegmentedControl',
  component: SegmentedControl,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SegmentedControl>;

export default meta;
type Story = StoryObj<typeof meta>;

// Color mode options (HEX/RGB/HSL)
const colorModeOptions = [
  { value: 'hex', label: 'HEX' },
  { value: 'rgb', label: 'RGB' },
  { value: 'hsl', label: 'HSL' },
];

// Curve property options (Lightness/Saturation/Hue)
const curvePropertyOptions = [
  { value: 'lightness', label: 'Lightness' },
  { value: 'saturation', label: 'Saturation' },
  { value: 'hue', label: 'Hue' },
];

// Wrapper component for interactive stories
function SegmentedControlWrapper({ variant, options, initialValue }: any) {
  const [value, setValue] = useState(initialValue);
  return (
    <div className="w-80">
      <SegmentedControl
        options={options}
        value={value}
        onChange={setValue}
        variant={variant}
        fullWidth
      />
    </div>
  );
}

export const BorderedVariant: Story = {
  render: () => (
    <SegmentedControlWrapper
      variant="bordered"
      options={colorModeOptions}
      initialValue="hex"
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Bordered variant with white background and border. Used in ColorPickerModal for HEX/RGB/HSL tabs.',
      },
    },
  },
};

export const FilledVariant: Story = {
  render: () => (
    <SegmentedControlWrapper
      variant="filled"
      options={curvePropertyOptions}
      initialValue="lightness"
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Filled variant with gray background, no border. Used in ShadesModal for Curve Property tabs.',
      },
    },
  },
};

export const CompactSize: Story = {
  render: () => {
    const [value, setValue] = useState('option1');
    const options = [
      { value: 'option1', label: 'One' },
      { value: 'option2', label: 'Two' },
    ];
    return (
      <SegmentedControl
        options={options}
        value={value}
        onChange={setValue}
        variant="bordered"
      />
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Compact size without fullWidth prop.',
      },
    },
  },
};

export const ManyOptions: Story = {
  render: () => {
    const [value, setValue] = useState('tab1');
    const options = [
      { value: 'tab1', label: 'Tab 1' },
      { value: 'tab2', label: 'Tab 2' },
      { value: 'tab3', label: 'Tab 3' },
      { value: 'tab4', label: 'Tab 4' },
      { value: 'tab5', label: 'Tab 5' },
    ];
    return (
      <div className="w-full max-w-2xl">
        <SegmentedControl
          options={options}
          value={value}
          onChange={setValue}
          variant="bordered"
          fullWidth
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Segmented control with many options.',
      },
    },
  },
};

export const WithBadges: Story = {
  render: () => {
    const [value, setValue] = useState('lightness');
    const [editedCurves, setEditedCurves] = useState({
      lightness: false,
      saturation: true,
      hue: true,
    });

    const handleReset = (curve: string) => {
      setEditedCurves(prev => ({ ...prev, [curve]: false }));
    };

    const options = curvePropertyOptions.map(option => ({
      ...option,
      badge: editedCurves[option.value as keyof typeof editedCurves] ? <RefreshIcon /> : undefined,
      onBadgeClick: editedCurves[option.value as keyof typeof editedCurves]
        ? () => handleReset(option.value)
        : undefined,
    }));

    return (
      <div className="w-80">
        <SegmentedControl
          options={options}
          value={value}
          onChange={setValue}
          variant="bordered"
          fullWidth
        />
      </div>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Segmented control with reset badges. Shows RefreshIcon when a curve has been edited. Click the icon to reset (badge disappears).',
      },
    },
  },
};
