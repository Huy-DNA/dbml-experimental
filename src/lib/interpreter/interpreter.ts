import { CompileError, CompileErrorCode } from '../errors';
import {
  BlockExpressionNode,
  CallExpressionNode,
  ElementDeclarationNode,
  ExpressionNode,
  FunctionApplicationNode,
  IdentiferStreamNode,
  InfixExpressionNode,
  ListExpressionNode,
  ProgramNode,
  SyntaxNode,
} from '../parser/nodes';
import {
  Column,
  Database,
  Enum,
  EnumField,
  Index,
  InlineRef,
  Project,
  Ref,
  RefEndpoint,
  Table,
  TableGroup,
  TableGroupField,
  TokenPosition,
} from './types';
import Report from '../report';
import {
  destructureComplexVariable,
  destructureIndex,
  extractQuotedStringToken,
  extractVarNameFromPrimaryVariable,
} from '../analyzer/utils';
import { collectAttribute } from './attributeCollector';
import { ColumnSymbol } from '../analyzer/symbol/symbols';
import {
  convertRelationOpToCardinalities,
  isCircular,
  isSameEndpoint,
  processRelOperand,
} from './utils';
import { None, Option, Some } from '../option';

export default class Interpreter {
  ast: ProgramNode;
  errors: CompileError[];
  db: Database;
  endpointPairSet: Set<string>;

  constructor(ast: ProgramNode) {
    this.ast = ast;
    this.db = {
      schemas: [],
      tables: [],
      refs: [],
      enums: [],
      tableGroups: [],
      aliases: [],
      project: {},
    };
    this.endpointPairSet = new Set();
    this.errors = [];
  }

  interpret(): Report<Database, CompileError> {
    this.ast.body.forEach((element) => {
      switch (element.type.value.toLowerCase()) {
        case 'table':
          tryPush(this.table(element), this.db.tables);
          break;
        case 'ref':
          this.db.refs.push(...this.ref(element, null, null));
          break;
        case 'tablegroup':
          tryPush(this.tableGroup(element), this.db.tableGroups);
          break;
        case 'enum':
          tryPush(this.enum(element), this.db.enums);
          break;
        case 'project':
          this.db.project = this.project(element);
          break;
      }
    });

    return new Report(this.db, this.errors);
  }

  table(element: ElementDeclarationNode): Table | undefined {
    const maybeName = this.extractElementName(element.name!);
    if (!maybeName.isOk()) {
      return undefined;
    }
    const { name, schemaName } = maybeName.unwrap();
    const alias = element.alias ? extractVarNameFromPrimaryVariable(element.alias as any) : null;

    const collector = collectAttribute(element.attributeList, this.errors);
    const headerColor = collector.extractHeaderColor();
    const note = collector.extractNote();
    const noteToken = collector.settingMap.getNameNode('note') as IdentiferStreamNode | undefined;
    const fields: Column[] = [];
    const indexes: Index[] = [];
    (element.body as BlockExpressionNode).body.forEach((sub) => {
      if (sub instanceof FunctionApplicationNode) {
        tryPush(this.column(sub, name, schemaName), fields);
      } else if (sub instanceof ElementDeclarationNode) {
        switch (sub.type.value.toLowerCase()) {
          case 'ref':
            this.db.refs.push(...this.ref(sub, name, schemaName));
            break;
          case 'indexes':
            this.indexes(sub);
            break;
          case 'note':
            if (note !== undefined) {
              this.logError(
                sub,
                CompileErrorCode.NOTE_REDEFINED,
                'Note already appears as a setting of the table',
              );
            } else {
              this.note(sub);
            }
            break;
        }
      }
    });

    return {
      name,
      schemaName,
      alias,
      fields,
      indexes,
      token: {
        start: element.startPos,
        end: element.endPos,
      },
      headerColor,
      note: note ?
        {
            value: note,
            token: {
              start: noteToken!.startPos,
              end: noteToken!.endPos,
            },
          } :
        undefined,
    };
  }

