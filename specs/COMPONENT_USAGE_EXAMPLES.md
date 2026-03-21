# Component Usage Examples

Comprehensive usage examples for all common components with practical patterns from the Winden Tokens plugin.

## Import Pattern

```typescript
// Import all common components from single entry point
import {
  Button,
  Input,
  Checkbox,
  Select,
  Textarea,
  Label,
  FormGroup,
  IconButton,
  Modal,
  Dropdown,
  DropdownItem,
  DropdownDivider,
} from '@/ui/components/common';
```

---

## Form Components

### Button

```typescript
import { Button } from '@/ui/components/common';

// Basic usage
<Button onClick={handleSave}>Save</Button>

// With variants
<Button variant="primary" onClick={handleCreate}>Create Variable</Button>
<Button variant="danger" onClick={handleDelete}>Delete All</Button>
<Button variant="ghost" onClick={handleCancel}>Cancel</Button>

// With states
<Button loading disabled>Processing...</Button>
<Button disabled>Disabled Button</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>

// Full width
<Button fullWidth variant="primary">Continue</Button>
```

**Real example from plugin:**
```typescript
// Modal footer buttons
<div className="modal-footer">
  <Button onClick={closeModal}>Cancel</Button>
  <Button variant="primary" onClick={handleApply}>
    Apply Changes
  </Button>
</div>

// Danger zone
<Button
  variant="danger"
  onClick={handleDeleteAll}
  disabled={variables.length === 0}
>
  Delete All Variables
</Button>
```

---

### Input

```typescript
import { Input } from '@/ui/components/common';

// Text input
<Input
  placeholder="Variable name"
  value={name}
  onChange={(e) => setName(e.target.value)}
/>

// Number input with constraints
<Input
  type="number"
  min={2}
  max={20}
  value={shadeCount}
  onChange={(e) => setShadeCount(Number(e.target.value))}
/>

// Monospace for code/colors
<Input
  mono
  placeholder="#000000"
  value={color}
  onChange={(e) => setColor(e.target.value)}
/>

// With error handling
<Input
  value={email}
  error={errors.email}
  id="email-input"
  onChange={(e) => setEmail(e.target.value)}
/>

// Ref forwarding for focus management
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (isOpen) {
    inputRef.current?.focus();
  }
}, [isOpen]);

<Input ref={inputRef} placeholder="Focus on mount" />
```

**Real example from plugin:**
```typescript
// Color input with preview
<div className="color-input-wrapper">
  <div
    className="color-input-preview"
    style={{ cursor: 'pointer' }}
    onClick={() => openColorPicker({ initialColor: baseColor, onConfirm: setBaseColor })}
  >
    <div className="color-fill" style={{ background: baseColor }} />
  </div>
  <Input
    type="text"
    mono
    value={baseColor}
    onChange={(e) => setBaseColor(e.target.value)}
    placeholder="#000000"
  />
</div>
```

---

### Checkbox

```typescript
import { Checkbox } from '@/ui/components/common';

// With label
<Checkbox
  label="Color variables"
  checked={selectedTypes.has('COLOR')}
  onChange={() => toggleType('COLOR')}
/>

// Without label (standalone)
<Checkbox
  checked={isChecked}
  onChange={(e) => setIsChecked(e.target.checked)}
/>

// Disabled states
<Checkbox label="Disabled option" disabled />
<Checkbox label="Checked & disabled" checked disabled onChange={() => {}} />

// With error
<Checkbox
  label="I agree to the terms"
  error="You must accept the terms to continue"
/>
```

**Real example from plugin:**
```typescript
// Variable type filters
{VARIABLE_TYPES.map(({ type, label }) => (
  <Checkbox
    key={type}
    label={
      <>
        <span className="type-icon"><TypeIcon type={type} /></span>
        <span>{label}</span>
      </>
    }
    checked={selectedVariableTypes.has(type)}
    onChange={() => toggleVariableType(type)}
  />
))}
```

---

### Select

```typescript
import { Select } from '@/ui/components/common';

// Basic select
<Select
  options={[
    { value: 'figma', label: 'Follow Figma' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
  ]}
  value={themeMode}
  onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
/>

// With placeholder
<Select
  options={sourceColors.map(v => ({ value: v.id, label: v.name }))}
  placeholder="-- Select a color --"
  value={selectedId}
  onChange={(e) => setSelectedId(e.target.value)}
/>

// With disabled options
<Select
  options={[
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2 (unavailable)', disabled: true },
    { value: '3', label: 'Option 3' },
  ]}
/>

// With error
<Select
  options={options}
  error="Please select an option"
  id="required-select"
/>
```

