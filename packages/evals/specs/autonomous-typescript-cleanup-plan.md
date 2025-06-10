# TypeScript Error Cleanup Plan for Autonomous System

## Overview
This document outlines the plan to address TypeScript errors and warnings in the `packages/evals/src/autonomous` directory. The analysis identified 6 files with errors out of 18 total files, with 23 TypeScript errors and 16 hints/warnings.

## Error Categories

### 1. Type Safety Issues (14 errors)
**Priority: HIGH**
- Undefined/null handling: 11 occurrences
- Type mismatches: 3 occurrences

### 2. Interface/Type Definition Issues (6 errors)
**Priority: HIGH**
- Missing properties: 3 occurrences
- Property specification conflicts: 1 occurrence
- Type assignment errors: 2 occurrences

### 3. Deprecated API Usage (5 hints)
**Priority: MEDIUM**
- `.substr()` method usage: 5 occurrences

### 4. Unused Code (11 hints)
**Priority: LOW**
- Unused imports: 3 occurrences
- Unused variables/parameters: 8 occurrences

## File-by-File Cleanup Tasks

### 1. `evolution/EvolvableRecommendationTemplates.ts` (Most Critical)
**Errors: 12 | Hints: 2**

#### Tasks:
1. **Fix template initialization (Line 82)**
   - Move `id` assignment after spread operator
   - Or remove `id` from the template partial type

2. **Add undefined checks for array access (Lines 176, 188, 190, 194, 266)**
   ```typescript
   // Example fix for line 176
   const templates = Array.from(this.archive.activeTemplates);
   const selected = templates[Math.floor(Math.random() * templates.length)];
   if (!selected) {
     throw new Error('No active templates available');
   }
   return selected;
   ```

3. **Handle optional mutation function (Line 380)**
   ```typescript
   const mutation = mutations[Math.floor(Math.random() * mutations.length)];
   if (mutation) {
     mutation();
   }
   ```

4. **Fix array destructuring (Line 410)**
   ```typescript
   const temp = sentences[i];
   if (temp !== undefined && sentences[j] !== undefined) {
     [sentences[i], sentences[j]] = [sentences[j], temp];
   }
   ```

5. **Replace deprecated `.substr()` with `.substring()` (Line 114)**

### 2. `orchestrator/AnalysisOrchestrator.ts`
**Errors: 5 | Hints: 3**

#### Tasks:
1. **Fix session state type definitions (Lines 148, 172, 177)**
   - Update `SessionState` type to include all valid states
   - Ensure state transitions are properly typed

2. **Handle undefined sessionId (Line 635)**
   ```typescript
   const sessionId = this.currentSessionId;
   if (!sessionId) {
     throw new Error('No active session');
   }
   ```

3. **Add undefined check for lastResult (Line 822)**
   ```typescript
   if (lastResult) {
     // Process lastResult
   }
   ```

### 3. `evolution/PatternDiscoveryArchive.ts`
**Errors: 3 | Hints: 2**

#### Tasks:
1. **Handle undefined pattern retrieval (Lines 447, 471)**
   ```typescript
   const pattern = this.patterns.get(patternId);
   if (!pattern) {
     throw new Error(`Pattern not found: ${patternId}`);
   }
   ```

2. **Fix undefined patternId (Line 545)**
   - Add null check before using patternId

### 4. `test-integration.ts`
**Errors: 3 | Hints: 2**

#### Tasks:
1. **Update SafetyLimits interface**
   - Add `maxDiskMB` property to type definition

2. **Update SessionConfiguration interface**
   - Add `enableLearning` property

3. **Add missing evolutionEngine property**
   - Include in initialization object

### 5. `feedback/learning-engine.ts`
**Errors: 0 | Hints: 9**

#### Tasks:
1. **Remove unused imports (Lines 5, 6, 8)**
2. **Replace `.substr()` with `.substring()` (Lines 151, 540)**
3. **Remove or use unused variables (Lines 351, 529, 557, 581, 582, 710)**
   - Prefix with underscore if intentionally unused

## Implementation Strategy

### Phase 1: Critical Fixes (Week 1)
1. Fix all TypeScript errors in `EvolvableRecommendationTemplates.ts`
2. Update interface definitions in `test-integration.ts`
3. Fix state type issues in `AnalysisOrchestrator.ts`

### Phase 2: Type Safety (Week 2)
1. Add comprehensive undefined/null checks
2. Implement proper error handling for edge cases
3. Add type guards where necessary

### Phase 3: Code Quality (Week 3)
1. Replace all deprecated API usage
2. Remove or properly handle unused code
3. Add JSDoc comments for complex type handling

## Testing Strategy

1. **Unit Tests**
   - Add tests for all error edge cases
   - Verify undefined handling behavior
   - Test type safety improvements

2. **Integration Tests**
   - Ensure system still functions after fixes
   - Verify no regression in autonomous features

3. **Type Coverage**
   - Run `tsc --noEmit` to verify no errors
   - Use strict TypeScript settings

## Success Criteria

- [ ] Zero TypeScript errors in autonomous directory
- [ ] All deprecated APIs replaced
- [ ] 100% type coverage for public APIs
- [ ] All unused code addressed
- [ ] Tests pass with strict type checking

## Notes

- The autonomous system shows good resilience despite type errors
- Many errors are defensive programming enforced by TypeScript
- Fixing these will improve reliability and maintainability
- Consider enabling `strictNullChecks` globally after cleanup