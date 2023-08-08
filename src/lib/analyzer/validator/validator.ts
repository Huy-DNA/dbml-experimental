import { isAccessExpression, isQuotedStringNode } from '../../utils';
import { ContextStack, ValidatorContext, canBeNestedWithin } from './validatorContext';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  InfixExpressionNode,
  ListExpressionNode,
  PrimaryExpressionNode,
  ProgramNode,
  SyntaxNode,
  TupleExpressionNode,
  VariableNode,
} from '../../parser/nodes';
import Report from '../../report';
import { CompileError, CompileErrorCode } from '../../errors';
import { SyntaxToken } from '../../lexer/tokens';
import { isValidColor, joinTokenStrings } from './utils/helpers';
import {
  EntryMap,
  SchemaSymbolTable,
  TableSymbolTable,
  createColumnEntry,
  createEnumElementEntry,
  createEnumEntry,
  createSchemaEntry,
  createTableEntry,
  createTableGroupEntry,
} from '../symbol';
import {
  ColumnSymbol,
  EnumElementSymbol,
  EnumSymbol,
  SchemaSymbol,
  TableGroupSymbol,
  TableSymbol,
} from '../symbol/symbols';
import {
  ColumnEntry,
  EnumEntry,
  EnumSymbolTable,
  TableEntry,
  TableGroupEntry,
} from '../symbol/symbolTable';
import { destructureComplexVariable, destructureIndex, extractVariable } from '../utils';
import { None, Option, Some } from '../../option';
import {
  getEnumFieldSettingValueValidator,
  allowDuplicateEnumFieldSetting,
} from './utils/enumFieldSettingValidator';
import {
  allowDuplicateColumnSetting,
  getColumnSettingValueValidator,
  isValidColumnType,
} from './utils/columnSettingValidator';
import {
  allowDuplicateTableSetting,
  getTableSettingValueValidator,
} from './utils/tableSettingValidator';
import {
  allowDuplicateRefSetting,
  getRefFieldSettingValueValidator,
} from './utils/refFieldValidator';
import {
  allowDuplicateIndexesSetting,
  getIndexesSettingValueValidator,
} from './utils/indexesSettingValidator';

export default class Validator {
  private nodeMap: EntryMap;

  private symbolTable: SchemaSymbolTable;

  private contextStack: ContextStack = new ContextStack();

  private errors: CompileError[] = [];

  private projectFound: boolean = false;

  constructor(nodeMap: EntryMap, symbolTable: SchemaSymbolTable) {
    this.nodeMap = nodeMap;
    this.symbolTable = symbolTable;
  }

  tryRegister(ast: ProgramNode): Report<ProgramNode, CompileError> {
    this.program(ast);

    return new Report(ast, this.errors);
  }

  private program(ast: ProgramNode) {
    // eslint-disable-next-line no-restricted-syntax
    for (const node of ast.body) {
      if (node instanceof ElementDeclarationNode) {
        this.elementDeclaration(node);
      } else {
        this.logError(node, CompileErrorCode.INVALID, 'Expect an element declaration at top level');
      }
    }
  }

  private elementDeclaration(node: ElementDeclarationNode) {
    if (typeof node.type.value !== 'string') {
      this.logError(node, CompileErrorCode.INVALID, 'Expect an element type to be a string');

      return;
    }

    switch (node.type.value.toLowerCase()) {
      case 'enum':
        this.enumElement(node);
        break;
      case 'table':
        this.tableElement(node);
        break;
      case 'tablegroup':
        this.tableGroupElement(node);
        break;
      case 'project':
        this.projectElement(node);
        break;
      case 'ref':
        this.refElement(node);
        break;
      case 'note':
        this.noteElement(node);
        break;
      case 'indexes':
        this.indexesElement(node);
        break;
      default:
        this.customElement(node);
        break;
    }
  }

