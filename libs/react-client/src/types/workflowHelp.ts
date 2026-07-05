export interface IWorkflowHelp {
  automataId: string;
  title: string;
  url: string;
  buttonLabel: string;
  preferenceKey: string;
  effectiveVersion: string;
  threadId: string;
  openOnResume: boolean;
  lifecycle: 'start' | 'resume';
}
