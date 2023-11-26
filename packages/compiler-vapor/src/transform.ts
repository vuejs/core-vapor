import {
  NodeTypes,
  RootNode,
  Node,
  TemplateChildNode,
  ElementNode,
  AttributeNode,
  InterpolationNode,
  TransformOptions,
  DirectiveNode,
  ExpressionNode,
} from '@vue/compiler-dom'
import {
  type DynamicChildren,
  type OperationNode,
  type RootIRNode,
  IRNodeTypes,
} from './ir'
import { isVoidTag } from '@vue/shared'
import {
  ErrorCodes,
  createCompilerError,
  defaultOnError,
  defaultOnWarn,
} from './errors'

export interface TransformContext<T extends Node = Node> {
  node: T
  parent: TransformContext | null
  root: TransformContext<RootNode>
  index: number
  options: TransformOptions
  template: string
  children: DynamicChildren
  store: boolean
  ghost: boolean
  once: boolean
  id: number | null

  getId(): number
  incraseId(): number
  registerTemplate(): number
  registerEffect(expr: string, operation: OperationNode): void
  registerOpration(...oprations: OperationNode[]): void
  helper(name: string): string
}

function createRootContext(
  ir: RootIRNode,
  node: RootNode,
  options: TransformOptions,
): TransformContext<RootNode> {
  let globalId = 0
  const { effect, operation: operation, helpers, vaporHelpers } = ir

  const ctx: TransformContext<RootNode> = {
    node,
    parent: null,
    index: 0,
    root: undefined as any, // set later
    options,
    children: {},
    store: false,
    ghost: false,
    once: false,

    id: null,
    incraseId: () => globalId++,
    getId() {
      if (this.id !== null) return this.id
      return (this.id = this.incraseId())
    },
    registerEffect(expr, operation) {
      if (!effect[expr]) effect[expr] = []
      effect[expr].push(operation)
    },

    template: '',
    registerTemplate() {
      if (!ctx.template) return -1

      const idx = ir.template.findIndex(
        (t) =>
          t.type === IRNodeTypes.TEMPLATE_FACTORY &&
          t.template === ctx.template,
      )
      if (idx !== -1) return idx

      ir.template.push({
        type: IRNodeTypes.TEMPLATE_FACTORY,
        template: ctx.template,
        loc: node.loc,
      })
      return ir.template.length - 1
    },
    registerOpration(...node) {
      operation.push(...node)
    },
    // TODO not used yet
    helper(name, vapor = true) {
      ;(vapor ? vaporHelpers : helpers).add(name)
      return name
    },
  }
  ctx.root = ctx
  return ctx
}

function createContext<T extends TemplateChildNode>(
  node: T,
  parent: TransformContext,
  index: number,
): TransformContext<T> {
  const children = {}

  const ctx: TransformContext<T> = {
    ...parent,
    id: null,
    node,
    parent,
    index,
    get template() {
      return parent.template
    },
    set template(t) {
      parent.template = t
    },
    children,
    store: false,
    registerEffect(expr, operation) {
      if (ctx.once) {
        return ctx.registerOpration(operation)
      }
      return parent.registerEffect(expr, operation)
    },
  }
  return ctx
}

// AST -> IR
export function transform(
  root: RootNode,
  options: TransformOptions = {},
): RootIRNode {
  options.onError ??= defaultOnError
  options.onWarn ??= defaultOnWarn

  const ir: RootIRNode = {
    type: IRNodeTypes.ROOT,
    loc: root.loc,
    template: [],
    children: {} as any,
    effect: Object.create(null),
    operation: [],
    helpers: new Set([]),
    vaporHelpers: new Set([]),
  }

  const ctx = createRootContext(ir, root, options)
  const rootId = ctx.getId()

  // TODO: transform presets, see packages/compiler-core/src/transforms
  transformChildren(ctx, true)
  ir.children = {
    id: rootId,
    store: true,
    ghost: false,
    children: ctx.children,
  }
  if (ir.template.length === 0) {
    ir.template.push({
      type: IRNodeTypes.FRAGMENT_FACTORY,
      loc: root.loc,
    })
  }

  return ir
}

function transformChildren(
  ctx: TransformContext<RootNode | ElementNode>,
  root?: boolean,
) {
  const {
    node: { children },
  } = ctx
  let index = 0
  children.forEach((child, i) => walkNode(child, i))

  if (root) ctx.registerTemplate()

  function walkNode(node: TemplateChildNode, i: number) {
    const child = createContext(node, ctx, index)
    const isFirst = i === 0
    const isLast = i === children.length - 1

    switch (node.type) {
      case 1 satisfies NodeTypes.ELEMENT: {
        transformElement(child as TransformContext<ElementNode>)
        break
      }
      case 2 satisfies NodeTypes.TEXT: {
        ctx.template += node.content
        break
      }
      case 3 satisfies NodeTypes.COMMENT: {
        ctx.template += `<!--${node.content}-->`
        break
      }
      case 5 satisfies NodeTypes.INTERPOLATION: {
        transformInterpolation(
          child as TransformContext<InterpolationNode>,
          isFirst,
          isLast,
        )
        break
      }
      case 12 satisfies NodeTypes.TEXT_CALL:
        // never?
        break
      default: {
        // TODO handle other types
        // CompoundExpressionNode
        // IfNode
        // IfBranchNode
        // ForNode
        ctx.template += `[type: ${node.type}]`
      }
    }

    if (Object.keys(child.children).length > 0 || child.store)
      ctx.children[index] = {
        id: child.store ? child.getId() : null,
        store: child.store,
        children: child.children,
        ghost: child.ghost,
      }

    if (!child.ghost) index++
  }
}

