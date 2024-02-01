// NOTE: runtime-core/src/componentEmits.ts

import {
  EMPTY_OBJ,
  type UnionToIntersection,
  camelize,
  extend,
  hyphenate,
  isArray,
  isFunction,
  isString,
  looseToNumber,
  toHandlerKey,
} from '@vue/shared'
import type { Component, ComponentInternalInstance } from './component'
import { VaporErrorCodes, callWithAsyncErrorHandling } from './errorHandling'

export type ObjectEmitsOptions = Record<
  string,
  ((...args: any[]) => any) | null // TODO: call validation?
>

export type EmitsOptions = ObjectEmitsOptions | string[]

export type EmitFn<
  Options = ObjectEmitsOptions,
  Event extends keyof Options = keyof Options,
> =
  Options extends Array<infer V>
    ? (event: V, ...args: any[]) => void
    : {} extends Options // if the emit is empty object (usually the default value for emit) should be converted to function
      ? (event: string, ...args: any[]) => void
      : UnionToIntersection<
          {
            [key in Event]: Options[key] extends (...args: infer Args) => any
              ? (event: key, ...args: Args) => void
              : (event: key, ...args: any[]) => void
          }[Event]
        >

export function emit(
  instance: ComponentInternalInstance,
  event: string,
  ...rawArgs: any[]
) {
  if (instance.isUnmounted) return
  const props = instance.rawProps

  let args = rawArgs
  const isModelListener = event.startsWith('update:')

  // for v-model update:xxx events, apply modifiers on args
  const modelArg = isModelListener && event.slice(7)

  if (modelArg && modelArg in props) {
    const modifiersKey = `${
      modelArg === 'modelValue' ? 'model' : modelArg
    }Modifiers`
    const { number, trim } = props[modifiersKey] || EMPTY_OBJ
    if (trim) {
      args = rawArgs.map(a => (isString(a) ? a.trim() : a))
    }
    if (number) {
      args = rawArgs.map(looseToNumber)
    }
  }

  // TODO: warn

  let handlerName
  let handler =
    props[(handlerName = toHandlerKey(event))] ||
    // also try camelCase event handler (#2249)
    props[(handlerName = toHandlerKey(camelize(event)))]
  // for v-model update:xxx events, also trigger kebab-case equivalent
  // for props passed via kebab-case
  if (!handler && isModelListener) {
    handler = props[(handlerName = toHandlerKey(hyphenate(event)))]
  }

  if (handler) {
    callWithAsyncErrorHandling(
      handler,
      instance,
      VaporErrorCodes.COMPONENT_EVENT_HANDLER,
      args,
    )
  }

  const onceHandler = props[handlerName + `Once`]
  if (onceHandler) {
    if (!instance.emitted) {
      instance.emitted = {}
    } else if (instance.emitted[handlerName]) {
      return
    }

    if (isFunction(onceHandler)) {
      instance.emitted[handlerName] = true
      callWithAsyncErrorHandling(
        handler,
        instance,
        VaporErrorCodes.COMPONENT_EVENT_HANDLER,
        args,
      )
    }
  }
}

export function normalizeEmitsOptions(
  comp: Component,
): ObjectEmitsOptions | null {
  // TODO: caching?

  const raw = comp.emits
  let normalized: ObjectEmitsOptions = {}

  if (isArray(raw)) {
    raw.forEach(key => (normalized[key] = null))
  } else {
    extend(normalized, raw)
  }

  return normalized
}
