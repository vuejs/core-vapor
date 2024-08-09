import {
  type Component,
  type ComponentInternalInstance,
  currentInstance,
} from './component'
import { isFunction, isObject } from '@vue/shared'
import { defineComponent } from './apiDefineComponent'
import { warn } from './warning'
import { ref } from '@vue/reactivity'
import { VaporErrorCodes, handleError } from './errorHandling'
import { createComponent } from './apiCreateComponent'
import { createIf } from './apiCreateIf'

export type AsyncComponentResolveResult<T = Component> = T | { default: T } // es modules

export type AsyncComponentLoader<T = any> = () => Promise<
  AsyncComponentResolveResult<T>
>

export interface AsyncComponentOptions<T = any> {
  loader: AsyncComponentLoader<T>
  loadingComponent?: Component
  errorComponent?: Component
  delay?: number
  timeout?: number
  suspensible?: boolean
  onError?: (
    error: Error,
    retry: () => void,
    fail: () => void,
    attempts: number,
  ) => any
}

export const isAsyncWrapper = (i: ComponentInternalInstance): boolean =>
  !!i.type.__asyncLoader

/*! #__NO_SIDE_EFFECTS__ */
export function defineAsyncComponent<T extends Component = Component>(
  source: AsyncComponentLoader<T> | AsyncComponentOptions<T>,
): T {
  if (isFunction(source)) {
    source = { loader: source }
  }

  const {
    loader,
    loadingComponent,
    errorComponent,
    delay = 200,
    timeout, // undefined = never times out
    // suspensible = true,
    onError: userOnError,
  } = source

  let pendingRequest: Promise<Component> | null = null
  let resolvedComp: Component | undefined

  let retries = 0
  const retry = () => {
    retries++
    pendingRequest = null
    return load()
  }

  const load = (): Promise<Component> => {
    let thisRequest: Promise<Component>
    return (
      pendingRequest ||
      (thisRequest = pendingRequest =
        loader()
          .catch(err => {
            err = err instanceof Error ? err : new Error(String(err))
            if (userOnError) {
              return new Promise((resolve, reject) => {
                const userRetry = () => resolve(retry())
                const userFail = () => reject(err)
                userOnError(err, userRetry, userFail, retries + 1)
              })
            } else {
              throw err
            }
          })
          .then((comp: any) => {
            if (thisRequest !== pendingRequest && pendingRequest) {
              return pendingRequest
            }
            if (__DEV__ && !comp) {
              warn(
                `Async component loader resolved to undefined. ` +
                  `If you are using retry(), make sure to return its return value.`,
              )
            }
            // interop module default
            if (
              comp &&
              (comp.__esModule || comp[Symbol.toStringTag] === 'Module')
            ) {
              comp = comp.default
            }
            if (__DEV__ && comp && !isObject(comp) && !isFunction(comp)) {
              throw new Error(`Invalid async component load result: ${comp}`)
            }
            resolvedComp = comp
            return comp
          }))
    )
  }

  return defineComponent({
    name: 'AsyncComponentWrapper',

    __asyncLoader: load,

    get __asyncResolved() {
      return resolvedComp
    },

    setup() {
      const instance = currentInstance!

      // already resolved
      if (resolvedComp) {
        return createInnerComp(resolvedComp!, instance)
      }

      const onError = (err: Error) => {
        pendingRequest = null
        handleError(
          err,
          instance,
          VaporErrorCodes.ASYNC_COMPONENT_LOADER,
          !errorComponent /* do not throw in dev if user provided error component */,
        )
      }

      // TODO: handle suspense and SSR.
      // suspense-controlled or SSR.
      // if (
      //   (__FEATURE_SUSPENSE__ && suspensible && instance.suspense) ||
      //   (__SSR__ && isInSSRComponentSetup)
      // ) {
      //   return load()
      //     .then(comp => {
      //       return () => createInnerComp(comp, instance)
      //     })
      //     .catch(err => {
      //       onError(err)
      //       return () =>
      //         errorComponent
      //           ? createVNode(errorComponent as ConcreteComponent, {
      //               error: err,
      //             })
      //           : null
      //     })
      // }

      const loaded = ref(false)
      const error = ref()
      const delayed = ref(!!delay)

      if (delay) {
        setTimeout(() => {
          delayed.value = false
        }, delay)
      }

      if (timeout != null) {
        setTimeout(() => {
          if (!loaded.value && !error.value) {
            const err = new Error(
              `Async component timed out after ${timeout}ms.`,
            )
            onError(err)
            error.value = err
          }
        }, timeout)
      }

      load()
        .then(() => {
          loaded.value = true
          // TODO: handle keep-alive.
          // if (instance.parent && isKeepAlive(instance.parent.vnode)) {
          //   // parent is keep-alive, force update so the loaded component's
          //   // name is taken into account
          //   queueJob(instance.parent.update)
          // }
        })
        .catch(err => {
          onError(err)
          error.value = err
        })

      return createIf(
        () => loaded.value && resolvedComp,
        () => {
          return createInnerComp(resolvedComp!, instance)
        },
        () =>
          createIf(
            () => error.value && errorComponent,
            () =>
              createComponent(errorComponent!, [{ error: () => error.value }]),
            () =>
              createIf(
                () => loadingComponent && !delayed.value,
                () => createComponent(loadingComponent!),
              ),
          ),
      )
    },
  }) as T
}

function createInnerComp(comp: Component, parent: ComponentInternalInstance) {
  const { rawProps: props, rawSlots: slots } = parent
  const innerComp = createComponent(comp, props, slots)
  // const vnode = createVNode(comp, props, children)
  // // ensure inner component inherits the async wrapper's ref owner
  innerComp.refs = parent.refs
  // vnode.ref = ref
  // // pass the custom element callback on to the inner comp
  // // and remove it from the async wrapper
  // vnode.ce = ce
  // delete parent.vnode.ce

  return innerComp
}
