'use client';

let containerEl: HTMLDivElement | null = null;

export function showToast(message: string, duration = 1500) {
  if (typeof window === 'undefined') return;
  if (!containerEl) {
    containerEl = document.createElement('div');
    containerEl.id = 'tf-toast-container';
    document.body.appendChild(containerEl);
  }
  const toast = document.createElement('div');
  toast.className = 'tf-toast';
  toast.innerHTML = `
    <svg class="tf-toast-check" viewBox="0 0 34 34" xmlns="http://www.w3.org/2000/svg">
      <circle cx="17" cy="17" r="10"></circle>
      <path d="M11 17.5l4 4 8-8.5"></path>
    </svg>
    <span></span>`;
  (toast.querySelector('span') as HTMLSpanElement).textContent = message;
  containerEl.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('tf-toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}
