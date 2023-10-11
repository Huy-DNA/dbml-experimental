import fs, { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { scanTestNames } from './jestHelpers';
import Compiler from '../src/compiler';
import benchmark from 'nodemark';

describe('#benchmark', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');
    let res: any;
    const ns = benchmark(
      () => {
        const compiler = new Compiler();
        compiler.setSource(program);
        res = compiler.parse.rawDb()?.normalize();
      },
      () => {},
    );
    const s = {
      mean: ns.mean / 1e9,
      error: ns.error / 1e9,
      max: ns.max / 1e9,
      min: ns.max / 1e9,
      count: ns.count,
    };
    const output = JSON.stringify(s, null, 2);
    writeFileSync(path.resolve(__dirname, `./output/${testName}.bench.json`), output);
    writeFileSync(
      path.resolve(__dirname, `./output/${testName}.out.json`),
      JSON.stringify(
        res,
        (key, value) => (['symbol', 'references', 'referee'].includes(key) ? undefined : value),
        2,
      ),
    );
    it('dummy test', expect.anything);
  });
});
