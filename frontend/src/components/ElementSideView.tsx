import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';

import { sideViewState } from '@chainlit/react-client';
import { dispatchCanvasShellCloseRequest } from '@/lib/canvas';

import { Card, CardContent } from '@/components/ui/card';
import { ResizableHandle, ResizablePanel } from '@/components/ui/resizable';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';

import { useIsMobile } from '@/hooks/use-mobile';

import { Element } from './Elements';

export default function ElementSideView() {
  const [sideView, setSideView] = useRecoilState(sideViewState);
  const isMobile = useIsMobile();
  const [isVisible, setIsVisible] = useState(false);
  const handleCloseSideView = () => {
    dispatchCanvasShellCloseRequest(sideView?.elements);
    setSideView(undefined);
  };

  const isCanvas = Boolean(
    sideView?.elements?.some(
      (element) => element.type === 'custom' && element.name === 'Canvas Editor'
    ) || sideView?.title?.trim().toLowerCase() === 'canvas'
  );

  useEffect(() => {
    if (sideView) {
      // Delay setting visibility to trigger animation
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
    }
  }, [sideView]);

  if (!sideView) return null;

  if (isMobile) {
    return (
      <Sheet open onOpenChange={(open) => !open && handleCloseSideView()}>
        <SheetContent
          className={cn('md:hidden flex flex-col', isCanvas && 'p-0')}
        >
          {!isCanvas ? (
            <SheetHeader>
              <SheetTitle id="side-view-title">{sideView.title}</SheetTitle>
            </SheetHeader>
          ) : null}
          <div
            id="side-view-content"
            className={cn(
              'overflow-auto flex-grow flex flex-col',
              isCanvas ? 'p-0' : 'gap-4 mt-4'
            )}
          >
            {sideView.elements.map((e) => (
              <Element key={e.id} element={e} />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <>
      <ResizableHandle className="sm:hidden md:flex" />
      <ResizablePanel
        minSize={20}
        defaultSize={70}
        className={`md:flex flex-col flex-grow sm:hidden transform transition-transform duration-300 ease-in-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <aside className="relative flex-grow overflow-y-auto mr-4 mb-4">
          <Card className="overflow-y-auto h-full relative flex flex-col">
            <CardContent
              id="side-view-content"
              className={cn(
                'flex flex-col flex-grow',
                isCanvas ? 'p-0' : 'gap-4 p-6'
              )}
            >
              {sideView.elements.map((e) => (
                <Element key={e.id} element={e} />
              ))}
            </CardContent>
          </Card>
        </aside>
      </ResizablePanel>
    </>
  );
}
