import { type Block, type Fragment, fragmentKey } from './apiRender'
import {
  EffectFlags,
  type EffectScope,
  ReactiveEffect,
  type SchedulerJob,
  effectScope,
} from '@vue/reactivity'
import { createComment, createTextNode, insert, remove } from './dom/element'
import { queueJob, queuePostRenderEffect } from './scheduler'
import {
  type Directive,
  type DirectiveBinding,
  type DirectiveBindingsMap,
  getDirectivesMap,
  invokeDirectiveHook,
  setDirectivesWithScopeMap,
} from './directives'
import { getCurrentInstance, setCurrentInstance } from './component'
import { warn } from './warning'
import { VaporErrorCodes, callWithAsyncErrorHandling } from './errorHandling'
import { invokeArrayFns } from '@vue/shared'

type BlockFn = () => Block

/*! #__NO_SIDE_EFFECTS__ */
export const createIf = (
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  // hydrationNode?: Node,
): Fragment => {
  let newValue: any
  let oldValue: any
  let branch: BlockFn | undefined
  let parent: ParentNode | undefined | null
  let block: Block | undefined
  let scope: EffectScope | undefined
  let directives: DirectiveBindingsMap | undefined
  let triggered = true
  const anchor = __DEV__ ? createComment('if') : createTextNode()
  const fragment: Fragment = {
    nodes: [],
    anchor,
    [fragmentKey]: true,
  }
  const instance = getCurrentInstance()
  const parentBindings = getDirectivesMap()
  const bindings: DirectiveBinding[] = []

  if (!instance) {
    warn('createIf() can only be used inside setup()')
  }

  // TODO: SSR
  // if (isHydrating) {
  //   parent = hydrationNode!.parentNode
  //   setCurrentHydrationNode(hydrationNode!)
  // }

  const dir: Directive = {
    beforeUpdate: hook,

    beforeMount: () => {
      if (instance?.isMounted) return
      const currentDirectives = directives
      if (currentDirectives) {
        invokeDirectiveHook(instance, 'beforeMount', currentDirectives)
        queuePostRenderEffect(() => {
          invokeDirectiveHook(instance, 'mounted', currentDirectives)
        })
      }
    },
    beforeUnmount: () =>
      directives && invokeDirectiveHook(instance, 'beforeUnmount', directives),
    unmounted: () =>
      directives && invokeDirectiveHook(instance, 'unmounted', directives),
  }
  const binding: DirectiveBinding = {
    dir,
    instance: instance!,
    value: null,
    oldValue: undefined,
  }

  parentBindings?.set(anchor, bindings)
  bindings.push(binding)

  const effect = new ReactiveEffect(() =>
    callWithAsyncErrorHandling(
      condition,
      instance,
      VaporErrorCodes.RENDER_FUNCTION,
    ),
  )

  effect.scheduler = () => {
    triggered = true
    if (instance) (job as SchedulerJob).id = instance.uid
    queueJob(job)
  }

  hook()

  // TODO: SSR
  // if (isHydrating) {
  //   parent!.insertBefore(anchor, currentHydrationNode)
  // }

  return fragment

  function hook() {
    if (!triggered || (newValue = !!effect.run()) === oldValue) {
      if (directives) {
        const currentDirs = directives
        invokeDirectiveHook(instance, 'beforeUpdate', currentDirs)
        queuePostRenderEffect(() => {
          invokeDirectiveHook(instance, 'updated', currentDirs)
        })
      }
      return
    }
    triggered = false

    parent ||= anchor.parentNode
    if (block) {
      const currentDirs = directives!
      scope!.stop()

      invokeDirectiveHook(instance, 'beforeUnmount', currentDirs)

      remove(block, parent!)

      queuePostRenderEffect(() => {
        invokeDirectiveHook(instance, 'unmounted', currentDirs)
      })
    }
    if ((branch = (oldValue = newValue) ? b1 : b2)) {
      scope = effectScope()
      setDirectivesWithScopeMap(scope, (directives = new Map()))
      fragment.nodes = block = scope.run(branch)!

      const currentDirs = directives
      if (instance?.isMounted) {
        invokeDirectiveHook(instance, 'beforeMount', currentDirs)
      }

      parent && insert(block, parent, anchor)

      if (instance?.isMounted) {
        queuePostRenderEffect(() => {
          invokeDirectiveHook(instance, 'mounted', currentDirs)
        })
      }
    } else {
      scope = block = directives = undefined
      fragment.nodes = []
    }
  }

  function job() {
    if (!(effect.flags & EffectFlags.ACTIVE) || !effect.dirty) {
      return
    }

    if (instance?.isMounted && !instance.isUpdating) {
      instance.isUpdating = true
      const reset = setCurrentInstance(instance)

      const { bu, u, dirs } = instance
      // beforeUpdate hook
      if (bu) {
        invokeArrayFns(bu)
      }
      if (dirs) {
        invokeDirectiveHook(instance, 'beforeUpdate', dirs)
      }

      queuePostRenderEffect(() => {
        instance.isUpdating = false
        const reset = setCurrentInstance(instance)
        if (dirs) {
          invokeDirectiveHook(instance, 'updated', dirs)
        }
        // updated hook
        if (u) {
          queuePostRenderEffect(u)
        }
        reset()
      })
      reset()
    }
  }
}
