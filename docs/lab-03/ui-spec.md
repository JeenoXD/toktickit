# Lab 3 UI Specification

## 1. Design Language
- **Theme**: Zen Green (`#006B3C` primary, `#E8F5E9` backgrounds, `#D32F2F` for errors).
- **Components**: Reuse Lab 2 cards, badges, form inputs, and validation message placements.
- **Responsiveness**: Desktop (≥992px), Tablet (768–991px), Mobile (<768px). Tables collapse to stacked cards on mobile.

## 2. Screen Specifications

### 2.1 Login & Change Password
- **Modes**: View (Login), View (Change Password).
- **Controls**: Email input, Password input, "Sign In" / "Update Password" button.
- **Feedback**: Loading spinner on button during API call. Safe error message ("Invalid email or password") without revealing if the email exists. Field-level validation for password complexity.

### 2.2 IT Staff Ticket Queue
- **Modes**: View (List).
- **Controls**: Search bar (Ticket #, Summary), Filter dropdowns (Status, IT Priority), Sortable column headers, Pagination controls.
- **Layout**: Desktop = Data Table. Mobile = Stacked Cards with clear badges for Status and Priority.
- **Feedback**: Loading skeleton, Empty state ("No tickets match your filters"), Safe API failure toast.

### 2.3 IT Staff Ticket Detail
- **Modes**: View/Edit.
- **Controls**: 
  - Header: Claim/Reassign dropdown, IT Priority dropdown, Status dropdown.
  - Body: Read-only ticket info (Requester, Category, Description).
  - Comments Section: Textarea + "Post Public Comment" button.
  - Notes Section: Distinct background color (e.g., light yellow `#FFF8E1`), Textarea + "Add Internal Note" button.
- **Feedback**: Success toast on save. Validation error if comment/note is empty. Forbidden state if accessed by Requester.

### 2.4 Administrator User Management
- **Modes**: View (List), Create (Modal), Edit (Modal).
- **Controls**: Search bar (Name/Email), Role filter dropdown, "Create User" button, Edit/Deactivate/Reset Password actions per row.
- **Layout**: Desktop = Data Table. Mobile = Stacked Cards.
- **Feedback**: Modal validation for duplicate emails. Safe error toast if Admin tries to deactivate themselves or the last active Admin.

## 3. Responsive & Accessibility Checklist
- [ ] All interactive elements have a minimum touch target of 44x44px on mobile.
- [ ] Color contrast meets WCAG AA standards (Zen Green on white passes).
- [ ] Form fields have associated `<label>` elements for screen readers.
- [ ] Internal Notes are visually distinct from Public Comments to prevent accidental public posting.