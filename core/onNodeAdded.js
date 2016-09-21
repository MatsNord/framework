'use strict'

const setupNode = require('./setupNode')
const symbols = require('./symbols')

const attached = 'attached'
const attaching = 'attaching'
const detached = 'detached'

module.exports = function onNodeAdded (node) {
  const context = getContext(node)
  setupNodeAndChildren(node, context.state, context.contentMiddlewares, context.hasRoot)
}

function setupNodeAndChildren (node, state, contentMiddlewares, hasRoot) {
  if (!shouldProcess(node, hasRoot)) return

  node[symbols.lifecycleStage] = attaching
  setupNode(node)

  if (node[symbols.root]) {
    hasRoot = true
  }
  if (node[symbols.contextState]) {
    state = node[symbols.contextState]
  }
  const contextState = state
  
  if (node[symbols.state]) {
    node[symbols.state].$parent = state
    if (node[symbols.inheritState]) {
      Object.setPrototypeOf(node[symbols.state], state)
    }
    state = node[symbols.state]
  }
  composeAndRunMiddlewares(node, state, contextState, contentMiddlewares, node[symbols.middlewares], hasRoot)
}

function composeAndRunMiddlewares (node, state, contextState, contentMiddlewares, middlewares, hasRoot) {
  let i = 0
  let j = 0
  next()

  function next () {
    if (i < contentMiddlewares.length) {
      contentMiddlewares[i++](node, contextState, next)
    } else if (middlewares && j < middlewares.length) {
      middlewares[j++](node, state, next)
    } else {
      node[symbols.lifecycleStage] = attached
      setupChildren(node, state, contentMiddlewares, hasRoot)
    }
  }
}

function setupChildren (node, state, contentMiddlewares, hasRoot) {
  if (node[symbols.isolate] === true) {
    return
  } else if (node[symbols.isolate] === 'middlewares') {
    contentMiddlewares = node[symbols.contentMiddlewares].slice()
  } else if (node[symbols.contentMiddlewares]) {
    contentMiddlewares = contentMiddlewares.concat(node[symbols.contentMiddlewares])
  }
  Array.prototype.forEach.call(node.childNodes, (childNode) => {
    setupNodeAndChildren(childNode, state, contentMiddlewares, hasRoot)
  })
}

function shouldProcess (node, hasRoot) {
  if (node[symbols.lifecycleStage] === detached) {
    throw new Error(`you can't reattach a detached node: ${node.tagName}`)
  }
  if (hasRoot && node[symbols.root]) {
    throw new Error(`Nested root component: ${node.tagName}`)
  }
  const validRoot = (hasRoot || node[symbols.root])
  const validStage = (node[symbols.lifecycleStage] === undefined)
  const validParent = ((node.parentNode && node.parentNode[symbols.lifecycleStage] === attached) || node[symbols.root])
  const registered = (node[symbols.registered] || !(node instanceof Element) || (node.tagName.indexOf('-') === -1 && !node.hasAttribute('is')))

  return (validRoot && validStage && validParent && registered)
}

function getContext (node) {
  const context = {contentMiddlewares: []}
  let isolate = false

  node = node.parentNode
  while (node) {
    if (!context.state && node[symbols.state]) {
      context.state = node[symbols.state]
    }
    if (!context.state && node[symbols.contextState]) {
      context.state = node[symbols.contextState]
    }
    if (isolate !== true && isolate !== 'middlewares') {
      isolate = node[symbols.isolate]
    } else if (isolate === true) {
      context.isolate = true
      return context
    }
    if (node[symbols.contentMiddlewares] && !isolate) {
      context.contentMiddlewares.unshift(...node[symbols.contentMiddlewares])
    }
    if (node[symbols.root]) {
      context.hasRoot = true
    }
    node = node.parentNode
  }
  return context
}