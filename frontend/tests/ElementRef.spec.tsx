import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { IMessageElement } from '@chainlit/react-client';

import { ElementRef } from '@/components/Elements/ElementRef';
import { MessageContext } from '@/contexts/MessageContext';

vi.mock('@/components/i18n/Translator', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { title?: string }) => {
      if (key === 'chat.artifactPreview.reopenChip') {
        return `Preview: ${options?.title ?? ''}`;
      }
      return key;
    },
    ready: true,
    i18n: { exists: () => true }
  })
}));

const renderWithContext = (
  element: IMessageElement,
  onElementRefClick = vi.fn()
) => {
  return {
    onElementRefClick,
    ...render(
      <MessageContext.Provider
        value={
          {
            onElementRefClick
          } as any
        }
      >
        <ElementRef element={element} />
      </MessageContext.Provider>
    )
  };
};

describe('ElementRef', () => {
  it('renders a light-green floating chip and forwards clicks', () => {
    const element = {
      id: 'c1',
      type: 'custom',
      name: 'MyWidget',
      display: 'floating',
      forId: 'm1',
      showReopenChip: true,
      props: {}
    } as IMessageElement;

    const { onElementRefClick } = renderWithContext(element);
    const chip = screen.getByRole('link', { name: 'MyWidget' });

    expect(chip).toHaveClass('element-link-floating');
    expect(chip).toHaveStyle({
      backgroundColor: '#045f3f',
      color: '#ffffff',
      borderColor: '#045f3f'
    });
    expect(chip.className).not.toContain('uppercase');

    fireEvent.click(chip);
    expect(onElementRefClick).toHaveBeenCalledWith(element);
  });

  it('prefers props.title for floating chip label when present', () => {
    const element = {
      id: 'c2',
      type: 'custom',
      name: 'DynamicTable',
      display: 'floating',
      forId: 'm1',
      showReopenChip: true,
      props: { title: 'Sample people' }
    } as IMessageElement;

    renderWithContext(element);
    const chip = screen.getByRole('link', { name: 'Sample people' });
    expect(chip).toBeInTheDocument();
    expect(chip.querySelector('svg')).toBeNull();
    expect(screen.queryByText('DynamicTable')).not.toBeInTheDocument();
  });

  it('prefixes ArtifactPreview chips with a preview icon and localized label', () => {
    const element = {
      id: 'c4',
      type: 'custom',
      name: 'ArtifactPreview',
      display: 'floating',
      forId: 'm1',
      showReopenChip: true,
      props: { title: 'msg actual' }
    } as IMessageElement;

    renderWithContext(element);
    const chip = screen.getByRole('link', { name: 'Preview: msg actual' });
    expect(chip).toHaveClass('element-link-floating');
    expect(chip.querySelector('svg')).not.toBeNull();
    expect(screen.queryByText('ArtifactPreview')).not.toBeInTheDocument();
  });

  it('does not render a floating chip when showReopenChip is false', () => {
    const element = {
      id: 'c3',
      type: 'custom',
      name: 'Motd',
      display: 'floating',
      forId: 'm1',
      showReopenChip: false,
      props: { title: 'Welcome message' }
    } as IMessageElement;

    const { container } = renderWithContext(element);
    expect(container).toBeEmptyDOMElement();
  });
  it('keeps the muted pill for side elements', () => {
    const element = {
      id: 's1',
      type: 'text',
      name: 'SideDoc',
      display: 'side',
      forId: 'm1'
    } as IMessageElement;

    renderWithContext(element);
    const chip = screen.getByText('SideDoc');
    expect(chip).toHaveClass('element-link');
    expect(chip).toHaveClass('uppercase');
    expect(chip.className).not.toContain('element-link-floating');
  });
});
