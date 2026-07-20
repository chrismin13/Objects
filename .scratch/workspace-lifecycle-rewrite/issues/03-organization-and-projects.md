# 03 — Organization and Projects

**What to build:** Deliver Spaces, Areas, Projects, Headings, Tags, inherited Location, and complete Project Closure behavior. Organization changes must preserve work and automatically change effective Location without copying stale parent data onto to-dos.

**Blocked by:** 02 — Complete Basic To-do Lifecycle.

**Status:** ready-for-agent

## Acceptance criteria

- [ ] A to-do's effective Location is derived through Heading, Project, Area, and Space; only unfiled work stores a Space directly.
- [ ] Moving a Heading, Project, or Area automatically changes the effective Location of everything inside it without rewriting copied parent fields.
- [ ] Spaces can be created, renamed, recolored, pinned, reordered, and deleted by moving their content to a chosen remaining Space.
- [ ] Areas can be created, edited, moved, and removed while keeping their Projects and to-dos in the same Space.
- [ ] Projects can be created, edited, moved, duplicated, completed, canceled, restored, trashed, and permanently deleted.
- [ ] Projects contain Headings and to-dos and show progress based on their active to-dos.
- [ ] Project Closure requires an explicit Outcome for every remaining open to-do and records exactly which to-dos that closure changed.
- [ ] Restoring a Project reopens only the to-dos changed by that Project Closure; work completed or canceled earlier remains unchanged.
- [ ] Headings can be created, edited, moved, duplicated, archived, restored, deleted without deleting their to-dos, and converted into Projects without separating their contents.
- [ ] Tags can be created, renamed, and deleted; inherited Area and Project tags combine with direct to-do tags without being copied.
- [ ] Current lists can be filtered by one or more effective tags, and tag changes update every affected view.
- [ ] Logged and trashed Projects remain discoverable and retain correct child history and restoration behavior.
- [ ] Behavioral tests cover parent moves, parent removal, inherited Location and tags, Project Closure edge cases, restoration, duplication identity, and destructive confirmation paths.

