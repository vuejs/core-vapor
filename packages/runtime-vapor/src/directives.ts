import { invokeArrayFns, isFunction } from '@vue/shared'
import {
  type ComponentInternalInstance,
  getCurrentInstance,
  setCurrentInstance,
} from './component'
import {
  EffectFlags,
  type EffectScope,
  ReactiveEffect,
  type SchedulerJob,
  getCurrentScope,
  pauseTracking,
  resetTracking,
  traverse,
} from '@vue/reactivity'
import {
  VaporErrorCodes,
  callWithAsyncErrorHandling,
  callWithErrorHandling,
} from './errorHandling'
import { queueJob, queuePostRenderEffect } from './scheduler'

export type DirectiveModifiers<M extends string = string> = Record<M, boolean>

export interface DirectiveBinding<T = any, V = any, M extends string = string> {
  instance: ComponentInternalInstance
  source?: () => V
  value: V
  oldValue: V | null
  arg?: string
  modifiers?: DirectiveModifiers<M>
  dir: ObjectDirective<T, V, M>
}

export type DirectiveBindingsMap = Map<Node, DirectiveBinding[]>

export type DirectiveHook<
  T = any | null,
  V = any,
  M extends string = string,
> = (node: T, binding: DirectiveBinding<T, V, M>) => void

// create node -> `created` -> node operation -> `beforeMount` -> node mounted -> `mounted`
// effect update -> `beforeUpdate` -> node updated -> `updated`
// `beforeUnmount`-> node unmount -> `unmounted`
export type DirectiveHookName =
  | 'created'
  | 'beforeMount'
  | 'mounted'
  | 'beforeUpdate'
  | 'updated'
  | 'beforeUnmount'
  | 'unmounted'
export type ObjectDirective<T = any, V = any, M extends string = string> = {
  [K in DirectiveHookName]?: DirectiveHook<T, V, M> | undefined
} & {
  /** Watch value deeply */
  deep?: boolean | number
}

export type FunctionDirective<
  T = any,
  V = any,
  M extends string = string,
> = DirectiveHook<T, V, M>

export type Directive<T = any, V = any, M extends string = string> =
  | ObjectDirective<T, V, M>
  | FunctionDirective<T, V, M>

export type DirectiveArguments = Array<
  | [Directive | undefined]
  | [Directive | undefined, () => any]
  | [Directive | undefined, () => any, argument: string]
  | [
      Directive | undefined,
      value: () => any,
      argument: string,
      modifiers: DirectiveModifiers,
    ]
>

const bindingsWithScope = new WeakMap<EffectScope, DirectiveBindingsMap>()

export function getDirectivesMap(
  scope = getCurrentScope(),
): DirectiveBindingsMap | undefined {
  const instance = getCurrentInstance()
  if (instance && instance.scope === scope) {
    return instance.dirs
  } else {
    return scope && bindingsWithScope.get(scope)
  }
}

export function setDirectivesWithScopeMap(
  scope: EffectScope,
  bindings: DirectiveBindingsMap,
) {
  bindingsWithScope.set(scope, bindings)
}

export function withDirectives<T extends Node>(
  node: T,
  directives: DirectiveArguments,
): T {
  const instance = getCurrentInstance()
  const parentBindings = getDirectivesMap()
  if (!instance || !parentBindings) {
    // TODO warning
    return node
  }

  if (!parentBindings.has(node)) parentBindings.set(node, [])
  let bindings = parentBindings.get(node)!

  for (const directive of directives) {
    let [dir, source, arg, modifiers] = directive
    if (!dir) continue
    if (isFunction(dir)) {
      dir = {
        mounted: dir,
        updated: dir,
      } satisfies ObjectDirective
    }

    const binding: DirectiveBinding = {
      dir,
      instance,
      value: null, // set later
      oldValue: undefined,
      arg,
      modifiers,
    }

    if (source) {
      if (dir.deep) {
        const deep = dir.deep === true ? undefined : dir.deep
        const baseSource = source
        source = () => traverse(baseSource(), deep)
      }

      const effect = new ReactiveEffect(() =>
        callWithErrorHandling(
          source!,
          instance,
          VaporErrorCodes.RENDER_FUNCTION,
        ),
      )
      const job = createUpdatingSchedulerJob(instance, effect)
      job.id = instance.uid
      effect.scheduler = () => queueJob(job)

      binding.source = effect.run.bind(effect)
    }

    bindings.push(binding)

    callDirectiveHook(node, binding, instance, 'created')
  }

  return node
}

export function invokeDirectiveHook(
  instance: ComponentInternalInstance | null,
  name: DirectiveHookName,
  directives: DirectiveBindingsMap,
) {
  if (!instance) return
  const iterator = directives.entries()
  for (const [node, bindings] of iterator) {
    for (const binding of bindings) {
      callDirectiveHook(node, binding, instance, name)
    }
  }
}

function callDirectiveHook(
  node: Node,
  binding: DirectiveBinding,
  instance: ComponentInternalInstance | null,
  name: DirectiveHookName,
) {
  if (name === 'beforeUpdate') binding.oldValue = binding.value
  const { dir } = binding
  const hook = dir[name]
  if (!hook) return

  const newValue = binding.source ? binding.source() : undefined
  binding.value = newValue
  // disable tracking inside all lifecycle hooks
  // since they can potentially be called inside effects.
  pauseTracking()
  callWithAsyncErrorHandling(hook, instance, VaporErrorCodes.DIRECTIVE_HOOK, [
    node,
    binding,
  ])
  resetTracking()
}

export function createUpdatingSchedulerJob(
  instance: ComponentInternalInstance | null,
  effect: ReactiveEffect,
): SchedulerJob {
  return job
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
