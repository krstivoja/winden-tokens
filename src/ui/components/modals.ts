// Modal components

let inputModalCallback: ((value: string) => void) | null = null;

export function initModals(): void {
  const inputModal = document.getElementById('input-modal');
  const inputModalInput = document.getElementById('input-modal-input') as HTMLInputElement;
  const confirmBtn = document.getElementById('input-modal-confirm');

  if (confirmBtn) {
    confirmBtn.onclick = () => {
      const value = inputModalInput?.value.trim();
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
  callback: (value: string) => void
): void {
  const titleEl = document.getElementById('input-modal-title');
  const labelEl = document.getElementById('input-modal-label');
  const confirmBtn = document.getElementById('input-modal-confirm');
  const inputEl = document.getElementById('input-modal-input') as HTMLInputElement;
  const modal = document.getElementById('input-modal');

  if (titleEl) titleEl.textContent = title;
  if (labelEl) labelEl.textContent = label;
  if (confirmBtn) confirmBtn.textContent = confirmText;
  if (inputEl) inputEl.value = '';

  inputModalCallback = callback;

  if (modal) modal.classList.add('open');
  setTimeout(() => inputEl?.focus(), 50);
}

export function closeInputModal(): void {
  const modal = document.getElementById('input-modal');
  if (modal) modal.classList.remove('open');
  inputModalCallback = null;
}
