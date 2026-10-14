const svg = (cls, size, body) =>
  `<svg class="${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${body}</svg>`;

export const playIcon = (size = 14) => svg('i-play', size, '<path d="M7 4.6v14.8a1 1 0 0 0 1.5.86l12.2-7.4a1 1 0 0 0 0-1.72L8.5 3.74A1 1 0 0 0 7 4.6Z"/>');
export const pauseIcon = (size = 14) => svg('i-pause', size, '<rect x="5" y="4" width="5" height="16" rx="1.4"/><rect x="14" y="4" width="5" height="16" rx="1.4"/>');
export const prevIcon = (size = 18) => svg('i-prev', size, '<rect x="4" y="5" width="2.6" height="14" rx="1"/><path d="M19.5 5.9v12.2a1 1 0 0 1-1.55.83L9.2 12.83a1 1 0 0 1 0-1.66l8.75-6.1a1 1 0 0 1 1.55.83Z"/>');
export const nextIcon = (size = 18) => svg('i-next', size, '<rect x="17.4" y="5" width="2.6" height="14" rx="1"/><path d="M4.5 5.9v12.2a1 1 0 0 0 1.55.83l8.75-6.1a1 1 0 0 0 0-1.66L6.05 5.07a1 1 0 0 0-1.55.83Z"/>');
