# Panel design

## Current system

At the owner's request, keyboard focus draws no outline or extra border anywhere
in the app. This supersedes the earlier thin/inset focus-edge decisions below.
Tab order, keyboard activation, Radix focus management, selected states and
existing background feedback remain. Text fields keep their normal border on
focus; do not restore focus-width/offset tokens or browser-default focus rings.

Home navigation has one Settings icon in the fixed footer beside Add Account
and the separate Quit control. Keep its accessible name and tooltip. The header
contains workspace selection and refresh. The workspace picker places an
icon-only Edit workspace action at the trailing edge of the current workspace
card, with an accessible name and tooltip. Keep it a sibling of the workspace
option rather than nesting buttons or placing actions inside the listbox. New workspace remains in the picker footer.
Both actions wait for picker dismissal before opening their dialog and restore
focus to the workspace trigger. Keep workspace controls out of the app footer.
The current workspace card keeps a single static selected surface on hover and
press; only its independent Edit action receives local pointer feedback. Other
workspace options keep their hover feedback. Keyboard focus remains visible.

Use the home panel as the visual reference. Its tokens live in `src/home.css`,
with shared dialog and control rules in `src/surfaces.css`. Use Figtree, opaque
graphite surfaces, the matching light palette and one fixed iris accent.
Reserve mint, amber and coral for success, warnings and errors. Workspace,
provider and account names identify their groups. Stored accent fields exist
for data compatibility.

Reuse `AppModal` for dialogs, Radix controls for keyboard and focus management,
and the existing top-edge Sonner toast. Use quiet solid surfaces, short titles,
separate groups and a clear primary action. Keep action targets fixed while
loading or hovering, and match placeholders to the final layout.

Use the shared ease and duration tokens. Fade hover layers on fine pointers
and scale the entire button slightly on pointer press. Keep keyboard focus
immediate, preserve visible focus and drop translation in reduced motion.
Dialogs enter and exit over the shared 250 ms duration, reversing the same
opacity, scale and short vertical offset. Exits use the shared ease-in-out curve
to remain legible during dismissal. Selects use 180 ms in both directions and
tooltips use 200 ms. Use `ModalTarget` when closing clears the selected data so the dialog
can retain its content until the exit ends. `AppModal` derives its stack level
from context so each nested scrim dims its parent sheet. Keep account cards flat with a quiet static inset edge, without whole-card
hover feedback. Preserve the picker’s interruptible dismissal. Preview
each changed surface in dark and light at tray width and verify exit and focus
restoration for dialogs.

Add Account sizes to its content within the tray viewport. Its review groups
verified accounts in one inset list, with provider marks on the left and
selection controls on the right. Show the destination workspace above the list with its initial mark and name as the review heading. Put provider and plan metadata below account identity so the checkbox has its own trailing column. Reuse the settings checkbox layers for this list.
Keep selection count and Clear selection together above a full-width Add accounts action in the fixed
footer. Keep this footer visible with zero selected accounts and disable Add
accounts. Row selection fades a persistent tint over 160ms, responds immediately
to keyboard input and uses a 100ms opacity fade in reduced motion.

Popup close buttons use the shared `popup-close` treatment: muted at rest,
a subtle coral layer and icon on pointer hover/press, and immediate iris keyboard
focus. Creation rows keep their rounded feedback layer separate from dividers.

The workspace picker presents the full list without search and initially focuses
the current workspace. Keep the same scrim token for the picker and dialogs,
including the stronger dimming in the matching light theme.

Destructive buttons on secondary surfaces use the shared softly coral-tinted inset fill, transparent
border and readable coral text (a darker coral in light mode). Fade a pre-painted
10% coral layer on pointer hover/press in 160ms; retain existing pointer press
feedback, immediate iris focus and 100ms reduced-motion fades. Never restore
legacy solid red hover fills. Discard confirmations emphasize Keep editing in
iris; both actions have 44px targets. Preserve safe initial focus and existing
confirmation flows. This follows Emil's hierarchy and feedback principles.

