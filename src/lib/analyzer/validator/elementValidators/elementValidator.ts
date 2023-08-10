import {
  AliasValidatorConfig,
  BodyValidatorConfig,
  ContextValidatorConfig,
  ElementKind,
  NameValidatorConfig,
  SettingsValidatorConfig,
  SubFieldValidatorConfig,
  UniqueElementValidatorConfig,
} from '../types';
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
import { ContextStack, canBeNestedWithin } from '../validatorContext';
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
} from '../utils';

export default abstract class ElementValidator {
  protected abstract elementKind: ElementKind;

  protected abstract context: ContextValidatorConfig;
  protected abstract unique: UniqueElementValidatorConfig;
  protected abstract name: NameValidatorConfig;
  protected abstract alias: AliasValidatorConfig;
  protected abstract body: BodyValidatorConfig;
  protected abstract settings: SettingsValidatorConfig;
  protected abstract subfield: SubFieldValidatorConfig;

  protected declarationNode: ElementDeclarationNode;
  protected globalSchema: SchemaSymbolTable;
  protected contextStack: ContextStack;
  protected errors: CompileError[];
  protected kindsGloballyFound: Set<ElementKind>;
  protected kindsLocallyFound: Set<ElementKind>;

  protected elementEntry?: SymbolTableEntry;

  private registerNameFailed: boolean = false;

  constructor(
    declarationNode: ElementDeclarationNode,
    globalSchema: SchemaSymbolTable,
    contextStack: ContextStack,
    errors: CompileError[],
    kindsGloballyFound: Set<ElementKind>,
    kindsLocallyFound: Set<ElementKind>,
  ) {
    this.declarationNode = declarationNode;
    this.globalSchema = globalSchema;
    this.contextStack = contextStack;
    this.errors = errors;
    this.kindsGloballyFound = kindsGloballyFound;
    this.kindsLocallyFound = kindsLocallyFound;
  }

  validate(): boolean {
    this.contextStack.push(this.context.name);
    const res =
      this.validateContext() &&
      this.validateUnique() &&
      this.validateName() &&
      this.validateAlias() &&
      this.validateSettings() &&
      this.validateBodyForm() &&
      this.validateBodyContent();

    this.contextStack.pop();

    return res;
  }

  private validateUnique(): boolean {
    return (
      (this.validateGloballyUnique() && this.validateLocallyUnique()) || !this.unique.stopOnError
    );
  }

  private validateLocallyUnique(): boolean {
    if (!this.unique.locally) {
      return true;
    }

    if (this.kindsLocallyFound.has(this.elementKind)) {
      this.logError(
        this.declarationNode.type,
        this.unique.notLocallyErrorCode,
        `A ${this.elementKind} has already been defined in this scope`,
      );

      return false;
    }

    this.kindsLocallyFound.add(this.elementKind);

    return true;
  }
  private validateGloballyUnique(): boolean {
    if (!this.unique.globally) {
      return true;
    }

    if (this.kindsGloballyFound.has(this.elementKind)) {
      this.logError(
        this.declarationNode.type,
        this.unique.notGloballyErrorCode,
        `A ${this.elementKind} has already been defined in this file`,
      );

      return false;
    }

    this.kindsGloballyFound.add(this.elementKind);

    return true;
  }

  private validateContext(): boolean {
    const res = canBeNestedWithin(this.contextStack.parent(), this.contextStack.top());

    if (!res) {
      this.logError(
        this.declarationNode.type,
        this.context.errorCode,
        `${this.elementKind} can not appear here`,
      );
    }

    return res || !this.context.stopOnError;
  }

  private validateName(): boolean {
    let hasError = false;
    const node = this.declarationNode;
    const nameNode = node.name;

    if (nameNode && !isValidName(nameNode)) {
      this.logError(nameNode, CompileErrorCode.INVALID_NAME, 'Invalid element name');
      hasError = true;
    }

    if (!this.name.allow && nameNode) {
      this.logError(
        nameNode,
        this.name.foundErrorCode,
        `${this.elementKind} shouldn't have a name`,
      );
      hasError = true;
    }

    if (!this.name.optional && !nameNode) {
      this.logError(node.type, this.name.foundErrorCode, `${this.elementKind} must have a name`);
      hasError = true;
    }

    if (!this.name.allowComplex && nameNode && !isSimpleName(nameNode)) {
      this.logError(
        nameNode,
        this.name.complexErrorCode,
        `${this.elementKind} must have a double-quoted string or an identifier name`,
      );
      hasError = true;
    }

    if (!hasError && nameNode && this.name.shouldRegister) {
      this.elementEntry = this.registerElement(nameNode, this.globalSchema).unwrap_or(undefined);
      if (!this.elementEntry) {
        this.registerNameFailed = true;
        hasError = true;
      }
    }

    return !hasError || !this.name.stopOnError;
  }