  private customElement = this.contextStack.withContextDo(
    ValidatorContext.CustomContext,
    (node: ElementDeclarationNode) => {
      this.checkContext(node, 'custom');

      this.checkNoName(node, 'custom');
      this.checkNoAlias(node, 'custom');
      this.checkNoSettings(node, 'custom');

      if (node.body instanceof BlockExpressionNode) {
        this.logError(
          node.body,
          CompileErrorCode.INVALID,
          "A custom element's should only have a simple body",
        );

        return;
      }

      if (!(node.body instanceof PrimaryExpressionNode)) {
        this.logError(
          node.body,
          CompileErrorCode.INVALID,
          "Only literals are allowed in a custom element's body",
        );
      }
    },
  );

  private enumElement = this.contextStack.withContextDo(
    ValidatorContext.EnumContext,
    (node: ElementDeclarationNode) => {
      const enumST = this.checkContext(node, 'Enum')
        .and_then(() => this.checkElementNameExistence(node, 'Enum'))
        .and_then(() => this.checkComplexVariableName(node.name, 'Enum'))
        .map((variables) => {
          const enumName = variables.pop();
          if (!enumName) {
            throw new Error('Unexpected empty Enum name');
          }
          const enumSymbol = new EnumSymbol(enumName);

          const schemaST = this.registerSchemaStack(node, variables);

          if (schemaST.has(enumSymbol)) {
            this.logError(node.name!, CompileErrorCode.INVALID, 'Duplicated Enum name');
          }

          const enumEntry = createEnumEntry(this.nodeMap, node, new EnumSymbolTable());
          schemaST.set(enumSymbol, enumEntry);

          return enumEntry.symbolTable;
        })
        .unwrap_or(undefined);

      if (!enumST) {
        return;
      }

      this.checkNoAlias(node, 'Enum');
      this.checkNoSettings(node, 'Enum');
      this.checkInstanceOf(node.body, BlockExpressionNode, 'block', "Enum's body").map(() =>
        (node.body as BlockExpressionNode).body.forEach((element) =>
          this.enumSubElement(element, enumST),
        ),
      );
    },
  );

  private enumSubElement(subElement: SyntaxNode, enumST: EnumSymbolTable) {
    if (
      !(subElement instanceof PrimaryExpressionNode) &&
      !(subElement instanceof FunctionApplicationNode)
    ) {
      this.logError(
        subElement,
        CompileErrorCode.INVALID,
        'An enum field must be a single identifier, a quoted string optionally followed by a note',
      );

      return;
    }

    if (subElement instanceof FunctionApplicationNode) {
      this.enumSubElement(subElement.callee, enumST);
      this.checkInstanceOf(subElement.args[0], ListExpressionNode, 'block', 'setting list').map(
        () =>
          this.settingList(
            subElement.args[0] as ListExpressionNode,
            getEnumFieldSettingValueValidator,
            allowDuplicateEnumFieldSetting,
          ),
      );
      if (subElement.args.length >= 2) {
        this.logError(
          subElement.args[1],
          CompileErrorCode.INVALID,
          'There can be at most a single enum field with a setting list',
        );
      }

      return;
    }

    if (!(subElement.expression instanceof VariableNode)) {
      this.logError(
        subElement,
        CompileErrorCode.INVALID,
        'The enum field should be an identifier or a double-quoted string',
      );

      return;
    }

    const enumFieldSymbol = new EnumElementSymbol(subElement.expression.variable.value);
    if (enumST.has(enumFieldSymbol)) {
      this.logError(subElement, CompileErrorCode.INVALID, 'Duplicated enum field');

      return;
    }

    const enumFieldEntry = createEnumElementEntry(this.nodeMap, subElement);
    enumST.set(enumFieldSymbol, enumFieldEntry);
  }

  private indexesElement = this.contextStack.withContextDo(
    ValidatorContext.IndexesContext,
    (node: ElementDeclarationNode) => {
      this.checkContext(node, 'Indexes');

      this.checkNoName(node, 'Indexes');
      this.checkNoAlias(node, 'Indexes');
      this.checkNoSettings(node, 'Indexes');

      this.checkInstanceOf(node.body, BlockExpressionNode, 'block', 'Indexes').map(() =>
        (node.body as BlockExpressionNode).body.forEach((element) =>
          this.indexesSubElement(element),
        ),
      );
    },
  );

