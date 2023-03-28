const fs = require('fs')
const path = require('path')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const babel = require('@babel/core')

/**
 *
 */
function getModuleInfo(file) {
  // 读取文件
  const body = fs.readFileSync(file, 'utf-8')
  // TODO 有哪些 improt项
  // 转化AST语法树
  const ast = parser.parse(body, {
    sourceType: 'module', //表示我们要解析的是ES模块
  })
  // console.log('ast', ast.program.body)
  // 依赖收集
  const deps = {}
  traverse(ast, {
    // visitor
    ImportDeclaration({ node }) {
      // 遇到improt节点时候会回调
      const dirname = path.dirname(file)
      // console.log(dirname) ==> ./src
      const abspath = './' + path.join(dirname, node.source.value)
      // console.log(abspath) ==> ./src/add.js
      deps[node.source.value] = abspath
      // console.log(node.source.value) ==> ./add,js
    },
  })
  // console.log('deps', deps) ==>  { './add,js': './src/add.js' }
  //TODO ES6 => ES5
  // 编译内容
  const { code } = babel.transformFromAst(ast, null, {
    presets: ['@babel/preset-env'],
  })
  console.log('code', code)
  const moduleInfo = { file, deps, code }
  return moduleInfo
}
// let info = getModuleInfo('./src/index.js')
// console.log('info', info)

/* 模块解析
 * @param {*} file * @returns
 */
function parseModules(file) {
  const entry = getModuleInfo(file)
  const temp = [entry]
  const depsGraph = {} //最后输出的依赖图
  getDeps(temp, entry)

  temp.forEach((moduleInfo) => {
    depsGraph[moduleInfo.file] = {
      deps: moduleInfo.deps,
      code: moduleInfo.code,
    }
  })
  return depsGraph
}

/*** 获取依赖
 * * @param {*} temp
 * * @param {*} param1
 * */
function getDeps(temp, { deps }) {
  Object.keys(deps).forEach((key) => {
    const child = getModuleInfo(deps[key])
    temp.push(child)
    getDeps(temp, child)
  })
}
// const content = parseModules('./src/index.js')
// console.log('content', content)

function bundle(file) {
  const depsGraph = JSON.stringify(parseModules(file))
  return `(function (graph) { 
    function require(file) { 
      function absRequire(relPath) { 
        return require(graph[file].deps[relPath]) 
      }
      var exports = {}; 
      (function (require,exports,code) { 
        eval(code) 
      })(absRequire,exports,graph[file].code) 
      return exports 
    }
    require('${file}') 
    })(${depsGraph})`
}

const content = bundle('./src/index.js')
// console.log('content', content)

!fs.existsSync('./dist') && fs.mkdirSync('./dist')
fs.writeFileSync('./dist/bundle.js', content)
