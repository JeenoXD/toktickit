# Lab 2 UI Specification — Zen Green Theme

## 1. Color Tokens

| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#006B3C` | App header, primary buttons, strong emphasis |
| `--color-secondary` | `#0B7A46` | Active tabs, focus accents, links, hover states |
| `--color-pale` | `#EAF6EF` | Selected state, success emphasis, subtle sections |
| `--color-bg` | `#F5F7F6` | Page background |
| `--color-surface` | `#FFFFFF` | Cards/panels, subtle border + restrained shadow |
| `--color-text` | `#1B2B24` (dark charcoal-green) | Body text, not pure black |
| `--color-error` | `#B3261E` | Error text/border |
| `--color-warning` | `#B36A00` (amber) | Warning callouts/badges only, never decorative |
| `--color-success` | `#0B7A46` | Success confirmation, paired with icon/text, not color alone |

## 2. Typography and Spacing

- Base font size 16px, headings scale 1.25x per level (H1 24px, H2 20px, H3 16px bold).
- Base spacing unit 8px; form field vertical gap 16px; section gap 32px.
- Labels: 14px, medium weight, positioned directly above their control (never inline/floating).

## 3. Field States

| State | Style |
|---|---|
| Editable | White background, 1px neutral gray border (`#CBD5D1`) |
| Read-only | Soft gray-green/ivory background (`#F0F1EE`), no border emphasis, not selectable-looking |
| Invalid | Red border (`--color-error`), red message directly below the field |
| Disabled | Reduced opacity (0.5), cursor not-allowed, no hover/focus response |
| Focused | 2px visible outline in `--color-secondary`, never removed for keyboard users |

Required-field marker: red asterisk immediately after the label text. The asterisk alone never
substitutes for a validation message — both appear together when invalid.

## 4. Button Hierarchy

| Type | Style | Example |
|---|---|---|
| Primary | Solid `--color-primary`, white text | Submit, Create Ticket, Continue |
| Secondary | White background, `--color-primary` border/text | Cancel, Change Requester |
| Tertiary | Text-only, `--color-secondary` | Clear Filters |
| Destructive | Solid `--color-error`, white text | Remove Attachment (confirm step) |
| Disabled | Reduced opacity, no pointer events | Any of the above while inactive |
| Busy | Spinner + disabled state, original label replaced or dimmed | Submit while request in flight |

## 5. Attachment Selection and Errors

- Selected files shown as a list with filename, size, and a remove-before-upload action.
- Invalid file (wrong type/oversized/over count) shown inline in the list with a red error line, not a popup alert.
- Uploading attachment shows a progress/spinner state per file.
- Removed attachment (soft-deleted) shown grayed out with "Removed" badge and reason; no download/preview control rendered for it.

## 6. Screen States (Create Ticket)

1. **Initial** — empty form, reference data (categories, related systems) loading or loaded.
2. **Loading reference data** — skeleton or spinner in the relevant dropdowns.
3. **Validation** — field-level red messages appear on blur/submit attempt; invalid fields get red border.
4. **Submitting** — Submit button busy state, all inputs disabled, no duplicate submission possible.
5. **Success** — confirmation panel showing the generated Ticket Number and a "View Ticket" / "Back to My Tickets" action.
6. **API failure** — banner/inline error, all entered values retained exactly as typed.

## 7. Application Shell and Navigation

- Header: TokTickIT logo/name (left), My Tickets + Create Ticket nav (center/left-of-profile), current Requester name + Change Requester (right).
- Active nav item indicated with `--color-secondary` underline/background, not color alone (also bold weight).
- Mobile (<768px): nav collapses into a hamburger/menu icon; Requester name still visible or accessible via the menu.

## 8. My Tickets — List/Card Behavior

- **Desktop (≥992px):** table with sortable column headers (Ticket No., Created Date, Summary, Category, Requested Priority, IT Priority, Current Status, Last Updated).
- **Tablet/Mobile (<992px):** each ticket renders as a stacked card with the same fields, no horizontal scroll.
- Search bar + filter dropdowns sit above the list, Clear Filters and Create Ticket actions top-right.
- Pagination control at the bottom: Previous/Next + page numbers, current page visually distinct.

## 9. Priority and Status Badges

| Field | Values | Badge color |
|---|---|---|
| Requested/IT Priority | LOW / MEDIUM / HIGH | Green / Amber / Red-toned pill, text label always present (not color-only) |
| Current Status | New (Lab 2 only) | Pale green pill with "New" label |

## 10. Empty vs No-Results

- **Empty list** (Requester genuinely has zero tickets): friendly illustration/message + prominent "Create your first ticket" CTA.
- **No results** (filters/search matched nothing): message clarifies filters are active, with a visible "Clear Filters" action. Must look visibly different from the empty-list state (different icon/copy), not the same generic box.

## 11. Requester Ticket Detail (View Mode)

- Ticket header fields grouped and clearly read-only (per Section 3 read-only styling), laid out in the same field groups as Create Ticket for consistency.
- Attachments section visually separated (card/border) from ticket info, with Add Attachment action and per-file download/remove controls.
- No Public Comments, Internal Notes, Actions Taken, or status-change controls present anywhere on this screen.

## 12. Accessibility

- All interactive controls reachable and operable via keyboard (Tab/Enter/Space).
- Icon-only controls (e.g. remove-attachment icon) have an `aria-label` and visible tooltip on hover/focus.
- Color is never the only signal — badges and states always pair color with text or an icon.
- Focus outline never removed via `outline: none` without a replacement indicator.

## 13. Responsive Layout Rules

| Viewport | Behavior |
|---|---|
| Desktop ≥992px | Multi-column layout, content max-width ~1200px, centered |
| Tablet 768–991px | Two-column where practical; Summary/Description get full available width |
| Mobile <768px | Single column, fields stack vertically, buttons full-width and touch-sized (min 44px height) |
| All sizes | No clipped labels, no overlapping messages, no hidden buttons, no horizontal page scroll |

## 14. Screenshot Paths (Visual Evidence)

```
artifacts/lab-02/screenshots/create-ticket/{desktop,tablet,mobile}.png
artifacts/lab-02/screenshots/my-tickets/{desktop,tablet,mobile}.png
artifacts/lab-02/screenshots/ticket-detail/{desktop,tablet,mobile}.png
```
