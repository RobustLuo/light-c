---
name: luoscope-release
description: Prepare LuoScope Release metadata and documentation. Use when the user asks to publish a new version, bump LuoScope version numbers, update CHANGELOG.md, update .github/workflows/release.yml, update README.md release notes, or avoid repeating the same release-document prompts for this Tauri + React project.
---

# LuoScope Release

## Workflow

Follow this checklist when preparing a LuoScope Release.

1. Decide the version bump from the user request and code changes.
   - Patch: bug fixes only.
   - Minor: user-visible feature such as a new module, layout mode, or major UX capability.
   - Major: incompatible behavior or migration.

2. Update all version files together.
   - `package.json`
   - `package-lock.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/Cargo.lock`

3. Update release notes.
   - Add a new top entry in `CHANGELOG.md` with `## vX.Y.Z (YYYY-MM-DD)`.
   - Keep wording concise and user-facing.
   - Group entries by feature area, for example `自定义布局`, `C 盘全盘分析`, `体验修复`.
   - Include bug fixes that were part of the current release.

4. Update GitHub release workflow.
   - Edit `.github/workflows/release.yml`.
   - Set `releaseName` to `LuoScope vX.Y.Z`.
   - Refresh `releaseBody` so it summarizes the current release, not the previous release.
   - Mention `CHANGELOG.md` as the full details source.

5. Update `README.md`.
   - Keep feature descriptions aligned with the new release behavior.
   - Keep the release checklist accurate, including all version files.
   - Do not rewrite unrelated historical content.

6. Validate before finishing.
   - Run `npm run build`.
   - Run `git diff --check`.
   - Use `rg "old.version|__VERSION__"` across release files to catch stale placeholders.

## LuoScope Specific Notes

- This repo is a Tauri + React desktop app; version drift between frontend and Tauri files can break release artifacts or updater metadata.
- `.github/workflows/release.yml` builds from Git tags `v*`; release copy should match the version the user will tag.
- Prefer UTF-8 Chinese release notes. If terminal output shows mojibake, inspect files with Node `fs.readFileSync(..., 'utf8')` before assuming the file is corrupt.
- Keep release changes scoped. Do not refactor application code while doing a release documentation pass unless the user explicitly asks.
- 本地签名私钥默认路径为 `.tauri/luoscope.key`（仍兼容旧版 `.tauri/lightc.key`）。
