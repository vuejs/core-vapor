import {
  type Data,
  EMPTY_ARR,
  EMPTY_OBJ,
  camelize,
  extend,
  hasOwn,
  hyphenate,
  isArray,
  isFunction,
} from '@vue/shared'
import { baseWatch, shallowReactive } from '@vue/reactivity'
import { warn } from './warning'
import {
  type Component,
  type ComponentInternalInstance,
  setCurrentInstance,
} from './component'
import { patchAttrs } from './componentAttrs'
import { createVaporPreScheduler } from './scheduler'

export type ComponentPropsOptions<P = Data> =
  | ComponentObjectPropsOptions<P>
  | string[]

export type ComponentObjectPropsOptions<P = Data> = {
  [K in keyof P]: Prop<P[K]> | null
}

export type Prop<T, D = T> = PropOptions<T, D> | PropType<T>

type DefaultFactory<T> = (props: Data) => T | null | undefined

export interface PropOptions<T = any, D = T> {
  type?: PropType<T> | true | null
  required?: boolean
  default?: D | DefaultFactory<D> | null | undefined | object
  validator?(value: unknown, props: Data): boolean
  /**
   * @internal
   */
  skipFactory?: boolean
}

export type PropType<T> = PropConstructor<T> | PropConstructor<T>[]

type PropConstructor<T = any> =
  | { new (...args: any[]): T & {} }
  | { (): T }
  | PropMethod<T>

type PropMethod<T, TConstructor = any> = [T] extends [
  ((...args: any) => any) | undefined,
] // if is function with args, allowing non-required functions
  ? { new (): TConstructor; (): T; readonly prototype: TConstructor } // Create Function like constructor
  : never

enum BooleanFlags {
  shouldCast,
  shouldCastTrue,
}

type NormalizedProp =
  | null
  | (PropOptions & {
      [BooleanFlags.shouldCast]?: boolean
      [BooleanFlags.shouldCastTrue]?: boolean
    })

export type NormalizedProps = Record<string, NormalizedProp>
export type NormalizedPropsOptions =
  | [props: NormalizedProps, needCastKeys: string[]]
  | []

type StaticProps = Record<string, () => unknown>
type DynamicProps = () => Data
export type NormalizedRawProps = Array<StaticProps | DynamicProps>
export type RawProps = NormalizedRawProps | StaticProps | null

export function initProps(
  instance: ComponentInternalInstance,
  rawProps: RawProps,
  isStateful: boolean,
) {
  const props: Data = {}
  const attrs = (instance.attrs = shallowReactive<Data>({}))

  if (!rawProps) rawProps = []
  else if (!isArray(rawProps)) rawProps = [rawProps]
  instance.rawProps = rawProps

  const [options] = instance.propsOptions

  const hasDynamicProps = rawProps.some(isFunction)
  if (options) {
    if (hasDynamicProps) {
      for (const key in options) {
        const getter = () =>
          getDynamicPropValue(rawProps as NormalizedRawProps, key)
        registerProp(instance, props, key, getter, true)
      }
    } else {
      for (const key in options) {
        const rawKey = rawProps[0] && getRawKey(rawProps[0] as StaticProps, key)
        if (rawKey) {
          registerProp(
            instance,
            props,
            key,
            (rawProps[0] as StaticProps)[rawKey],
          )
        } else {
          registerProp(instance, props, key, undefined, false, true)
        }
      }
    }
  }

  // validation
  if (__DEV__) {
    validateProps(rawProps, props, options || {})
  }

  if (hasDynamicProps) {
    baseWatch(() => patchAttrs(instance), undefined, {
      scheduler: createVaporPreScheduler(instance),
    })
  } else {
    patchAttrs(instance)
  }

  if (isStateful) {
    instance.props = /* isSSR ? props :  */ shallowReactive(props)
  } else {
    // functional w/ optional props, props === attrs
    instance.props = instance.propsOptions === EMPTY_ARR ? attrs : props
  }
}

function registerProp(
  instance: ComponentInternalInstance,
  props: Data,
  rawKey: string,
  getter?: (() => unknown) | (() => DynamicPropResult),
  isDynamic?: boolean,
  isAbsent?: boolean,
) {
  const key = camelize(rawKey)
  if (key in props) return

  const [options, needCastKeys] = instance.propsOptions
  const needCast = needCastKeys && needCastKeys.includes(key)
  const withCast = (value: unknown, absent?: boolean) =>
    resolvePropValue(options!, props, key, value, instance, absent)

  if (isAbsent) {
    props[key] = needCast ? withCast(undefined, true) : undefined
  } else {
    const get: () => unknown = isDynamic
      ? needCast
        ? () => withCast(...(getter!() as DynamicPropResult))
        : () => (getter!() as DynamicPropResult)[0]
      : needCast
        ? () => withCast(getter!())
        : getter!

    Object.defineProperty(props, key, {
      get,
      enumerable: true,
    })
  }
}

function getRawKey(obj: Data, key: string) {
  return Object.keys(obj).find(k => camelize(k) === key)
}

type DynamicPropResult = [value: unknown, absent: boolean]
function getDynamicPropValue(
  rawProps: NormalizedRawProps,
  key: string,
): DynamicPropResult {
  for (const props of Array.from(rawProps).reverse()) {
    if (isFunction(props)) {
      const resolved = props()
      const rawKey = getRawKey(resolved, key)
      if (rawKey) return [resolved[rawKey], false]
    } else {
      const rawKey = getRawKey(props, key)
      if (rawKey) return [props[rawKey](), false]
    }
  }
  return [undefined, true]
}

