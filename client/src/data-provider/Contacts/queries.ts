import { QueryKeys, MutationKeys, DynamicQueryKeys, dataService } from 'librechat-data-provider';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import type {
  UseQueryOptions,
  UseMutationOptions,
  QueryObserverResult,
} from '@tanstack/react-query';
import type {
  ContactAttributes,
  ContactImportResponse,
  ContactListParams,
  ContactListResponse,
  TContact,
} from 'librechat-data-provider';

export const useContactsQuery = (
  params: ContactListParams,
  config?: UseQueryOptions<ContactListResponse>,
): QueryObserverResult<ContactListResponse> => {
  return useQuery<ContactListResponse>(
    [QueryKeys.contacts, params],
    () => dataService.listContacts(params),
    {
      keepPreviousData: true,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
    },
  );
};

export const useContactQuery = (
  contactId: string,
  config?: UseQueryOptions<TContact>,
): QueryObserverResult<TContact> => {
  return useQuery<TContact>(
    DynamicQueryKeys.contact(contactId),
    () => dataService.getContact(contactId),
    {
      enabled: Boolean(contactId),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
    },
  );
};

export type CreateContactParams = {
  name: string;
  company?: string;
  role?: string;
  email?: string;
  notes?: string;
  attributes?: ContactAttributes;
};

export const useCreateContactMutation = (
  options?: UseMutationOptions<TContact, Error, CreateContactParams>,
) => {
  const queryClient = useQueryClient();
  return useMutation((params: CreateContactParams) => dataService.createContact(params), {
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries([QueryKeys.contacts]);
      options?.onSuccess?.(...args);
    },
  });
};

export type UpdateContactParams = {
  contactId: string;
  data: {
    name?: string;
    company?: string;
    role?: string;
    email?: string;
    notes?: string;
    attributes?: ContactAttributes;
  };
};

export const useUpdateContactMutation = (
  options?: UseMutationOptions<TContact, Error, UpdateContactParams>,
) => {
  const queryClient = useQueryClient();
  return useMutation(
    ({ contactId, data }: UpdateContactParams) => dataService.updateContact(contactId, data),
    {
      ...options,
      onSuccess: (...args) => {
        queryClient.invalidateQueries([QueryKeys.contacts]);
        options?.onSuccess?.(...args);
      },
    },
  );
};

export const useDeleteContactMutation = (options?: UseMutationOptions<void, Error, string>) => {
  const queryClient = useQueryClient();
  return useMutation((contactId: string) => dataService.deleteContact(contactId), {
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries([QueryKeys.contacts]);
      options?.onSuccess?.(...args);
    },
  });
};

export const useImportContactsMutation = (
  options?: UseMutationOptions<ContactImportResponse, Error, FormData>,
) => {
  const queryClient = useQueryClient();
  return useMutation(
    [MutationKeys.importContacts],
    (formData: FormData) => dataService.importContactsFile(formData),
    {
      ...options,
      onSuccess: (...args) => {
        queryClient.invalidateQueries([QueryKeys.contacts]);
        options?.onSuccess?.(...args);
      },
    },
  );
};
