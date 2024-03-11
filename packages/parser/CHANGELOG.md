# @dbml-experimental/parser

## 1.2.4

### Patch Changes

- add a note normalization step for more ui-friendly markdown notes

## 1.2.3

### Patch Changes

- fix catch tables reappearing in multiple tablegroups

## 1.2.2

### Patch Changes

- support identifiers starting with digits

## 1.2.1

### Patch Changes

- Support continuation marker and raise errors on invalid escape sequence

## 1.2.0

### Minor Changes

- Refactor binder, allow for more flexibility

## 1.1.7

### Patch Changes

- Fix table reappearing in TableGroup not throwing an error
  Fix circular ref detection
  Improve auto-suggestions for identifiers containing non-ascii letters
  Fix interpreting onUpdate and onDelete settings
  Fix getMemberChain to include ArrayNode

## 1.1.6

### Patch Changes

- Check reappearing tables in different table groups

## 1.1.5

### Patch Changes

- Fix error message for enum field

## 1.1.4

### Patch Changes

- Take ArrayNode into account in getMemberChain

## 1.1.3

### Patch Changes

- Fix circular ref going undetected

## 1.1.2

### Patch Changes

- Validator failed to report errors properly when there're excessive arguments

## 1.1.1

### Patch Changes

- Swap endpoints in inline refs

## 1.1.0

### Minor Changes

- Support non-ascii letters in identifiers
