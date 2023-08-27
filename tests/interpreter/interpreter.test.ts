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
    let output;
    try {
      output = JSON.stringify(compiler.emitJSONFromDBML(program), null, 2);
    } catch (e) {
      output = e;
    }

    it('should equal snapshot', () =>
      expect(output).toMatchFileSnapshot(path.resolve(__dirname, `./output/${testName}.out.json`)));
  });
});
