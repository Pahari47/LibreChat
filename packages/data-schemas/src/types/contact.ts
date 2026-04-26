import type { Document, Types } from 'mongoose';

export type ContactAttributes = Record<string, string>;

export interface Contact {
  userId: Types.ObjectId;
  name: string;
  company?: string;
  role?: string;
  email?: string;
  notes?: string;
  attributes?: ContactAttributes;
  created_at?: Date;
  updated_at?: Date;
  tenantId?: string;
}

export interface IContact extends Contact, Document {}

export interface IContactLean extends Contact {
  _id: Types.ObjectId;
  __v?: number;
}

export interface CreateContactParams {
  userId: string | Types.ObjectId;
  name: string;
  company?: string;
  role?: string;
  email?: string;
  notes?: string;
  attributes?: ContactAttributes;
}

export interface UpdateContactParams {
  userId: string | Types.ObjectId;
  contactId: string | Types.ObjectId;
  name?: string;
  company?: string;
  role?: string;
  email?: string;
  notes?: string;
  attributes?: ContactAttributes;
}

export interface DeleteContactParams {
  userId: string | Types.ObjectId;
  contactId: string | Types.ObjectId;
}

export interface ContactListParams {
  userId: string | Types.ObjectId;
  search?: string;
  company?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export interface BulkContactInput {
  userId: string | Types.ObjectId;
  name: string;
  company?: string;
  role?: string;
  email?: string;
  notes?: string;
  attributes?: ContactAttributes;
}

export interface BulkUpsertContactsParams {
  userId: string | Types.ObjectId;
  contacts: BulkContactInput[];
}

export interface ContactListResult {
  contacts: IContactLean[];
  total: number;
  page: number;
  limit: number;
  hasNextPage: boolean;
}

