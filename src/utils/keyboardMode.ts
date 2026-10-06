const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

/**
 * Hides the mouse pointer while the remote's arrow keys are in use, and
 * brings it back as soon as a real mouse moves. A TV needs no pointer once
 * the arrows reach the page; if a TV browser keeps the arrows to itself,
 * no key ever arrives here and the pointer simply stays.
 */
export function trackKeyboardMode(root: HTMLElement = document.documentElement): () => void {
  const onKey = (event: KeyboardEvent) => {
    if (ARROWS.includes(event.key)) root.classList.add('keyboard-mode');
  };
  const onPointer = () => root.classList.remove('keyboard-mode');
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('mousemove', onPointer, true);
  return () => {
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('mousemove', onPointer, true);
  };
}
