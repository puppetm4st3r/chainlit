import { describe, expect, it } from 'vitest';

import type { IMessageElement } from '@chainlit/react-client';

import { prepareContent } from '@/lib/message';

describe('prepareContent floating chip labels', () => {
  it('uses props.title as the visible markdown label and keeps name in href', () => {
    const elements = [
      {
        id: 'el-1',
        type: 'custom',
        name: 'DynamicTable',
        display: 'floating',
        forId: 'msg-1',
        showReopenChip: true,
        props: { title: 'Sample people' }
      }
    ] as IMessageElement[];

    const result = prepareContent({
      elements,
      content: 'DynamicTable',
      id: 'msg-1'
    });

    expect(result.preparedContent).toContain('[Sample people](#element:DynamicTable)');
    expect(result.preparedContent).not.toContain('[DynamicTable]');
    expect(result.refElements).toHaveLength(1);
    expect(result.refElements[0].name).toBe('DynamicTable');
  });

  it('falls back to element.name when props.title is empty', () => {
    const elements = [
      {
        id: 'el-2',
        type: 'custom',
        name: 'DynamicTable',
        display: 'floating',
        forId: 'msg-2',
        showReopenChip: true,
        props: { title: '' }
      }
    ] as IMessageElement[];

    const result = prepareContent({
      elements,
      content: 'DynamicTable',
      id: 'msg-2'
    });

    expect(result.preparedContent).toContain('[DynamicTable](#element:DynamicTable)');
  });

  it('strips Motd match tokens when showReopenChip is false', () => {
    const elements = [
      {
        id: 'el-3',
        type: 'custom',
        name: 'Motd',
        display: 'floating',
        forId: 'msg-3',
        showReopenChip: false,
        props: { title: 'Welcome message' }
      }
    ] as IMessageElement[];

    const result = prepareContent({
      elements,
      content: 'Motd',
      id: 'msg-3'
    });

    expect(result.preparedContent).toBe('');
    expect(result.refElements).toHaveLength(0);
  });
});