  private indexesSubElement(subElement: SyntaxNode) {
    if (subElement instanceof PrimaryExpressionNode) {
      return;
    }

    if (subElement instanceof FunctionApplicationNode) {
      if (subElement.args.length >= 2) {
        this.logError(
          subElement,
          CompileErrorCode.INVALID,
          'There should be at most an index and a setting',
        );
      }
      this.indexesSubElement(subElement.callee);
      this.checkInstanceOf(subElement.args[0], ListExpressionNode, 'list', 'Indexes').map(() =>
        this.settingList(
          subElement.args[0] as ListExpressionNode,
          getIndexesSettingValueValidator,
          allowDuplicateIndexesSetting,
        ),
      );

      return;
    }

    if (subElement instanceof TupleExpressionNode || isAccessExpression(subElement)) {
      if (!destructureIndex(subElement).unwrap_or(undefined)) {
        this.logError(subElement, CompileErrorCode.INVALID, 'Invalid index');
      }

      return;
    }

    this.logError(subElement, CompileErrorCode.INVALID, 'Invalid index');
  }

  private noteElement = this.contextStack.withContextDo(
    ValidatorContext.NoteContext,
    (node: ElementDeclarationNode) => {
      this.checkContext(node, 'Note');

      this.checkNoName(node, 'Note');
      this.checkNoAlias(node, 'Note');
      this.checkNoSettings(node, 'Note');

      if (node.body instanceof BlockExpressionNode) {
        if (node.body.body.length >= 2) {
          this.logError(
            node.body,
            CompileErrorCode.INVALID,
            "There should be a single string inside Note's body",
          );

          return;
        }
        const [content] = node.body.body;
        if (!isQuotedStringNode(content)) {
          this.logError(
            node.body,
            CompileErrorCode.INVALID,
            "A Note's body should only be a string",
          );
        }
      } else {
        const content = node.body;
        if (!isQuotedStringNode(content)) {
          this.logError(
            node.body,
            CompileErrorCode.INVALID,
            'A Notes body should only be a string',
          );
        }
      }
    },
  );

  private refElement = this.contextStack.withContextDo(
    ValidatorContext.RefContext,
    (node: ElementDeclarationNode) => {
      this.checkContext(node, 'Ref');

      if (node.name) {
        this.checkComplexVariableName(node.name, 'Ref');
      }

      this.checkNoAlias(node, 'Ref');

      if (node.body instanceof BlockExpressionNode) {
        node.body.body.forEach((element) => this.refSubElement(element));
      } else {
        this.refSubElement(node.body);
        if (node.attributeList) {
          this.checkInstanceOf(node.attributeList, ListExpressionNode, 'list', 'settings list').map(
            () =>
              this.settingList(
                node.attributeList as ListExpressionNode,
                getRefFieldSettingValueValidator,
                allowDuplicateRefSetting,
              ),
          );
        }
      }
    },
  );

  private refSubElement(element: SyntaxNode) {
    if (
      !(element instanceof FunctionApplicationNode) &&
      !(element instanceof InfixExpressionNode)
    ) {
      this.logError(element, CompileErrorCode.INVALID, 'Invalid expression in a ref element');

      return;
    }

    if (element instanceof FunctionApplicationNode) {
      this.refSubElement(element.callee);
      this.checkInstanceOf(element.args[0], ListExpressionNode, 'list', 'settings list').map(() =>
        this.settingList(
          element.args[0] as ListExpressionNode,
          getRefFieldSettingValueValidator,
          allowDuplicateRefSetting,
        ),
      );
      if (element.args.length >= 2) {
        this.logError(
          element.args[1],
          CompileErrorCode.INVALID,
          'There can be at most a relationship expresion and a setting',
        );
      }
    }
  }