  column(
    field: FunctionApplicationNode,
    tableName: string,
    schemaName: string | null,
  ): Column | undefined {
    const name = extractVarNameFromPrimaryVariable(field.callee as any);
    let typeNode = field.args[0];
    let typeArgs: string | null = null;
    if (typeNode instanceof CallExpressionNode) {
      typeArgs = typeNode.argumentList.elementList
        .map((e) => (e as any).expression.literal.value)
        .join(', ');
      typeNode = typeNode.callee;
    }

    const maybeName = this.extractElementName(typeNode);
    if (!maybeName.isOk()) {
      return undefined;
    }
    const { name: typeName, schemaName: typeSchemaName } = maybeName.unwrap();

    let pk: boolean | undefined;
    let increment: boolean | undefined;
    let unique: boolean | undefined;
    let notNull: boolean | undefined;
    let dbdefault:
      | {
          type: 'number' | 'string';
          value: number | string;
        }
      | undefined;
    let inlineRefs: (InlineRef & { referee: ColumnSymbol; node: SyntaxNode })[] = [];
    // eslint-disable-next-line no-underscore-dangle
    const _inlineRefs: InlineRef[] = [];
    if (field.args.length === 2) {
      const collector = collectAttribute(field.args[1] as ListExpressionNode, this.errors);
      pk = collector.extractPk();
      increment = collector.extractIncrement();
      unique = collector.extractUnique();
      notNull = collector.extractNotNull();
      dbdefault = collector.extractDefault();
      inlineRefs = collector.extractRef(tableName, schemaName);
      inlineRefs.forEach((ref) => {
        if (!this.logIfCircularRefError(field.callee, field.symbol as ColumnSymbol, ref.referee)) {
          return;
        }
        _inlineRefs.push({
          schemaName: ref.schemaName,
          fieldNames: ref.fieldNames,
          tableName: ref.tableName,
          relation: ref.relation,
          token: ref.token,
        });
        this.registerInlineRefEndpoints(ref, field, tableName, schemaName);
      });
    }

    return {
      name,
      type: {
        schemaName: typeSchemaName,
        type_name: `${typeName}(${typeArgs})`,
        args: typeArgs,
      },
      token: {
        start: field.startPos,
        end: field.endPos,
      },
      pk,
      dbdefault,
      increment,
      unique,
      not_null: notNull,
      inline_refs: _inlineRefs,
    };
  }

  registerInlineRefEndpoints(
    inlRef: InlineRef,
    columnNode: FunctionApplicationNode,
    tableName: string,
    schemaName: string | null,
  ) {
    const [left, right] = convertRelationOpToCardinalities(inlRef.relation);
    const ref: Ref = {
      schemaName: null,
      name: null,
      endpoints: [
        {
          schemaName,
          tableName,
          fieldNames: [extractVarNameFromPrimaryVariable(columnNode.callee as any)],
          relation: left,
          token: {
            start: columnNode.startPos,
            end: columnNode.endPos,
          },
        },
        {
          schemaName: inlRef.schemaName,
          tableName: inlRef.tableName,
          fieldNames: inlRef.fieldNames,
          relation: right,
          token: inlRef.token,
        },
      ],
    };
    this.db.refs.push(ref);
  }

  ref(
    element: ElementDeclarationNode,
    ownerTableName: string | null,
    ownerSchemaName: string | null,
  ): Ref[] {
    let schemaName: string | null = null;
    let name: string | null = null;
    if (element.name) {
      const maybeName = this.extractElementName(element.name);
      if (!maybeName.isOk()) {
        return [];
      }
      schemaName = maybeName.unwrap().schemaName;
      name = maybeName.unwrap().name;
    }

    if (!(element.body instanceof BlockExpressionNode)) {
      const maybeRef = this.refField(
        element.body,
        schemaName,
        name,
        ownerTableName,
        ownerSchemaName,
      );

      return maybeRef ? [maybeRef] : [];
    }

    const res: Ref[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const field of element.body.body) {
      const maybeRef = this.refField(field, schemaName, name, ownerTableName, ownerSchemaName);
      if (maybeRef) {
        res.push(maybeRef);
      }
    }

    return res;
  }

