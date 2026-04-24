# Model Route Command

Recommend the best model for the current task by complexity and budget.

## Usage

`/model-route [task-description] [--budget low|med|high]`

## Routing Heuristic

- `minimax-m2.1-free`: deterministic, single-file edits, quick fixes
- `gpt-5.1-codex`: code generation, testing, pair programming
- `claude-sonnet-4-5`: default for implementation, refactors
- `claude-opus-4-5`: architecture, deep review, ambiguous requirements
- `gemini-2.5-pro`: large context tasks, research

## Required Output

- recommended model
- confidence level
- why this model fits
- fallback model if first attempt fails

## Arguments

$ARGUMENTS:
- `[task-description]` optional free-text
- `--budget low|med|high` optional