**Real example from plugin:**
```typescript
// Source color selector
<Select
  options={sourceColors.map(variable => ({
    value: variable.id,
    label: variable.name
  }))}
  value={sourceColorId}
  onChange={(e) => handleSourceChange(e)}
  placeholder="-- Select a group --"
/>
```

---

### Textarea

```typescript
import { Textarea } from '@/ui/components/common';

// Basic usage
<Textarea
  placeholder="Enter description..."
  rows={4}
  value={description}
  onChange={(e) => setDescription(e.target.value)}
/>

// Monospace for code/data
<Textarea
  mono
  spellCheck={false}
  placeholder="50, #FFFFFF&#10;100, #F5F5F5"
  rows={8}
  value={bulkEditText}
  onChange={(e) => setBulkEditText(e.target.value)}
/>

// Resize control
<Textarea resize="none" rows={4} />
<Textarea resize="horizontal" rows={4} />

// With error
<Textarea
  value={json}
  error="Invalid JSON format"
  id="json-textarea"
/>
```

**Real example from plugin:**
```typescript
// Bulk edit modal
<FormGroup label="One variable per line: name, value">
  <Textarea
    mono
    spellCheck={false}
    placeholder="50, #FFFFFF\n100, #F5F5F5\n200, #EEEEEE"
    value={textValue}
    onChange={(e) => setTextValue(e.target.value)}
    onKeyDown={(e) => e.key === 'Escape' && closeBulkEdit()}
  />
</FormGroup>
```

---

## Layout Components

### Label

```typescript
import { Label } from '@/ui/components/common';

// Basic label
<Label htmlFor="email-input">Email Address</Label>
<Input id="email-input" type="email" />

// Required field
<Label htmlFor="password-input" required>Password</Label>
<Input id="password-input" type="password" />
```

---

### FormGroup

```typescript
import { FormGroup } from '@/ui/components/common';

// Basic usage
<FormGroup label="Email Address" htmlFor="email">
  <Input id="email" type="email" />
</FormGroup>

// Required field
<FormGroup label="Password" htmlFor="password" required>
  <Input id="password" type="password" />
</FormGroup>

// With description
<FormGroup
  label="API Key"
  htmlFor="api-key"
  description="Your API key will be used to authenticate requests"
>
  <Input id="api-key" placeholder="sk_..." mono />
</FormGroup>

// With error
<FormGroup
  label="Username"
  htmlFor="username"
  error="Username is already taken"
>
  <Input id="username" placeholder="johndoe" />
</FormGroup>

// Inline layout (for small controls)
<FormGroup label="Shade Count" htmlFor="count" inline>
  <Input id="count" type="number" min={2} max={20} style={{ width: '80px' }} />
</FormGroup>
```

**Real example from plugin:**
```typescript
// Complete form
<div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
  <FormGroup label="Variable Name" htmlFor="var-name" required>
    <Input id="var-name" placeholder="primary-color" />
  </FormGroup>

  <FormGroup label="Variable Type" htmlFor="var-type" required>
    <Select
      id="var-type"
      options={VARIABLE_TYPE_OPTIONS}
      placeholder="Select type..."
    />
  </FormGroup>

  <FormGroup
    label="Variable Value"
    htmlFor="var-value"
    required
    description="Enter a valid color value"
  >
    <Input id="var-value" placeholder="#FF5733" mono />
  </FormGroup>
</div>
```

---

## Button Components

### IconButton

```typescript
import { IconButton } from '@/ui/components/common';
import { CloseIcon, RefreshIcon, TrashIcon } from '@/ui/components/Icons';

// Basic icon button
<IconButton
  icon={<CloseIcon />}
  aria-label="Close"
  onClick={handleClose}
/>

// Variants
<IconButton icon={<TrashIcon />} variant="danger" aria-label="Delete" />
<IconButton icon={<RefreshIcon />} variant="ghost" aria-label="Refresh" />

// Sizes
<IconButton icon={<CloseIcon />} size="sm" aria-label="Close" />
<IconButton icon={<CloseIcon />} size="lg" aria-label="Close" />

// Disabled
<IconButton icon={<RefreshIcon />} disabled aria-label="Refresh" />
```