  refField(
    field: ExpressionNode,
    refSchemaName: string | null,
    refName: string | null,
    ownerTableName: string | null,
    ownerSchemaName: string | null,
  ): Ref | undefined {
    const args = field instanceof FunctionApplicationNode ? [field.callee, ...field.args] : [field];
    const rel = args[0] as InfixExpressionNode;
    const [leftCardinality, rightCardinality] = convertRelationOpToCardinalities(rel.op.value);
    if (
      !this.logIfSameEndpoint(
        rel,
        rel.leftExpression.referee as ColumnSymbol,
        rel.rightExpression.referee as ColumnSymbol,
      )
    ) {
      return undefined;
    }
    if (
      !this.logIfCircularRefError(
        rel,
        rel.leftExpression.referee as ColumnSymbol,
        rel.rightExpression.referee as ColumnSymbol,
      )
    ) {
      return undefined;
    }
    const left = processRelOperand(rel.leftExpression, ownerTableName, ownerSchemaName);
    const right = processRelOperand(rel.rightExpression, ownerTableName, ownerSchemaName);
    if (left instanceof CompileError) {
      this.errors.push(left);
    }
    if (right instanceof CompileError) {
      this.errors.push(right);
    }
    if (left instanceof CompileError || right instanceof CompileError) {
      return undefined;
    }

    const leftEndpoint: RefEndpoint = {
      schemaName: left.schemaName,
      tableName: left.tableName,
      fieldNames: [left.columnName],
      relation: leftCardinality,
      token: {
        start: rel.leftExpression.startPos,
        end: rel.leftExpression.endPos,
      },
    };
    const rightEndpoint: RefEndpoint = {
      schemaName: right.schemaName,
      tableName: right.tableName,
      fieldNames: [right.columnName],
      relation: rightCardinality,
      token: {
        start: rel.rightExpression.startPos,
        end: rel.rightExpression.endPos,
      },
    };
    let del: string | undefined;
    let update: string | undefined;
    if (args.length === 2) {
      const collector = collectAttribute(args[1] as ListExpressionNode, this.errors);
      del = collector.extractDelete();
      update = collector.extractUpdate();
    }

    return {
      schemaName: refSchemaName,
      name: refName,
      endpoints: [leftEndpoint, rightEndpoint],
      delete: del as any,
      update: update as any,
    };
  }

  enum(element: ElementDeclarationNode): Enum | undefined {
    const maybeName = this.extractElementName(element.name!);
    if (!maybeName.isOk()) {
      return undefined;
    }
    const { name, schemaName } = maybeName.unwrap();
    const values = (element.body as BlockExpressionNode).body.map((sub) => this.enumField(sub));

    return {
      schemaName,
      name,
      values,
      token: {
        start: element.startPos,
        end: element.endPos,
      },
    };
  }

  enumField(field: ExpressionNode): EnumField {
    const args = field instanceof FunctionApplicationNode ? [field.callee, ...field.args] : [field];
    let note: string | undefined;
    if (args.length === 2) {
      const collector = collectAttribute(args[1] as ListExpressionNode, this.errors);
      note = collector.extractNote();
    }

    return {
      name: extractVarNameFromPrimaryVariable(args[0] as any),
      token: {
        start: field.startPos,
        end: field.endPos,
      },
      note,
    };
  }

  project(element: ElementDeclarationNode): Project {
    const proj: Project = {
      name: (element.name && extractVarNameFromPrimaryVariable(element.name as any)) || null,
      tables: [],
      refs: [],
      enums: [],
      tableGroups: [],
      note: null,
    };

    (element.body as BlockExpressionNode).body.forEach((sub) => {
      // eslint-disable-next-line no-underscore-dangle
      const _sub = sub as ElementDeclarationNode;
      const type = _sub.type.value.toLowerCase();
      switch (type) {
        case 'table':
          tryPush(this.table(_sub), proj.tables);
          break;
        case 'ref':
          proj.refs.push(...this.ref(_sub, null, null));
          break;
        case 'tablegroup':
          tryPush(this.tableGroup(_sub), proj.tableGroups);
          break;
        case 'enum':
          tryPush(this.enum(_sub), proj.enums);
          break;
        case 'note':
          proj.note = this.note(_sub)?.value || null;
          break;
        default:
          proj[type as any] = this.custom(_sub);
          break;
      }
    });

    return proj;
  }

  custom(element: ElementDeclarationNode): string {
    return extractQuotedStringToken(element.body)!;
  }

