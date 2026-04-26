import { Types } from 'mongoose';
import type { AnyBulkWriteOperation, Model, RootFilterQuery } from 'mongoose';
import type * as t from '~/types';

const defaultPage = 1;
const defaultLimit = 50;
const maxLimit = 500;

const normalizePage = (page?: number): number => {
  if (!page || page < 1) {
    return defaultPage;
  }
  return page;
};

const normalizeLimit = (limit?: number): number => {
  if (!limit || limit < 1) {
    return defaultLimit;
  }
  return Math.min(limit, maxLimit);
};

const normalizeRegex = (value?: string): RegExp | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
};

const normalizeAttributes = (attributes?: t.ContactAttributes): t.ContactAttributes | undefined => {
  if (!attributes) {
    return undefined;
  }
  const entries = Object.entries(attributes)
    .map(([key, value]) => [key.trim(), value.trim()] as const)
    .filter(([key, value]) => key.length > 0 && value.length > 0);

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
};

export function createContactMethods(mongoose: typeof import('mongoose')) {
  const Contact = mongoose.models.Contact as Model<t.IContact>;

  async function createContact(params: t.CreateContactParams): Promise<t.IContactLean> {
    const name = params.name.trim();
    if (!name) {
      throw new Error('Contact name is required');
    }

    const created = await Contact.create({
      userId: params.userId,
      name,
      company: params.company?.trim() || undefined,
      role: params.role?.trim() || undefined,
      email: params.email?.trim().toLowerCase() || undefined,
      notes: params.notes?.trim() || undefined,
      attributes: normalizeAttributes(params.attributes),
    });

    return created.toObject() as t.IContactLean;
  }

  async function getContactById(
    userId: string | Types.ObjectId,
    contactId: string | Types.ObjectId,
  ): Promise<t.IContactLean | null> {
    return (await Contact.findOne({ _id: contactId, userId }).lean()) as t.IContactLean | null;
  }

  async function listContacts(params: t.ContactListParams): Promise<t.ContactListResult> {
    const page = normalizePage(params.page);
    const limit = normalizeLimit(params.limit);
    const skip = (page - 1) * limit;

    const filter: RootFilterQuery<t.IContact> = {
      userId: params.userId,
    };

    const companyRegex = normalizeRegex(params.company);
    if (companyRegex) {
      filter.company = companyRegex;
    }

    const roleRegex = normalizeRegex(params.role);
    if (roleRegex) {
      filter.role = roleRegex;
    }

    const searchRegex = normalizeRegex(params.search);
    if (searchRegex) {
      filter.$or = [
        { name: searchRegex },
        { company: searchRegex },
        { role: searchRegex },
        { email: searchRegex },
        { notes: searchRegex },
      ];
    }

    const [contacts, total] = await Promise.all([
      Contact.find(filter).sort({ updated_at: -1 }).skip(skip).limit(limit).lean<t.IContactLean[]>(),
      Contact.countDocuments(filter),
    ]);

    return {
      contacts,
      total,
      page,
      limit,
      hasNextPage: skip + contacts.length < total,
    };
  }

  async function updateContact(params: t.UpdateContactParams): Promise<t.IContactLean | null> {
    const updatePayload: Partial<t.Contact> = {};

    if (params.name !== undefined) {
      const normalizedName = params.name.trim();
      if (!normalizedName) {
        throw new Error('Contact name cannot be empty');
      }
      updatePayload.name = normalizedName;
    }
    if (params.company !== undefined) {
      updatePayload.company = params.company.trim() || undefined;
    }
    if (params.role !== undefined) {
      updatePayload.role = params.role.trim() || undefined;
    }
    if (params.email !== undefined) {
      updatePayload.email = params.email.trim().toLowerCase() || undefined;
    }
    if (params.notes !== undefined) {
      updatePayload.notes = params.notes.trim() || undefined;
    }
    if (params.attributes !== undefined) {
      updatePayload.attributes = normalizeAttributes(params.attributes);
    }

    if (Object.keys(updatePayload).length === 0) {
      return await getContactById(params.userId, params.contactId);
    }

    return (await Contact.findOneAndUpdate(
      { _id: params.contactId, userId: params.userId },
      { $set: updatePayload },
      { new: true },
    ).lean()) as t.IContactLean | null;
  }

  async function deleteContact(params: t.DeleteContactParams): Promise<boolean> {
    const result = await Contact.findOneAndDelete({ _id: params.contactId, userId: params.userId });
    return result != null;
  }

  async function bulkUpsertContacts({
    userId,
    contacts,
  }: t.BulkUpsertContactsParams): Promise<{ matchedCount: number; upsertedCount: number }> {
    if (contacts.length === 0) {
      return { matchedCount: 0, upsertedCount: 0 };
    }

    const operations: AnyBulkWriteOperation<t.IContact>[] = contacts.flatMap((contact) => {
        const normalizedName = contact.name.trim();
        if (!normalizedName) {
          return [];
        }

        const normalizedEmail = contact.email?.trim().toLowerCase() || undefined;
        const setPayload: Partial<t.Contact> = {
          name: normalizedName,
          company: contact.company?.trim() || undefined,
          role: contact.role?.trim() || undefined,
          email: normalizedEmail,
          notes: contact.notes?.trim() || undefined,
          attributes: normalizeAttributes(contact.attributes),
        };

        const identifier: RootFilterQuery<t.IContact> = normalizedEmail
          ? { userId, email: normalizedEmail, name: normalizedName }
          : { userId, name: normalizedName, company: setPayload.company ?? null };

        return [
          {
          updateOne: {
            filter: identifier,
            update: { $set: setPayload },
            upsert: true,
          },
          } satisfies AnyBulkWriteOperation<t.IContact>,
        ];
      });

    if (operations.length === 0) {
      return { matchedCount: 0, upsertedCount: 0 };
    }

    const result = await Contact.bulkWrite(operations, { ordered: false });
    return {
      matchedCount: result.matchedCount,
      upsertedCount: result.upsertedCount,
    };
  }

  return {
    createContact,
    getContactById,
    listContacts,
    updateContact,
    deleteContact,
    bulkUpsertContacts,
  };
}

export type ContactMethods = ReturnType<typeof createContactMethods>;