  private projectElement = this.contextStack.withContextDo(
    ValidatorContext.ProjectContext,
    (node: ElementDeclarationNode) => {
      this.checkContext(node, 'Project');

      if (this.projectFound) {
        this.logError(node.type, CompileErrorCode.INVALID, 'A project has already been defined');
      }
      this.projectFound = true;

      if (node.name) {
        this.checkComplexVariableName(node.name, 'Project');
      }

      this.checkNoSettings(node, 'Project');

      this.checkInstanceOf(node.body, BlockExpressionNode, 'block', 'Project').map(() =>
        (node.body as BlockExpressionNode).body.forEach((element) =>
          this.projectSubElement(element),
        ),
      );
    },
  );

  private projectSubElement(subelement: SyntaxNode) {
    if (!(subelement instanceof ElementDeclarationNode)) {
      this.logError(subelement, CompileErrorCode.INVALID, 'Invalid expression in a Project');

      return;
    }
    this.elementDeclaration(subelement);
  }

  private tableElement = this.contextStack.withContextDo(
    ValidatorContext.TableContext,
    (node: ElementDeclarationNode) => {
      const tableEntry = this.checkContext(node, 'Table')
        .and_then(() => this.checkElementNameExistence(node, 'Table'))
        .and_then(() => this.checkComplexVariableName(node.name, 'Table'))
        .map((variables) => {
          const tableName = variables.pop();
          if (!tableName) {
            throw Error('Unexpected undefined Table name');
          }
          const tableSymbol = new TableSymbol(tableName);

          const schemaSymbolTable = this.registerSchemaStack(node, variables);

          return { schemaSymbolTable, tableSymbol };
        })
        .map(({ schemaSymbolTable, tableSymbol }) =>
          this.registerTable(node, tableSymbol, schemaSymbolTable),
        )
        .unwrap_or(undefined);

      if (!tableEntry) {
        return;
      }

      this.checkAlias(node).map((variable) => {
        this.registerTable(node, new TableSymbol(variable), this.symbolTable, tableEntry);
      });

      if (node.attributeList) {
        this.checkInstanceOf(
          node.attributeList,
          ListExpressionNode,
          'list',
          "Table's attribute list",
        ).map(() =>
          this.settingList(
            node.attributeList as ListExpressionNode,
            getTableSettingValueValidator,
            allowDuplicateTableSetting,
          ),
        );
      }
      this.checkInstanceOf(node.body, BlockExpressionNode, 'block', "Table's body").map(() =>
        (node.body as BlockExpressionNode).body.forEach((e) =>
          this.tableSubElement(tableEntry.symbolTable, e),
        ),
      );
    },
  );

  private tableSubElement(tableST: TableSymbolTable, subElement: SyntaxNode) {
    if (subElement instanceof FunctionApplicationNode) {
      this.tableColumn(tableST, subElement);
    } else if (subElement instanceof ElementDeclarationNode) {
      this.elementDeclaration(subElement);
    } else {
      this.logError(
        subElement,
        CompileErrorCode.UNEXPECTED_THINGS,
        "Unexpected field or expression in a Table's body",
      );
    }
  }

  private tableColumn(tableST: TableSymbolTable, node: FunctionApplicationNode) {
    const { callee, args } = node;

    const columnName = extractVariable(callee).unwrap_or(undefined);

    if (!columnName) {
      this.logError(
        callee,
        CompileErrorCode.INVALID,
        'A column name must be a valid variable (an identifier or a double-quoted string)',
      );

      return;
    }

    if (args.length > 2 || args.length <= 0) {
      this.logError(
        node,
        CompileErrorCode.INVALID,
        'Invalid column definition, at most a column name, type and setting can be present',
      );

      return;
    }

    const columnEntry = this.registerColumn(node, new ColumnSymbol(columnName), tableST);
    if (!columnEntry) {
      this.logError(callee, CompileErrorCode.INVALID, 'Duplicated column name');
    }

    const type = args[0];
    if (!isValidColumnType(type)) {
      this.logError(type, CompileErrorCode.INVALID, 'Invalid column type');
    }

    if (args.length === 2) {
      const settingList = args[1];
      if (!(settingList instanceof ListExpressionNode)) {
        this.logError(settingList, CompileErrorCode.INVALID, 'Expect a list of settings');
      } else {
        this.settingList(settingList, getColumnSettingValueValidator, allowDuplicateColumnSetting);
      }
    }
  }

