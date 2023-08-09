import { CompileError, CompileErrorCode } from '../../../errors';
import { SyntaxToken } from '../../../lexer/tokens';
import { None, Option, Some } from '../../../option';
import {
  ElementDeclarationNode,
  ExpressionNode,
  FunctionApplicationNode,
  ListExpressionNode,
  SyntaxNode,
} from '../../../parser/nodes';
import { extractIdentifierFromNode } from '../../../utils';
import { SchemaSymbolTable, SymbolTableEntry } from '../../symbol/symbolTable';
import { destructureComplexVariable, joinTokenStrings } from '../../utils';
import { ContextStack, ValidatorContext, canBeNestedWithin } from '../validatorContext';
import {
  createEntry,
  createSubFieldEntry,
  createSubFieldSymbol,
  createSymbol,
  hasComplexBody,
  hasSimpleBody,
  isSimpleName,
  isValidAlias,
  isValidName,
  isValidSettings,
  pickValidator,
  registerSchemaStack,
} from './utils';

export type ErrorMessage = string;

export interface ArgumentValidatorConfig {
  validateArg(node: SyntaxNode): boolean;
  errorCode: CompileErrorCode;
}

export enum ElementKind {
  TABLE = 'Table',
  ENUM = 'Enum',
  INDEXES = 'Indexes',
  NOTE = 'Note',
  PROJECT = 'Project',
  REF = 'Ref',
  TABLEGROUP = 'TableGroup',
  CUSTOM = 'CUSTOM',
}

export default abstract class ElementValidator {
  protected abstract elementKind: ElementKind;

  protected abstract associatedContext: ValidatorContext;
  protected abstract contextErrorCode: CompileErrorCode;
  protected abstract stopOnContextError: boolean;

  protected abstract shouldBeUnique: boolean;
  protected abstract nonuniqueErrorCode?: CompileErrorCode;
  protected abstract stopOnUniqueError: boolean;

  protected abstract allowNoName: boolean;
  protected abstract noNameFoundErrorCode?: CompileErrorCode;
  protected abstract allowName: boolean;
  protected abstract nameFoundErrorCode?: CompileErrorCode;
  protected abstract allowComplexName: boolean;
  protected abstract complexNameFoundErrorCode?: CompileErrorCode;
  protected abstract stopOnNameError: boolean;
  protected abstract shouldRegisterName: boolean;
  protected abstract duplicateNameFoundErrorCode?: CompileErrorCode;

  protected abstract allowNoAlias: boolean;
  protected abstract noAliasFoundErrorCode?: CompileErrorCode;
  protected abstract allowAlias: boolean;
  protected abstract aliasFoundErrorCode?: CompileErrorCode;
  protected abstract stopOnAliasError: boolean;

  protected abstract allowNoSettings: boolean;
  protected abstract noSettingsFoundErrorCode?: CompileErrorCode;
  protected abstract allowSettings: boolean;
  protected abstract settingsFoundErrorCode?: CompileErrorCode;
  protected abstract stopOnSettingsError: boolean;
  protected abstract allowDuplicateForThisSetting?: (settingName: string) => boolean;
  protected abstract duplicateSettingsErrorCode?: CompileErrorCode;
  protected abstract allowValueForThisSetting?: (
    settingName: string,
    value?: SyntaxToken[] | SyntaxNode,
  ) => boolean;
  protected abstract invalidSettingValueErrorCode?: CompileErrorCode;

  protected abstract allowSimpleBody: boolean;
  protected abstract simpleBodyFoundErrorCode?: CompileErrorCode;
  protected abstract allowComplexBody: boolean;
  protected abstract complexBodyFoundErrorCode?: CompileErrorCode;
  protected abstract stopOnBodyError: boolean;

  protected abstract nonSettingsArgsValidators: ArgumentValidatorConfig[];
  protected abstract invalidNumberOfArgsErrorCode?: CompileErrorCode;
  protected abstract allowSubFieldSettings?: boolean;
  protected abstract subFieldSettingsFoundErrorCode?: CompileErrorCode;
  protected abstract allowDuplicateForThisSubFieldSetting?: (settingName: string) => boolean;
  protected abstract duplicateSubFieldSettingsErrorCode?: CompileErrorCode;
  protected abstract allowValueForThisSubFieldSetting?: (
    settingName: string,
    value?: SyntaxToken[] | SyntaxNode,
  ) => boolean;
  protected abstract invalidSubFieldSettingValueErrorCode?: CompileErrorCode;
  protected abstract shouldRegisterSubField: boolean;
  protected abstract duplicateSubFieldNameErrorCode?: CompileErrorCode;

