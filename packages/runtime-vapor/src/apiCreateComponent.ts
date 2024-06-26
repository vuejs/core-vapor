import { type Component, createComponentInstance } from './component'
import { setupComponent } from './apiRender'
import type { RawProps } from './componentProps'
import type { RawSlots } from './componentSlots'
import { withAttrs } from './componentAttrs'
import { getCurrentScope } from '@vue/reactivity'
import type { BlockEffectScope } from './blockEffectScope'
import { setDirectiveBinding } from './directives'
import { VaporLifecycleHooks } from './enums'
import { scheduleLifecycleHooks } from './componentLifecycle'

export function createComponent(
  comp: Component,
  rawProps: RawProps | null = null,
  slots: RawSlots | null = null,
  singleRoot: boolean = false,
  once: boolean = false,
) {
  const parentScope = getCurrentScope() as BlockEffectScope
  const instance = createComponentInstance(
    comp,
    singleRoot ? withAttrs(rawProps) : rawProps,
    slots,
    once,
  )
  setupComponent(instance, singleRoot)

  setDirectiveBinding(
    instance,
    instance,
    {
      beforeMount: scheduleLifecycleHooks(
        instance,
        VaporLifecycleHooks.BEFORE_MOUNT,
        'beforeMount',
      ),
      mounted: scheduleLifecycleHooks(
        instance,
        VaporLifecycleHooks.MOUNTED,
        'mounted',
        () => (instance.isMounted = true),
        true,
      ),
      beforeUnmount: scheduleLifecycleHooks(
        instance,
        VaporLifecycleHooks.BEFORE_UNMOUNT,
        'beforeUnmount',
      ),
      unmounted: scheduleLifecycleHooks(
        instance,
        VaporLifecycleHooks.UNMOUNTED,
        'unmounted',
        () => (instance.isUnmounted = true),
        true,
      ),
    },
    null,
    undefined,
    parentScope,
  )

  return instance
}
