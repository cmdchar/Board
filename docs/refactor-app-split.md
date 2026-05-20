# App.jsx Strangler Refactor Checklist

## Scope
- Target file: `frontend/src/App.jsx`
- Goal: split into smaller modules with zero behavior/UI/feature changes.

## Safety Rules
- No business logic changes.
- No feature changes.
- No visual changes (except import/export wiring).
- Move code by extraction only (copy -> wire -> delete old).
- Keep prop contracts explicit and stable.

## Validation Gate (run after each extraction step)
1. `npm.cmd run build` in `frontend/`
2. `npm.cmd run test:dataflow` in `frontend/`
3. `npm.cmd run test:spreadsheet` in `frontend/`
4. `npm.cmd run test:connectors` in `frontend/`

## Manual Smoke (after each extraction step)
1. Open board.
2. Add node.
3. Connect nodes.
4. Open right panel.
5. Open mobile bottom sheet.
6. Join same board from second client (realtime check).

## Planned Extraction Order
1. Folder skeleton + `AppRoot` shim.
2. Low-risk UI components:
   - `TopBar`
   - `LeftToolbar` shell
   - `MobileBottomBar`
3. Panels.
4. Canvas render layer.
5. Hooks/controllers.
6. Pure utilities.

## Progress (2026-03-06)
1. Completed:
   - step 0, step 1
   - step 2 (TopBar, LeftToolbar, MobileBottomBar, MobileQuickActionsBar)
   - `Toolbar` moved out of `App.jsx` to `app/ui/Toolbar.jsx` (wrapper kept in `App.jsx`)
   - `SpreadsheetNode` moved out of `App.jsx` to `app/canvas/SpreadsheetNode.jsx` (wrapper kept in `App.jsx`)
   - landing/auth UI moved out of `App.jsx` to `app/ui/LandingPage.jsx`
   - step 3 partial (search/shortcuts/theme/template panels)
   - board selector dashboard moved out of `App.jsx` to `app/panels/Dashboard.jsx`
   - step 4 partial (canvas renderers + overlays + minimap/align/timer delegates)
2. Step 5 in progress:
   - `useCanvasUiState` extracted and wired
   - `useConnectorStyleController` extracted/wired
   - `useSheetFormulaBridge` extracted/wired
   - `useCanvasTransientUiHandlers` extracted/wired
   - `useConnectorSelectionSync` extracted/wired
   - `useCanvasImageIo` extracted/wired
   - `useCanvasWheelPanZoom` extracted/wired
   - `useCanvasLaserTrail` extracted/wired
   - `useTouchPointerCapture` extracted/wired
   - `useCanvasTouchHelpers` extracted/wired
   - `useCanvasMouseMoveRaf` extracted/wired
   - `useCanvasTouchMoveRaf` extracted/wired
   - `useCanvasTouchMoveRaf` cancel path wired (`onTouchEnd`)
   - `useTouchGestureUndoRedo` extracted/wired
   - `useTouchRadialMenuEnd` extracted/wired
   - `useTouchLongPressEnd` extracted/wired
   - `useTouchDoubleTapEnd` extracted/wired
   - `usePortConnectController` extracted/wired
   - `useConnectorContextMenu` extracted/wired
   - `useCanvasContextCommands` extracted/wired
   - `useCanvasPointerController` extracted/wired
   - `useCanvasContextMenuController` extracted/wired
   - `useCanvasContextImageUpload` extracted/wired
   - `useCanvasDoubleClickInsert` extracted/wired
   - `useCanvasNodeTransformStart` extracted/wired
   - `useCanvasNodeTouchStart` extracted/wired
   - `useCanvasTouchStartTarget` extracted/wired
   - `useCanvasTouchMoveNonPinch` extracted/wired
   - `useCanvasTouchEndHandler` extracted/wired
   - `useCanvasTouchStartTwoFinger` extracted/wired
   - `useCanvasTouchMovePinch` extracted/wired
   - `useCanvasTouchStartHandler` extracted/wired
   - `useCanvasTouchMoveHandler` extracted/wired
3. Step 4 major extraction:
   - `Canvas` orchestration moved from `App.jsx` to `frontend/src/app/canvas/Canvas.jsx`
   - `App.jsx` now keeps a thin `Canvas` wrapper (`useWB` + dependency injection into `CanvasView`)
4. Step 5 major extraction:
   - `InnerApp` orchestration moved from `App.jsx` to `frontend/src/app/InnerApp.jsx`
   - `App.jsx` now keeps a thin `InnerApp` wrapper (`useWB` + dependency injection into `InnerAppView`)
   - hotfix: dependency maps moved inside wrappers (`Canvas` / `InnerApp`) to avoid top-level TDZ initialization errors in production bundle
   - hotfix: `Canvas.jsx` hook order corrected (`connectorById` initialized before `useConnectorContextMenu`)
   - hotfix: completed `Canvas` dependency injection list (`SHAPE_DEFAULTS`, `makeShapeNode`, `makeSheetNode`, `makeDeckNode`, `collectDependency`)
   - verification: ESLint `no-undef` run on `App.jsx`, `InnerApp.jsx`, `Canvas.jsx` (clean)
5. Step 6 started:
   - connector style localStorage helpers moved to `app/utils/connectorStyleStorage.js`
6. Additional low-risk UI extraction:
   - `PresentBar`, `EditorOnboardingOverlay`, `EmptyBoardPrompt` moved to `app/ui/EditorAuxPanels.jsx`
7. Documentation:
   - quick index added: `docs/app-refactor-index.md`

## Rollback Rule
- If any gate fails, revert only the last extraction step and re-run validation.
