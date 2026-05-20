# App Refactor Index

Purpose: quick map for everything extracted from `frontend/src/App.jsx`, so future feature work can find the right file fast.

## Root wiring
- `frontend/src/app/AppRoot.jsx`
  - thin app entry wrapper.
- `frontend/src/app/InnerApp.jsx`
  - extracted main editor orchestration previously in `App.jsx`.
- `frontend/src/main.jsx`
  - mounts `AppRoot`.

## UI components (`frontend/src/app/ui/`)
- `TopBar.jsx`
  - desktop/mobile top bar controls.
- `LeftToolbar.jsx`
  - desktop left tool rail wrapper.
- `MobileBottomBar.jsx`
  - mobile primary actions bar.
- `MobileQuickActionsBar.jsx`
  - mobile selection quick actions.
- `TimerWidget.jsx`
  - timer floating widget.
- `Toolbar.jsx`
  - floating editor toolbar (shortcuts + quick actions).
- `LandingPage.jsx`
  - public landing page + auth modal.
- `EditorAuxPanels.jsx`
  - `PresentBar`, `EditorOnboardingOverlay`, `EmptyBoardPrompt`.

## Panels (`frontend/src/app/panels/`)
- `SearchPanel.jsx`
  - search overlay panel.
- `ShortcutsPanel.jsx`
  - keyboard shortcuts help.
- `ThemePicker.jsx`
  - canvas theme selector.
- `TplPanel.jsx`
  - template panel wrapper.
- `Dashboard.jsx`
  - authenticated board selector dashboard.

## Canvas render layer (`frontend/src/app/canvas/`)
- `Canvas.jsx`
  - extracted main `Canvas` orchestration from `App.jsx` (event wiring, overlays, connector/node rendering).
- `ConnectorRenderer.jsx`
  - connector SVG render + interaction surface.
- `NodeRenderer.jsx`
  - node render list.
- `SpreadsheetNode.jsx`
  - spreadsheet node UI + formula/session behavior.
- `SelectionOverlay.jsx`
  - lasso selection rectangle.
- `GuidesOverlay.jsx`
  - alignment guides.
- `RemoteCursors.jsx`
  - realtime cursor visuals.
- `CanvasHud.jsx`
  - canvas HUD controls/status.
- `ConnectorStylePanels.jsx`
  - connector style editors (desktop/mobile).
- `AlignPanel.jsx`
  - alignment panel actions.
- `Minimap.jsx`
  - minimap UI.

## Hooks/controllers (`frontend/src/app/hooks/`)
- `useCanvasUiState.js`
  - canvas UI refs/state bootstrap.
- `useConnectorStyleController.js`
  - connector default style + update logic.
- `useSheetFormulaBridge.js`
  - spreadsheet formula session/reference bridge callbacks.
- `useCanvasTransientUiHandlers.js`
  - escape/delete/close-transient global listeners.
- `useConnectorSelectionSync.js`
  - selected connector synchronization + event dispatch.
- `useCanvasImageIo.js`
  - image drag-drop + clipboard paste.
- `useCanvasWheelPanZoom.js`
  - wheel pan/zoom interaction.
- `useCanvasLaserTrail.js`
  - laser trail state/update.
- `useTouchPointerCapture.js`
  - mobile pointer capture handlers.
- `useCanvasTouchHelpers.js`
  - touch helper pack (`touchEvt`, `touchPoint`, `touchDistance`, `beginMobilePress`).
- `useCanvasMouseMoveRaf.js`
  - RAF scheduler for `onMouseMove`.
- `useCanvasTouchMoveRaf.js`
  - RAF scheduler + cancel path for `onTouchMove`.
- `useTouchGestureUndoRedo.js`
  - two-finger touch undo/redo branch.
- `useTouchRadialMenuEnd.js`
  - radial menu consume branch in touch end.
- `useTouchLongPressEnd.js`
  - long-press consume/reset branch in touch end.
- `useTouchDoubleTapEnd.js`
  - double-tap branch in touch end.
- `usePortConnectController.js`
  - port-based connector creation controller (port hit test, live preview path, pointer attach flow).
- `useConnectorContextMenu.js`
  - connector context-menu controller (routing/style/label/delete, desktop/mobile open).
- `useCanvasContextCommands.js`
  - canvas context-menu command factory (`makeContextCommands`) extracted from `Canvas`.
- `useCanvasPointerController.js`
  - pointer interaction controller for `onDown/onNodeSel/onMove/onUp` (selection, drag, lasso, draw, eraser, smart guides/connect).
- `useCanvasContextMenuController.js`
  - canvas context menu controller (`openContextMenuAt`, `onCtx`, mobile group/title derivation).
- `useCanvasContextImageUpload.js`
  - context image upload handler used by hidden file input (`onCtxUploadImage`).
- `useCanvasDoubleClickInsert.js`
  - canvas double-click quick insert handler (sticky add on empty canvas in select mode).
- `useCanvasNodeTransformStart.js`
  - node transform start handlers (`onRotSt`, `onRSt`) for rotate/resize initiation.
- `useCanvasNodeTouchStart.js`
  - node touch-start handler for mobile press metadata + selection start flow.
- `useCanvasTouchStartTarget.js`
  - extracted single-touch target branch from `onTouchStart` (connector/canvas routing).
- `useCanvasTouchMoveNonPinch.js`
  - extracted non-pinch flow from `onTouchMove` (prelude/tail around pinch branch).
- `useCanvasTouchEndHandler.js`
  - extracted `onTouchEnd` wrapper flow (gesture end + radial/long-press/double-tap consume + fallback `onUp`).
- `useCanvasTouchStartTwoFinger.js`
  - extracted two-finger branch from `onTouchStart` (duplicate-drag + pinch bootstrap).
- `useCanvasTouchMovePinch.js`
  - extracted pinch branch from `onTouchMove` (two-finger zoom/pan update flow).
- `useCanvasTouchStartHandler.js`
  - extracted `onTouchStart` shell wrapper (two-finger guard + pinch reset + delegate to target branch).
- `useCanvasTouchMoveHandler.js`
  - extracted `onTouchMove` shell wrapper (prelude + pinch branch + tail delegation).

## Utilities (`frontend/src/app/utils/`)
- `connectorStyleStorage.js`
  - connector style localStorage load/save helpers.

## Still in `App.jsx` (major remaining blocks)
- thin `Canvas` wrapper (`useWB` + dependency map into `Canvas.jsx`, map built inside wrapper to avoid module init TDZ)
- thin `InnerApp` wrapper (`useWB` + dependency map into `InnerApp.jsx`, map built inside wrapper to avoid module init TDZ)

## Refactor safety gate
Run after each extraction step:
1. `npm.cmd run build` (frontend)
2. `npm.cmd run test:dataflow`
3. `npm.cmd run test:spreadsheet`
4. `npm.cmd run test:connectors`
