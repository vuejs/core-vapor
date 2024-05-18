import {
  type Component,
  createComponentInstance,
  currentInstance,
} from './component'
import { setupComponent } from './apiRender'
import type { RawProps } from './componentProps'
import type { DynamicSlots, Slots } from './componentSlots'
import { withAttrs } from './componentAttrs'

export function createComponent(
  comp: Component,
  rawProps: RawProps | null = null,
  slots: Slots | null = null,
  dynamicSlots: DynamicSlots | null = null,
  singleRoot: boolean = false,
  once: boolean = false,
) {
  const current = currentInstance!
  const instance = createComponentInstance(
    comp,
    singleRoot ? withAttrs(rawProps) : rawProps,
    slots,
    dynamicSlots,
    once,
  )
  setupComponent(instance, singleRoot)

  // register sub-component with current component for lifecycle management
  current.comps.add(instance)

  return instance
}
