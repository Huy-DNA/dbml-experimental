import React from 'react';
import defaultParserInterface from '../utils/defaultParserInterface';

const ID = 'dbmlparse';

export default {
  ...defaultParserInterface,

  id: ID,
  displayName: ID,
  version: `1.0.0`,
  homepage: "#",
  locationProps: new Set(['start', 'end']),
  typeProps: new Set(['kind']),

  loadParser(callback) {
    require(['@dbml-experimental/parser'], ({ serialize, Compiler }) => {
      callback({ serialize, Compiler });
    });
  },

  parse({ Compiler, serialize }, code) {
    const compiler = new Compiler();
    compiler.setSource(code);
    const ast = compiler.parse.ast();
    const errors = compiler.parse.errors();
    return JSON.parse(serialize({ ast, errors }));
  },

  getDefaultOptions() {
    return {
      ranges: true,
      locations: false,
      comments: true,
      scope: false,
      dbmlVersion: '1.0',
    };
  },

  _getSettingsConfiguration() {
    return {
      fields: [
        'ranges',
        'locations',
        'comments',
        'scope',
      ],
      required: new Set(['ranges']),
    };

  },

  nodeToRange(node) {
    if (node && node.start !== undefined && node.end !== undefined) {
      return [node.start, node.end];
    }
  },

  getNodeName(node) {
    if (node && node.kind !== undefined) {
      return node.kind;
    }
  },

  renderSettings(parserSettings, onChange) {
    return (
      <div>
        <p>
          <a
            href="https://oxyc.github.io/luaparse/#parser-interface"
            target="_blank" rel="noopener noreferrer">
            Option descriptions
          </a>
        </p>
        {defaultParserInterface.renderSettings.call(
          this,
          parserSettings,
          onChange,
        )}
      </div>
    );
  },
};
