import { onBeforeMount } from '../apiLifecycle'
import type { Directive } from '../directives'
import { renderEffect } from '../renderEffect'

export const vShowOriginalDisplay: unique symbol = Symbol('_vod')
export const vShowHidden: unique symbol = Symbol('_vsh')

export interface VShowElement extends HTMLElement {
  // _vod = vue original display
  [vShowOriginalDisplay]: string
  [vShowHidden]: boolean
}

export const vShow: Directive<VShowElement> = (node, { source }) => {
  function getValue(): boolean {
    return source ? source() : false
  }

  onBeforeMount(() => {
    node[vShowOriginalDisplay] =
      node.style.display === 'none' ? '' : node.style.display
  })

  renderEffect(() => {
    setDisplay(node, getValue())
  })
}

function setDisplay(el: VShowElement, value: unknown): void {
  el.style.display = value ? el[vShowOriginalDisplay] : 'none'
  el[vShowHidden] = !value
}
