import { NOOP, invokeArrayFns } from '@vue/shared'
import type { VaporLifecycleHooks } from './enums'
import { type ComponentInternalInstance, setCurrentInstance } from './component'
import { type DirectiveHookName, invokeDirectiveHook } from './directives'
import { queuePostFlushCb } from './scheduler'

export function invokeLifecycle(
  instance: ComponentInternalInstance,
  lifecycle: VaporLifecycleHooks,
  directive: DirectiveHookName,
  cb?: () => void,
  post?: boolean,
) {
  const fn = scheduleLifecycleHooks(instance, lifecycle, directive, cb, post)
  return post ? queuePostFlushCb(fn) : fn()
}

export function scheduleLifecycleHooks(
  instance: ComponentInternalInstance,
  lifecycle: VaporLifecycleHooks,
  directive: DirectiveHookName,
  cb = NOOP,
  reverse?: boolean,
) {
  const hooks = reverse
    ? [cb, callDirHooks, callLifecycleHooks]
    : [callLifecycleHooks, callDirHooks, cb]

  return () => invokeArrayFns(hooks)

  function callDirHooks() {
    invokeDirectiveHook(instance, directive, instance.scope)
  }
  function callLifecycleHooks() {
    // lifecycle hooks may be mounted halfway.
    const lifecycleHooks = instance[lifecycle]
    if (lifecycleHooks && lifecycleHooks.length) {
      const reset = setCurrentInstance(instance)
      instance.scope.run(() => invokeArrayFns(lifecycleHooks))
      reset()
    }
  }
}