**Real example from plugin:**
```typescript
// Modal close button
<div className="modal-header">
  <h3>Edit Variable</h3>
  <IconButton
    icon={<CloseIcon />}
    variant="ghost"
    aria-label="Close modal"
    onClick={closeModal}
    className="modal-close"
  />
</div>

// Curve reset button
<IconButton
  icon={<RefreshIcon />}
  onClick={() => handleResetCurve(property)}
  aria-label={`Reset ${property}`}
  title={`Reset ${property}`}
  size="sm"
/>
```

---

## Overlay Components

### Modal

```typescript
import { Modal } from '@/ui/components/common';

// Basic modal
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Edit Variable"
>
  <p>Modal content goes here</p>
</Modal>

// With footer
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Confirm Action"
  footer={
    <>
      <Button onClick={() => setIsOpen(false)}>Cancel</Button>
      <Button variant="primary" onClick={handleConfirm}>
        Confirm
      </Button>
    </>
  }
>
  <p>Are you sure you want to proceed?</p>
</Modal>

// Custom width
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Large Modal"
  width={800}
>
  <p>Wider modal for more content</p>
</Modal>

// Disable overlay click & escape
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  closeOnOverlayClick={false}
  closeOnEscape={false}
>
  <p>Must use buttons to close</p>
</Modal>

// Without close button
<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  showCloseButton={false}
  footer={<Button onClick={() => setIsOpen(false)}>OK</Button>}
>
  <p>Important message</p>
</Modal>
```

**Real example from plugin:**
```typescript
// Input modal
<Modal
  isOpen={isOpen}
  onClose={closeInputModal}
  title="New Collection"
  width={300}
  footer={
    <>
      <Button onClick={closeInputModal}>Cancel</Button>
      <Button variant="primary" onClick={handleConfirm}>
        Create
      </Button>
    </>
  }
>
  <FormGroup label="Collection name">
    <Input
      ref={inputRef}
      placeholder="Enter name..."
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
    />
  </FormGroup>
</Modal>
```

---

### Dropdown

```typescript
import { Dropdown, DropdownItem, DropdownDivider } from '@/ui/components/common';

// Basic dropdown menu
const [isOpen, setIsOpen] = useState(false);

<Dropdown
  trigger={<Button>Actions ▾</Button>}
  isOpen={isOpen}
  onToggle={() => setIsOpen(!isOpen)}
>
  <DropdownItem onClick={() => { handleEdit(); setIsOpen(false); }}>
    Edit
  </DropdownItem>
  <DropdownItem onClick={() => { handleDuplicate(); setIsOpen(false); }}>
    Duplicate
  </DropdownItem>
  <DropdownDivider />
  <DropdownItem onClick={() => { handleDelete(); setIsOpen(false); }}>
    Delete
  </DropdownItem>
</Dropdown>

// With icons
import { PlusIcon, CopyIcon, TrashIcon } from '@/ui/components/Icons';

<Dropdown
  trigger={<Button>Actions ▾</Button>}
  isOpen={isOpen}
  onToggle={() => setIsOpen(!isOpen)}
>
  <DropdownItem icon={<PlusIcon />} onClick={handleAdd}>
    Create New
  </DropdownItem>
  <DropdownItem icon={<CopyIcon />} onClick={handleCopy}>
    Duplicate
  </DropdownItem>
  <DropdownDivider />
  <DropdownItem icon={<TrashIcon />} onClick={handleDelete}>
    Delete
  </DropdownItem>
</Dropdown>

// Disabled items
<DropdownItem disabled>Unavailable Option</DropdownItem>

// Right-aligned
<Dropdown
  trigger={<Button>Menu ▾</Button>}
  isOpen={isOpen}
  onToggle={() => setIsOpen(!isOpen)}
  position="bottom-right"
  align="end"
>
  {/* items */}
</Dropdown>
```

