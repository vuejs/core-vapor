import { defineComponent } from 'vue'
import {
  append,
  children,
  createIf,
  fragment,
  insert,
  nextTick,
  ref,
  render,
  renderEffect,
  setText,
  template,
} from '../src'
import type { Mock } from 'vitest'

let host: HTMLElement

const initHost = () => {
  host = document.createElement('div')
  host.setAttribute('id', 'host')
  document.body.appendChild(host)
}
beforeEach(() => {
  initHost()
})
afterEach(() => {
  host.remove()
})

describe('createIf', () => {
  test('basic', async () => {
    // mock this template:
    //  <div>
    //    <p v-if="counter">{{counter}}</p>
    //    <p v-else>zero</p>
    //  </div>

    let spyIfFn: Mock<any, any>
    let spyElseFn: Mock<any, any>
    const count = ref(0)

    // templates can be reused through caching.
    const t0 = template('<div></div>')
    const t1 = template('<p></p>')
    const t2 = template('<p>zero</p>')

    const component = defineComponent({
      setup() {
        // render
        return (() => {
          const n0 = t0()
          const {
            0: [n1],
          } = children(n0)

          insert(
            createIf(
              () => count.value,
              // v-if
              (spyIfFn ||= vi.fn(() => {
                const n2 = t1()
                const {
                  0: [n3],
                } = children(n2)
                renderEffect(() => {
                  setText(n3, count.value)
                })
                return n2
              })),
              // v-else
              (spyElseFn ||= vi.fn(() => {
                const n4 = t2()
                return n4
              })),
            ),
            n1 as any as ParentNode,
          )
          return n0
        })()
      },
    })
    render(component as any, {}, '#host')

    expect(host.innerHTML).toBe('<div><p>zero</p><!--if--></div>')
    expect(spyIfFn!).toHaveBeenCalledTimes(0)
    expect(spyElseFn!).toHaveBeenCalledTimes(1)

    count.value++
    await nextTick()
    expect(host.innerHTML).toBe('<div><p>1</p><!--if--></div>')
    expect(spyIfFn!).toHaveBeenCalledTimes(1)
    expect(spyElseFn!).toHaveBeenCalledTimes(1)

    count.value++
    await nextTick()
    expect(host.innerHTML).toBe('<div><p>2</p><!--if--></div>')
    expect(spyIfFn!).toHaveBeenCalledTimes(1)
    expect(spyElseFn!).toHaveBeenCalledTimes(1)

    count.value = 0
    await nextTick()
    expect(host.innerHTML).toBe('<div><p>zero</p><!--if--></div>')
    expect(spyIfFn!).toHaveBeenCalledTimes(1)
    expect(spyElseFn!).toHaveBeenCalledTimes(2)
  })

  test('should handle nested template', async () => {
    // mock this template:
    //  <template v-if="ok1">
    //    Hello <template v-if="ok2">Vapor</template>
    //  </template>

    const ok1 = ref(true)
    const ok2 = ref(true)

    const t0 = template('Vapor')
    const t1 = template('Hello ')
    const t2 = fragment()
    render(
      defineComponent({
        setup() {
          // render
          return (() => {
            const n0 = t2()
            append(
              n0,
              createIf(
                () => ok1.value,
                () => {
                  const n2 = t1()
                  append(
                    n2,
                    createIf(
                      () => ok2.value,
                      () => t0(),
                    ),
                  )
                  return n2
                },
              ),
            )
            return n0
          })()
        },
      }) as any,
      {},
      '#host',
    )
    expect(host.innerHTML).toBe('Hello Vapor<!--if--><!--if-->')

    ok1.value = false
    await nextTick()
    expect(host.innerHTML).toBe('<!--if-->')

    ok1.value = true
    await nextTick()
    expect(host.innerHTML).toBe('Hello Vapor<!--if--><!--if-->')

    ok2.value = false
    await nextTick()
    expect(host.innerHTML).toBe('Hello <!--if--><!--if-->')

    ok1.value = false
    await nextTick()
    expect(host.innerHTML).toBe('<!--if-->')
  })
})