  private validateAlias(): boolean {
    let hasError = false;
    const node = this.declarationNode;
    const aliasNode = node.alias;

    if (aliasNode && !isValidAlias(aliasNode)) {
      this.logError(aliasNode, CompileErrorCode.INVALID_ALIAS, 'Invalid element alias');
      hasError = true;
    }

    if (!this.alias.allow && aliasNode) {
      this.logError(
        aliasNode,
        this.alias.foundErrorCode,
        `${this.elementKind} shouldn't have an alias`,
      );
      hasError = true;
    }

    if (!this.alias.optional && !aliasNode) {
      this.logError(
        node.type,
        this.alias.notFoundErrorCode,
        `${this.elementKind} must have an alias`,
      );
      hasError = true;
    }

    if (!hasError && aliasNode && this.name.shouldRegister && !this.registerNameFailed) {
      this.elementEntry = this.registerElement(
        aliasNode,
        this.globalSchema,
        this.elementEntry,
      ).unwrap_or(undefined);
      hasError = this.elementEntry === undefined || hasError;
    }

    return !hasError || !this.alias.stopOnError;
  }

  private validateSettings(): boolean {
    let hasError = false;
    const node = this.declarationNode;
    const settingsNode = node.attributeList;

    if (settingsNode && !isValidSettings(settingsNode)) {
      this.logError(settingsNode, CompileErrorCode.INVALID_SETTINGS, 'Settings must be a list');
      hasError = true;
    }

    if (!this.settings.allow && settingsNode) {
      this.logError(
        settingsNode,
        this.settings.foundErrorCode,
        `${this.elementKind} shouldn't have a setting list`,
      );
      hasError = true;
    }

    if (!this.settings.optional && !settingsNode) {
      this.logError(
        node.type,
        this.settings.notFoundErrorCode,
        `${this.elementKind} must have a setting list`,
      );
      hasError = true;
    }

    if (settingsNode) {
      hasError = this.validateSettingsContent(settingsNode, this.settings) || hasError;
    }

    return !hasError || !this.settings.stopOnError;
  }

  private validateBodyForm(): boolean {
    let hasError = false;
    const node = this.declarationNode;

    if (!this.body.allowComplex && hasComplexBody(node)) {
      this.logError(
        node.body,
        this.body.complexErrorCode,
        `${this.elementKind} should not have a complex body`,
      );
      hasError = true;
    }

    if (!this.body.allowSimple && hasSimpleBody(node)) {
      this.logError(
        node.body,
        this.body.simpleErrorCode,
        `${this.elementKind} should not have a simple body`,
      );
      hasError = true;
    }

    return !hasError || !this.body.stopOnError;
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

    const symbol = createSymbol(name, this.context.name);
    const registerSchema = registerSchemaStack(variables, schema);
    if (!symbol) {
      throw new Error(`${this.elementKind} isn't supposed to register its name`);
    }
    if (registerSchema.has(symbol)) {
      this.logError(
        nameNode,
        this.name.duplicateErrorCode,
        `This ${this.elementKind} has a duplicated name`,
      );

      return new None();
    }

    const newEntry = createEntry(this.context.name);
    if (!newEntry) {
      throw new Error(`${this.elementKind} can create symbol but not entry?`);
    }

    return new Some(registerSchema.get(symbol, entry || (newEntry as any)));
  }

  protected validateBodyContent(): boolean {
    const node = this.declarationNode;

    if (hasComplexBody(node)) {
      const kindsFoundInScope = new Set<ElementKind>();
      let hasError = false;
      node.body.body.forEach((sub) => {
        hasError = this.validateEachOfComplexBody(sub, kindsFoundInScope) || hasError;
      });

      return !hasError;
    }
    if (node.body instanceof FunctionApplicationNode) {
      return this.validateSubField(node.body);
    }

    return this.validateSubField(new FunctionApplicationNode({ callee: node.body, args: [] }));
  }

