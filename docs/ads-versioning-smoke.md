[ ] draft -> PATCH -> updated (same id)
[ ] draft -> publish -> active
[ ] active -> PATCH -> new active + old stopped
[ ] stopped -> PATCH -> new draft
[ ] stopped -> restart -> active (NO fork)
[ ] active -> restart -> 409
[ ] feed shows only latest active
[ ] public GET hides stopped/draft
