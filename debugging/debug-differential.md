# /debug-differential

## Variables

GOOD_ENV: $ARGUMENTS
BAD_ENV: $ARGUMENTS

## Run these commands top to bottom

NAVIGATE to project root
RUN `env | sort > /tmp/current_env.txt`
RUN `cat package.json | jq '.dependencies' 2>/dev/null || echo "No package.json"`

## Instructions

**Beginning State**: Code works in one environment but fails in another ("works on my machine")

Compare a known-good run against the bad one to spot deltas:

1. **Run good binary** with input → save logs `good.log`
2. **Run bad binary** with same input/env → save `bad.log`
3. `diff -u good.log bad.log | less`
4. **Pay attention to** config paths, env vars, timestamps, library versions
5. **Align environments** or configs until behaviors match
6. **Verify the differential analysis** by confirming the last remaining diff is the root cause
7. **Document environment requirements** to prevent future occurrences

**End State**: Environmental differences causing the bug are identified and documented
