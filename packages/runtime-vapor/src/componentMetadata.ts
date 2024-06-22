import { remove } from '@vue/shared'
import type { DelegatedHandler } from './dom/event'
import type { Data } from '@vue/runtime-shared'
import { type ShallowRef, shallowRef } from '@vue/reactivity'

export enum MetadataKind {
  prop,
  event,
  internalProps,
  setDynamicProps,
}

export type ComponentMetadata = [
  props: Data,
  events: Record<string, DelegatedHandler[]>,
  internalProps: ShallowRef<Data | undefined>,
  setDynamicProps?: () => void,
]

export function getMetadata(
  el: Node & { $$metadata?: ComponentMetadata },
): ComponentMetadata {
  return el.$$metadata || (el.$$metadata = [{}, {}, shallowRef()])
}

export function recordPropMetadata(el: Node, key: string, value: any): any {
  const metadata = getMetadata(el)[MetadataKind.prop]
  const prev = metadata[key]
  metadata[key] = value
  return prev
}

export function recordEventMetadata(el: Node, key: string, value: any) {
  const metadata = getMetadata(el)[MetadataKind.event]
  const handlers = (metadata[key] ||= [])
  handlers.push(value)
  return () => remove(handlers, value)
}
