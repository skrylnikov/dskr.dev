## Test Plan

<!-- Every scenario from specs/ mapped to a concrete test. The mapping is a -->
<!-- floor, not a ceiling: extra tests are welcome but need no entry here. -->
<!-- LIVE LEDGER: during apply, flip each row 🔴 red → 🟢 green as its test -->
<!-- passes. verify blocks on any row left red. -->

| Requirement | Scenario | Test File | Test Name | Initial State |
|-------------|----------|-----------|-----------|---------------|
| specs/<cap>/spec.md → <Requirement Name> | <Scenario Name> | src/tests/... | test_<name> | 🔴 red |
<!-- Non-executable change (docs/config/schema): map to a mechanical check instead. -->
<!-- | specs/<cap>/spec.md → <Requirement Name> | <Scenario Name> | openspec schema validate anvil | schema-validates | N/A — non-executable | -->

## Coverage Notes

<!-- Any notes on test infrastructure, shared fixtures, or test utilities needed. -->
<!-- For N/A — non-executable entries, justify why no code test exists and name the check that gates the change. -->