  private tableGroupElement = this.contextStack.withContextDo(
    ValidatorContext.TableGroupContext,
    (node: ElementDeclarationNode) => {
      this.checkContext(node, 'TableGroup')
        .and_then(() => this.checkElementNameExistence(node, 'TableGroup'))
        .and_then(() => this.checkComplexVariableName(node.name, 'TableGroup'))
        .map((variables) => {
          const tableGroupName = variables.pop();
          if (!tableGroupName) {
            throw new Error('Unexpected empty TableGroup name');
          }
          const tableGroupSymbol = new TableGroupSymbol(tableGroupName);

          const schemaST = this.registerSchemaStack(node, variables);

          if (schemaST.has(tableGroupSymbol)) {
            this.logError(node.name!, CompileErrorCode.INVALID, 'Duplicated TableGroup name');
          }

          const tableGroupEntry = createTableGroupEntry(this.nodeMap, node);
          schemaST.set(tableGroupSymbol, tableGroupEntry);
        });

      this.checkNoAlias(node, 'TableGroup');
      this.checkNoSettings(node, 'TableGroup');
      this.checkInstanceOf(node.body, BlockExpressionNode, 'block', "TableGroup's body").map(() =>
        (node.body as BlockExpressionNode).body.forEach((element) =>
          this.tableGroupSubElement(element),
        ),
      );
    },
  );

  private tableGroupSubElement(subElement: SyntaxNode) {
    if (subElement instanceof PrimaryExpressionNode || isAccessExpression(subElement)) {
      this.checkComplexVariableName(subElement, 'TableGroup field');
    }
  }

  private settingList(
    settingList: ListExpressionNode,
    getSettingValueValidator: (
      settingName: string,
    ) => ((value?: SyntaxNode | SyntaxToken[]) => boolean) | undefined,
    allowDuplicateSetting: (settingName: string) => boolean,
  ) {
    const presentSettings = new Set<string>();

    // eslint-disable-next-line no-restricted-syntax
    for (const setting of settingList.elementList) {
      const { name, value } = setting;

      const joinedName = joinTokenStrings(name);

      if (!allowDuplicateSetting(joinedName)) {
        if (presentSettings.has(joinedName)) {
          this.logError(
            setting,
            CompileErrorCode.INVALID,
            'This setting is not supposed to be duplicated',
          );
          continue;
        } else {
          presentSettings.add(joinedName);
        }
      }

      const settingValueValidator = getSettingValueValidator(joinedName);
      if (!settingValueValidator) {
        this.logError(setting, CompileErrorCode.INVALID, 'Unknown setting');
        continue;
      }
      if (!settingValueValidator(value)) {
        this.logError(setting, CompileErrorCode.INVALID, 'Invalid setting value');
      }
    }
  }

  private checkInstanceOf(
    node: SyntaxNode,
    cls: any,
    clsName: string,
    elemName: string,
  ): Option<null> {
    if (!(node instanceof cls)) {
      this.logError(node, CompileErrorCode.INVALID, `Expect ${elemName} to be a ${clsName}`);

      return new None();
    }

    return new Some(null);
  }

  private checkContext(node: ElementDeclarationNode, elemName: string): Option<null> {
    const res = canBeNestedWithin(this.contextStack.parent(), this.contextStack.top());
    if (!res) {
      this.logError(
        node.type,
        CompileErrorCode.INVALID,
        `"${elemName}" can not appear in this context`,
      );

      return new None();
    }

    return new Some(null);
  }

  private checkNoSettings(node: ElementDeclarationNode, elemName: string): Option<null> {
    if (node.attributeList) {
      this.logError(
        node.attributeList,
        CompileErrorCode.INVALID,
        `${elemName} isn't expected to have settings`,
      );

      return new None();
    }

    return new Some(null);
  }