  protected declarationNode: ElementDeclarationNode;
  protected globalSchema: SchemaSymbolTable;
  protected contextStack: ContextStack;
  protected errors: CompileError[];
  protected uniqueKindsFound: Set<ElementKind>;

  protected elementEntry?: SymbolTableEntry;

  constructor(
    declarationNode: ElementDeclarationNode,
    globalSchema: SchemaSymbolTable,
    contextStack: ContextStack,
    errors: CompileError[],
    uniqueKindsFound: Set<ElementKind>,
  ) {
    this.declarationNode = declarationNode;
    this.globalSchema = globalSchema;
    this.contextStack = contextStack;
    this.errors = errors;
    this.uniqueKindsFound = uniqueKindsFound;
  }

  validate(): boolean {
    this.contextStack.push(this.associatedContext);
    const res =
      this.validateContext() &&
      this.validateUnique() &&
      this.validateName() &&
      this.validateAlias() &&
      this.validateSetting() &&
      this.validateBody();

    this.contextStack.pop();

    return res;
  }

  private validateUnique(): boolean {
    if (!this.shouldBeUnique) {
      return true;
    }

    if (this.uniqueKindsFound.has(this.elementKind)) {
      this.logError(
        this.declarationNode.type,
        this.nonuniqueErrorCode,
        `A ${this.elementKind} has already been defined`,
      );

      return false || !this.stopOnUniqueError;
    }

    this.uniqueKindsFound.add(this.elementKind);

    return true;
  }

  private validateContext(): boolean {
    const res = canBeNestedWithin(this.contextStack.parent(), this.contextStack.top());

    if (!res) {
      this.logError(
        this.declarationNode.type,
        this.contextErrorCode,
        `${this.elementKind} can not appear here`,
      );
    }

    return res || !this.stopOnContextError;
  }

  private validateName(): boolean {
    let hasError = false;
    const node = this.declarationNode;
    const nameNode = node.name;

    if (nameNode && !isValidName(nameNode)) {
      this.logError(nameNode, CompileErrorCode.INVALID_NAME, 'Invalid element name');
      hasError = true;
    }

    if (!this.allowName && nameNode) {
      this.logError(nameNode, this.nameFoundErrorCode, `${this.elementKind} shouldn't have a name`);
      hasError = true;
    }

    if (!this.allowNoName && !nameNode) {
      this.logError(node.type, this.noNameFoundErrorCode, `${this.elementKind} must have a name`);
      hasError = true;
    }

    if (!this.allowComplexName && nameNode && !isSimpleName(nameNode)) {
      this.logError(
        nameNode,
        this.complexNameFoundErrorCode,
        `${this.elementKind} must have a double-quoted string or an identifier name`,
      );
      hasError = true;
    }

    if (!hasError && nameNode && this.shouldRegisterName) {
      this.elementEntry = this.registerElement(nameNode, this.globalSchema).unwrap_or(undefined);
      if (!this.elementEntry) {
        this.logError(
          nameNode,
          this.duplicateNameFoundErrorCode,
          `This ${this.elementKind} has a duplicated name`,
        );
        hasError = true;
      }
    }

    return !hasError || !this.stopOnNameError;
  }

  private validateAlias(): boolean {
    let hasError = false;
    const node = this.declarationNode;
    const aliasNode = node.alias;

    if (aliasNode && !isValidAlias(aliasNode)) {
      this.logError(aliasNode, CompileErrorCode.INVALID_ALIAS, 'Invalid element alias');
      hasError = true;
    }

    if (!this.allowAlias && aliasNode) {
      this.logError(
        aliasNode,
        this.aliasFoundErrorCode,
        `${this.elementKind} shouldn't have an alias`,
      );
      hasError = true;
    }

    if (!this.allowNoAlias && !aliasNode) {
      this.logError(
        node.type,
        this.noAliasFoundErrorCode,
        `${this.elementKind} must have an alias`,
      );
      hasError = true;
    }

    if (!hasError && aliasNode && this.shouldRegisterName) {
      this.elementEntry = this.registerElement(
        aliasNode,
        this.globalSchema,
        this.elementEntry,
      ).unwrap_or(undefined);
      hasError = this.elementEntry === undefined || hasError;
    }

    return !hasError || !this.stopOnAliasError;
  }

