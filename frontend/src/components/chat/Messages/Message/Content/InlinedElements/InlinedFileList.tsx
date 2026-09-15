import type { IFileElement } from '@chainlit/react-client';

import { FileElement } from '@/components/Elements/File';

interface Props {
  items: IFileElement[];
}

const InlinedFileList = ({ items }: Props) => {
  return (
    <div className="flex w-full flex-col gap-2">
      {items.map((file, i) => (
        <div key={file.id || `${file.name}-${i}`} className="w-full">
          <FileElement element={file} />
        </div>
      ))}
    </div>
  );
};

export { InlinedFileList };
