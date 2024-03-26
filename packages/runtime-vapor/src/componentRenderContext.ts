import {
  type ComponentInternalInstance,
  currentInstance,
  setCurrentInstance,
} from './component'

export function withCtx<T extends (...args: any) => any>(
  fn: T,
  instance: ComponentInternalInstance | null = currentInstance,
): T {
  if (!instance) return fn

  const fnWithCtx = ((...args: any[]) => {
    const reset = setCurrentInstance(instance)
    try {
      return fn(...args)
    } finally {
      reset()
    }
  }) as T
  return fnWithCtx
}
