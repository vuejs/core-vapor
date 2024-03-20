import { EffectFlags, ReactiveEffect } from '@vue/reactivity'
import { invokeArrayFns } from '@vue/shared'
import { getCurrentInstance, setCurrentInstance } from './component'
import { queueJob, queuePostRenderEffect } from './scheduler'
import { VaporErrorCodes, callWithAsyncErrorHandling } from './errorHandling'
import { invokeDirectiveHook } from './directives'

export function renderEffect(cb: () => void) {
  const instance = getCurrentInstance()
  if (instance) job.id = instance.uid

  const effect = new ReactiveEffect(() => {
    callWithAsyncErrorHandling(cb, instance, VaporErrorCodes.RENDER_FUNCTION)
  })
  effect.scheduler = () => queueJob(job)

  effect.run()

  function job() {
    if (!(effect.flags & EffectFlags.ACTIVE) || !effect.dirty) {
      return
    }

    const reset = instance && setCurrentInstance(instance)

    if (instance?.isMounted && !instance.isUpdating) {
      instance.isUpdating = true

      const { bu, u, dirs } = instance
      // beforeUpdate hook
      if (bu) {
        invokeArrayFns(bu)
      }
      if (dirs) {
        invokeDirectiveHook(instance, 'beforeUpdate', dirs)
      }

      effect.run()

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
    } else {
      effect.run()
    }

    reset?.()
  }
}
