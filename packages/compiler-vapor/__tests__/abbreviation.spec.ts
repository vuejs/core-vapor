/**
 * @vitest-environment jsdom
 */
import {
  compile as _compile,
  transformChildren,
  transformElement,
  transformText,
} from '../src'
import { makeCompile } from './transforms/_utils'
const parser = new DOMParser()

function parseHTML(html: string) {
  return parser.parseFromString(html, 'text/html').body.innerHTML
}

const compileWithElementTransform = makeCompile({
  nodeTransforms: [transformElement, transformChildren, transformText],
})
const splitHTMLTags = (htmlString: string) => {
  // change `<div>hello</div>` to `['<div>','hello','</div>']`
  const tagPattern =
    /<\/?[\w-]+(?:\s+[\w-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*\s*\/?>|[^<>]+/g
  return htmlString.match(tagPattern)
}

const checkBeforeAbbr = (template: string) => {
  const { ir } = compileWithElementTransform(template)
  let templateToAbbreviation = ''
  const getRes = (irTemplate: string) => {
    let childIndex = 0
    const res = splitHTMLTags(irTemplate)
    const loop = (node: any) => {
      if (!node) {
        return
      }
      node.forEach((ele: any) => {
        if (ele.children && ele.children.length !== 0) {
          childIndex++
          loop(ele.children)
        }
      })
    }
    // get the node's children index,then filter the close tags
    loop(ir.node.children)
    let abbr: string[] = res?.slice(0, res.length - childIndex) ?? []
    const pre = abbr[abbr?.length - 2]
    const last = abbr[abbr?.length - 1]
    // if the last two elements has the same `tag` type
    if (childIndex && last === `</${pre.replace(/<\/?(\w+).*>/, '$1')}>`) {
      abbr = abbr?.slice(0, -1)
    }
    templateToAbbreviation += abbr?.join('')
  }
  ir.template.forEach(irNode => {
    getRes(irNode)
  })
  return templateToAbbreviation
}

function checkAbbr(template: string, abbrevation: string, expected: string) {
  const tempToAbbr = checkBeforeAbbr(template)
  expect(tempToAbbr).toBe(abbrevation)
  expect(parseHTML(abbrevation)).toBe(expected)
}

test('template abbreviation', () => {
  checkAbbr('<div>hello</div>', '<div>hello', '<div>hello</div>')
  checkAbbr(
    '<div><div>hello</div></div>',
    '<div><div>hello',
    '<div><div>hello</div></div>',
  )
  checkAbbr(
    '<div><span>foo</span><span/></div>',
    '<div><span>foo</span><span>',
    '<div><span>foo</span><span></span></div>',
  )
  checkAbbr(
    '<div><hr/><div/></div>',
    '<div><hr><div>',
    '<div><hr><div></div></div>',
  )
  checkAbbr(
    '<div><hr/><span/></div>',
    '<div><hr><span>',
    '<div><hr><span></span></div>',
  )
  checkAbbr(
    '<div><div/><hr/></div>',
    '<div><div></div><hr>',
    '<div><div></div><hr></div>',
  )

  checkAbbr('<span/>hello', '<span></span>hello', '<span></span>hello')
  checkAbbr(
    '<span/>hello<div/>',
    '<span></span>hello<div></div>',
    '<span></span>hello<div></div>',
  )
})
