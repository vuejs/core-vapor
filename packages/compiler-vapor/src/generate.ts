import type { CodegenOptions, CodegenResult } from '@vue/compiler-dom'
import {
  type DynamicChildren,
  type RootIRNode,
  IRNodeTypes,
  OperationNode,
} from './ir'

// remove when stable
function checkNever(x: never): void {}

// IR -> JS codegen
export function generate(
  ir: RootIRNode,
  options: CodegenOptions = {},
): CodegenResult {
  let code = ''
  let preamble = ''

  const { helpers, vaporHelpers } = ir
  if (ir.template.length) {
    preamble += ir.template
      .map(
        (template, i) => `const t${i} = template(\`${template.template}\`)\n`,
      )
      .join('')
    vaporHelpers.add('template')
  }

  // TODO multiple-template
  code += `const root = t0()\n`
  if (ir.children[0]) {
    code += `const {${genChildren(ir.children[0].children)}} = children(root)\n`
    vaporHelpers.add('children')
  }

  for (const operation of ir.operation) {
    code += genOperation(operation)
  }

  for (const [_expr, operations] of Object.entries(ir.effect)) {
    // TODO don't use watchEffect from vue/core, implement `effect` function in runtime-vapor package
    let scope = `watchEffect(() => {\n`
    helpers.add('watchEffect')
    for (const operation of operations) {
      scope += genOperation(operation)
    }
    scope += '})\n'
    code += scope
  }

  code += 'return root'

  if (vaporHelpers.size)
    preamble =
      `import { ${[...vaporHelpers].join(', ')} } from 'vue/vapor'\n` + preamble
  if (helpers.size)
    preamble = `import { ${[...helpers].join(', ')} } from 'vue'\n` + preamble

  const functionName = options.ssr ? `ssrRender` : `render`
  const isSetupInlined = !!options.inline
  if (isSetupInlined) {
    code = `(() => {\n${code}\n})();`
  } else {
    code = `${preamble}export function ${functionName}() {\n${code}\n}`
  }

  return {
    code,
    ast: ir as any,
    preamble,
  }

  function genOperation(operation: OperationNode) {
    let code = ''
    switch (operation.type) {
      case IRNodeTypes.SET_PROP: {
        const variableName = operation.isRoot ? 'root' : `n${operation.element}`
        code = `setAttr(${variableName}, ${JSON.stringify(
          operation.name,
        )}, undefined, ${operation.value})\n`
        vaporHelpers.add('setAttr')
        break
      }

      case IRNodeTypes.SET_TEXT: {
        const variableName = operation.isRoot ? 'root' : `n${operation.element}`
        code = `setText(${variableName}, undefined, ${operation.value})\n`
        vaporHelpers.add('setText')
        break
      }

      case IRNodeTypes.SET_EVENT: {
        const variableName = operation.isRoot ? 'root' : `n${operation.element}`
        code = `on(${variableName}, ${JSON.stringify(operation.name)}, ${
          operation.value
        })\n`
        vaporHelpers.add('on')
        break
      }

      case IRNodeTypes.SET_HTML: {
        code = `setHtml(n${operation.element}, undefined, ${operation.value})\n`
        vaporHelpers.add('setHtml')
        break
      }

      case IRNodeTypes.TEXT_NODE: {
        // TODO handle by runtime: document.createTextNode
        code = `const n${operation.id} = document.createTextNode(${operation.value})\n`
        break
      }

      case IRNodeTypes.INSERT_NODE: {
        const parentNode = operation.isRoot ? `root` : `n${operation.parent}`
        let anchor = ''
        if (typeof operation.anchor === 'number') {
          anchor = `, n${operation.anchor}`
        } else if (operation.anchor === 'first') {
          anchor = `, 0 /* InsertPosition.FIRST */`
        }
        code = `insert(n${operation.element}, ${parentNode}${anchor})\n`
        vaporHelpers.add('insert')
        break
      }

      default:
        checkNever(operation)
    }

    return code
  }
}

function genChildren(children: DynamicChildren) {
  let str = ''
  for (const [index, child] of Object.entries(children)) {
    str += ` ${index}: [`
    if (child.store) {
      str += `n${child.id}`
    }
    if (Object.keys(child.children).length) {
      str += `, {${genChildren(child.children)}}`
    }
    str += '],'
  }
  return str
}
