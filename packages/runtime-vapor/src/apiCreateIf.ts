import { type Block, type Fragment, fragmentKey } from './apiRender'
import { type EffectScope, ReactiveEffect, effectScope } from '@vue/reactivity'
import { createComment, createTextNode, insert, remove } from './dom/element'
import { queueJob, queuePostRenderEffect } from './scheduler'
import {
  type Directive,
  type DirectiveBindingsMap,
  createUpdatingSchedulerJob,
  getDirectivesMap,
  invokeDirectiveHook,
  setDirectivesWithScopeMap,
} from './directives'
import { getCurrentInstance } from './component'
import { warn } from './warning'
import { VaporErrorCodes, callWithErrorHandling } from './errorHandling'

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
  let isTriggered = true
  const anchor = __DEV__ ? createComment('if') : createTextNode()
  const fragment: Fragment = {
    nodes: [],
    anchor,
    [fragmentKey]: true,
  }

  const instance = getCurrentInstance()
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
  getDirectivesMap()!.set(anchor, [
    {
      dir,
      instance: instance!,
      value: null,
      oldValue: undefined,
    },
  ])

  const effect = new ReactiveEffect(() =>
    callWithErrorHandling(condition, instance, VaporErrorCodes.RENDER_FUNCTION),
  )
  const job = createUpdatingSchedulerJob(instance, effect)
  if (instance) job.id = instance.uid
  effect.scheduler = () => {
    isTriggered = true
    queueJob(job)
  }

  hook()

  // TODO: SSR
  // if (isHydrating) {
  //   parent!.insertBefore(anchor, currentHydrationNode)
  // }

  return fragment

  function hook() {
    if (!isTriggered || (newValue = !!effect.run()) === oldValue) {
      if (directives) {
        const currentDirs = directives
        invokeDirectiveHook(instance, 'beforeUpdate', currentDirs)
        queuePostRenderEffect(() => {
          invokeDirectiveHook(instance, 'updated', currentDirs)
        })
      }
      return
    }
    isTriggered = false

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
}