function resolvePropValue(
  options: NormalizedProps,
  props: Data,
  key: string,
  value: unknown,
  instance: ComponentInternalInstance,
  isAbsent?: boolean,
) {
  const opt = options[key]
  if (opt != null) {
    const hasDefault = hasOwn(opt, 'default')
    // default values
    if (hasDefault && value === undefined) {
      const defaultValue = opt.default
      if (
        opt.type !== Function &&
        !opt.skipFactory &&
        isFunction(defaultValue)
      ) {
        // TODO: caching?
        // const { propsDefaults } = instance
        // if (key in propsDefaults) {
        //   value = propsDefaults[key]
        // } else {
        const reset = setCurrentInstance(instance)
        value = defaultValue.call(null, props)
        reset()
        // }
      } else {
        value = defaultValue
      }
    }
    // boolean casting
    if (opt[BooleanFlags.shouldCast]) {
      if (isAbsent && !hasDefault) {
        value = false
      } else if (
        opt[BooleanFlags.shouldCastTrue] &&
        (value === '' || value === hyphenate(key))
      ) {
        value = true
      }
    }
  }
  return value
}

export function normalizePropsOptions(comp: Component): NormalizedPropsOptions {
  // TODO: cahching?

  const raw = comp.props
  const normalized: NormalizedProps | undefined = {}
  const needCastKeys: NormalizedPropsOptions[1] = []

  if (!raw) {
    return EMPTY_ARR as []
  }

  if (isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      const normalizedKey = camelize(raw[i])
      if (validatePropName(normalizedKey)) {
        normalized[normalizedKey] = EMPTY_OBJ
      }
    }
  } else {
    for (const key in raw) {
      const normalizedKey = camelize(key)
      if (validatePropName(normalizedKey)) {
        const opt = raw[key]
        const prop: NormalizedProp = (normalized[normalizedKey] =
          isArray(opt) || isFunction(opt) ? { type: opt } : extend({}, opt))
        if (prop) {
          const booleanIndex = getTypeIndex(Boolean, prop.type)
          const stringIndex = getTypeIndex(String, prop.type)
          prop[BooleanFlags.shouldCast] = booleanIndex > -1
          prop[BooleanFlags.shouldCastTrue] =
            stringIndex < 0 || booleanIndex < stringIndex
          // if the prop needs boolean casting or default value
          if (booleanIndex > -1 || hasOwn(prop, 'default')) {
            needCastKeys.push(normalizedKey)
          }
        }
      }
    }
  }

  const res: NormalizedPropsOptions = [normalized, needCastKeys]
  return res
}

function validatePropName(key: string) {
  if (key[0] !== '$') {
    return true
  } else if (__DEV__) {
    warn(`Invalid prop name: "${key}" is a reserved property.`)
  }
  return false
}

function getType(ctor: Prop<any>): string {
  const match = ctor && ctor.toString().match(/^\s*(function|class) (\w+)/)
  return match ? match[2] : ctor === null ? 'null' : ''
}

function isSameType(a: Prop<any>, b: Prop<any>): boolean {
  return getType(a) === getType(b)
}

function getTypeIndex(
  type: Prop<any>,
  expectedTypes: PropType<any> | void | null | true,
): number {
  if (isArray(expectedTypes)) {
    return expectedTypes.findIndex(t => isSameType(t, type))
  } else if (isFunction(expectedTypes)) {
    return isSameType(expectedTypes, type) ? 0 : -1
  }
  return -1
}

/**
 * dev only
 */
function validateProps(
  rawProps: NormalizedRawProps,
  props: Data,
  options: NormalizedProps,
) {
  const presentKeys: string[] = []
  for (const props of rawProps) {
    presentKeys.push(...Object.keys(isFunction(props) ? props() : props))
  }

  for (const key in options) {
    const opt = options[key]
    if (opt != null)
      validateProp(
        key,
        props[key],
        opt,
        props,
        !presentKeys.some(k => camelize(k) === key),
      )
  }
}

/**
 * dev only
 */
function validateProp(
  name: string,
  value: unknown,
  option: PropOptions,
  props: Data,
  isAbsent: boolean,
) {
  const { required, validator } = option
  // required!
  if (required && isAbsent) {
    warn('Missing required prop: "' + name + '"')
    return
  }
  // missing but optional
  if (value == null && !required) {
    return
  }
  // NOTE: type check is not supported in vapor
  // // type check
  // if (type != null && type !== true) {
  //   let isValid = false
  //   const types = isArray(type) ? type : [type]
  //   const expectedTypes = []
  //   // value is valid as long as one of the specified types match
  //   for (let i = 0; i < types.length && !isValid; i++) {
  //     const { valid, expectedType } = assertType(value, types[i])
  //     expectedTypes.push(expectedType || '')
  //     isValid = valid
  //   }
  //   if (!isValid) {
  //     warn(getInvalidTypeMessage(name, value, expectedTypes))
  //     return
  //   }
  // }

  // custom validator
  if (validator && !validator(value, props)) {
    warn('Invalid prop: custom validator check failed for prop "' + name + '".')
  }
}
