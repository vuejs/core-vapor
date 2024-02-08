import { type Block, type Fragment, fragmentKey } from './render'
import { type EffectScope, effectScope } from '@vue/reactivity'
import { createComment, createTextNode, insert, remove } from './dom/element'
import { queuePostRenderEffect } from './scheduler'
import {
  type DirectiveBindingsMap,
  type DirectiveHook,
  invokeDirectiveHook,
  setDirectivesWithScopeMap,
  withDirectives,
} from './directives'
import { getCurrentInstance } from './component'

type BlockFn = () => Block

/*! #__NO_SIDE_EFFECTS__ */
export const createIf = (
  condition: () => any,
  b1: BlockFn,
  b2?: BlockFn,
  // hydrationNode?: Node,
): Fragment => {
  let branch: BlockFn | undefined
  let parent: ParentNode | undefined | null
  let block: Block | undefined
  let scope: EffectScope | undefined
  let directives: DirectiveBindingsMap | undefined
  const anchor = __DEV__ ? createComment('if') : createTextNode()
  const fragment: Fragment = {
    nodes: [],
    anchor,
    [fragmentKey]: true,
  }

  const instance = getCurrentInstance()
  if (!instance) {
    // FIXME should use error handling
    console.warn('createIf() can only be used inside setup()')
  }

  // TODO: SSR
  // if (isHydrating) {
  //   parent = hydrationNode!.parentNode
  //   setCurrentHydrationNode(hydrationNode!)
  // }

  const hook: DirectiveHook = (_, { value, oldValue }) => {
    if (value === oldValue) {
      if (directives) {
        const currentDirs = directives
        invokeDirectiveHook(instance, 'beforeUpdate', currentDirs)
        queuePostRenderEffect(() => {
          invokeDirectiveHook(instance, 'updated', currentDirs)
        })
      }
      return
    }

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
    if ((branch = value ? b1 : b2)) {
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

  withDirectives(anchor, [
    [
      {
        created: hook,
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
          directives &&
          invokeDirectiveHook(instance, 'beforeUnmount', directives),
        unmounted: () =>
          directives && invokeDirectiveHook(instance, 'unmounted', directives),
      },
      () => !!condition(),
    ],
  ])

  // TODO: SSR
  // if (isHydrating) {
  //   parent!.insertBefore(anchor, currentHydrationNode)
  // }

  return fragment
}
