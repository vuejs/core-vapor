import { extend, isArray } from '@vue/shared'
import type { CodegenContext } from '../generate'
import type { CreateComponentIRNode, IRProp } from '../ir'
import {
  type CodeFragment,
  INDENT_END,
  INDENT_START,
  NEWLINE,
  genCall,
  genMulti,
} from './utils'
import { genExpression } from './expression'
import { genPropKey } from './prop'
import { createSimpleExpression } from '@vue/compiler-dom'
import { genEventHandler } from './event'

// TODO: generate component slots
export function genCreateComponent(
  oper: CreateComponentIRNode,
  context: CodegenContext,
): CodeFragment[] {
  const { helper, vaporHelper } = context

  const tag = genTag()
  const isRoot = oper.root
  const props = genProps()

  return [
    NEWLINE,
    `const n${oper.id} = `,
    ...genCall(
      vaporHelper('createComponent'),
      tag,
      props || (isRoot ? 'null' : false),
      isRoot && 'true',
    ),
  ]

  function genTag() {
    if (oper.resolve) {
      return genCall(vaporHelper('resolveComponent'), JSON.stringify(oper.tag))
    } else {
      return genExpression(
        extend(createSimpleExpression(oper.tag, false), { ast: null }),
        context,
      )
    }
  }

  function genProps() {
    const props = oper.props
      .map(props => {
        if (isArray(props)) {
          if (!props.length) return undefined
          return genStaticProps(props)
        } else {
          let expr = genExpression(props.value, context)
          if (props.handler) expr = genCall(helper('toHandlers'), expr)
          return ['() => (', ...expr, ')']
        }
      })
      .filter(Boolean)
    if (props.length) {
      return genMulti(['[', ']', ', '], ...props)
    }
  }

  function genStaticProps(props: IRProp[]) {
    return genMulti(
      [
        ['{', INDENT_START, NEWLINE],
        [INDENT_END, NEWLINE, '}'],
        [', ', NEWLINE],
      ],
      ...props.map(prop => {
        return [
          ...genPropKey(prop, context),
          ': ',
          ...(prop.handler
            ? genEventHandler(context, prop.values[0])
            : ['() => (', ...genExpression(prop.values[0], context), ')']),
        ]
      }),
    )
  }
}
