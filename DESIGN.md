# Words in Life design system

Version 0.6 · 2026-10-30

## Overview

The current application implementation is the visual authority, carrying forward the supplied five-screen reference: warm cream paper, coffee-brown camera housing, orange shutter, taped instant photos, handwritten English annotations and muted blue tags. The application now adopts the existing tokens and reusable React components across home, camera, developing/recognition, scene results, collection, word detail, original-photo dialogs, flashcard review, daily missions and failure recovery. This is an application-wide adoption of the existing system, not a replacement visual identity. The interactive component catalog remains at `/design-system`.

The catalog uses existing project scene photographs; they are contextual images, not isolated object crops or reproductions of the reference illustration. Its sample collection is in memory and resets on reload. Its shutter demonstrates an event callback; it does not request camera access. The current-screen catalog embeds `/design-system/preview?screen=home|printing|scene|collection|detail|quiz`, using production React views and application CSS in isolated viewports. Preview state is in memory; camera and microphone permissions are blocked in embeds and recognition is never requested. Sample photographs are scene fixtures, not generated object crops. The print preview deliberately holds the developed photo until the reviewer opens the sample result.

### Files and integration

- `src/design-system/tokens.css`: scoped primitive and semantic tokens.
- `src/design-system/components.tsx` and `components.css`: reusable components.
- `src/styles/base.css`: base application layout and secondary flows (`app-base` layer).
- `src/styles/composition.css`: screen composition, camera materials and viewport sizing (`app-composition` layer). `application.css` declares the cascade; `design-system/foundation.css` supplies the preceding token and component layers.
- `src/hooks/useDialog.ts`: native modal lifecycle shared by application dialogs.
- `src/design-system/Showcase.tsx` and `showcase.css`: catalog-only layout and interactions.
- `src/design-system/Preview.tsx`: isolated, in-memory fixtures that reuse production views; no duplicate screen styling.
- `public/design-system/paper-grain.png`: deterministic, locally generated translucent paper grain tile.

Import components directly and place them within a `.vs-theme` ancestor. Component imports include their styles. The application root uses `.vs-theme.words-in-life-app`, so all application screens inherit the same semantic palette, typography and focus treatment. State, persistence and service calls remain outside the presentational component library. Showcase layout styles are not part of the component contract.

```tsx
import { Button, Polaroid, Tag } from './design-system/components';

<div className="vs-theme">
  <Polaroid src={photoUrl} alt="桌上的咖啡" taped>
    <h2>coffee</h2>
    <Tag tone="blue">食物</Tag>
    <Button onClick={saveWord}>加入單字</Button>
  </Polaroid>
</div>
```

`StartupTransition` retains the loading screen while the real homepage mounts. After storage is ready, loading text and the print fade out; the small front rotates to its edge over 320ms while moving toward the measured homepage camera center. The actual homepage camera rotates in from the opposite edge over 400ms; its utility header fades in near the end. No video, controls or DOM trees are cloned. Home remains inert and hidden from assistive technology until the transition finishes, and returning from other screens does not replay it. Reduced motion uses a 120ms dissolve; resizing or enabling reduced motion during the turn completes it immediately. `tests/startup-transition.cjs` covers mobile/desktop, storage retry, interrupted turns, reduced motion and subsequent navigation.

## Colors

Values are design interpretations of the reference, not exact sampled source values.

| Primitive | Value | Semantic purpose |
| --- | --- | --- |
| Cream | #F3EADB | Page background |
| Paper | #FFF9EF | Paper cards and controls |
| Sand | #E8DAC5 | Secondary controls and tags |
| Coffee | #6C503C | Selected chips, dark contextual surfaces |
| Espresso | #302820 | Primary text |
| Tangerine | #F47732 | Shutter, primary action fill, photo marker |
| Rust | #A64016 | Small action text on light surfaces |
| Blue | #426775 | Focus rings, category text |
| Muted | #756453 | Secondary text |
| Error | #A53726 | Error text |
| Success | #466744 | Success text |

