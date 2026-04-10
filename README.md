# Form Inspector Sidebar

Lightning-fast Chrome extension that shows every `<input>`, `<textarea>`, and `<select>` on the current page with full validation metadata.

## Performance
- Target: **< 30 ms** on normal pages (achieved via single `querySelectorAll` + direct property reads)
- Cache + MutationObserver = instant reopen on static pages

## Architecture
- Content script → does the actual DOM scan
- Side panel → UI (messages content script directly)
- Background service worker → MV3 requirement only
- MutationObserver marks cache stale on any DOM change

## Out of scope (v1)
- No label inference
- No XPath
- No shadow DOM deep scan
- No highlighting

Ready for v2 enhancements (export JSON, group by form, etc.)