  private checkElementNameExistence(node: ElementDeclarationNode, elemName: string): Option<null> {
    if (node.name === undefined) {
      this.logError(
        node.type,
        CompileErrorCode.EXPECTED_THINGS,
        `Expect a name for this ${elemName}`,
      );

      return new None();
    }

    return new Some(null);
  }

  private checkComplexVariableName(
    nameNode: SyntaxNode | undefined,
    elemName: string,
  ): Option<string[]> {
    if (nameNode === undefined) {
      return new None();
    }

    const variables = destructureComplexVariable(nameNode).unwrap_or(undefined);
    if (!variables) {
      this.logError(nameNode, CompileErrorCode.INVALID, `Invalid ${elemName} name`);

      return new None();
    }

    return new Some(variables);
  }

  private checkAlias(node: ElementDeclarationNode): Option<string> {
    if (!node.as && node.alias) {
      this.logError(
        node.alias,
        CompileErrorCode.EXPECTED_THINGS,
        'Expect the "as" keyword when an alias is present',
      );
    }

    if (node.alias) {
      // eslint-disable-next-line @typescript-eslint/no-shadow
      const variable = extractVariable(node.alias).unwrap_or(undefined);
      if (!variable) {
        this.logError(
          node.alias,
          CompileErrorCode.INVALID,
          'Expect the alias to be a quoted string or an identifer',
        );

        return new None();
      }

      return new Some(variable);
    }

    return new None();
  }

  private checkNoName(node: ElementDeclarationNode, elemName: string): Option<null> {
    if (node.name) {
      this.logError(
        node.name,
        CompileErrorCode.UNEXPECTED_THINGS,
        `A ${elemName} shouldn't have a name`,
      );

      return new None();
    }

    return new Some(null);
  }

  private checkNoAlias(node: ElementDeclarationNode, elemName: string): Option<null> {
    if (node.as || node.alias) {
      this.logError(
        node.as || (node.alias as SyntaxNode | SyntaxToken),
        CompileErrorCode.UNEXPECTED_THINGS,
        `A ${elemName} shouldn't have an alias`,
      );

      return new None();
    }

    return new Some(null);
  }

  private registerTable(
    declarationNode: ElementDeclarationNode,
    tableSymbol: TableSymbol,
    schemaSymbolTable: SchemaSymbolTable,
    tableEntry?: TableEntry,
  ): TableEntry | undefined {
    if (schemaSymbolTable.has(tableSymbol)) {
      this.logError(declarationNode.name!, CompileErrorCode.INVALID, 'Duplicated Table name');

      return undefined;
    }
    const entry =
      tableEntry || createTableEntry(this.nodeMap, declarationNode, new TableSymbolTable());

    schemaSymbolTable.set(tableSymbol, entry);

    return entry;
  }

  private registerColumn(
    declarationNode: FunctionApplicationNode,
    columnSymbol: ColumnSymbol,
    tableSymbolTable: TableSymbolTable,
  ): ColumnEntry | undefined {
    if (tableSymbolTable.has(columnSymbol)) {
      return undefined;
    }

    const columnEntry = createColumnEntry(this.nodeMap, declarationNode);
    tableSymbolTable.set(columnSymbol, columnEntry);

    return columnEntry;
  }

  private registerSchemaStack(
    declarationNode: ElementDeclarationNode,
    variables: string[],
  ): SchemaSymbolTable {
    let schemaST: SchemaSymbolTable = this.symbolTable;
    // eslint-disable-next-line no-restricted-syntax
    for (const schemaName of variables) {
      const schemaSym = new SchemaSymbol(schemaName);
      schemaST = schemaST.get(
        schemaSym,
        createSchemaEntry(this.nodeMap, new SchemaSymbolTable()),
      ).symbolTable;
    }

    return schemaST;
  }

  private logError(node: SyntaxNode | SyntaxToken, code: CompileErrorCode, message: string) {
    // eslint-disable-next-line no-unused-expressions
    node instanceof SyntaxToken
      ? this.errors.push(new CompileError(code, message, node.offset, node.offset + node.length))
      : this.errors.push(new CompileError(code, message, node.start, node.end));
  }
}
