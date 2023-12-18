// These codes originate from a file of the same name in runtime-core,
// duplicated during Vapor's early development to ensure its independence.
// The ultimate aim is to uncouple this replicated code and
// facilitate its shared use between two runtimes.

import { VaporLifecycleHooks } from './apiLifecycle'
import { type ComponentInternalInstance } from './component'
import { isFunction, isPromise } from '@vue/shared'
import { warn } from './warning'

// contexts where user provided function may be executed, in addition to
// lifecycle hooks.
export enum ErrorCodes {
  SETUP_FUNCTION,
  RENDER_FUNCTION,
  WATCH_GETTER,
  WATCH_CALLBACK,
  WATCH_CLEANUP,
  NATIVE_EVENT_HANDLER,
  COMPONENT_EVENT_HANDLER,
  VNODE_HOOK,
  DIRECTIVE_HOOK,
  TRANSITION_HOOK,
  APP_ERROR_HANDLER,
  APP_WARN_HANDLER,
  FUNCTION_REF,
  ASYNC_COMPONENT_LOADER,
  SCHEDULER,
}

export const ErrorTypeStrings: Record<
  VaporLifecycleHooks | ErrorCodes,
  string
> = {
  // [VaporLifecycleHooks.SERVER_PREFETCH]: 'serverPrefetch hook',
  [VaporLifecycleHooks.BEFORE_CREATE]: 'beforeCreate hook',
  [VaporLifecycleHooks.CREATED]: 'created hook',
  [VaporLifecycleHooks.BEFORE_MOUNT]: 'beforeMount hook',
  [VaporLifecycleHooks.MOUNTED]: 'mounted hook',
  [VaporLifecycleHooks.BEFORE_UPDATE]: 'beforeUpdate hook',
  [VaporLifecycleHooks.UPDATED]: 'updated',
  [VaporLifecycleHooks.BEFORE_UNMOUNT]: 'beforeUnmount hook',
  [VaporLifecycleHooks.UNMOUNTED]: 'unmounted hook',
  [VaporLifecycleHooks.ACTIVATED]: 'activated hook',
  [VaporLifecycleHooks.DEACTIVATED]: 'deactivated hook',
  [VaporLifecycleHooks.ERROR_CAPTURED]: 'errorCaptured hook',
  [VaporLifecycleHooks.RENDER_TRACKED]: 'renderTracked hook',
  [VaporLifecycleHooks.RENDER_TRIGGERED]: 'renderTriggered hook',
  [ErrorCodes.SETUP_FUNCTION]: 'setup function',
  [ErrorCodes.RENDER_FUNCTION]: 'render function',
  [ErrorCodes.WATCH_GETTER]: 'watcher getter',
  [ErrorCodes.WATCH_CALLBACK]: 'watcher callback',
  [ErrorCodes.WATCH_CLEANUP]: 'watcher cleanup function',
  [ErrorCodes.NATIVE_EVENT_HANDLER]: 'native event handler',
  [ErrorCodes.COMPONENT_EVENT_HANDLER]: 'component event handler',
  [ErrorCodes.VNODE_HOOK]: 'vnode hook',
  [ErrorCodes.DIRECTIVE_HOOK]: 'directive hook',
  [ErrorCodes.TRANSITION_HOOK]: 'transition hook',
  [ErrorCodes.APP_ERROR_HANDLER]: 'app errorHandler',
  [ErrorCodes.APP_WARN_HANDLER]: 'app warnHandler',
  [ErrorCodes.FUNCTION_REF]: 'ref function',
  [ErrorCodes.ASYNC_COMPONENT_LOADER]: 'async component loader',
  [ErrorCodes.SCHEDULER]:
    'scheduler flush. This is likely a Vue internals bug. ' +
    'Please open an issue at https://new-issue.vuejs.org/?repo=vuejs/core',
}

export type ErrorTypes = VaporLifecycleHooks | ErrorCodes

export function callWithErrorHandling(
  fn: Function,
  instance: ComponentInternalInstance | null,
  type: ErrorTypes,
  args?: unknown[],
) {
  let res
  try {
    res = args ? fn(...args) : fn()
  } catch (err) {
    handleError(err, instance, type)
  }
  return res
}

export function callWithAsyncErrorHandling(
  fn: Function | Function[],
  instance: ComponentInternalInstance | null,
  type: ErrorTypes,
  args?: unknown[],
): any[] {
  if (isFunction(fn)) {
    const res = callWithErrorHandling(fn, instance, type, args)
    if (res && isPromise(res)) {
      res.catch((err) => {
        handleError(err, instance, type)
      })
    }
    return res
  }

  const values = []
  for (let i = 0; i < fn.length; i++) {
    values.push(callWithAsyncErrorHandling(fn[i], instance, type, args))
  }
  return values
}

export function handleError(
  err: unknown,
  instance: ComponentInternalInstance | null,
  type: ErrorTypes,
  throwInDev = true,
) {
  if (instance) {
    let cur = instance.parent
    // the exposed instance is the render proxy to keep it consistent with 2.x
    const exposedInstance = ('proxy' in instance && instance.proxy) || null
    // in production the hook receives only the error code
    const errorInfo = __DEV__
      ? ErrorTypeStrings[type]
      : `https://vuejs.org/errors/#runtime-${type}`
    while (cur) {
      const errorCapturedHooks = 'ec' in cur ? cur.ec : null
      if (errorCapturedHooks) {
        for (let i = 0; i < errorCapturedHooks.length; i++) {
          if (
            errorCapturedHooks[i](err, exposedInstance, errorInfo) === false
          ) {
            return
          }
        }
      }
      cur = cur.parent
    }

    // TODO: need appContext interface
    // app-level handling
    // const appErrorHandler = instance.appContext?.config.errorHandler
    // if (appErrorHandler) {
    //   callWithErrorHandling(
    //     appErrorHandler,
    //     null,
    //     ErrorCodes.APP_ERROR_HANDLER,
    //     [err, exposedInstance, errorInfo],
    //   )
    //   return
    // }
  }
  logError(err, type, throwInDev)
}

function logError(err: unknown, type: ErrorTypes, throwInDev = true) {
  if (__DEV__) {
    const info = ErrorTypeStrings[type]
    warn(`Unhandled error${info ? ` during execution of ${info}` : ``}`)
    // crash in dev by default so it's more noticeable
    if (throwInDev) {
      throw err
    } else if (!__TEST__) {
      console.error(err)
    }
  } else {
    // recover in prod to reduce the impact on end-user
    console.error(err)
  }
}
