import {
  type Component,
  type ComponentInternalInstance,
  type ObjectComponent,
  getCurrentInstance,
} from '../component'
import type { Block } from '../apiRender'
import { invokeArrayFns, isArray, isRegExp, isString } from '@vue/shared'
import { queuePostFlushCb } from '../scheduler'
import { watch } from '../apiWatch'
import { onBeforeUnmount, onMounted, onUpdated } from '../apiLifecycle'
import { warn } from '..'

type MatchPattern = string | RegExp | (string | RegExp)[]

export interface KeepAliveProps {
  include?: MatchPattern
  exclude?: MatchPattern
  max?: number | string
}

type CacheKey = PropertyKey | Component
type Cache = Map<CacheKey, ComponentInternalInstance>
type Keys = Set<CacheKey>

// TODO: render coantext alternative
export interface KeepAliveComponentInternalInstance
  extends ComponentInternalInstance {
  activate: () => void
  deactivate: () => void
}

export const isKeepAlive = (instance: ComponentInternalInstance): boolean =>
  (instance as any).__isKeepAlive

const KeepAliveImpl: ObjectComponent = {
  name: 'KeepAlive',

  // @ts-expect-error
  __isKeepAlive: true,

  props: {
    include: [String, RegExp, Array],
    exclude: [String, RegExp, Array],
    max: [String, Number],
  },

  setup(props: KeepAliveProps, { slots }) {
    const instance = getCurrentInstance() as KeepAliveComponentInternalInstance

    // TODO: ssr

    const cache: Cache = new Map()
    const keys: Keys = new Set()
    let current: ComponentInternalInstance | null = null

    // TODO: is it necessary?
    // if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
    //   ;(instance as any).__v_cache = cache
    // }

    // TODO: suspense
    // const parentSuspense = instance.suspense

    // TODO:
    // const storageContainer = template('<div></div>')()

    instance.activate = () => {
      // TODO:
      // move(vnode, container, anchor, MoveType.ENTER, parentSuspense)

      // TODO: suspense (queuePostRenderEffect)
      queuePostFlushCb(() => {
        instance.isDeactivated = false
        if (instance.a) {
          invokeArrayFns(instance.a)
        }
      })

      // TODO: devtools
      // if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      //   // Update components tree
      //   devtoolsComponentAdded(instance)
      // }
    }

    instance.deactivate = () => {
      // TODO:
      // invalidateMount(instance.m)
      // invalidateMount(instance.a)
      // move(vnode, storageContainer, null, MoveType.LEAVE, parentSuspense)

      // TODO: suspense (queuePostRenderEffect)
      queuePostFlushCb(() => {
        if (instance.da) {
          invokeArrayFns(instance.da)
        }
        instance.isDeactivated = true
      })

      // TODO: devtools
      // if (__DEV__ || __FEATURE_PROD_DEVTOOLS__) {
      //   // Update components tree
      //   devtoolsComponentAdded(instance)
      // }
    }

    function pruneCache(filter?: (name: string) => boolean) {
      cache.forEach((cachedInstance, key) => {
        const name = cachedInstance.type.name
        if (name && (!filter || !filter(name))) {
          pruneCacheEntry(key)
        }
      })
    }

    function pruneCacheEntry(key: CacheKey) {
      const cached = cache.get(key)
      if (!current || cached !== current) {
        // TODO:
        // unmount(cached)
      } else if (current) {
        // current active instance should no longer be kept-alive.
        // we can't unmount it now but it might be later, so reset its flag now.
        // TODO:
        // resetShapeFlag(current)
      }
      cache.delete(key)
      keys.delete(key)
    }

    // prune cache on include/exclude prop change
    watch(
      () => [props.include, props.exclude],
      ([include, exclude]) => {
        include && pruneCache(name => matches(include, name))
        exclude && pruneCache(name => !matches(exclude, name))
      },
      // prune post-render after `current` has been updated
      { flush: 'post', deep: true },
    )

    // cache sub tree after render
    let pendingCacheKey: CacheKey | null = null
    const cacheSubtree = () => {
      // fix #1621, the pendingCacheKey could be 0
      if (pendingCacheKey != null) {
        cache.set(pendingCacheKey, instance)
      }
    }
    onMounted(cacheSubtree)
    onUpdated(cacheSubtree)

    onBeforeUnmount(() => {
      // TODO:
    })

    // TODO: effects
    return () => {
      pendingCacheKey = null

      if (!slots.default) {
        return null
      }

      const children = slots.default()
      const childInstance = children as ComponentInternalInstance
      if (isArray(children) && children.length > 1) {
        if (__DEV__) {
          warn(`KeepAlive should contain exactly one component child.`)
        }
        current = null
        return children
      } else {
        // TODO:
      }

      const name = childInstance.type.name
      const { include, exclude, max } = props

      if (
        (include && (!name || !matches(include, name))) ||
        (exclude && name && matches(exclude, name))
      ) {
        return (current = childInstance)
      }

      const key = childInstance.type // TODO: vnode key
      const cachedBlock = cache.get(key)

      pendingCacheKey = key

      if (cachedBlock) {
        // TODO: setTransitionHooks

        keys.delete(key)
        keys.add(key)
      } else {
        keys.add(key)
        if (max && keys.size > parseInt(max as string, 10)) {
          pruneCacheEntry(keys.values().next().value)
        }
      }

      return (current = childInstance)
    }
  },
}

export const KeepAlive = KeepAliveImpl as any as {
  __isKeepAlive: true
  new (): {
    $props: KeepAliveProps
    $slots: {
      default(): Block
    }
  }
}

function matches(pattern: MatchPattern, name: string): boolean {
  if (isArray(pattern)) {
    return pattern.some((p: string | RegExp) => matches(p, name))
  } else if (isString(pattern)) {
    return pattern.split(',').includes(name)
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}
