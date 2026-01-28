// Resize handles component

import React, { useEffect, useRef } from 'react';
import { post } from '../hooks/usePluginMessages';

type ResizeDir = 'top' | 'right' | 'bottom' | 'left' | 'corner';

export function ResizeHandles() {
  const isResizingRef = useRef(false);
  const startRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  const directionRef = useRef<ResizeDir>('corner');

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;

      const deltaX = e.clientX - startRef.current.x;
      const deltaY = e.clientY - startRef.current.y;
      const direction = directionRef.current;

      let newWidth = startRef.current.width;
      let newHeight = startRef.current.height;

      if (direction === 'right' || direction === 'corner') {
        newWidth = startRef.current.width + deltaX;
      } else if (direction === 'left') {
        newWidth = startRef.current.width - deltaX;
      }

      if (direction === 'bottom' || direction === 'corner') {
        newHeight = startRef.current.height + deltaY;
      } else if (direction === 'top') {
        newHeight = startRef.current.height - deltaY;
      }

      newWidth = Math.max(400, newWidth);
      newHeight = Math.max(300, newHeight);
      post({ type: 'resize', width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      isResizingRef.current = false;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const handleMouseDown = (direction: ResizeDir) => (e: React.MouseEvent) => {
    isResizingRef.current = true;
    directionRef.current = direction;
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: window.innerWidth,
      height: window.innerHeight,
    };
    e.preventDefault();
  };

  return (
    <>
      <div
        className="resize-handle resize-handle--top"
        onMouseDown={handleMouseDown('top')}
      />
      <div
        className="resize-handle resize-handle--right"
        onMouseDown={handleMouseDown('right')}
      />
      <div
        className="resize-handle resize-handle--bottom"
        onMouseDown={handleMouseDown('bottom')}
      />
      <div
        className="resize-handle resize-handle--left"
        onMouseDown={handleMouseDown('left')}
      />
      <div
        className="resize-handle resize-handle--corner"
        onMouseDown={handleMouseDown('corner')}
      />
    </>
  );
}
