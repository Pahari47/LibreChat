import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createContactMethods, type ContactMethods } from './contact';
import type * as t from '~/types';

jest.setTimeout(10 * 60 * 1000);

describe('Contact Methods', () => {
  let mongoServer: MongoMemoryServer;
  let contactMethods: ContactMethods;
  let Contact: mongoose.Model<t.IContact>;
  const userId = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());

    const contactSchema = new mongoose.Schema<t.IContact>(
      {
        userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
        name: { type: String, required: true, trim: true },
        company: { type: String, trim: true },
        role: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true },
        notes: { type: String, trim: true },
        attributes: { type: Map, of: String, default: {} },
        attributes_search: { type: String, default: '' },
      },
      { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
    );

    Contact =
      mongoose.models.Contact || mongoose.model<t.IContact>('Contact', contactSchema, 'contacts');
    contactMethods = createContactMethods(mongoose);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    await Contact.deleteMany({});
  });

  it('indexes attributes into attributes_search on create', async () => {
    const contact = await contactMethods.createContact({
      userId,
      name: 'John Doe',
      company: 'Acme',
      role: 'CTO',
      attributes: {
        Industry: 'AI Infrastructure',
        Location: 'San Francisco',
      },
    });

    expect(contact.attributes_search).toContain('Industry AI Infrastructure');
    expect(contact.attributes_search).toContain('Location San Francisco');
  });

  it('returns relevant contacts for attribute query', async () => {
    await contactMethods.createContact({
      userId,
      name: 'John Doe',
      attributes: { Industry: 'AI Infrastructure' },
    });
    await contactMethods.createContact({
      userId,
      name: 'Jane Roe',
      attributes: { Industry: 'Fintech' },
    });

    const results = await contactMethods.getRelevantContacts({
      userId,
      query: 'AI Infrastructure',
    });

    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('John Doe');
  });

  it('searches across core fields and respects limit', async () => {
    await contactMethods.createContact({
      userId,
      name: 'Alex One',
      company: 'Stripe',
      role: 'Engineer',
    });
    await contactMethods.createContact({
      userId,
      name: 'Alex Two',
      company: 'Stripe',
      role: 'Designer',
    });
    await contactMethods.createContact({
      userId,
      name: 'Alex Three',
      company: 'Stripe',
      role: 'PM',
    });

    const results = await contactMethods.getRelevantContacts({
      userId,
      query: 'Stripe',
      limit: 2,
    });

    expect(results).toHaveLength(2);
    expect(results.every((contact) => contact.company === 'Stripe')).toBe(true);
  });

  it('matches natural-language questions by tokenized query terms', async () => {
    await contactMethods.createContact({
      userId,
      name: 'Anmol Bhandari',
      email: 'anmol@example.com',
      notes: 'Lead',
    });

    const results = await contactMethods.getRelevantContacts({
      userId,
      query: "What is Anmol Bhandari's email from my contacts?",
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('Anmol Bhandari');
  });

  it('prioritizes exact full-name match over partial matches', async () => {
    await contactMethods.createContact({
      userId,
      name: 'Parth Naik',
      email: 'naik@example.com',
    });
    await contactMethods.createContact({
      userId,
      name: 'Parth Bora',
      email: 'bora@example.com',
    });
    await contactMethods.createContact({
      userId,
      name: 'Parth Dixit',
      email: 'dixit@example.com',
      attributes: { company_name: 'Maharaj-Basu' },
    });

    const results = await contactMethods.getRelevantContacts({
      userId,
      query: 'what do we know about Parth Dixit?',
      limit: 5,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('Parth Dixit');
  });
});