function transformElement(ctx: TransformContext<ElementNode>) {
  const { node } = ctx
  const { tag, props, children } = node

  ctx.template += `<${tag}`

  props.forEach((prop) => transformProp(prop, ctx))
  ctx.template += `>`

  if (children.length) transformChildren(ctx)

  // TODO remove unnecessary close tag, e.g. if it's the last element of the template
  if (!node.isSelfClosing || !isVoidTag(tag)) {
    ctx.template += `</${tag}>`
  }
}

function transformInterpolation(
  ctx: TransformContext<InterpolationNode>,
  isFirst: boolean,
  isLast: boolean,
) {
  const { node } = ctx

  if (node.content.type === (4 satisfies NodeTypes.SIMPLE_EXPRESSION)) {
    const expr = processExpression(ctx, node.content)!

    const parent = ctx.parent!
    const parentId = parent.getId()
    parent.store = true

    if (isFirst && isLast) {
      ctx.registerEffect(expr, {
        type: IRNodeTypes.SET_TEXT,
        loc: node.loc,
        element: parentId,
        value: expr,
      })
    } else {
      let id: number
      let anchor: number | 'first' | 'last'

      if (!isFirst && !isLast) {
        id = ctx.incraseId()
        anchor = ctx.getId()
        ctx.template += '<!>'
        ctx.store = true
      } else {
        id = ctx.getId()
        ctx.ghost = true
        anchor = isFirst ? 'first' : 'last'
      }

      ctx.registerOpration(
        {
          type: IRNodeTypes.CREATE_TEXT_NODE,
          loc: node.loc,
          id,
          value: expr,
        },
        {
          type: IRNodeTypes.INSERT_NODE,
          loc: node.loc,
          element: id,
          parent: parentId,
          anchor,
        },
      )

      ctx.registerEffect(expr, {
        type: IRNodeTypes.SET_TEXT,
        loc: node.loc,
        element: id,
        value: expr,
      })
    }
    return
  }

  // TODO: CompoundExpressionNode: {{ count + 1 }}
}

function transformProp(
  node: DirectiveNode | AttributeNode,
  ctx: TransformContext<ElementNode>,
): void {
  const { name } = node

  if (node.type === (6 satisfies NodeTypes.ATTRIBUTE)) {
    if (node.value) {
      ctx.template += ` ${name}="${node.value.content}"`
    } else {
      ctx.template += ` ${name}`
    }
    return
  }

  const { exp, loc } = node

  ctx.store = true
  const expr = processExpression(ctx, exp)
  switch (name) {
    case 'bind': {
      if (
        !exp ||
        (exp.type === NodeTypes.SIMPLE_EXPRESSION! && !exp.content.trim())
      ) {
        ctx.options.onError?.(
          createCompilerError(ErrorCodes.X_V_BIND_NO_EXPRESSION, loc),
        )
        return
      }

      if (expr === null) {
        // TODO: Vue 3.4 supported shorthand syntax
        // https://github.com/vuejs/core/pull/9451
        return
      } else if (!node.arg) {
        // TODO support v-bind="{}"
        return
      } else if (
        node.arg.type === (8 satisfies NodeTypes.COMPOUND_EXPRESSION)
      ) {
        // TODO support :[foo]="bar"
        return
      }

      ctx.registerEffect(expr, {
        type: IRNodeTypes.SET_PROP,
        loc: node.loc,
        element: ctx.getId(),
        name: node.arg.content,
        value: expr,
      })
      break
    }
    case 'on': {
      if (!node.arg) {
        // TODO support v-on="{}"
        return
      } else if (
        node.arg.type === (8 satisfies NodeTypes.COMPOUND_EXPRESSION)
      ) {
        // TODO support @[foo]="bar"
        return
      } else if (expr === null) {
        // TODO: support @foo
        // https://github.com/vuejs/core/pull/9451
        return
      }

      ctx.registerEffect(expr, {
        type: IRNodeTypes.SET_EVENT,
        loc: node.loc,
        element: ctx.getId(),
        name: node.arg.content,
        value: expr,
      })
      break
    }
    case 'html': {
      const value = expr || '""'
      ctx.registerEffect(value, {
        type: IRNodeTypes.SET_HTML,
        loc: node.loc,
        element: ctx.getId(),
        value,
      })
      break
    }
    case 'text': {
      const value = expr || '""'
      ctx.registerEffect(value, {
        type: IRNodeTypes.SET_TEXT,
        loc: node.loc,
        element: ctx.getId(),
        value,
      })
      break
    }
    case 'once': {
      ctx.once = true
      break
    }
    case 'cloak': {
      // do nothing
      break
    }
  }
}

// TODO: reuse packages/compiler-core/src/transforms/transformExpression.ts
function processExpression(
  ctx: TransformContext,
  expr: ExpressionNode | undefined,
): string | null {
  if (!expr) return null
  if (expr.type === (8 satisfies NodeTypes.COMPOUND_EXPRESSION)) {
    // TODO
    return ''
  }
  const { content } = expr
  if (ctx.options.bindingMetadata?.[content] === 'setup-ref') {
    return content + '.value'
  }
  return content
}
