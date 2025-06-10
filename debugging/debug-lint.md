# /debug-lint

## Variables

LINT_TARGET: $ARGUMENTS

## Run these commands top to bottom

NAVIGATE to project root
RUN `find . -name ".eslintrc*" -o -name "tslint.json" -o -name ".pylintrc" | head -5`
RUN `npm run lint --silent 2>&1 | head -20 || make lint 2>&1 | head -20`

## Instructions

**Beginning State**: Bugs keep appearing that could be caught by static analysis

Eliminate whole bug classes before runtime:

1. **Enable strict linter config** (`eslint --max-warnings 0`, `tsc --strict`)
2. **Run** `make lint`; note new errors
3. **Fix warnings** from highest-confidence to lowest
4. **Add linter run** to pre-commit or CI
5. **Verify the linting** catches the types of bugs you've been seeing
6. **Celebrate FTBFS** ("fail the build if it smells")

**End State**: Static analysis prevents entire classes of bugs from reaching production
