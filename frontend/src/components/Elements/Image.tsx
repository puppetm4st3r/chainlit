import { cn } from '@/lib/utils';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useState } from 'react';

import { IImageElement } from '@chainlit/react-client';

import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal
} from '@/components/ui/dialog';

const ImageElement = ({ element }: { element: IImageElement }) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  if (!element.url) return null;

  const handleClick = () => {
    setLightboxOpen(true);
    setZoomLevel(1); // Reset zoom when opening
    setPosition({ x: 0, y: 0 }); // Reset position when opening
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev * 1.5, 5)); // Max zoom 5x
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev / 1.5, 0.2)); // Min zoom 0.2x
  };

  const handleZoomReset = () => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 }); // Reset position when resetting zoom
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoomLevel > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <>
      <div className="rounded-sm bg-accent overflow-hidden relative group">
        <img
          className={cn(
            'mx-auto block max-w-full h-auto',
            element.display === 'inline' && 'cursor-pointer',
            `${element.display}-image`
          )}
          src={element.url}
          alt={element.name}
          loading="lazy"
          onClick={handleClick}
        />
        {/* Tooltip overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100" onClick={handleClick}>
          <div className="bg-black/80 text-white px-3 py-2 rounded-lg text-sm font-medium border border-primary">
            Clic para ampliar y usar controles de zoom
          </div>
        </div>
      </div>

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogPortal>
          <DialogOverlay className="bg-black/80" />
          <DialogContent className="border-none bg-transparent shadow-none max-w-none p-0 w-screen h-screen overflow-hidden [&>button]:hidden">
            <div 
              className={`relative w-full h-full flex items-center justify-center ${
                zoomLevel > 1 ? 'overflow-hidden' : 'overflow-auto'
              }`}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Close button */}
              <button
                onClick={() => setLightboxOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white z-10"
                aria-label="Close lightbox"
              >
                <X className="h-6 w-6" />
              </button>

              {/* Zoom controls */}
              <div className="absolute top-4 left-4 flex gap-2 z-10">
                <button
                  onClick={handleZoomIn}
                  className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="h-5 w-5" />
                </button>
                <button
                  onClick={handleZoomOut}
                  className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="h-5 w-5" />
                </button>
                <button
                  onClick={handleZoomReset}
                  className="p-2 rounded-full bg-black/50 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
                  aria-label="Reset zoom"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
              </div>

              {/* Zoom level indicator */}
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 text-white text-sm z-10">
                {Math.round(zoomLevel * 100)}%
              </div>

              <img
                src={element.url}
                alt={element.name}
                className={`object-contain transition-transform duration-200 ${
                  zoomLevel > 1 ? 'cursor-grab' : 'cursor-default'
                } ${isDragging ? 'cursor-grabbing' : ''}`}
                style={{
                  transform: `scale(${zoomLevel}) translate(${position.x}px, ${position.y}px)`,
                  maxWidth: zoomLevel <= 1 ? '100vw' : 'none',
                  maxHeight: zoomLevel <= 1 ? '100vh' : 'none'
                }}
                onMouseDown={handleMouseDown}
                onClick={(e) => e.stopPropagation()}
                draggable={false}
              />
            </div>
          </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
};

export { ImageElement };