  tableGroup(element: ElementDeclarationNode): TableGroup | undefined {
    const maybeName = this.extractElementName(element.name!);
    if (!maybeName.isOk()) {
      return undefined;
    }
    const { name, schemaName } = maybeName.unwrap();
    const tables: TableGroupField[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const field of (element.body as BlockExpressionNode).body) {
      const maybeTableGroupField = this.tableGroupField(field);
      if (maybeTableGroupField) {
        tables.push(maybeTableGroupField);
      }
    }

    return {
      schemaName,
      name,
      tables,
      token: {
        start: element.startPos,
        end: element.endPos,
      },
    };
  }

  tableGroupField(field: ExpressionNode): TableGroupField | undefined {
    const maybeName = this.extractElementName(field);
    if (!maybeName.isOk()) {
      return undefined;
    }
    const { name, schemaName } = maybeName.unwrap();

    return {
      name,
      schemaName,
    };
  }

  note(element: ElementDeclarationNode): { value: string; token: TokenPosition } | undefined {
    const content =
      element.body instanceof BlockExpressionNode ?
        extractQuotedStringToken((element.body as BlockExpressionNode).body[0]) :
        extractQuotedStringToken(element.body);

    return {
      value: content!,
      token: {
        start: element.startPos,
        end: element.endPos,
      },
    };
  }

  indexes(element: ElementDeclarationNode): Index[] {
    const res: Index[] = [];

    // eslint-disable-next-line no-restricted-syntax
    for (const sub of (element.body as BlockExpressionNode).body) {
      const maybeIndexField = this.indexField(sub);
      if (maybeIndexField) {
        res.push(maybeIndexField);
      }
    }

    return res;
  }

  indexField(field: ExpressionNode): Index {
    const args = field instanceof FunctionApplicationNode ? [field.callee, ...field.args] : [field];

    const { functional, nonFunctional } = destructureIndex(args[0]).unwrap();
    let pk: boolean | undefined;
    let unique: boolean | undefined;
    let name: string | undefined;
    let note: string | undefined;
    let type: string | undefined;
    if (args.length === 2) {
      const collector = collectAttribute(args[1] as ListExpressionNode, this.errors);
      pk = collector.extractPk();
      unique = collector.extractUnique();
      name = collector.extractIdxName();
      note = collector.extractNote();
      type = collector.extractIndexType();
    }

    return {
      columns: [
        ...functional.map((s) => ({
          value: s,
          type: 'expression',
        })),
        ...nonFunctional.map((s) => ({
          value: s,
          type: 'column',
        })),
      ],
      token: {
        start: field.startPos,
        end: field.endPos,
      },
      pk,
      unique,
      name,
      type,
      note,
    };
  }

  extractElementName(nameNode: SyntaxNode): Option<{ schemaName: string | null; name: string }> {
    const fragments = destructureComplexVariable(nameNode).unwrap();
    const name = fragments.pop()!;
    const schemaName = fragments.pop();
    if (fragments.length > 0) {
      this.logError(
        nameNode,
        CompileErrorCode.UNSUPPORTED,
        'Nested schemas are currently not allowed',
      );

      return new None();
    }

    return new Some({
      name,
      // eslint-disable-next-line no-unneeded-ternary
      schemaName: schemaName ? schemaName : null,
    });
  }

  logIfSameEndpoint(
    node: SyntaxNode,
    firstColumnSymbol: ColumnSymbol,
    secondColumnSymbol: ColumnSymbol,
  ): boolean {
    if (isSameEndpoint(firstColumnSymbol, secondColumnSymbol)) {
      this.logError(node, CompileErrorCode.SAME_ENDPOINT, 'Two endpoints are the same');

      return false;
    }

    return true;
  }

  logIfCircularRefError(
    node: SyntaxNode,
    firstColumnSymbol: ColumnSymbol,
    secondColumnSymbol: ColumnSymbol,
  ): boolean {
    if (isCircular(firstColumnSymbol, secondColumnSymbol, this.endpointPairSet)) {
      this.logError(
        node,
        CompileErrorCode.UNSUPPORTED,
        'Reference with the same endpoints already exists',
      );

      return false;
    }

    return true;
  }

  logError(node: SyntaxNode, code: CompileErrorCode, message: string) {
    this.errors.push(new CompileError(code, message, node));
  }
}

function tryPush<T>(element: T | undefined, list: T[]) {
  if (element === undefined) {
    return;
  }

  list.push(element);
}