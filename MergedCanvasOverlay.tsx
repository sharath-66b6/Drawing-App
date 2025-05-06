import React, { useRef, useState, useEffect, useCallback, type PointerEvent, type Touch, type TouchEvent, type CSSProperties } from 'react';
import styled from 'styled-components';

import OverlayMenu from '~/components/Overlay/OverlayMenu';
import OverlayNavbar from '~/components/Overlay/OverlayNavbar';
import OverlaySidebar from '~/components/Overlay/OverlaySidebar';
import OverlayZoom from '~/components/Overlay/OverlayZoom';
import theme from '~/theme';

// Overlay component from Overlay.tsx
const FixedDiv = styled.div\`
  pointer-events: none;
  position: fixed;
  top: \${theme.variables.overlayGutter};
  bottom: \${theme.variables.overlayGutter};
  left: \${theme.variables.overlayGutter};
  right: \${theme.variables.overlayGutter};
  z-index: \${theme.layers.overlay};
  user-select: none;
\`;

const TopDiv = styled.div\`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: \${theme.variables.overlayGutter};
\`;

const LeftDiv = styled.div\`
  position: absolute;
  bottom: 0;
  left: 0;
  width: \${theme.variables.sidebarWidth};

  \${theme.medias.gteSmall} {
    top: calc(\${theme.variables.topNavbarHeight} + \${theme.variables.overlayGutter});
  }
\`;

const BottomRightDiv = styled.div\`
  position: absolute;
  bottom: 0;
  right: 0;
\`;

function Overlay() {
  return (
    <FixedDiv>
      <TopDiv>
        <OverlayNavbar />
        <OverlayMenu />
      </TopDiv>
      <BottomRightDiv>
        <OverlayZoom />
      </BottomRightDiv>
      <LeftDiv>
        <OverlaySidebar />
      </LeftDiv>
    </FixedDiv>
  );
}

// SingleCanvas.tsx content starts here

type CanvasObjectType = 'rectangle' | 'ellipse' | 'free-draw' | 'text';

interface FreeDrawPoint {
  x: number;
  y: number;
}

interface CanvasObject {
  id: string;
  type: CanvasObjectType;
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColorHex?: string;
  strokeColorHex?: string;
  strokeWidth?: number;
  opacity?: number;
  borderRadius?: number;
  freeDrawPoints?: FreeDrawPoint[];
  text?: string;
  textAlignHorizontal?: CanvasTextAlign;
  textAlignVertical?: CanvasTextBaseline;
  textJustify?: boolean;
  fontColorHex?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  fontWeight?: string;
  fontVariant?: string;
  fontLineHeightRatio?: number;
}

const TRANSPARENT_BACKGROUND_IMAGE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P4z8DwHwAF/gL+Xq6qWQAAAABJRU5ErkJggg=='; // transparent 1x1 pixel
const APP_FIXED_MAIN_UNIQUE_ID = 'app-fixed-main-unique-id';
const CANVAS_CONTROLS_OVERLAY = 'canvas-controls-overlay';

const themeLayers = {
  canvasApp: 1000,
  canvasElement: 1001,
};

function generateUniqueId(): string {
  return Math.random().toString(36).substr(2, 9);
}

function getControlPoints({ canvasObject, zoom }: { canvasObject: CanvasObject; zoom: number }) {
  const { x, y, width, height } = canvasObject;
  const size = 10 / (zoom / 100);
  return {
    position: { x, y, width, height },
    topLeftBox: { x: x - size / 2, y: y - size / 2, width: size, height: size },
    topRightBox: { x: x + width - size / 2, y: y - size / 2, width: size, height: size },
    bottomLeftBox: { x: x - size / 2, y: y + height - size / 2, width: size, height: size },
    bottomRightBox: { x: x + width - size / 2, y: y + height - size / 2, width: size, height: size },
  };
}

// Get cursor style from modes
function getCursorFromModes({ userMode, actionMode }: { userMode: string; actionMode: any }): string {
  if (!actionMode) {
    switch (userMode) {
      case 'select':
        return 'default';
      case 'free-draw':
        return 'crosshair';
      case 'rectangle':
      case 'ellipse':
        return 'crosshair';
      case 'text':
        return 'text';
      default:
        return 'default';
    }
  } else {
    switch (actionMode.type) {
      case 'isMoving':
        return 'move';
      case 'isResizing':
        return 'nwse-resize';
      case 'isDrawing':
        return 'crosshair';
      case 'isPanning':
        return 'grab';
      default:
        return 'default';
    }
  }
}

// Get dimensions from free draw points
function getDimensionsFromFreeDraw({ freeDrawObject }: { freeDrawObject: CanvasObject }) {
  if (!freeDrawObject.freeDrawPoints || freeDrawObject.freeDrawPoints.length === 0) {
    return { width: 0, height: 0 };
  }
  const xs = freeDrawObject.freeDrawPoints.map((p) => p.x);
  const ys = freeDrawObject.freeDrawPoints.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { width: maxX - minX, height: maxY - minY };
}

// Get relative mouse position on canvas
function getRelativeMousePositionOnCanvas({
  windowMouseX,
  windowMouseY,
  canvasWorkingSize,
  scrollPosition,
  zoom,
}: {
  windowMouseX: number;
  windowMouseY: number;
  canvasWorkingSize: { width: number; height: number };
  scrollPosition: { x: number; y: number };
  zoom: number;
}): { relativeMouseX: number; relativeMouseY: number } {
  const relativeMouseX = (windowMouseX - scrollPosition.x) / (zoom / 100);
  const relativeMouseY = (windowMouseY - scrollPosition.y) / (zoom / 100);
  return { relativeMouseX, relativeMouseY };
}

// Check if cursor is within rectangle
function isCursorWithinRectangle({
  x,
  y,
  width,
  height,
  relativeMouseX,
  relativeMouseY,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  relativeMouseX: number;
  relativeMouseY: number;
}): boolean {
  return (
    relativeMouseX >= x &&
    relativeMouseX <= x + width &&
    relativeMouseY >= y &&
    relativeMouseY <= y + height
  );
}

// Main component
export default function MergedCanvasOverlay() {
  // Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);
  const previousTouchRef = useRef<Touch | null>(null);
  const distanceBetweenTouchesRef = useRef<number>(0);
  const initialDrawingPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // State replacements for external hooks
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  const [activeObjectId, setActiveObjectId] = useState<string | null>(null);

  const [canvasObjects, setCanvasObjects] = useState<any[]>([]);

  const [canvasWorkingSize, setCanvasWorkingSize] = useState({ width: 1920, height: 1080 });

  const [defaultParams] = useState({
    strokeColorHex: '#000000',
    backgroundColorHex: '#ffffff',
    fontColorHex: '#000000',
  });

  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });

  const [userMode, setUserMode] = useState<string>('select');

  const [actionMode, setActionMode] = useState<any>(null);

  const [zoom, setZoom] = useState(100);

  // Effect to update window size on resize
  useEffect(() => {
    function handleResize() {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Canvas context initialization
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    contextRef.current = context;
    drawEverything();
  }, [canvasWorkingSize, canvasObjects, zoom]);

  // Drawing function
  const drawEverything = useCallback(() => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    // Clear canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Draw each object
    canvasObjects.forEach((obj) => {
      switch (obj.type) {
        case 'rectangle':
          context.fillStyle = obj.backgroundColorHex || '#ffffff';
          context.fillRect(obj.x, obj.y, obj.width, obj.height);
          if (obj.strokeWidth && obj.strokeColorHex) {
            context.lineWidth = obj.strokeWidth;
            context.strokeStyle = obj.strokeColorHex;
            context.strokeRect(obj.x, obj.y, obj.width, obj.height);
          }
          break;
        case 'ellipse':
          context.beginPath();
          context.ellipse(
            obj.x + obj.width / 2,
            obj.y + obj.height / 2,
            obj.width / 2,
            obj.height / 2,
            0,
            0,
            2 * Math.PI
          );
          context.fillStyle = obj.backgroundColorHex || '#ffffff';
          context.fill();
          if (obj.strokeWidth && obj.strokeColorHex) {
            context.lineWidth = obj.strokeWidth;
            context.strokeStyle = obj.strokeColorHex;
            context.stroke();
          }
          break;
        case 'free-draw':
          if (obj.freeDrawPoints && obj.freeDrawPoints.length > 0) {
            context.beginPath();
            context.lineWidth = obj.strokeWidth || 1;
            context.strokeStyle = obj.strokeColorHex || '#000000';
            context.moveTo(obj.freeDrawPoints[0].x, obj.freeDrawPoints[0].y);
            for (let i = 1; i < obj.freeDrawPoints.length; i++) {
              context.lineTo(obj.freeDrawPoints[i].x, obj.freeDrawPoints[i].y);
            }
            context.stroke();
          }
          break;
        case 'text':
          context.fillStyle = obj.fontColorHex || '#000000';
          context.font = \`\${obj.fontSize || 16}px \${obj.fontFamily || 'sans-serif'}\`;
          context.textAlign = obj.textAlignHorizontal || 'left';
          context.textBaseline = obj.textAlignVertical || 'alphabetic';
          context.fillText(obj.text || '', obj.x, obj.y + (obj.fontSize || 16));
          break;
        default:
          break;
      }
    });
  }, [canvasObjects]);

  // Helper functions to update canvas objects state
  const appendRectangleObject = (obj: any) => {
    setCanvasObjects((prev) => [...prev, { ...obj, type: 'rectangle' }]);
  };
  const appendEllipseObject = (obj: any) => {
    setCanvasObjects((prev) => [...prev, { ...obj, type: 'ellipse' }]);
  };
  const appendFreeDrawObject = (obj: any) => {
    setCanvasObjects((prev) => [...prev, { ...obj, type: 'free-draw' }]);
  };
  const appendTextObject = (obj: any) => {
    setCanvasObjects((prev) => [...prev, { ...obj, type: 'text' }]);
  };
  const updateCanvasObject = (id: string, updates: any) => {
    setCanvasObjects((prev) =>
      prev.map((obj) => (obj.id === id ? { ...obj, ...updates } : obj))
    );
  };
  const appendFreeDrawPointToCanvasObject = (id: string, point: { x: number; y: number }) => {
    setCanvasObjects((prev) =>
      prev.map((obj) => {
        if (obj.id === id && obj.type === 'free-draw') {
          return { ...obj, freeDrawPoints: [...obj.freeDrawPoints, point] };
        }
        return obj;
      })
    );
  };
  const moveCanvasObject = (params: {
    id: string;
    deltaPosition: { deltaX: number; deltaY: number };
    canvasWorkingSize: { width: number; height: number };
  }) => {
    const { id, deltaPosition } = params;
    setCanvasObjects((prev) =>
      prev.map((obj) => {
        if (obj.id === id) {
          return {
            ...obj,
            x: obj.x + deltaPosition.deltaX,
            y: obj.y + deltaPosition.deltaY,
          };
        }
        return obj;
      })
    );
  };
  const resizeCanvasObject = (params: {
    id: string;
    actionModeOption: string;
    delta: { deltaX: number; deltaY: number };
    canvasWorkingSize: { width: number; height: number };
  }) => {
    const { id, actionModeOption, delta } = params;
    setCanvasObjects((prev) =>
      prev.map((obj) => {
        if (obj.id === id) {
          let newX = obj.x;
          let newY = obj.y;
          let newWidth = obj.width;
          let newHeight = obj.height;
          switch (actionModeOption) {
            case 'topLeft':
              newX += delta.deltaX;
              newY += delta.deltaY;
              newWidth -= delta.deltaX;
              newHeight -= delta.deltaY;
              break;
            case 'topRight':
              newY += delta.deltaY;
              newWidth += delta.deltaX;
              newHeight -= delta.deltaY;
              break;
            case 'bottomLeft':
              newX += delta.deltaX;
              newWidth -= delta.deltaX;
              newHeight += delta.deltaY;
              break;
            case 'bottomRight':
              newWidth += delta.deltaX;
              newHeight += delta.deltaY;
              break;
            default:
              break;
          }
          if (newWidth < 0) newWidth = 0;
          if (newHeight < 0) newHeight = 0;
          return {
            ...obj,
            x: newX,
            y: newY,
            width: newWidth,
            height: newHeight,
          };
        }
        return obj;
      })
    );
  };

  // Increment and decrement zoom
  const incrementZoom = (amount: number) => {
    setZoom((z) => Math.min(500, z + amount));
  };
  const decrementZoom = (amount: number) => {
    setZoom((z) => Math.max(10, z - amount));
  };

  // Event handlers

  type PointerOrTouchEvent = PointerEvent<HTMLElement> | TouchEvent<HTMLElement>;

  const activeObject = canvasObjects.find((obj) => obj.id === activeObjectId);

  const onPointerDown = (event: PointerOrTouchEvent) => {
    event.preventDefault();

    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    const clientX = 'clientX' in event ? event.clientX : event.touches[0]?.clientX;
    const clientY = 'clientY' in event ? event.clientY : event.touches[0]?.clientY;

    const relativeMousePosition = getRelativeMousePositionOnCanvas({
      windowMouseX: clientX!,
      windowMouseY: clientY!,
      canvasWorkingSize,
      scrollPosition,
      zoom,
    });

    initialDrawingPositionRef.current = {
      x: relativeMousePosition.relativeMouseX,
      y: relativeMousePosition.relativeMouseY,
    };
    const createdObjectId = generateUniqueId();

    switch (userMode) {
      case 'icon':
      case 'image':
      case 'select': {
        let isResizing = false;
        if (activeObject) {
          const { position, ...boxes } = getControlPoints({
            canvasObject: activeObject,
            zoom,
          });
          Object.entries(boxes).forEach(([boxName, box]) => {
            const isWithinBounds = isCursorWithinRectangle({
              x: box.x,
              y: box.y,
              width: box.width,
              height: box.height,
              relativeMouseX: initialDrawingPositionRef.current.x,
              relativeMouseY: initialDrawingPositionRef.current.y,
            });
            if (isWithinBounds) {
              isResizing = true;
              setActionMode({
                type: 'isResizing',
                option: boxName.split('Box')[0],
              });
            }
          });
        }
        if (!isResizing) {
          const clickedObjects = canvasObjects.filter((canvasObject) => {
            return isCursorWithinRectangle({
              x: canvasObject.x,
              y: canvasObject.y,
              width: canvasObject.width,
              height: canvasObject.height,
              relativeMouseX: initialDrawingPositionRef.current.x,
              relativeMouseY: initialDrawingPositionRef.current.y,
            });
          });
          const clickedObject = clickedObjects[clickedObjects.length - 1];
          const wasClickInsideWorkingCanvas = isCursorWithinRectangle({
            x: 0,
            y: 0,
            width: canvasWorkingSize.width,
            height: canvasWorkingSize.height,
            relativeMouseX: initialDrawingPositionRef.current.x,
            relativeMouseY: initialDrawingPositionRef.current.y,
          });
          const shouldClearSelection = !wasClickInsideWorkingCanvas && clickedObject?.id !== activeObjectId;
          setActiveObjectId(shouldClearSelection ? null : clickedObject?.id || null);
          if (clickedObject) {
            setUserMode('select');
            setActionMode({ type: 'isMoving' });
          } else {
            setActionMode({ type: 'isPanning' });
          }
        }
        drawEverything();
        break;
      }
      case 'free-draw': {
        appendFreeDrawObject({
          id: createdObjectId,
          x: initialDrawingPositionRef.current.x,
          y: initialDrawingPositionRef.current.y,
          width: 0,
          height: 0,
          strokeColorHex: defaultParams.strokeColorHex,
          strokeWidth: 1,
          opacity: 100,
          freeDrawPoints: [
            {
              x: initialDrawingPositionRef.current.x,
              y: initialDrawingPositionRef.current.y,
            },
          ],
        });
        setActiveObjectId(createdObjectId);
        setActionMode({ type: 'isDrawing' });
        break;
      }
      case 'rectangle': {
        appendRectangleObject({
          id: createdObjectId,
          x: initialDrawingPositionRef.current.x,
          y: initialDrawingPositionRef.current.y,
          width: 0,
          height: 0,
          backgroundColorHex: defaultParams.backgroundColorHex,
          strokeColorHex: defaultParams.strokeColorHex,
          strokeWidth: 0,
          opacity: 100,
          borderRadius: 0,
        });
        setActiveObjectId(createdObjectId);
        setActionMode({ type: 'isDrawing' });
        break;
      }
      case 'ellipse': {
        appendEllipseObject({
          id: createdObjectId,
          x: initialDrawingPositionRef.current.x,
          y: initialDrawingPositionRef.current.y,
          width: 0,
          height: 0,
          backgroundColorHex: defaultParams.backgroundColorHex,
          strokeColorHex: defaultParams.strokeColorHex,
          strokeWidth: 0,
          opacity: 100,
          borderRadius: 0,
        });
        setActiveObjectId(createdObjectId);
        setActionMode({ type: 'isDrawing' });
        break;
      }
      case 'text': {
        appendTextObject({
          id: createdObjectId,
          x: initialDrawingPositionRef.current.x,
          y: initialDrawingPositionRef.current.y,
          width: 200,
          height: 100,
          text: 'Add text',
          textAlignHorizontal: 'center',
          textAlignVertical: 'middle',
          textJustify: false,
          fontColorHex: defaultParams.fontColorHex,
          fontSize: 44,
          fontFamily: 'sans-serif',
          fontStyle: 'normal',
          fontWeight: 'normal',
          fontVariant: 'normal',
          fontLineHeightRatio: 1,
          opacity: 100,
        });
        setActiveObjectId(createdObjectId);
        setUserMode('select');
        setActionMode(null);
        break;
      }
      default:
        break;
    }
  };

  const onPointerMove = (event: PointerOrTouchEvent) => {
    event.preventDefault();
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context || !actionMode) return;

    const clientX = 'clientX' in event ? event.clientX : event.touches[0]?.clientX;
    const clientY = 'clientY' in event ? event.clientY : event.touches[0]?.clientY;

    const finger0PageX = 'touches' in event ? event.touches[0]?.pageX : null;
    const finger0PageY = 'touches' in event ? event.touches[0]?.pageY : null;

    const finger1PageX = 'touches' in event ? event.touches[1]?.pageX : null;
    const finger1PageY = 'touches' in event ? event.touches[1]?.pageY : null;

    if (
      finger0PageX !== null &&
      finger0PageY !== null &&
      finger1PageX !== null &&
      finger1PageY !== null
    ) {
      const distanceBetweenTouches = Math.hypot(finger0PageX - finger1PageX, finger0PageY - finger1PageY);

      if (distanceBetweenTouchesRef.current) {
        if (distanceBetweenTouches > distanceBetweenTouchesRef.current) {
          incrementZoom(1);
        } else if (distanceBetweenTouches < distanceBetweenTouchesRef.current) {
          decrementZoom(1);
        }
      }

      distanceBetweenTouchesRef.current = distanceBetweenTouches;
    }

    const movementX =
      'movementX' in event
        ? event.movementX
        : previousTouchRef.current?.pageX
        ? event.touches[0].pageX - previousTouchRef.current.pageX
        : 0;

    const movementY =
      'movementY' in event
        ? event.movementY
        : previousTouchRef.current?.pageY
        ? event.touches[0].pageY - previousTouchRef.current.pageY
        : 0;

    if ('touches' in event) {
      previousTouchRef.current = event.touches[0];
    }

    const relativeMousePosition = getRelativeMousePositionOnCanvas({
      windowMouseX: clientX!,
      windowMouseY: clientY!,
      canvasWorkingSize,
      scrollPosition,
      zoom,
    });

    const finalX = relativeMousePosition.relativeMouseX;
    const finalY = relativeMousePosition.relativeMouseY;

    switch (userMode) {
      case 'select': {
        if (activeObjectId && actionMode.type === 'isMoving') {
          moveCanvasObject({
            id: activeObjectId,
            deltaPosition: {
              deltaX: movementX / (zoom / 100),
              deltaY: movementY / (zoom / 100),
            },
            canvasWorkingSize,
          });
        } else if (activeObjectId && actionMode.type === 'isResizing' && actionMode.option) {
          resizeCanvasObject({
            id: activeObjectId,
            actionModeOption: actionMode.option,
            delta: {
              deltaX: movementX / (zoom / 100),
              deltaY: movementY / (zoom / 100),
            },
            canvasWorkingSize,
          });
        } else if (actionMode.type === 'isPanning') {
          setScrollPosition((pos) => ({
            x: pos.x + movementX,
            y: pos.y + movementY,
          }));
        }
        break;
      }
      case 'free-draw': {
        if (activeObjectId) {
          appendFreeDrawPointToCanvasObject(activeObjectId, {
            x: finalX,
            y: finalY,
          });
        }
        break;
      }
      case 'rectangle':
      case 'ellipse': {
        if (activeObjectId) {
          const topLeftX = Math.min(initialDrawingPositionRef.current.x, finalX);
          const topLeftY = Math.min(initialDrawingPositionRef.current.y, finalY);

          const width = Math.abs(initialDrawingPositionRef.current.x - finalX);
          const height = Math.abs(initialDrawingPositionRef.current.y - finalY);

          updateCanvasObject(activeObjectId, {
            x: topLeftX,
            y: topLeftY,
            width,
            height,
          });
        }
        break;
      }
      default: {
        break;
      }
    }
  };

  const onPointerUp = (event: PointerOrTouchEvent) => {
    event.preventDefault();
    setActionMode(null);
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    previousTouchRef.current = null;
    if ('touches' in event) {
      distanceBetweenTouchesRef.current = 0;
    }

    switch (userMode) {
      case 'select': {
        break;
      }
      case 'text': {
        break;
      }
      case 'free-draw': {
        context.closePath();
        if (activeObject) {
          const dimensions = getDimensionsFromFreeDraw({
            freeDrawObject: activeObject,
          });
          updateCanvasObject(activeObject.id, {
            width: dimensions.width,
            height: dimensions.height,
          });
        }
        setUserMode('select');
        drawEverything();
        break;
      }
      case 'rectangle':
      case 'ellipse': {
        setUserMode('select');
        drawEverything();
        break;
      }
      default: {
        break;
      }
    }
  };

  // Styles for FixedMain replacement
  const fixedMainStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: '100%',
    zIndex: themeLayers.canvasApp,
    userSelect: 'none',
    cursor: getCursorFromModes({ userMode, actionMode }),
  };

  return (
    <>
      <main
        id={APP_FIXED_MAIN_UNIQUE_ID}
        style={fixedMainStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onTouchStart={onPointerDown}
        onTouchMove={onPointerMove}
        onTouchEnd={onPointerUp}
      >
        <canvas
          id={CANVAS_CONTROLS_OVERLAY}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: \`\${windowSize.width}px\`,
            height: \`\${windowSize.height}px\`,
            zIndex: themeLayers.canvasElement + 1,
          }}
          width={windowSize.width}
          height={windowSize.height}
        />
        <div
          style={{
            position: 'absolute',
            top: scrollPosition.y,
            left: scrollPosition.x,
            width: \`\${canvasWorkingSize.width}px\`,
            height: \`\${canvasWorkingSize.height}px\`,
            transform: \`scale(\${zoom / 100})\`,
            zIndex: themeLayers.canvasElement,
            backgroundImage: \`url(\${TRANSPARENT_BACKGROUND_IMAGE})\`,
            backgroundColor: 'white',
          }}
        >
          <h1
            style={{
              position: 'absolute',
              top: \`\${-38 / (zoom / 100)}px\`,
              left: '0',
              width: \`\${Number.MAX_SAFE_INTEGER}px\`,
              color: 'white',
              fontSize: \`\${20 / (zoom / 100)}px\`,
            }}
          >
            {\`\${canvasWorkingSize.width} x \${canvasWorkingSize.height} px\`}
          </h1>
          <canvas ref={canvasRef} width={canvasWorkingSize.width} height={canvasWorkingSize.height} />
        </div>
      </main>
      <Overlay />
    </>
  );
}
