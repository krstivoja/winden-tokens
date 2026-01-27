// Modal components

let inputModalCallback: ((value: string) => void) | null = null;

export function initModals(): void {
  const inputModal = document.getElementById('input-modal');
  const inputModalInput = document.getElementById('input-modal-input') as HTMLInputElement;
  const inputModalSelect = document.getElementById('input-modal-select') as HTMLSelectElement;
  const confirmBtn = document.getElementById('input-modal-confirm');

  if (confirmBtn) {
    confirmBtn.onclick = () => {
      let value = '';
      if (inputModalInput.style.display !== 'none') {
        value = inputModalInput?.value.trim();
      } else {
        value = inputModalSelect?.value;
      }
      if (value && inputModalCallback) {
        inputModalCallback(value);
      }
      closeInputModal();
    };
  }

  if (inputModalInput) {
    inputModalInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        confirmBtn?.click();
      } else if (e.key === 'Escape') {
        closeInputModal();
      }
    };
  }

  if (inputModalSelect) {
    inputModalSelect.onkeydown = (e) => {
      if (e.key === 'Enter') {
        confirmBtn?.click();
      } else if (e.key === 'Escape') {
        closeInputModal();
      }
    };
  }

  if (inputModal) {
    inputModal.onclick = (e) => {
      if (e.target === inputModal) closeInputModal();
    };
  }
}

export function showInputModal(
  title: string,
  label: string,
  confirmText: string,
  callback: (value: string) => void,
  options?: string[]
): void {
  const titleEl = document.getElementById('input-modal-title');
  const labelEl = document.getElementById('input-modal-label');
  const confirmBtn = document.getElementById('input-modal-confirm');
  const inputEl = document.getElementById('input-modal-input') as HTMLInputElement;
  const selectEl = document.getElementById('input-modal-select') as HTMLSelectElement;
  const modal = document.getElementById('input-modal');

  if (titleEl) titleEl.textContent = title;
  if (labelEl) labelEl.textContent = label;
  if (confirmBtn) confirmBtn.textContent = confirmText;

  // Show either input or select based on whether options are provided
  if (options && options.length > 0) {
    inputEl.style.display = 'none';
    selectEl.style.display = 'block';
    selectEl.innerHTML = options.map(opt => `<option value="${opt}">${opt}</option>`).join('');
    selectEl.selectedIndex = 0;
  } else {
    inputEl.style.display = 'block';
    selectEl.style.display = 'none';
    inputEl.value = '';
  }

  inputModalCallback = callback;

  if (modal) modal.classList.add('open');
  setTimeout(() => {
    if (options && options.length > 0) {
      selectEl?.focus();
    } else {
      inputEl?.focus();
    }
  }, 50);
}

export function closeInputModal(): void {
  const modal = document.getElementById('input-modal');
  if (modal) modal.classList.remove('open');
  inputModalCallback = null;
}
