# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-11-17

### Added
- `scan()` lists model files stored in Cache API, IndexedDB and OPFS and groups them by model and variant.
- `removeModel()` and `clearAll()` delete per model or by predicate.
- `preflight()` returns a fits / tight / insufficient / unknown verdict from file sizes and `navigator.storage.estimate()`, plus persist advice.
- `fetchHfFileSizes()` reads Hugging Face file sizes with `Range: bytes=0-0`.
- `requestPersist()` asks for persistent storage only when needed.
- `webai-storage/testing` in-memory fakes for CacheStorage, OPFS and StorageManager.
- `webai-storage/react` with `useModelStorage()` and `<ModelStoragePanel>` (English and Korean, language choice stored in localStorage).
- Practice-mock example CLI (`npm run example`, `--lang en|ko`).