Use semantic tokens (`--vs-bg`, `--vs-surface`, `--vs-text`, `--vs-action`, `--vs-focus`) in new UI. Orange-filled buttons use Espresso text; orange itself is not the small-text foreground. Dark Coffee surfaces use Paper text. White camera icons use `--vs-shutter-icon` (#FFFFFF) on `--vs-shutter-bg` (#DB621E), approximately 3.63:1; keep the original Tangerine/deep-text pairing for ordinary primary buttons. Input boundaries use `--vs-control-border` (#8E7862), approximately 3.51:1 against Cream and 4.00:1 against Paper; decorative borders keep `--vs-border`. Camera overlays use `--vs-overlay-bg` (#302820D9), retaining text contrast even over a white camera frame.

Use `.vs-surface-dark` for dark contexts: it supplies Coffee/Paper and changes `--vs-focus` to `--vs-focus-inverse`. The default focus uses `--vs-focus-default` (Blue). Polaroids and light result/quiz panels restore the default focus. Keep neutral tags in Coffee text; generic section-heading captions must not override tag colors. The catalog includes rendered shutter, control-boundary and dark-focus examples.

## Typography

Noto Sans TC is the Chinese interface face. Plus Jakarta Sans carries English words and small Latin labels. Kalam is limited to short handwritten annotations and examples. Google Fonts is loaded by the existing HTML font stylesheet; fallback fonts remain available offline.

The theme base is 15px with a 1.65 line height. Application page headers are 27px, section headings 18px, detail words 32px, collection annotations 20px and captions commonly 12px. The desktop catalog uses larger editorial headings; those are not mobile application defaults.

## Layout

Application initialization mounts `StartupTransition` in `main.tsx` outside the lazy application boundary. One persistent `StartupView` covers both camera-interface preparation and browser-local collection loading, with the orange camera light gently pulsing as the visible loading status;「準備中」is visually hidden and retained for assistive technology. Phase indicators and explanatory loading copy are omitted. The bottom slogan「把日常，變成你的單字簿」is retained. `App` reports library/ready/error status to the entry shell; advancing phases preserves the same camera, paper DOM and in-flight animation. The centered cream surface shares a small coffee-brown instant camera, paper print and brand across boot, library and storage-error states. Loading uses a stable screen-reader text status and the existing orange camera light fading between full and quarter brightness over a 1.2-second loop, without separate dots or simulated percentages. Reduced-motion and error states keep the light steady. Storage errors expose the application's error view through the same mounted shell and provide a keyboard-accessible retry action. The illustration is CSS geometry with no image or service dependency. `main.tsx` imports `index.css` first so cascade-layer ordering and startup typography are established before the lazy application loads.

The primary five-screen shell is centered and capped at 430px on mobile and desktop. Home is a single viewport camera body with four-corner framing, a plain orange shutter and recessed print slot. The lower-right camera control area contains a raised pill with a stacked-photo icon, divider and live saved-word count. Its accessible label names the collection and count. The lower-left photo control directly opens the native image picker; the collection counter sits to the right of the shutter. A compact viewfinder overlay opens daily missions and secondary sample scenes. Selecting a mission returns to the same viewfinder; its target can be cancelled without leaving the camera. Home has no bottom navigation. Scene results keep a floating orange circular shutter with a small coffee-backed「再拍一張」label that returns to capture, matching the collection camera control without a full-width footer; content reserves space for the footer and device safe area. The photo marker toggle sits in the lower-right Polaroid caption, and「重新辨識」is a visible secondary button below the results. The header keeps a labelled back action; there is no discard icon or collapsed photo-options section. The collection keeps three columns and only photo/English/Chinese on each grid card; secondary actions remain in list mode and word details. The collection uses white instant-photo frames with square photos, small corners and a deeper caption margin. A standalone centered orange camera button provides the return to capture; there is no bottom bar or side navigation icons.

The word-detail Polaroid flexes to the viewport with visible previous/next controls. Pronunciation practice, phrases and original photo access are behind its three-dot menu; expanded content can scroll. Scene photos use cover cropping with markers remapped to the measured visible image aspect ratio. Photo height adapts to result count; long result sets and secondary photo options remain scrollable. Recognition stays in the camera shell and feeds a developing print from its slot; the older standalone analyzing view is retained in code but is not the current capture flow. Native browser status UI is not fabricated.

Spacing tokens: 4, 8, 12, 16, 24, 32, 48, 64px. Application layout rules live in `src/styles/base.css` and `src/styles/composition.css`; catalog layout rules remain separate.

The loading camera feeds its paper print downward from the physical slot over 0.5s, then settles it at the existing slight angle. A clipped output region hides the portion still inside the housing, and the slot lip stays in front of the paper. This is a single entrance, never a loading loop. The homepage turn waits for both storage readiness and the existing paper-feed animation to finish; if storage is slower, the settled print remains visible, with no additional animation delay once the data is ready. Error and reduced-motion states show the settled print immediately, and reduced motion skips the paper wait.

## Elevation & Depth

Paper shadow is warm, offset and soft. Paper cards have small corners and generous lower margins. Tape is decorative CSS with no semantic meaning. Keep texture faint and off photographic content; do not place grain overlays above interactive controls.

Startup and home share a restrained upper-left warm light direction. `--vs-light-startup` gives the loading surface a soft warm-white to sand gradient; `--vs-light-home` keeps the working camera screen and its desktop surroundings nearly uniform, with only a faint warm gradient. The homepage camera retains its original sand-paper housing, top inset highlight and lower inset shadow so its rounded rim reads as a solid raised shell. Keep this material depth distinct from the subdued ambient light. During the startup turn, a noninteractive background layer fades over 720ms and a decorative floor shadow narrows and expands beneath the camera. These layers are removed on completion or interruption; reduced motion uses the existing 120ms dissolve without a moving shadow. Collection, photos and text receive no lighting overlays.

## Shapes

Small radius 6px, controls 12px, large shell 24px and round controls 999px form the reusable token scale. Camera housing and viewfinder silhouettes use application-specific radii. Photographs remain rectangular crops inside paper frames; the Polaroid supplies the surrounding paper, shadow and optional tape.

## Components

### Component API

| Component | Main props | Behavior |
| --- | --- | --- |
| Button | variant: primary/secondary/ghost; loading; native button props | Loading disables activation and sets aria-busy; preserve meaningful label |
| IconButton | label required; native button props | Accessible name; 44px target; caller supplies aria-pressed for toggles |
| Chip | selected; native button props | aria-pressed reflects selection; caller owns selection state |
| Tag | tone: neutral/blue; children | Noninteractive metadata |
| SearchField | label; error; native input props | Associated label, unique ID, described error and invalid state |
| Progress | label; optional value | 0–100 determinate progress; omit value for native indeterminate state |
| Polaroid | src; alt; taped; children; className | Semantic figure and optional caption; lazy-loaded image |
| PhotoMarker | label; x; y; onClick | Percent position within positioned parent; keep marker within photo bounds |
| WordRow | image; word; translation; onSpeak; action | Decorative thumbnail, pronunciation action, caller-owned save action |
| ShutterButton | onClick; disabled | Accessible shutter control; caller owns capture permissions and lifecycle |
| BottomNav (legacy) | active; onNavigate | Retained for compatibility; not used in current application or catalog patterns. Use the standalone collection capture button instead. |

Use lucide-react icons, consistent 20px icons and 1.7px stroke. Icon-only controls always require a specific accessible name. A card is not inherently clickable: use explicit buttons for its actions.

### Accessibility and states

Keyboard focus uses a visible 3px ring with a 4px offset: Blue on light surfaces, Paper on dark surfaces. Targets are at least 44px high. Inputs have programmatic labels, errors link via aria-describedby, selections expose aria-pressed, and feedback uses a polite status region. The catalog includes disabled, loading, error and empty-result examples. Reduced-motion preference disables component animations and smooth catalog scrolling. Application camera, word-detail, source-photo and mission-completion overlays use native `<dialog>` with `showModal()`, Escape handling and restoration of the previously focused element through `useDialog`. Native modal behavior contains focus, including when source-photo dialogs open from word details.

The prototype's error input is intentionally disabled and illustrative. Real network errors must provide a retry action. Browser speech playback has an unsupported/error message; available English voices depend on the browser.

### Application content and behavior

Settings is an ordinary extension of the compact cream-paper layout, using the shared back button, status tag and primary/secondary actions. The API-key field uses the existing surface, border, radius and focus tokens, with a labelled show/hide control. Sand-backed guidance distinguishes a missing key; errors and saved-state feedback use the existing semantic colors and live regions. Keep the key masked by default. Settings explains browser-local storage and direct transmission to Google; saving is not a live credential-validation state. This screen introduces no new global tokens or camera-material treatments.

The homepage requests a rear-facing live camera stream when the persisted camera switch is enabled. At 1x its preview contains the entire camera frame with letterboxing when needed, matching the uncropped canvas capture and recognition upload. A single zoom button toggles between 1x and 2x with each tap, selecting a centered digital zoom without restarting the stream; 2x crops the center half of each source dimension for both preview and capture, retaining actual crop resolution rather than upscaling. The preview clips inside the contained source-aspect frame so letterboxing never exposes extra content. The control shows a compact 32px cream circle at 1x and orange at 2x, inside a 44px touch target; its accessible label announces the current and next magnification. Every new capture session defaults to 1x. `tests/camera-zoom.cjs` covers both magnifications, keyboard selection, responsive framing, crop pixels in captured and uploaded JPEGs, and session reset. Failure photos retain their source aspect ratio. `tests/camera-photo-content.cjs` checks preview, print and failure framing across landscape, portrait and square sources, viewport sizes and motion preferences, and checks all four colored source edges in both captured and uploaded JPEGs. The shutter stays disabled until video frames are available. Permission-denied and unavailable states show recovery and photo-selection actions, never a static scene disguised as live video. `useLiveCamera` owns the stream, stops it on unmount or hidden-page visibility, and disposes streams returned after navigation. All capture entry points route back to this homepage; no separate camera modal is mounted. The upper-left recessed switch toggles the camera and exposes `role="switch"` with `aria-checked`. During recognition, the camera moves upward over 1.4s and feeds the photo through the actual print slot over 1.6s, with a 0.1s delay. Capture adds a 320ms flash; the photo develops over 1.6s. A 420ms view transition carries the same photo into results where supported. While recognition is pending, a small magnifying glass searches gently from side to side below the photo, with short pauses and a slight turn; a few enlarged blue strokes inside its lens suggest looking closer and a small folded paper character peeks from behind the print at the right, top, left and bottom edges in sequence. Only one paper character is visible at a time; short viewports scale the entire photo into a shorter image area, retaining all edges and leaving paper-colored margins to keep the decorations and cancel action visible. The label reads「正在找照片裡的單字」with three animated dots; the dots are hidden from assistive technology and stop under reduced motion. These decorations are hidden from assistive technology; the stable recognition label is a polite status. A labelled cancel button remains available below the print while the other camera controls are inert. Reduced motion shows the developed photo immediately and keeps the magnifying glass and paper character static. Existing sample scenes, original photographs, vocabulary, daily missions and saved-word data remain the content sources. No replacement imagery is required by this migration.

Collection category chips and detail tags share `src/utils/wordCategory.ts`: a small English-keyword heuristic for food, everyday objects and plants, with unmatched words placed in Other. These categories are not AI classifications or a comprehensive taxonomy. Search matches English and Chinese text; gallery/list controls change presentation only.

New localized photo crops are plain square JPEGs. Existing saved entries with a source image and position are regenerated when their `photoCropVersion` is not 1; their words and source photos are retained. Entries without the required source data keep their available images. The internal `stickerUrl` field and generator names remain for compatibility; they no longer imply an outlined cutout.

## Do's and Don'ts

- Do use the existing semantic tokens and shared components for new screens.
- Do keep state, storage and service calls outside presentational components.
- Do preserve meaningful photo content and give icon-only actions specific accessible names.
- Don't promote camera-specific decorative colors or geometry into new global tokens.
- Don't import catalog-only layout styles into application pages.
- Don't treat category heuristics as authoritative object classification.

Validate changes with `npm run lint` (TypeScript), `npm run build`, and desktop/mobile browser checks of both `/` and `/design-system`. Exercise collection search/filter/list mode, save/remove, previous/next word navigation, nested dialogs, keyboard focus, flashcards, missions, recognition failure/retry, empty results and reduced motion. The sample scenes and catalog allow local interface validation without a working recognition service. Successful live recognition additionally requires a valid Gemini API key; camera and speech behavior require compatible browser capabilities and permissions. Interface checks alone do not establish live-service success.

### Photo-first flashcards

Quiz cards present only the object photo and recall prompt on the front. The back contains English, IPA, Chinese, definition, example and a separate pronunciation button. A 560ms Y-axis flip preserves the paper-card form; reduced-motion preference changes faces immediately. The inactive face is inert and hidden from assistive technology. Every next word remounts the card on its photo face without a reverse-flip answer flash.

Advancing a quiz slides the next photo leftward from beyond the right viewport edge and settles it over the current print over 600ms. Answer/flip controls pause during the transition, and a synchronous guard prevents double advancement. Reduced motion advances immediately; the last answer goes directly to results. Validate this with `tests/quiz-motion.cjs`.

### Synchronization contract

Scene result photos use their source aspect ratio at the available width, with no fixed-height crop. The marker layer follows the same photo bounds and uses source percentage coordinates; longer portrait photos scroll with the results. `tests/scene-photo.cjs` covers landscape, portrait and square photos across mobile and desktop sizes, marker coordinates after resizing, and marker controls.

The six live catalog previews reuse `HomeView`, `SceneView`, `FavoritesView`, `WordDetailModal` and `FlashcardQuiz`, with the same explicit `app-base` → `app-composition` cascade as the application. Update those production views first; the catalog inherits their visual changes automatically. Keep fixture state and service simulation in `Preview.tsx`. The basic component examples illustrate primitives and are not replicas of the current screens.

White instant-photo frames use #FFFDF9, 2px corners, a square image and a deeper caption margin. Camera material gradients, recessed hardware and print-slot geometry remain screen-specific styles rather than global palette tokens. Current collection navigation is a standalone centered orange camera button; home and results have no bottom navigation.
