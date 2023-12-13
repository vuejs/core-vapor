export function on(
  el: HTMLElement,
  event: string,
  handler: () => any,
  options?: AddEventListenerOptions,
) {
  el.addEventListener(event, handler, options)
  return () => el.removeEventListener(event, handler, options)
}
