import React, { useMemo, useState } from 'react';
import {
  Button,
  Input,
  Label,
  OGDialog,
  OGDialogTemplate,
  Spinner,
  useToastContext,
} from '@librechat/client';
import { useCreateContactMutation } from '~/data-provider';
import { useLocalize } from '~/hooks';

interface ContactCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

const parseAttributes = (input: string): Record<string, string> | undefined => {
  const lines = input
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return undefined;
  }

  const attributes = lines.reduce<Record<string, string>>((acc, line) => {
    const separatorIndex = line.indexOf(':');
    if (separatorIndex <= 0) {
      return acc;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key || !value) {
      return acc;
    }

    acc[key] = value;
    return acc;
  }, {});

  return Object.keys(attributes).length > 0 ? attributes : undefined;
};

export default function ContactCreateDialog({
  open,
  onOpenChange,
  children,
}: ContactCreateDialogProps) {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [attributesText, setAttributesText] = useState('');

  const createContactMutation = useCreateContactMutation({
    onSuccess: () => {
      showToast({ status: 'success', message: localize('com_ui_contact_created') });
      onOpenChange(false);
      setName('');
      setCompany('');
      setRole('');
      setEmail('');
      setNotes('');
      setAttributesText('');
    },
    onError: (error: Error) => {
      showToast({ status: 'error', message: error.message || localize('com_ui_error') });
    },
  });

  const canSubmit = useMemo(() => name.trim().length > 0, [name]);

  const handleCreate = () => {
    if (!canSubmit) {
      return;
    }

    createContactMutation.mutate({
      name: name.trim(),
      company: company.trim() || undefined,
      role: role.trim() || undefined,
      email: email.trim() || undefined,
      notes: notes.trim() || undefined,
      attributes: parseAttributes(attributesText),
    });
  };

  return (
    <OGDialog open={open} onOpenChange={onOpenChange}>
      {children}
      <OGDialogTemplate
        title={localize('com_ui_create_contact')}
        showCloseButton={false}
        className="w-11/12 md:max-w-xl"
        main={
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="contact-name">{localize('com_ui_name')}</Label>
              <Input
                id="contact-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={localize('com_ui_contact_name_placeholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label htmlFor="contact-company">{localize('com_ui_company')}</Label>
                <Input
                  id="contact-company"
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  placeholder={localize('com_ui_contact_company_placeholder')}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-role">{localize('com_ui_role')}</Label>
                <Input
                  id="contact-role"
                  value={role}
                  onChange={(event) => setRole(event.target.value)}
                  placeholder={localize('com_ui_contact_role_placeholder')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">{localize('com_ui_email')}</Label>
              <Input
                id="contact-email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={localize('com_ui_contact_email_placeholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-notes">{localize('com_ui_notes')}</Label>
              <textarea
                id="contact-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="min-h-[90px] w-full resize-none rounded-lg border border-border-light bg-transparent px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-heavy"
                placeholder={localize('com_ui_contact_notes_placeholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-attributes">{localize('com_ui_contact_attributes')}</Label>
              <textarea
                id="contact-attributes"
                value={attributesText}
                onChange={(event) => setAttributesText(event.target.value)}
                className="min-h-[90px] w-full resize-none rounded-lg border border-border-light bg-transparent px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border-heavy"
                placeholder={localize('com_ui_contact_attributes_placeholder')}
              />
            </div>
          </div>
        }
        buttons={
          <Button
            type="button"
            variant="submit"
            onClick={handleCreate}
            disabled={!canSubmit || createContactMutation.isLoading}
            className="text-white"
          >
            {createContactMutation.isLoading ? (
              <Spinner className="size-4" />
            ) : (
              localize('com_ui_create')
            )}
          </Button>
        }
      />
    </OGDialog>
  );
}
