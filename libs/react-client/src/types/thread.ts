import { IElement } from './element';
import { IStep } from './step';

export interface IThread {
  id: string;
  createdAt: number | string;
  name?: string;
  userId?: string;
  userIdentifier?: string;
  tags?: string[];
  metadata?: Record<string, any> | string;
  steps: IStep[];
  elements?: IElement[];
  projectId?: string | null;
}