**Real example from plugin:**
```typescript
// Collection filter dropdown
const [isOpen, setIsOpen] = useState(false);
const [selected, setSelected] = useState(new Set(['1', '2']));

<Dropdown
  trigger={
    <button className="btn">
      Collections ({selected.size}/{collections.length}) ▾
    </button>
  }
  isOpen={isOpen}
  onToggle={() => setIsOpen(!isOpen)}
>
  <div className="dropdown-header">
    <span>Select Collections</span>
    <Button size="sm" onClick={toggleAllCollections}>
      {selected.size === collections.length ? 'None' : 'All'}
    </Button>
  </div>
  <div className="dropdown-list">
    {collections.map(collection => (
      <Checkbox
        key={collection.id}
        label={collection.name}
        checked={selected.has(collection.id)}
        onChange={() => toggleCollection(collection.id)}
      />
    ))}
  </div>
</Dropdown>

// Add variable type menu
<Dropdown
  trigger={<Button variant="primary"><PlusIcon /> Add Variable</Button>}
  isOpen={isOpen}
  onToggle={() => setIsOpen(!isOpen)}
>
  {VARIABLE_TYPES.map(({ type, label, icon }) => (
    <DropdownItem
      key={type}
      onClick={() => {
        handleAddVariable(type);
        setIsOpen(false);
      }}
    >
      <span className="icon">{icon}</span>
      {label}
    </DropdownItem>
  ))}
</Dropdown>
```

---

## Advanced Patterns

### Form with Validation

```typescript
const [formData, setFormData] = useState({ name: '', value: '', type: '' });
const [errors, setErrors] = useState<Record<string, string>>({});

const validate = () => {
  const newErrors: Record<string, string> = {};
  if (!formData.name) newErrors.name = 'Name is required';
  if (!formData.value) newErrors.value = 'Value is required';
  if (!formData.type) newErrors.type = 'Type is required';
  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};

const handleSubmit = () => {
  if (validate()) {
    // Submit form
  }
};

return (
  <Modal
    isOpen={isOpen}
    onClose={closeModal}
    title="Create Variable"
    footer={
      <>
        <Button onClick={closeModal}>Cancel</Button>
        <Button variant="primary" onClick={handleSubmit}>Create</Button>
      </>
    }
  >
    <FormGroup label="Name" htmlFor="name" required error={errors.name}>
      <Input
        id="name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
      />
    </FormGroup>

    <FormGroup label="Type" htmlFor="type" required error={errors.type}>
      <Select
        id="type"
        options={TYPE_OPTIONS}
        value={formData.type}
        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
      />
    </FormGroup>

    <FormGroup label="Value" htmlFor="value" required error={errors.value}>
      <Input
        id="value"
        mono
        value={formData.value}
        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
      />
    </FormGroup>
  </Modal>
);
```

### Confirmation Dialog

```typescript
const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, danger = false }) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    title={title}
    footer={
      <>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          onClick={() => {
            onConfirm();
            onClose();
          }}
        >
          Confirm
        </Button>
      </>
    }
  >
    <p>{message}</p>
  </Modal>
);

// Usage
<ConfirmDialog
  isOpen={showConfirm}
  onClose={() => setShowConfirm(false)}
  onConfirm={handleDeleteAll}
  title="Delete All Variables"
  message="This will delete all variables. This action cannot be undone!"
  danger
/>
```

---

## Tips & Best Practices

### Accessibility
- Always provide `aria-label` for IconButton
- Use `htmlFor` to link Label with Input
- Set `required` on FormGroup for required fields
- Use `error` prop to show validation errors

### Focus Management
```typescript
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (isOpen) {
    // Focus input when modal opens
    setTimeout(() => inputRef.current?.focus(), 50);
  }
}, [isOpen]);

<Input ref={inputRef} />
```

### Keyboard Shortcuts
```typescript
<Input
  onKeyDown={(e) => {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') handleCancel();
  }}
/>
```

### Controlled vs Uncontrolled
```typescript
// Controlled (recommended for forms)
<Input value={value} onChange={(e) => setValue(e.target.value)} />

// Uncontrolled (use with refs)
<Input defaultValue="initial" ref={inputRef} />
```

---

## Next Steps

1. **Start refactoring**: Replace existing UI elements with these common components
2. **Add tests**: Create test files for remaining components
3. **Extend as needed**: Add new variants or props based on actual usage
4. **Document patterns**: Add more examples as you discover useful patterns

For more information, see:
- [TESTING.md](TESTING.md) - Testing guide
- [COMPONENT_QUICK_START.md](COMPONENT_QUICK_START.md) - Creating components
- [COMPONENT_SUMMARY.md](COMPONENT_SUMMARY.md) - Component overview
