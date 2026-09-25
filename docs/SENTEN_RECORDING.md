# Senten Recording

`senten record` creates a durable, human-readable execution record for dogfooding, architecture reviews, bug reports, and release evidence.

```bash
senten record start dogfood-next-app
senten discover
senten adopt --details
senten compatibility
senten release check
senten record stop
senten record export --format md
```

Records are stored under `.senten/records/`. Each record preserves the Senten version, application, command arguments, timestamps, duration, exit status, and a final architecture/adoption snapshot. Markdown exports summarize the commands and final adoption state without recording secrets or terminal keystrokes.

Commands:

```text
senten record start <name>
senten record status
senten record stop
senten record list
senten record export [id] --format md|json [--output path]
```

Recording is structured evidence, not screen capture. It records Senten invocations and outcomes; it does not capture arbitrary shell activity, credentials, or terminal input.
