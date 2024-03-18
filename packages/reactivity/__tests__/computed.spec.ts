import {
  h,
  nextTick,
  nodeOps,
  onMounted,
  onUnmounted,
  render,
  serializeInner,
} from '@vue/runtime-test'
import {
  type DebuggerEvent,
  ITERATE_KEY,
  TrackOpTypes,
  TriggerOpTypes,
  type WritableComputedRef,
  computed,
  effect,
  isReadonly,
  reactive,
  ref,
  shallowRef,
  toRaw,
} from '../src'
import { EffectFlags, pauseTracking, resetTracking } from '../src/effect'
import type { ComputedRef, ComputedRefImpl } from '../src/computed'

describe('reactivity/computed', () => {
  it('should return updated value', () => {
    const value = reactive<{ foo?: number }>({})
    const cValue = computed(() => value.foo)
    expect(cValue.value).toBe(undefined)
    value.foo = 1
    expect(cValue.value).toBe(1)
  })

  it('should compute lazily', () => {
    const value = reactive<{ foo?: number }>({})
    const getter = vi.fn(() => value.foo)
    const cValue = computed(getter)

    // lazy
    expect(getter).not.toHaveBeenCalled()

    expect(cValue.value).toBe(undefined)
    expect(getter).toHaveBeenCalledTimes(1)

    // should not compute again
    cValue.value
    expect(getter).toHaveBeenCalledTimes(1)

    // should not compute until needed
    value.foo = 1
    expect(getter).toHaveBeenCalledTimes(1)

    // now it should compute
    expect(cValue.value).toBe(1)
    expect(getter).toHaveBeenCalledTimes(2)

    // should not compute again
    cValue.value
    expect(getter).toHaveBeenCalledTimes(2)
  })

  it('should trigger effect', () => {
    const value = reactive<{ foo?: number }>({})
    const cValue = computed(() => value.foo)
    let dummy
    effect(() => {
      dummy = cValue.value
    })
    expect(dummy).toBe(undefined)
    value.foo = 1
    expect(dummy).toBe(1)
  })

  it('should work when chained', () => {
    const value = reactive({ foo: 0 })
    const c1 = computed(() => value.foo)
    const c2 = computed(() => c1.value + 1)
    expect(c2.value).toBe(1)
    expect(c1.value).toBe(0)
    value.foo++
    expect(c2.value).toBe(2)
    expect(c1.value).toBe(1)
  })

  it('should trigger effect when chained', () => {
    const value = reactive({ foo: 0 })
    const getter1 = vi.fn(() => value.foo)
    const getter2 = vi.fn(() => {
      return c1.value + 1
    })
    const c1 = computed(getter1)
    const c2 = computed(getter2)

    let dummy
    effect(() => {
      dummy = c2.value
    })
    expect(dummy).toBe(1)
    expect(getter1).toHaveBeenCalledTimes(1)
    expect(getter2).toHaveBeenCalledTimes(1)
    value.foo++
    expect(dummy).toBe(2)
    // should not result in duplicate calls
    expect(getter1).toHaveBeenCalledTimes(2)
    expect(getter2).toHaveBeenCalledTimes(2)
  })

  it('should trigger effect when chained (mixed invocations)', () => {
    const value = reactive({ foo: 0 })
    const getter1 = vi.fn(() => value.foo)
    const getter2 = vi.fn(() => {
      return c1.value + 1
    })
    const c1 = computed(getter1)
    const c2 = computed(getter2)

    let dummy
    effect(() => {
      dummy = c1.value + c2.value
    })
    expect(dummy).toBe(1)

    expect(getter1).toHaveBeenCalledTimes(1)
    expect(getter2).toHaveBeenCalledTimes(1)
    value.foo++
    expect(dummy).toBe(3)
    // should not result in duplicate calls
    expect(getter1).toHaveBeenCalledTimes(2)
    expect(getter2).toHaveBeenCalledTimes(2)
  })

  it('should support setter', () => {
    const n = ref(1)
    const plusOne = computed({
      get: () => n.value + 1,
      set: val => {
        n.value = val - 1
      },
    })

    expect(plusOne.value).toBe(2)
    n.value++
    expect(plusOne.value).toBe(3)

    plusOne.value = 0
    expect(n.value).toBe(-1)
  })

  it('should trigger effect w/ setter', () => {
    const n = ref(1)
    const plusOne = computed({
      get: () => n.value + 1,
      set: val => {
        n.value = val - 1
      },
    })

    let dummy
    effect(() => {
      dummy = n.value
    })
    expect(dummy).toBe(1)

    plusOne.value = 0
    expect(dummy).toBe(-1)
  })

  // #5720
  it('should invalidate before non-computed effects', () => {
    let plusOneValues: number[] = []
    const n = ref(0)
    const plusOne = computed(() => n.value + 1)
    effect(() => {
      n.value
      plusOneValues.push(plusOne.value)
    })
    // access plusOne, causing it to be non-dirty
    plusOne.value
    // mutate n
    n.value++
    // on the 2nd run, plusOne.value should have already updated.
    expect(plusOneValues).toMatchObject([1, 2])
  })

  it('should warn if trying to set a readonly computed', () => {
    const n = ref(1)
    const plusOne = computed(() => n.value + 1)
    ;(plusOne as WritableComputedRef<number>).value++ // Type cast to prevent TS from preventing the error

    expect(
      'Write operation failed: computed value is readonly',
    ).toHaveBeenWarnedLast()
  })

  it('should be readonly', () => {
    let a = { a: 1 }
    const x = computed(() => a)
    expect(isReadonly(x)).toBe(true)
    expect(isReadonly(x.value)).toBe(false)
    expect(isReadonly(x.value.a)).toBe(false)
    const z = computed<typeof a>({
      get() {
        return a
      },
      set(v) {
        a = v
      },
    })
    expect(isReadonly(z)).toBe(false)
    expect(isReadonly(z.value.a)).toBe(false)
  })

  it('debug: onTrack', () => {
    let events: DebuggerEvent[] = []
    const onTrack = vi.fn((e: DebuggerEvent) => {
      events.push(e)
    })
    const obj = reactive({ foo: 1, bar: 2 })
    const c = computed(() => (obj.foo, 'bar' in obj, Object.keys(obj)), {
      onTrack,
    })
    expect(c.value).toEqual(['foo', 'bar'])
    expect(onTrack).toHaveBeenCalledTimes(3)
    expect(events).toEqual([
      {
        effect: c,
        target: toRaw(obj),
        type: TrackOpTypes.GET,
        key: 'foo',
      },
      {
        effect: c,
        target: toRaw(obj),
        type: TrackOpTypes.HAS,
        key: 'bar',
      },
      {
        effect: c,
        target: toRaw(obj),
        type: TrackOpTypes.ITERATE,
        key: ITERATE_KEY,
      },
    ])
  })

  it('debug: onTrigger', () => {
    let events: DebuggerEvent[] = []
    const onTrigger = vi.fn((e: DebuggerEvent) => {
      events.push(e)
    })
    const obj = reactive<{ foo?: number }>({ foo: 1 })
    const c = computed(() => obj.foo, { onTrigger })

    // computed won't track until it has a subscriber
    effect(() => c.value)

    obj.foo!++
    expect(c.value).toBe(2)
    expect(onTrigger).toHaveBeenCalledTimes(1)
    expect(events[0]).toEqual({
      effect: c,
      target: toRaw(obj),
      type: TriggerOpTypes.SET,
      key: 'foo',
      oldValue: 1,
      newValue: 2,
    })

    delete obj.foo
    expect(c.value).toBeUndefined()
    expect(onTrigger).toHaveBeenCalledTimes(2)
    expect(events[1]).toEqual({
      effect: c,
      target: toRaw(obj),
      type: TriggerOpTypes.DELETE,
      key: 'foo',
      oldValue: 2,
    })
  })

  // https://github.com/vuejs/core/pull/5912#issuecomment-1497596875
  it('should query deps dirty sequentially', () => {
    const cSpy = vi.fn()

    const a = ref<null | { v: number }>({
      v: 1,
    })
    const b = computed(() => {
      return a.value
    })
    const c = computed(() => {
      cSpy()
      return b.value?.v
    })
    const d = computed(() => {
      if (b.value) {
        return c.value
      }
      return 0
    })

    d.value
    a.value!.v = 2
    a.value = null
    d.value
    expect(cSpy).toHaveBeenCalledTimes(1)
  })

  // https://github.com/vuejs/core/pull/5912#issuecomment-1738257692
  it('chained computed dirty reallocation after querying dirty', () => {
    let _msg: string | undefined

    const items = ref<number[]>()
    const isLoaded = computed(() => {
      return !!items.value
    })
    const msg = computed(() => {
      if (isLoaded.value) {
        return 'The items are loaded'
      } else {
        return 'The items are not loaded'
      }
    })

    effect(() => {
      _msg = msg.value
    })

    items.value = [1, 2, 3]
    items.value = [1, 2, 3]
    items.value = undefined

    expect(_msg).toBe('The items are not loaded')
  })

  it('chained computed dirty reallocation after trigger computed getter', () => {
    let _msg: string | undefined

    const items = ref<number[]>()
    const isLoaded = computed(() => {
      return !!items.value
    })
    const msg = computed(() => {
      if (isLoaded.value) {
        return 'The items are loaded'
      } else {
        return 'The items are not loaded'
      }
    })

    _msg = msg.value
    items.value = [1, 2, 3]
    isLoaded.value // <- trigger computed getter
    _msg = msg.value
    items.value = undefined
    _msg = msg.value

    expect(_msg).toBe('The items are not loaded')
  })

  // https://github.com/vuejs/core/pull/5912#issuecomment-1739159832
  it('deps order should be consistent with the last time get value', () => {
    const cSpy = vi.fn()

    const a = ref(0)
    const b = computed(() => {
      return a.value % 3 !== 0
    }) as unknown as ComputedRefImpl
    const c = computed(() => {
      cSpy()
      if (a.value % 3 === 2) {
        return 'expensive'
      }
      return 'cheap'
    }) as unknown as ComputedRefImpl
    const d = computed(() => {
      return a.value % 3 === 2
    }) as unknown as ComputedRefImpl
    const e = computed(() => {
      if (b.value) {
        if (d.value) {
          return 'Avoiding expensive calculation'
        }
      }
      return c.value
    }) as unknown as ComputedRefImpl

    e.value
    a.value++
    e.value

    expect(e.deps!.dep).toBe(b.dep)
    expect(e.deps!.nextDep!.dep).toBe(d.dep)
    expect(e.deps!.nextDep!.nextDep!.dep).toBe(c.dep)
    expect(cSpy).toHaveBeenCalledTimes(2)

    a.value++
    e.value

    expect(cSpy).toHaveBeenCalledTimes(2)
  })

  it('should trigger by the second computed that maybe dirty', () => {
    const cSpy = vi.fn()

    const src1 = ref(0)
    const src2 = ref(0)
    const c1 = computed(() => src1.value)
    const c2 = computed(() => (src1.value % 2) + src2.value)
    const c3 = computed(() => {
      cSpy()
      c1.value
      c2.value
    })

    c3.value
    src1.value = 2
    c3.value
    expect(cSpy).toHaveBeenCalledTimes(2)
    src2.value = 1
    c3.value
    expect(cSpy).toHaveBeenCalledTimes(3)
  })

  it('should trigger the second effect', () => {
    const fnSpy = vi.fn()
    const v = ref(1)
    const c = computed(() => v.value)

    effect(() => {
      c.value
    })
    effect(() => {
      c.value
      fnSpy()
    })

    expect(fnSpy).toBeCalledTimes(1)
    v.value = 2
    expect(fnSpy).toBeCalledTimes(2)
  })

  it('should chained recursive effects clear dirty after trigger', () => {
    const v = ref(1)
    const c1 = computed(() => v.value) as unknown as ComputedRefImpl
    const c2 = computed(() => c1.value) as unknown as ComputedRefImpl

    c2.value
    expect(c1.flags & EffectFlags.DIRTY).toBeFalsy()
    expect(c2.flags & EffectFlags.DIRTY).toBeFalsy()
  })

  it('should chained computeds dirtyLevel update with first computed effect', () => {
    const v = ref(0)
    const c1 = computed(() => {
      if (v.value === 0) {
        v.value = 1
      }
      return v.value
    })
    const c2 = computed(() => c1.value)
    const c3 = computed(() => c2.value)

    c3.value
    // expect(COMPUTED_SIDE_EFFECT_WARN).toHaveBeenWarned()
  })

  it('should work when chained(ref+computed)', () => {
    const v = ref(0)
    const c1 = computed(() => {
      if (v.value === 0) {
        v.value = 1
      }
      return 'foo'
    })
    const c2 = computed(() => v.value + c1.value)
    expect(c2.value).toBe('0foo')
    expect(c2.value).toBe('1foo')
    // expect(COMPUTED_SIDE_EFFECT_WARN).toHaveBeenWarned()
  })

  it('should trigger effect even computed already dirty', () => {
    const fnSpy = vi.fn()
    const v = ref(0)
    const c1 = computed(() => {
      if (v.value === 0) {
        v.value = 1
      }
      return 'foo'
    })
    const c2 = computed(() => v.value + c1.value)

    effect(() => {
      fnSpy(c2.value)
    })
    expect(fnSpy).toBeCalledTimes(1)
    expect(fnSpy.mock.calls).toMatchObject([['0foo']])
    expect(v.value).toBe(1)
    v.value = 2
    expect(fnSpy).toBeCalledTimes(2)
    expect(fnSpy.mock.calls).toMatchObject([['0foo'], ['2foo']])
    expect(v.value).toBe(2)
    // expect(COMPUTED_SIDE_EFFECT_WARN).toHaveBeenWarned()
  })

  // #10185
  it('should not override queried MaybeDirty result', () => {
    class Item {
      v = ref(0)
    }
    const v1 = shallowRef()
    const v2 = ref(false)
    const c1 = computed(() => {
      let c = v1.value
      if (!v1.value) {
        c = new Item()
        v1.value = c
      }
      return c.v.value
    })
    const c2 = computed(() => {
      if (!v2.value) return 'no'
      return c1.value ? 'yes' : 'no'
    })
    const c3 = computed(() => c2.value)

    c3.value
    v2.value = true

    c3.value
    v1.value.v.value = 999

    expect(c3.value).toBe('yes')
    // expect(COMPUTED_SIDE_EFFECT_WARN).toHaveBeenWarned()
  })

  it('should be not dirty after deps mutate (mutate deps in computed)', async () => {
    const state = reactive<any>({})
    const consumer = computed(() => {
      if (!('a' in state)) state.a = 1
      return state.a
    })
    const Comp = {
      setup: () => {
        nextTick().then(() => {
          state.a = 2
        })
        return () => consumer.value
      },
    }
    const root = nodeOps.createElement('div')
    render(h(Comp), root)
    await nextTick()
    await nextTick()
    expect(serializeInner(root)).toBe(`2`)
    // expect(COMPUTED_SIDE_EFFECT_WARN).toHaveBeenWarned()
  })

  it('should not trigger effect scheduler by recursive computed effect', async () => {
    const v = ref('Hello')
    const c = computed(() => {
      v.value += ' World'
      return v.value
    })
    const Comp = {
      setup: () => {
        return () => c.value
      },
    }
    const root = nodeOps.createElement('div')

    render(h(Comp), root)
    await nextTick()
    expect(serializeInner(root)).toBe('Hello World')

    v.value += ' World'
    await nextTick()
    expect(serializeInner(root)).toBe('Hello World World World')
    // expect(COMPUTED_SIDE_EFFECT_WARN).toHaveBeenWarned()
  })

  test('should not trigger if value did not change', () => {
    const src = ref(0)
    const c = computed(() => src.value % 2)
    const spy = vi.fn()
    effect(() => {
      spy(c.value)
    })
    expect(spy).toHaveBeenCalledTimes(1)
    src.value = 2

    // should not trigger
    expect(spy).toHaveBeenCalledTimes(1)

    src.value = 3
    src.value = 5
    // should trigger because latest value changes
    expect(spy).toHaveBeenCalledTimes(2)
  })

  test('chained computed trigger', () => {
    const effectSpy = vi.fn()
    const c1Spy = vi.fn()
    const c2Spy = vi.fn()

    const src = ref(0)
    const c1 = computed(() => {
      c1Spy()
      return src.value % 2
    })
    const c2 = computed(() => {
      c2Spy()
      return c1.value + 1
    })

    effect(() => {
      effectSpy(c2.value)
    })

    expect(c1Spy).toHaveBeenCalledTimes(1)
    expect(c2Spy).toHaveBeenCalledTimes(1)
    expect(effectSpy).toHaveBeenCalledTimes(1)

    src.value = 1
    expect(c1Spy).toHaveBeenCalledTimes(2)
    expect(c2Spy).toHaveBeenCalledTimes(2)
    expect(effectSpy).toHaveBeenCalledTimes(2)
  })

  test('chained computed avoid re-compute', () => {
    const effectSpy = vi.fn()
    const c1Spy = vi.fn()
    const c2Spy = vi.fn()

    const src = ref(0)
    const c1 = computed(() => {
      c1Spy()
      return src.value % 2
    })
    const c2 = computed(() => {
      c2Spy()
      return c1.value + 1
    })

    effect(() => {
      effectSpy(c2.value)
    })

    expect(effectSpy).toHaveBeenCalledTimes(1)
    src.value = 2
    src.value = 4
    src.value = 6
    expect(c1Spy).toHaveBeenCalledTimes(4)
    // c2 should not have to re-compute because c1 did not change.
    expect(c2Spy).toHaveBeenCalledTimes(1)
    // effect should not trigger because c2 did not change.
    expect(effectSpy).toHaveBeenCalledTimes(1)
  })

  test('chained computed value invalidation', () => {
    const effectSpy = vi.fn()
    const c1Spy = vi.fn()
    const c2Spy = vi.fn()

    const src = ref(0)
    const c1 = computed(() => {
      c1Spy()
      return src.value % 2
    })
    const c2 = computed(() => {
      c2Spy()
      return c1.value + 1
    })

    effect(() => {
      effectSpy(c2.value)
    })

    expect(effectSpy).toHaveBeenCalledTimes(1)
    expect(effectSpy).toHaveBeenCalledWith(1)
    expect(c2.value).toBe(1)

    expect(c1Spy).toHaveBeenCalledTimes(1)
    expect(c2Spy).toHaveBeenCalledTimes(1)

    src.value = 1
    // value should be available sync
    expect(c2.value).toBe(2)
    expect(c2Spy).toHaveBeenCalledTimes(2)
  })

  test('sync access of invalidated chained computed should not prevent final effect from running', () => {
    const effectSpy = vi.fn()
    const c1Spy = vi.fn()
    const c2Spy = vi.fn()

    const src = ref(0)
    const c1 = computed(() => {
      c1Spy()
      return src.value % 2
    })
    const c2 = computed(() => {
      c2Spy()
      return c1.value + 1
    })

    effect(() => {
      effectSpy(c2.value)
    })
    expect(effectSpy).toHaveBeenCalledTimes(1)

    src.value = 1
    // sync access c2
    c2.value
    expect(effectSpy).toHaveBeenCalledTimes(2)
  })

  it('computed should force track in untracked zone', () => {
    const n = ref(0)
    const spy1 = vi.fn()
    const spy2 = vi.fn()

    let c: ComputedRef
    effect(() => {
      spy1()
      pauseTracking()
      n.value
      c = computed(() => n.value + 1)
      // access computed now to force refresh
      c.value
      effect(() => spy2(c.value))
      n.value
      resetTracking()
    })

    expect(spy1).toHaveBeenCalledTimes(1)
    expect(spy2).toHaveBeenCalledTimes(1)

    n.value++
    // outer effect should not trigger
    expect(spy1).toHaveBeenCalledTimes(1)
    // inner effect should trigger
    expect(spy2).toHaveBeenCalledTimes(2)
  })

  // not recommended behavior, but needed for backwards compatibility
  // used in VueUse asyncComputed
  it('computed side effect should be able trigger', () => {
    const a = ref(false)
    const b = ref(false)
    const c = computed(() => {
      a.value = true
      return b.value
    })
    effect(() => {
      if (a.value) {
        b.value = true
      }
    })
    expect(b.value).toBe(false)
    // accessing c triggers change
    c.value
    expect(b.value).toBe(true)
    expect(c.value).toBe(true)
  })

  it('chained computed should work when accessed before having subs', () => {
    const n = ref(0)
    const c = computed(() => n.value)
    const d = computed(() => c.value + 1)
    const spy = vi.fn()

    // access
    d.value

    let dummy
    effect(() => {
      spy()
      dummy = d.value
    })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(dummy).toBe(1)

    n.value++
    expect(spy).toHaveBeenCalledTimes(2)
    expect(dummy).toBe(2)
  })

  // #10236
  it('chained computed should still refresh after owner component unmount', async () => {
    const a = ref(0)
    const spy = vi.fn()

    const Child = {
      setup() {
        const b = computed(() => a.value + 1)
        const c = computed(() => b.value + 1)
        // access
        c.value
        onUnmounted(() => spy(c.value))
        return () => {}
      },
    }

    const show = ref(true)
    const Parent = {
      setup() {
        return () => (show.value ? h(Child) : null)
      },
    }

    render(h(Parent), nodeOps.createElement('div'))

    a.value++
    show.value = false

    await nextTick()
    expect(spy).toHaveBeenCalledWith(3)
  })

  // case: radix-vue `useForwardExpose` sets a template ref during mount,
  // and checks for the element's closest form element in a computed.
  // the computed is expected to only evaluate after mount.
  it('computed deps should only be refreshed when the subscribing effect is run, not when scheduled', async () => {
    const calls: string[] = []
    const a = ref(0)
    const b = computed(() => {
      calls.push('b eval')
      return a.value + 1
    })

    const App = {
      setup() {
        onMounted(() => {
          calls.push('mounted')
        })
        return () =>
          h(
            'div',
            {
              ref: () => (a.value = 1),
            },
            b.value,
          )
      },
    }

    render(h(App), nodeOps.createElement('div'))

    await nextTick()
    expect(calls).toMatchObject(['b eval', 'mounted', 'b eval'])
  })
})
