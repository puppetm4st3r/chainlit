import mapValues from 'lodash/mapValues';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useRecoilState, useSetRecoilState } from 'recoil';

import {
  chatSettingsValueState,
  useChatData,
  useChatInteract
} from '@chainlit/react-client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Translator } from 'components/i18n';

import { chatSettingsOpenState } from 'state/project';

import { FormInput, TFormInputValue } from './FormInput';

export default function ChatSettingsModal() {
  const { chatSettingsValue, chatSettingsInputs, chatSettingsDefaultValue } =
    useChatData();

  const { updateChatSettings } = useChatInteract();
  const [chatSettingsOpen, setChatSettingsOpen] = useRecoilState(
    chatSettingsOpenState
  );

  const { handleSubmit, setValue, reset, watch } = useForm({
    defaultValues: chatSettingsValue
  });
  const setChatSettingsValue = useSetRecoilState(chatSettingsValueState);

  const collectLeafInputs = (inputs: any[]): any[] => {
    const leafInputs: any[] = [];

    inputs.forEach((input: any) => {
      if (!input) {
        return;
      }

      if (Array.isArray(input.inputs) && input.inputs.length > 0) {
        leafInputs.push(...collectLeafInputs(input.inputs));
        return;
      }

      leafInputs.push(input);
    });

    return leafInputs;
  };

  const collectLiveReadOnlyInputIds = (inputs: any[]): string[] => {
    const ids: string[] = [];

    inputs.forEach((input: any) => {
      if (!input) {
        return;
      }

      if (Array.isArray(input.inputs) && input.inputs.length > 0) {
        ids.push(...collectLiveReadOnlyInputIds(input.inputs));
        return;
      }

      const isReadOnlyProgress = input.type === 'progress';
      const isDisabledInformationalField =
        input.disabled === true &&
        (input.type === 'textinput' || input.type === 'numberinput');

      if ((isReadOnlyProgress || isDisabledInformationalField) && input.id) {
        ids.push(input.id);
      }
    });

    return ids;
  };

  // Reset form when the widget schema changes or when the modal opens.
  useEffect(() => {
    if (!chatSettingsOpen) {
      return;
    }
    reset(chatSettingsValue);
  }, [chatSettingsInputs, chatSettingsOpen, reset]);

  // Live progress widgets should refresh in place without resetting editable fields.
  useEffect(() => {
    const readOnlyInputIds = collectLiveReadOnlyInputIds(chatSettingsInputs);
    readOnlyInputIds.forEach((id) => {
      setValue(id, chatSettingsValue[id]);
    });
  }, [chatSettingsInputs, chatSettingsValue, setValue]);

  const handleClose = (open: boolean) => {
    if (!open) {
      reset(chatSettingsValue);
      setChatSettingsOpen(false);
    }
  };

  const handleConfirm = handleSubmit((data) => {
    const processedValues = mapValues(data, (x: TFormInputValue) =>
      x !== '' ? x : null
    );
    updateChatSettings(processedValues);
    setChatSettingsValue(processedValues);
    setChatSettingsOpen(false);
  });

  const handleReset = () => {
    reset(chatSettingsDefaultValue);
  };

  // Legacy setField compatibility layer
  const handleChange = () => {};

  const setFieldValue = (field: string, value: any) => {
    setValue(field, value);
  };

  const values = watch();
  const leafInputs = collectLeafInputs(chatSettingsInputs);
  const hasOnlyReadOnlyInformationalInputs =
    leafInputs.length > 0 &&
    leafInputs.every((input: any) => {
      if (!input) {
        return false;
      }

      if (input.type === 'progress') {
        return true;
      }

      return (
        input.disabled === true &&
        (input.type === 'textinput' || input.type === 'numberinput')
      );
    });
  const tabInputs = chatSettingsInputs.filter(
    (input: any) => Array.isArray(input?.inputs) && input.inputs.length > 0
  );
  const regularInputs = chatSettingsInputs.filter(
    (input: any) => !Array.isArray(input?.inputs) || input.inputs.length === 0
  );
  const hasTabs = tabInputs.length > 0;
  const defaultTab = tabInputs[0]?.id;

  const handlePrimaryAction = hasOnlyReadOnlyInformationalInputs
    ? () => handleClose(false)
    : handleConfirm;

  return (
    <Dialog open={chatSettingsOpen} onOpenChange={handleClose}>
      <DialogContent
        id="chat-settings"
        className={`flex flex-col gap-6 p-6 ${
          hasTabs ? 'min-w-[25vw] h-[85vh]' : 'min-w-[20vw] max-h-[85vh]'
        }`}
      >
        <DialogHeader>
          <DialogTitle>
            <Translator path="chat.settings.title" />
          </DialogTitle>
          <DialogDescription className="sr-only">
            <Translator path="chat.settings.customize" />
          </DialogDescription>
        </DialogHeader>
        {hasTabs ? (
          <Tabs
            defaultValue={defaultTab}
            className="flex flex-col flex-grow min-h-0"
          >
            <TabsList className="w-full flex justify-start">
              {tabInputs.map((tab: any) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label ?? tab.id}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabInputs.map((tab: any) => (
              <TabsContent
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:flex flex-col flex-grow overflow-y-auto gap-6 p-1 mt-4"
              >
                {tab.inputs?.map((input: any) => (
                  <FormInput
                    key={input.id}
                    element={{
                      ...input,
                      value: values[input.id],
                      onChange: handleChange,
                      setField: setFieldValue
                    }}
                  />
                ))}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="flex flex-col flex-grow overflow-y-auto gap-6 p-1">
            {regularInputs.map((input: any) => (
              <FormInput
                key={input.id}
                element={{
                  ...input,
                  value: values[input.id],
                  onChange: handleChange,
                  setField: setFieldValue
                }}
              />
            ))}
          </div>
        )}
        <DialogFooter>
          {!hasOnlyReadOnlyInformationalInputs ? (
            <>
              <Button variant="outline" onClick={handleReset}>
                <Translator path="common.actions.reset" />
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" onClick={() => handleClose(false)}>
                <Translator path="common.actions.cancel" />
              </Button>
            </>
          ) : null}
          <Button onClick={handlePrimaryAction} id="confirm" autoFocus>
            <Translator path="common.actions.confirm" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
