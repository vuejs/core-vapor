import {
  type BaseWatchErrorCodes,
  type BaseWatchMiddleware,
  type BaseWatchOptions,
  type ReactiveEffect,
  baseWatch,
} from '@vue/reactivity'
import { NOOP, extend, invokeArrayFns, remove } from '@vue/shared'
import { getCurrentInstance, setCurrentInstance } from './component'
import {
  createVaporRenderingScheduler,
  queuePostRenderEffect,
} from './scheduler'
import { handleError as handleErrorWithInstance } from './errorHandling'
import { warn } from './warning'
import { invokeDirectiveHook } from './directives'

interface RenderWatchOptions {
  immediate?: boolean
  deep?: boolean
  once?: boolean
}

type WatchStopHandle = () => void

export function renderEffect(effect: () => void): WatchStopHandle {
  return doWatch(effect)
}

export function renderWatch(
  source: any,
  cb: (value: any, oldValue: any) => void,
  options?: RenderWatchOptions,
): WatchStopHandle {
  return doWatch(source as any, cb, options)
}

function doWatch(
  source: any,
  cb?: any,
  options?: RenderWatchOptions,
): WatchStopHandle {
  let effect: ReactiveEffect | undefined

  const extendOptions: BaseWatchOptions =
    cb && options ? extend({}, options) : {}

  if (__DEV__) extendOptions.onWarn = warn

  // TODO: SSR
  // if (__SSR__) {}

  const middleware: BaseWatchMiddleware = next => {
    let value: unknown
    // with lifecycle
    if (instance && instance.isMounted) {
      const reset = setCurrentInstance(instance)

      const { bu, u, dirs } = instance
      // beforeUpdate hook
      const isFirstEffect = !instance.isUpdating
      if (isFirstEffect) {
        instance.isUpdating = true
        if (bu) {
          invokeArrayFns(bu)
        }
        if (dirs) {
          invokeDirectiveHook(instance, 'beforeUpdate', instance.dirs)
        }
      }

      // When invoking beforeUpdate, it is possible to disable effects,
      // for example in v-if or v-for, so we need to check the effect is still active.
      if (!effect || effect.active) {
        // run callback
        value = next()
      }

      if (isFirstEffect) {
        queuePostRenderEffect(() => {
          instance.isUpdating = false
          const reset = setCurrentInstance(instance)
          if (dirs) {
            invokeDirectiveHook(instance, 'updated', instance.dirs)
          }
          // updated hook
          if (u) {
            invokeArrayFns(u)
          }
          reset()
        })
      }

      reset()
    } else {
      // is not mounted
      value = next()
    }
    return value
  }

  const instance = getCurrentInstance()
  extend(extendOptions, {
    onError: (err: unknown, type: BaseWatchErrorCodes) =>
      handleErrorWithInstance(err, instance, type),
    scheduler: createVaporRenderingScheduler(instance),
    middleware,
  })
  effect = baseWatch(source, cb, extendOptions)

  const unwatch = !effect
    ? NOOP
    : () => {
        effect!.stop()
        if (instance && instance.scope) {
          remove(instance.scope.effects!, effect)
        }
      }

  return unwatch
}
