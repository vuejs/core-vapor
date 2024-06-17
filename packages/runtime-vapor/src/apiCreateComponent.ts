import {
  type Component,
  createComponentInstance,
  currentInstance,
} from './component'
import { type Block, setupComponent } from './apiRender'
import {
  type NormalizedRawProps,
  type RawProps,
  normalizeRawProps,
  walkRawProps,
} from './componentProps'
import type { RawSlots } from './componentSlots'
import { withAttrs } from './componentAttrs'
import { isString } from '@vue/shared'
import { renderEffect } from './renderEffect'
import { normalizeBlock } from './dom/element'
import { setDynamicProp } from './dom/prop'

export function createComponent(
  comp: Component | string,
  rawProps: RawProps | null = null,
  slots: RawSlots | null = null,
  singleRoot: boolean = false,
  once: boolean = false,
) {
  if (isString(comp)) {
    return fallbackComponent(comp, rawProps, slots, singleRoot)
  }

  const current = currentInstance!
  const instance = createComponentInstance(
    comp,
    singleRoot ? withAttrs(rawProps) : rawProps,
    slots,
    once,
  )
  setupComponent(instance, singleRoot)

  // register sub-component with current component for lifecycle management
  current.comps.add(instance)

  return instance
}

function fallbackComponent(
  comp: string,
  rawProps: RawProps | null,
  slots: RawSlots | null,
  singleRoot: boolean,
) {
  // eslint-disable-next-line no-restricted-globals
  const el = document.createElement(comp)

  if (rawProps) {
    rawProps = normalizeRawProps(rawProps)
    renderEffect(() => {
      walkRawProps(rawProps as NormalizedRawProps, (key, value, getter) => {
        setDynamicProp(el, key, getter ? value() : value)
      })
    })
  }

  if (slots && slots.length) {
    renderEffect(() => {
      let block: Block | undefined

      if (slots && slots.default) {
        block = slots.default()
      } else {
        for (const slotFn of dynamicSlots!) {
          const slot = slotFn()
          if (slot.name === 'default') {
            block = slot.fn()
            break
          }
        }
      }

      if (block) el.append(...normalizeBlock(block))
    })
  }
  return { __return: el, rawProps }
}
