import type { IFileElement } from '@chainlit/react-client';

import { FileElement } from '@/components/Elements/File';

interface Props {
  items: IFileElement[];
}

const InlinedFileList = ({ items }: Props) => {
  return (
    <div 
      className="grid w-full gap-2"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))'
      }}
    >
      {items.map((file, i) => {
        return (
          <div key={i}>
            <FileElement element={file} />
          </div>
        );
      })}
    </div>
  );
};

export { InlinedFileList };