  private validateSetting(): boolean {
    let hasError = false;
    const node = this.declarationNode;
    const settingsNode = node.attributeList;

    if (settingsNode && !isValidSettings(settingsNode)) {
      this.logError(settingsNode, CompileErrorCode.INVALID_SETTINGS, 'Settings must be a list');
      hasError = true;
    }

    if (!this.allowSettings && settingsNode) {
      this.logError(
        settingsNode,
        this.settingsFoundErrorCode,
        `${this.elementKind} shouldn't have a setting list`,
      );
      hasError = true;
    }

    if (!this.allowNoSettings && !settingsNode) {
      this.logError(
        node.type,
        this.noSettingsFoundErrorCode,
        `${this.elementKind} must have a setting list`,
      );
      hasError = true;
    }

    if (this.allowDuplicateForThisSetting && this.allowValueForThisSetting && settingsNode) {
      const settingsSet = new Set<string>();
      // eslint-disable-next-line no-restricted-syntax
      for (const setting of settingsNode.elementList) {
        const settingName = joinTokenStrings(setting.name).toLowerCase();
        const settingValue = setting.value;
        if (settingsSet.has(settingName) && !this.allowDuplicateForThisSetting(settingName)) {
          this.logError(setting, this.duplicateSettingsErrorCode, 'Duplicated setting');
          hasError = true;
          continue;
        }
        settingsSet.add(settingName);
        if (!this.allowValueForThisSetting(settingName, settingValue)) {
          this.logError(
            setting,
            this.invalidSettingValueErrorCode,
            'Invalid value for this setting',
          );
          hasError = true;
        }
      }
    }

    return !hasError || !this.stopOnSettingsError;
  }

  private validateBody(): boolean {
    let hasError = false;
    const node = this.declarationNode;

    if (!this.allowComplexBody && hasComplexBody(node)) {
      this.logError(
        node.body,
        this.complexBodyFoundErrorCode,
        `${this.elementKind} should not have a complex body`,
      );
      hasError = true;
    }

    if (!this.allowSimpleBody && hasSimpleBody(node)) {
      this.logError(
        node.body,
        this.simpleBodyFoundErrorCode,
        `${this.elementKind} should not have a simple body`,
      );
      hasError = true;
    }

    if (hasComplexBody(node)) {
      node.body.body.forEach((sub) => {
        hasError = this.validateSubElement(sub) || hasError;
      });
    } else if (node.body instanceof FunctionApplicationNode) {
      hasError = this.validateSubFunctionApplication(node.body) || hasError;
    } else {
      hasError =
        this.validateSubFunctionApplication(
          new FunctionApplicationNode({ callee: node.body, args: [] }),
        ) || hasError;
    }

    return !hasError || !this.stopOnBodyError;
  }

  private registerElement(
    nameNode: SyntaxNode,
    schema: SchemaSymbolTable,
    entry?: SymbolTableEntry,
  ): Option<SymbolTableEntry> {
    const variables = destructureComplexVariable(nameNode).unwrap_or(undefined);
    if (!variables) {
      throw new Error(`${this.elementKind} must be a valid complex variable`);
    }
    const name = variables.pop();
    if (!name) {
      throw new Error(`${this.elementKind} name shouldn't be empty`);
    }

    const symbol = createSymbol(name, this.associatedContext);
    const registerSchema = registerSchemaStack(variables, schema);
    if (!symbol) {
      throw new Error(`${this.elementKind} isn't supposed to register its name`);
    }
    if (registerSchema.has(symbol)) {
      this.logError(
        nameNode,
        this.duplicateNameFoundErrorCode,
        `This ${this.elementKind} has a duplicated name`,
      );

      return new None();
    }

    const newEntry = createEntry(this.associatedContext);
    if (!newEntry) {
      throw new Error(`${this.elementKind} can create symbol but not entry?`);
    }

    return new Some(registerSchema.get(symbol, entry || (newEntry as any)));
  }

  protected validateSubElement(sub: SyntaxNode): boolean {
    if (sub instanceof ElementDeclarationNode) {
      return this.validateSubElementDeclaration(sub);
    }
    if (sub instanceof FunctionApplicationNode) {
      return this.validateSubFunctionApplication(sub);
    }

    return this.validateSubFunctionApplication(
      new FunctionApplicationNode({ callee: sub as ExpressionNode, args: [] }),
    );
  }

