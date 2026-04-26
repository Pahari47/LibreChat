import { useMemo, useRef, useState } from 'react';
import { matchSorter } from 'match-sorter';
import { Download, Plus } from 'lucide-react';
import type { TContact } from 'librechat-data-provider';
import {
  Button,
  FilterInput,
  OGDialogTrigger,
  Spinner,
  TooltipAnchor,
  useToastContext,
} from '@librechat/client';
import {
  useContactsQuery,
  useDeleteContactMutation,
  useImportContactsMutation,
} from '~/data-provider';
import { useLocalize } from '~/hooks';
import ContactCreateDialog from './ContactCreateDialog';

const pageSize = 25;

const getDisplayName = (contact: TContact) => {
  if (contact.company && contact.role) {
    return `${contact.name} - ${contact.role} @ ${contact.company}`;
  }
  if (contact.company) {
    return `${contact.name} @ ${contact.company}`;
  }
  if (contact.role) {
    return `${contact.name} - ${contact.role}`;
  }
  return contact.name;
};

export default function ContactsPanel() {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const { data, isLoading, isFetching } = useContactsQuery({ page, limit: pageSize });
  const contacts = data?.contacts ?? [];
  const totalPages = useMemo(() => {
    if (!data) {
      return 1;
    }
    return Math.max(1, Math.ceil(data.total / data.limit));
  }, [data]);

  const filteredContacts = useMemo(() => {
    return matchSorter(contacts, searchQuery, {
      keys: ['name', 'company', 'role', 'email', 'notes'],
    });
  }, [contacts, searchQuery]);

  const selectedContact = useMemo(() => {
    if (!selectedContactId) {
      return null;
    }
    return filteredContacts.find((contact) => contact._id === selectedContactId) ?? null;
  }, [filteredContacts, selectedContactId]);

  const deleteMutation = useDeleteContactMutation({
    onSuccess: () => {
      showToast({ status: 'success', message: localize('com_ui_contact_deleted') });
      setSelectedContactId(null);
    },
    onError: () => {
      showToast({ status: 'error', message: localize('com_ui_error') });
    },
  });

  const importMutation = useImportContactsMutation({
    onSuccess: (result) => {
      showToast({ status: 'success', message: result.message });
    },
    onError: (error: Error) => {
      showToast({ status: 'error', message: error.message || localize('com_ui_error') });
    },
  });

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    importMutation.mutate(formData);
    event.target.value = '';
  };

  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col px-3 pb-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FilterInput
            inputId="contacts-search"
            label={localize('com_ui_contacts_filter')}
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            containerClassName="flex-1"
          />
          <ContactCreateDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <OGDialogTrigger asChild>
              <TooltipAnchor
                description={localize('com_ui_create_contact')}
                side="bottom"
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 bg-transparent"
                    aria-label={localize('com_ui_create_contact')}
                    onClick={() => setCreateDialogOpen(true)}
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </Button>
                }
              />
            </OGDialogTrigger>
          </ContactCreateDialog>
          <TooltipAnchor
            description={localize('com_ui_contacts_import_csv')}
            side="bottom"
            render={
              <Button
                variant="outline"
                size="icon"
                className="size-9 shrink-0 bg-transparent"
                aria-label={localize('com_ui_contacts_import_csv')}
                onClick={handleImportClick}
                disabled={importMutation.isLoading}
              >
                {importMutation.isLoading ? (
                  <Spinner className="size-4" />
                ) : (
                  <Download className="size-4" aria-hidden="true" />
                )}
              </Button>
            }
          />
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>

        <div className="grid min-h-[320px] grid-cols-2 gap-2">
          <div className="space-y-1 overflow-auto rounded-lg border border-border-light p-2">
            {filteredContacts.length === 0 ? (
              <p className="text-sm text-text-secondary">{localize('com_ui_no_contacts')}</p>
            ) : (
              filteredContacts.map((contact) => (
                <button
                  key={contact._id}
                  type="button"
                  className={`w-full rounded-md px-2 py-2 text-left text-sm transition hover:bg-surface-hover ${
                    selectedContactId === contact._id ? 'bg-surface-hover' : ''
                  }`}
                  onClick={() => setSelectedContactId(contact._id)}
                >
                  {getDisplayName(contact)}
                </button>
              ))
            )}
          </div>

          <div className="overflow-auto rounded-lg border border-border-light p-3">
            {!selectedContact ? (
              <p className="text-sm text-text-secondary">{localize('com_ui_select_contact')}</p>
            ) : (
              <div className="space-y-2 text-sm">
                <p className="text-base font-semibold">{selectedContact.name}</p>
                {selectedContact.company ? (
                  <p>{`${localize('com_ui_company')}: ${selectedContact.company}`}</p>
                ) : null}
                {selectedContact.role ? (
                  <p>{`${localize('com_ui_role')}: ${selectedContact.role}`}</p>
                ) : null}
                {selectedContact.email ? (
                  <p>{`${localize('com_ui_email')}: ${selectedContact.email}`}</p>
                ) : null}
                {selectedContact.notes ? (
                  <p>{`${localize('com_ui_notes')}: ${selectedContact.notes}`}</p>
                ) : null}
                {selectedContact.attributes &&
                Object.keys(selectedContact.attributes).length > 0 ? (
                  <div>
                    <p className="font-medium">{localize('com_ui_contact_attributes')}</p>
                    <div className="mt-1 space-y-1">
                      {Object.entries(selectedContact.attributes).map(([key, value]) => (
                        <p key={`${selectedContact._id}-${key}`}>{`${key}: ${value}`}</p>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteMutation.mutate(selectedContact._id)}
                    disabled={deleteMutation.isLoading}
                    aria-label={localize('com_ui_delete_contact')}
                  >
                    {localize('com_ui_delete_contact')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-text-secondary">
            {isFetching
              ? localize('com_ui_loading')
              : `${data?.total ?? 0} ${localize('com_ui_contacts')}`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={page <= 1}
            >
              {localize('com_ui_prev')}
            </Button>
            <span className="text-xs text-text-secondary">
              {page} / {totalPages}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={page >= totalPages}
            >
              {localize('com_ui_next')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
