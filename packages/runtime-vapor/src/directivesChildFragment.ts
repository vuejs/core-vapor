import { ReactiveEffect } from '@vue/reactivity'
import {
  type DirectiveHookName,
  createRenderingUpdateTrigger,
  invokeDirectiveHook,
  setDirectiveBinding,
} from './directives'
import { warn } from './warning'
import { type BlockEffectScope, isBlockEffectScope } from './blockEffectScope'
import { currentInstance } from './component'
import { VaporErrorCodes, callWithErrorHandling } from './errorHandling'
import { queueJob, queuePostFlushCb } from './scheduler'

/**
 * used in createIf and createFor
 * manage directives of child fragments in components.
 */
export function createChildFragmentDirectives(
  anchor: Node,
  getScopes: () => BlockEffectScope[],
  source: () => any,
  initCallback: (getValue: () => any) => void,
  effectCallback: (getValue: () => any) => void,
  once?: boolean,
) {
  let isTriggered = false
  const instance = currentInstance!
  if (__DEV__ && !instance) {
    warn('child directives can only be added in a component')
  }

  const callSourceWithErrorHandling = () =>
    callWithErrorHandling(source, instance, VaporErrorCodes.RENDER_FUNCTION)

  if (once) {
    initCallback(callSourceWithErrorHandling)
    return
  }

  setDirectiveBinding(instance, anchor, {
    beforeUpdate: onDirectiveBeforeUpdate,
    beforeMount: () => invokeChildrenDirectives('beforeMount'),
    mounted: () => invokeChildrenDirectives('mounted'),
    beforeUnmount: () => invokeChildrenDirectives('beforeUnmount'),
    unmounted: () => invokeChildrenDirectives('unmounted'),
  })

  const effect = new ReactiveEffect(callSourceWithErrorHandling)
  const triggerRenderingUpdate = createRenderingUpdateTrigger(instance, effect)
  effect.scheduler = () => {
    isTriggered = true
    queueJob(triggerRenderingUpdate)
  }

  const getValue = () => effect.run()

  initCallback(getValue)

  function onDirectiveBeforeUpdate() {
    if (isTriggered) {
      isTriggered = false
      effectCallback(getValue)
    } else {
      const scopes = getScopes()
      for (const scope of scopes) {
        invokeWithUpdate(scope)
      }
      return
    }
  }

  function invokeChildrenDirectives(name: DirectiveHookName) {
    const scopes = getScopes()
    for (const scope of scopes) {
      invokeDirectiveHook(instance, name, scope)
    }
  }
}

export function invokeWithMount(scope: BlockEffectScope, handler?: () => any) {
  if (isBlockEffectScope(scope.parent) && !scope.parent.im) {
    return handler && handler()
  }
  return invokeWithDirsHooks(scope, 'mount', handler)
}

export function invokeWithUnmount(
  scope: BlockEffectScope,
  handler?: () => void,
) {
  try {
    return invokeWithDirsHooks(scope, 'unmount', handler)
  } finally {
    scope.stop()
  }
}

export function invokeWithUpdate(
  scope: BlockEffectScope,
  handler?: () => void,
) {
  return invokeWithDirsHooks(scope, 'update', handler)
}

const lifecycleMap = {
  mount: ['beforeMount', 'mounted'],
  update: ['beforeUpdate', 'updated'],
  unmount: ['beforeUnmount', 'unmounted'],
} as const

function invokeWithDirsHooks(
  scope: BlockEffectScope,
  name: keyof typeof lifecycleMap,
  handler?: () => any,
) {
  const { dirs, it: instance } = scope
  const [before, after] = lifecycleMap[name]

  if (!dirs) {
    const res = handler && handler()
    if (name === 'mount') {
      queuePostFlushCb(() => (scope.im = true))
    }
    return res
  }

  invokeDirectiveHook(instance, before, scope)
  try {
    if (handler) {
      return handler()
    }
  } finally {
    queuePostFlushCb(() => {
      invokeDirectiveHook(instance, after, scope)
    })
  }
}
