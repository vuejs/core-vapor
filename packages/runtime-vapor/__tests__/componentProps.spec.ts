import { computed, defineComponent, ref, watchEffect } from 'vue'

import { template } from '../src/template'
import { children, setText } from '../src/dom'
import { render as renderComponent } from '../src/render'
import { nextTick } from '../src/scheduler'

let host: HTMLElement

const initHost = () => {
  host = document.createElement('div')
  host.setAttribute('id', 'host')
  document.body.appendChild(host)
}
beforeEach(() => initHost())
afterEach(() => host.remove())

describe('runtime: compoentn props', () => {
  // TODO: pending: https://github.com/vuejs/core-vapor/issues/84
  // test('should render props value (string array spec)', () => {
  //   const ChildComp = defineComponent({
  //     props: ['foo'],
  //     setup() {
  //       const __returned__ = {}
  //       Object.defineProperty(__returned__, '__isScriptSetup', {
  //         enumerable: false,
  //         value: true,
  //       })
  //       return __returned__
  //     },
  //     render(_ctx: any) {
  //       const t0 = template('<div></div>')
  //       const n0 = t0()
  //       const {
  //         0: [n1],
  //       } = children(n0)
  //       watchEffect(() => {
  //         setText(n1, void 0, _ctx.foo)
  //       })
  //       return n0
  //     },
  //   })
  //   const Comp = defineComponent({
  //     setup() {
  //       const __returned__ = {}
  //       Object.defineProperty(__returned__, '__isScriptSetup', {
  //         enumerable: false,
  //         value: true,
  //       })
  //       return __returned__
  //     },
  //     render() {
  //       const t0 = template('<div></div>')
  //       const n0 = t0()
  //       const {
  //         0: [n1],
  //       } = children(n0)
  //       renderComponent(
  //         ChildComp as any,
  //         {
  //           get foo() {
  //             return 'foo'
  //           },
  //         },
  //         n1 as any,
  //       )
  //       return n0
  //     },
  //   })
  //   renderComponent(Comp as any, {}, '#host')
  //   expect(host.innerHTML).toBe('<div><div>foo</div></div>')
  // })
  // TODO: pending: https://github.com/vuejs/core-vapor/issues/84
  // test('should render props value (object spec)', () => {
  //   const ChildComp = defineComponent({
  //     props: { foo: {} },
  //     setup() {
  //       const __returned__ = {}
  //       Object.defineProperty(__returned__, '__isScriptSetup', {
  //         enumerable: false,
  //         value: true,
  //       })
  //       return __returned__
  //     },
  //     render(_ctx: any) {
  //       const t0 = template('<div></div>')
  //       const n0 = t0()
  //       const {
  //         0: [n1],
  //       } = children(n0)
  //       watchEffect(() => {
  //         setText(n1, void 0, _ctx.foo)
  //       })
  //       return n0
  //     },
  //   })
  //   const Comp = defineComponent({
  //     setup() {
  //       const __returned__ = {}
  //       Object.defineProperty(__returned__, '__isScriptSetup', {
  //         enumerable: false,
  //         value: true,
  //       })
  //       return __returned__
  //     },
  //     render() {
  //       const t0 = template('<div></div>')
  //       const n0 = t0()
  //       const {
  //         0: [n1],
  //       } = children(n0)
  //       renderComponent(
  //         ChildComp as any,
  //         {
  //           get foo() {
  //             return 'foo'
  //           },
  //         },
  //         n1 as any,
  //       )
  //       return n0
  //     },
  //   })
  //   renderComponent(Comp as any, {}, '#host')
  //   expect(host.innerHTML).toBe('<div><div>foo</div></div>')
  // })

  // TODO: pending: https://github.com/vuejs/core-vapor/issues/84
  // test('should render props default value', () => {
  //   const ChildComp = defineComponent({
  //     props: {
  //       foo: { default: 'foo' }, // default value
  //     },
  //     setup() {
  //       const __returned__ = {}
  //       Object.defineProperty(__returned__, '__isScriptSetup', {
  //         enumerable: false,
  //         value: true,
  //       })
  //       return __returned__
  //     },
  //     render(_ctx: any) {
  //       const t0 = template('<div></div>')
  //       const n0 = t0()
  //       const {
  //         0: [n1],
  //       } = children(n0)
  //       watchEffect(() => {
  //         setText(n1, void 0, _ctx.foo)
  //       })
  //       return n0
  //     },
  //   })
  //   const Comp = defineComponent({
  //     setup() {
  //       const __returned__ = {}
  //       Object.defineProperty(__returned__, '__isScriptSetup', {
  //         enumerable: false,
  //         value: true,
  //       })
  //       return __returned__
  //     },
  //     render() {
  //       const t0 = template('<div></div>')
  //       const n0 = t0()
  //       const {
  //         0: [n1],
  //       } = children(n0)
  //       renderComponent(
  //         ChildComp as any,
  //         {
  //           /** no props are provided */
  //         },
  //         n1 as any,
  //       )
  //       return n0
  //     },
  //   })
  //   renderComponent(Comp as any, {}, '#host')
  //   expect(host.innerHTML).toBe('<div><div>foo</div></div>')
  // })
  // TODO: pending: https://github.com/vuejs/core-vapor/issues/84
  // test('should render props updates', () => {
  //   const ChildComp = defineComponent({
  //     props: { count: {} },
  //     setup() {
  //       const __returned__ = {}
  //       Object.defineProperty(__returned__, '__isScriptSetup', {
  //         enumerable: false,
  //         value: true,
  //       })
  //       return __returned__
  //     },
  //     render(_ctx: any) {
  //       const t0 = template('<div></div>')
  //       const n0 = t0()
  //       const {
  //         0: [n1],
  //       } = children(n0)
  //       watchEffect(() => {
  //         setText(n1, void 0, _ctx.count)
  //       })
  //       return n0
  //     },
  //   })
  //   const count = ref(0) // state
  //   const increment = () => count.value++
  //   const Comp = defineComponent({
  //     setup() {
  //       const __returned__ = { count }
  //       Object.defineProperty(__returned__, '__isScriptSetup', {
  //         enumerable: false,
  //         value: true,
  //       })
  //       return __returned__
  //     },
  //     render(_ctx: any) {
  //       const t0 = template('<div></div>')
  //       const n0 = t0()
  //       const {
  //         0: [n1],
  //       } = children(n0)
  //       renderComponent(
  //         ChildComp as any,
  //         {
  //           get count() {
  //             return _ctx.count
  //           },
  //         },
  //         n1 as any,
  //       )
  //       return n0
  //     },
  //   })
  //   renderComponent(Comp as any, {}, '#host')
  //   expect(host.innerHTML).toBe('<div><div>0</div></div>')
  //   increment() // update state
  //   expect(host.innerHTML).toBe('<div><div>1</div></div>')
  // })

  test('should not render props value (no props spec)', () => {
    const ChildComp = defineComponent({
      // props: { foo: {} }, // no props specs
      setup() {
        const __returned__ = {}
        Object.defineProperty(__returned__, '__isScriptSetup', {
          enumerable: false,
          value: true,
        })
        return __returned__
      },
      render(_ctx: any) {
        const t0 = template('<div></div>')
        const n0 = t0()
        const {
          0: [n1],
        } = children(n0)
        watchEffect(() => {
          setText(n1, void 0, _ctx.foo)
        })
        return n0
      },
    })
    const Comp = defineComponent({
      setup() {
        const __returned__ = {}
        Object.defineProperty(__returned__, '__isScriptSetup', {
          enumerable: false,
          value: true,
        })
        return __returned__
      },
      render() {
        const t0 = template('<div></div>')
        const n0 = t0()
        const {
          0: [n1],
        } = children(n0)
        renderComponent(
          ChildComp as any,
          {
            // but props are provided
            get foo() {
              return 'foo'
            },
          },
          n1 as any,
        )
        return n0
      },
    })
    renderComponent(Comp as any, {}, '#host')
    expect(host.innerHTML).toBe('<div><div></div></div>')
  })

  test('should render computed props', async () => {
    const ChildComp = defineComponent({
      props: { count: { type: Number, required: true } },
      setup(props) {
        const double = computed(() => props.count * 2)
        const __returned__ = { double }
        Object.defineProperty(__returned__, '__isScriptSetup', {
          enumerable: false,
          value: true,
        })
        return __returned__
      },
      render(_ctx: any) {
        const t0 = template('<div></div>')
        const n0 = t0()
        const {
          0: [n1],
        } = children(n0)
        watchEffect(() => {
          setText(n1, void 0, _ctx.double)
        })
        return n0
      },
    })

    const count = ref(0) // state
    const increment = () => count.value++

    const Comp = defineComponent({
      setup() {
        const __returned__ = { count }
        Object.defineProperty(__returned__, '__isScriptSetup', {
          enumerable: false,
          value: true,
        })
        return __returned__
      },
      render(_ctx: any) {
        const t0 = template('<div></div>')
        const n0 = t0()
        const {
          0: [n1],
        } = children(n0)
        renderComponent(
          ChildComp as any,
          {
            get count() {
              return _ctx.count
            },
          },
          n1 as any,
        )
        return n0
      },
    })
    renderComponent(Comp as any, {}, '#host')
    expect(host.innerHTML).toBe('<div><div>0</div></div>')
    increment() // update state
    await nextTick()
    expect(host.innerHTML).toBe('<div><div>2</div></div>')
  })
})