  protected validateEachOfComplexBody(
    sub: SyntaxNode,
    kindsFoundInScope: Set<ElementKind>,
  ): boolean {
    if (sub instanceof ElementDeclarationNode) {
      return this.validateNestedElementDeclaration(sub, kindsFoundInScope);
    }
    if (sub instanceof FunctionApplicationNode) {
      return this.validateSubField(sub);
    }

    return this.validateSubField(
      new FunctionApplicationNode({ callee: sub as ExpressionNode, args: [] }),
    );
  }

  protected validateNestedElementDeclaration(
    sub: ElementDeclarationNode,
    kindsFoundInScope: Set<ElementKind>,
  ): boolean {
    const Val = pickValidator(sub);

    const validatorObject = new Val(
      sub,
      this.globalSchema,
      this.contextStack,
      this.errors,
      this.kindsGloballyFound,
      kindsFoundInScope,
    );

    return validatorObject.validate();
  }

  protected validateSubField(sub: FunctionApplicationNode): boolean {
    const args = [sub.callee, ...sub.args];
    if (args.length === 0) {
      throw new Error('A function application node always has at least 1 callee');
    }

    const maybeSettings = args[args.length - 1];
    this.validateSubFieldSettings(maybeSettings);
    if (maybeSettings instanceof ListExpressionNode) {
      args.pop();
    }

    this.validateSubFieldSettings(maybeSettings);

    if (args.length !== this.subfield.argValidators.length) {
      this.logError(
        sub,
        this.subfield.invalidArgNumberErrorCode,
        `There must be ${this.subfield.argValidators.length} non-setting terms`,
      );

      return false;
    }

    let hasError = false;

    for (let i = 0; i < args.length; ++i) {
      const res = this.subfield.argValidators[i].validateArg(args[i]);
      if (!res) {
        this.logError(args[i], this.subfield.argValidators[i].errorCode, 'Invalid field value');
        hasError = true;
      }
    }

    if (this.subfield.shouldRegister && !hasError) {
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

    const symbol = createSubFieldSymbol(name, this.context.name);
    if ((symbolTable as any).has(symbol)) {
      this.logError(
        nameNode,
        this.subfield.duplicateErrorCode,
        `${this.elementKind} subfield's name is duplicated`,
      );

      return new None();
    }

    return new Some((symbolTable as any).get(symbol, createSubFieldEntry(this.context.name)));
  }

  protected validateSubFieldSettings(maybeSettings: ExpressionNode): boolean {
    if (!(maybeSettings instanceof ListExpressionNode) && !this.subfield.setting.optional) {
      this.logError(
        maybeSettings,
        this.subfield.setting.notFoundErrorCode,
        `A ${this.elementKind} subfield must have a settings`,
      );

      return false;
    }

    if (maybeSettings instanceof ListExpressionNode && !this.subfield.setting.allow) {
      this.logError(
        maybeSettings,
        this.subfield.setting.foundErrorCode,
        `A ${this.elementKind} subfield should not have a settings`,
      );

      return false;
    }

    if (!(maybeSettings instanceof ListExpressionNode)) {
      return true;
    }

    return this.validateSettingsContent(maybeSettings, this.subfield.setting);
  }

  private validateSettingsContent(
    settingsNode: ListExpressionNode,
    config: SettingsValidatorConfig,
  ): boolean {
    const settingsSet = new Set<string>();
    let hasError = false;
    // eslint-disable-next-line no-restricted-syntax
    for (const setting of settingsNode.elementList) {
      const name = joinTokenStrings(setting.name).toLowerCase();
      const { value } = setting;

      if (!config.isValid(name, value).isOk()) {
        this.logError(setting, config.unknownErrorCode, 'Unknown setting');
        hasError = true;
      } else if (settingsSet.has(name) && !config.allowDuplicate) {
        this.logError(setting, config.duplicateErrorCode, 'Duplicate setting');
        hasError = true;
      } else {
        settingsSet.add(name);
        if (!config.isValid(name, value).unwrap()) {
          this.logError(setting, config.invalidErrorCode, 'Invalid value for this setting');
          hasError = true;
        }
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