Workspace settings uses the entire appearance preview as its Radix radio target,
without a duplicate circle. Pointer hover fades a contrasting fill and inset edge
over 220ms with ease in both directions; quick reversals continue from the current
opacity. Reduced motion shortens this fade to 100ms. Quiet inset fills define the cards; a tinted selection
layer fades in over 180ms. Checkbox edges are soft inset strokes, with persistent
check/fill layers that reverse over 160ms. Visible-limit labels have no extra
outline. Usage uses two illustrated radio cards for Remaining / Used, showing complementary example values with explicit example copy. Codex resets has a master switch and a dependent predictions checkbox; hiding updates preserves its checked preference. Keyboard selection and focus
are immediate; reduced motion keeps only short opacity fades.

Shared select menus use a 4px inset and concentric 7px item corners inside the
12px frame. A checkmark identifies selection independently of hover. Pointer
feedback fades one pre-painted layer over 160ms, only on the actual hovered
highlighted item; keyboard targets receive immediate inset iris focus and fill.
Keyboard opening skips menu animation. Open Source triggers use a quiet 35%
layer so the menu owns the interaction. Reduced motion uses 100ms opacity fades.

Menu bar Source separates its full-width provider select from read-only account
metadata. Only the select has an inset fill, a quiet static edge and four complete
12px corners; the group has no fill or divider. Active account sits beneath it
with a muted label and a right-aligned wrapping name. Other providers have a
separate labeled account select. Hover fades a pre-painted layer to 65% over
240ms with CSS ease in both directions: the previous strong ease-out exposed
most of the change immediately. Keep the open fill at the same 65% and press
at 80% to avoid a bright flash followed by dimming. Source controls and chevrons
stay stationary; the menu already signals opening. Pointer entry restores pointer
feedback after keyboard use. Keyboard feedback and focus stay immediate; reduced
motion keeps only a 100ms opacity fade. Account initials uses an illustrated
checkbox card that follows the selected percentage/bar style. Visible limits
stay in duration order regardless of selection. Switches all use the shared
Radix Switch, without an inset outline; switch groups use 16px horizontal and 4px vertical
padding and no outer border. The Limit colors group keeps 16px below its final helper text. Limit colors has no repeated visible heading. Its dependent levels sit inside
the master switch group, indented behind a quiet vertical guide, with no row
hover layer. Content panels never draw keyboard focus borders; direct controls
keep an inset focus edge that stays inside scroll containers. The home Add
Account button has a flat fill without a top-edge inset highlight.
Preserve shared focus, pointer and reduced-motion behavior.

Segmented navigation uses one persistent selection layer that travels over 220ms
with the shared ease-out curve on pointer selection. Keep labels and panel
content stationary, retarget interrupted transitions from their current position,
and match the 3px inset and 4px gaps for every option count. Selection, hover
and focus corners use the outer radius minus the 1px border and 3px inset
(8px inside the 12px frame), keeping the nested curves concentric. Keyboard selection
and reduced motion move the indicator immediately; focus remains immediate.

Divided fixed action footers match the surrounding bottom inset: 18px on home
and 16px in dialogs. Setup and Add accounts use the shared action-footer inset,
without extra nested bottom padding. All discovery and review account rows use
the same quiet checkbox layers, persistent check indicator and immediate keyboard
feedback as Workspace Settings.

Light appearance uses an iris-tinted porcelain palette: a pale lilac canvas,
white cards, lavender inset controls and deep iris actions. The active account
has a quiet lavender surface and a solid iris monogram, with its explicit Active
label retained. Selected segments use a white selection layer and iris text.
All light surfaces, including legacy controls, resolve to the home semantic
tokens. Keep account cards flat and static; preserve the graphite dark palette
and existing focus, pointer and reduced-motion rules.

The sections below include historical design decisions.

Aiturn is a macOS tray utility. Apply the Appllama principles to the existing
Tauri/React panel: desktop typography, grouped preferences, keyboard focus and
short sheets. Mobile navigation, safe areas and simulator APIs do not apply.