  protected validateSubElementDeclaration(sub: ElementDeclarationNode): boolean {
    const Validator: {
      new (
        arg1: ElementDeclarationNode,
        arg2: SchemaSymbolTable,
        arg3: ContextStack,
        arg4: CompileError[],
        arg5: Set<ElementKind>,
      ): ElementValidator;
    } = pickValidator(sub);

    const validatorObject = new Validator(
      sub,
      this.globalSchema,
      this.contextStack,
      this.errors,
      this.uniqueKindsFound,
    );

    return validatorObject.validate();
  }

  protected validateSubFunctionApplication(sub: FunctionApplicationNode): boolean {
    const args = [sub.callee, ...sub.args];
    if (args.length === 0) {
      throw new Error('A function application node always has at least 1 callee');
    }

    const maybeSettings = args[args.length - 1];
    let hasError = false;

    if (maybeSettings instanceof ListExpressionNode) {
      if (!this.allowSubFieldSettings) {
        this.logError(
          maybeSettings,
          this.subFieldSettingsFoundErrorCode,
          `A ${this.elementKind} subfield should not have a settings`,
        );
        hasError = true;
      } else {
        hasError = this.validateSubFieldSettings(maybeSettings) || hasError;
      }
      args.pop();
    }

    if (args.length !== this.nonSettingsArgsValidators.length) {
      this.logError(
        sub,
        this.invalidNumberOfArgsErrorCode,
        `There must be ${this.nonSettingsArgsValidators.length} non-setting terms`,
      );
      hasError = true;
    } else {
      for (let i = 0; i < args.length; ++i) {
        const res = this.nonSettingsArgsValidators[i].validateArg(args[i]);
        if (!res) {
          this.logError(
            args[i],
            this.nonSettingsArgsValidators[i].errorCode,
            'Invalid field value',
          );
          hasError = true;
        }
      }
    }

    if (this.shouldRegisterSubField && !hasError) {
      const entry = this.registerSubField(args[0]).unwrap_or(undefined);
      hasError = entry === undefined || hasError;
    }

    return !hasError;
  }

  private registerSubField(nameNode: SyntaxNode): Option<SymbolTableEntry> {
    if (!this.elementEntry || !this.elementEntry.symbolTable) {
      throw new Error('If an element allows registering subfields, it must own a symbol table');
    }
    if (!isSimpleName(nameNode)) {
      throw new Error('If an element allows registering subfields, their name must be simple');
    }
    const name = extractIdentifierFromNode(nameNode)?.value;
    const { symbolTable } = this.elementEntry;
    if (!name) {
      throw new Error(`${this.elementKind} subfield's name shouldn't be empty`);
    }

    const symbol = createSubFieldSymbol(name, this.associatedContext);
    if ((symbolTable as any).has(symbol)) {
      this.logError(
        nameNode,
        this.duplicateSubFieldNameErrorCode,
        `${this.elementKind} subfield's name is duplicated`,
      );

      return new None();
    }

    return new Some((symbolTable as any).get(symbol, createSubFieldEntry(this.associatedContext)));
  }

  protected validateSubFieldSettings(subSettings: ListExpressionNode): boolean {
    if (!this.allowDuplicateForThisSubFieldSetting || !this.allowValueForThisSubFieldSetting) {
      throw new Error('Subsettings validators must be passed to call validateSubFieldSettings');
    }
    let hasError = false;

    const settingsSet = new Set<string>();
    // eslint-disable-next-line no-restricted-syntax
    for (const setting of subSettings.elementList) {
      const settingName = joinTokenStrings(setting.name).toLowerCase();
      const settingValue = setting.value;
      if (settingsSet.has(settingName) && !this.allowDuplicateForThisSubFieldSetting(settingName)) {
        this.logError(
          setting,
          this.duplicateSubFieldSettingsErrorCode,
          'Duplicated subfield setting',
        );
        hasError = true;
        continue;
      }
      settingsSet.add(settingName);
      if (!this.allowValueForThisSubFieldSetting(settingName, settingValue)) {
        this.logError(
          setting,
          this.invalidSubFieldSettingValueErrorCode,
          'Invalid value for this setting',
        );
        hasError = true;
      }
    }

    return !hasError;
  }

  protected logError(
    node: SyntaxNode | SyntaxToken,
    code: CompileErrorCode | undefined,
    message: string,
  ) {
    if (code === undefined) {
      throw Error(`This error shouldn't exist. Maybe a validator is misconfigured
       Error message: ${message}`);
    }
    // eslint-disable-next-line no-unused-expressions
    node instanceof SyntaxToken ?
      this.errors.push(new CompileError(code, message, node.offset, node.offset + node.length)) :
      this.errors.push(new CompileError(code, message, node.start, node.end));
  }
}
