# /debug-fuzz

## Variables

TARGET_FUNCTION: $ARGUMENTS

## Run these commands top to bottom

NAVIGATE to project root
RUN `find . -name "*fuzz*" -o -name "*property*" | grep -i test | head -10`
RUN `brew list | grep -E "(go|node|python)" | head -3`

## Instructions

**Beginning State**: Need to find edge cases that manual testing misses

Expose edge-case crashes automatically:

1. **Define function contracts/invariants**
2. **Pick fuzzer** (Go's built-in fuzzing, hypothesis for Python, fast-check for JS)
3. **Write a driver**:
    ```go
    func FuzzParse(f *testing.F) {
      f.Fuzz(func(t *testing.T, data []byte) {
        _ = Parse(data) // should not panic
      })
    }
    ```
4. **Run fuzzer** until it finds a crash; save the input
5. **Add that input** as a regression test; patch the code
6. **Verify the fix** by rerunning fuzzer to ensure no more crashes on similar inputs
7. **Integrate fuzzing** into CI for continuous edge-case discovery

**End State**: Edge cases are automatically discovered and function robustness is verified
