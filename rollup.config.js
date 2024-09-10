/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { resolve, dirname, relative, join } from 'path';
import resolveModule from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import copy from 'rollup-plugin-copy';
import { peerDependencies, dependencies } from './package.json';
import { sync as globSync } from 'glob';
import { readFileSync } from 'fs';
import generatePackageJson from 'rollup-plugin-generate-package-json';

const packageJsonPaths = globSync('**/package.json', { ignore: ['node_modules/**', 'dist/**', 'test/**'] });
const packages = packageJsonPaths.reduce((acc, path) => {
  const pkg = JSON.parse(readFileSync(path, { encoding: 'utf-8'} ));
  const component = dirname(path);
  if (component === '.') {
    Object.keys(pkg.exports).forEach(exportName => {
      pkg.exports[exportName].import = pkg.exports[exportName].import.replace(/^\.\/dist\//, './');
      pkg.exports[exportName].require = pkg.exports[exportName].require.replace(/^\.\/dist\//, './');
    });
  }
  acc[component] = pkg;
  return acc;
}, {});

const plugins = [resolveModule(), commonjs()];

const external = [
  ...Object.keys({ ...peerDependencies, ...dependencies }),
  'firebase/firestore',
  'firebase/firestore/lite',
  'firebase/auth',
  'firebase/functions',
  'firebase/storage',
  'firebase/database',
  'firebase/remote-config',
  'firebase/performance',
  '@firebase/firestore',
  '@firebase/firestore/lite',
  '@firebase/auth',
  '@firebase/functions',
  '@firebase/storage',
  '@firebase/database',
  '@firebase/remote-config',
  '@firebase/performance',
  'rxjs/operators'
];

const globals = {
  //rxfire: GLOBAL_NAME,
  rxjs: 'rxjs',
  tslib: 'tslib',
  ...Object.values(packages).reduce((acc, {name}) => (acc[name] = name.replace(/\//g, '.'), acc), {}),
  'firebase/firestore': 'firebase.firestore',
  'firebase/firestore/lite': 'firebase.firestore-lite',
  'firebase/auth': 'firebase.auth',
  'firebase/functions': 'firebase.functions',
  'firebase/storage': 'firebase.storage',
  'firebase/database': 'firebase.database',
  'firebase/remote-config': 'firebase.remote-config',
  'firebase/performance': 'firebase.performance',
  '@firebase/firestore': 'firebase.firestore',
  '@firebase/firestore/lite': 'firebase.firestore-lite',
  '@firebase/auth': 'firebase.auth',
  '@firebase/functions': 'firebase.functions',
  '@firebase/storage': 'firebase.storage',
  '@firebase/database': 'firebase.database',
  '@firebase/remote-config': 'firebase.remote-config',
  '@firebase/performance': 'firebase.performance',
  'rxjs/operators': 'rxjs.operators',
};

export default Object.keys(packages)
  .map(component => {
    const baseContents = packages[component];
    const { browser, main, module, typings } = baseContents;
    // rewrite the paths for dist folder
    // TODO error if any of these don't match convention
    const outputFolder = join('dist', component);
    baseContents.browser = relative(outputFolder, resolve(component, browser));
    baseContents.main = relative(outputFolder, resolve(component, main));
    baseContents.module = relative(outputFolder, resolve(component, module));
    baseContents.typings = relative(outputFolder, resolve(component, typings));
    if (component === '.') {
      baseContents.scripts = {};
      delete baseContents.files;
      baseContents.devDependencies = {};
      baseContents.private = false;
    }
    return [
      {
        input: `${component}/index.ts`,
        output: [
          {
            file: resolve(component, main),
            format: 'cjs',
            sourcemap: true
          },
          {
            file: resolve(component, module),
            format: 'es',
            sourcemap: true
          }
        ],
        plugins: [
          ...plugins,
          // TS sourceMaps conflict with Rollup sourceMaps
          typescript({ sourceMap: false }),
          generatePackageJson({ outputFolder, baseContents }),
          copy({
            targets: [{
              src: 'dist/**/*.d.ts',
              dest: 'dist/',
              rename: (name) => `${name}.mts`
            }],
            flatten: false
          })
        ],
        external
      },
    ];
  }).flat();
