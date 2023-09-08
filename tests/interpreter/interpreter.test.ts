import fs, { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { scanTestNames } from '../jestHelpers';
import { Compiler } from '../../src';

describe('#interpreter', () => {
  const testNames = scanTestNames(path.resolve(__dirname, './input/'));

  testNames.forEach((testName) => {
    const program = readFileSync(path.resolve(__dirname, `./input/${testName}.in.dbml`), 'utf-8');
    const compiler = new Compiler();
    compiler.setSource(program);
    let output;
    try {
      output = JSON.stringify(compiler.emitRawDbFromDBML().normalize(), null, 2);
    } catch (e) {
      output = JSON.stringify(
        e,
        (key, value) => (['symbol', 'references', 'referee'].includes(key) ? undefined : value),
        2,
      );
    }

    it('should equal snapshot', () =>
      expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
