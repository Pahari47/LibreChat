const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const express = require('express');
const { parse } = require('csv-parse');
const { logger, isValidObjectIdString } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');
const {
  createContact,
  getContactById,
  listContacts,
  updateContact,
  deleteContact,
  bulkUpsertContacts,
} = require('~/models');

const router = express.Router();
const payloadLimit = express.json({ limit: '1mb' });
const importChunkSize = 1000;
const importTempRoot = path.join(os.tmpdir(), 'librechat-contacts-import');
const fieldAliases = {
  id: ['id', 'contact_id'],
  name: ['name', 'full_name', 'contact_name'],
  company: ['company', 'organization', 'org'],
  role: ['role', 'title', 'job_title', 'position'],
  email: ['email', 'email_address', 'work_email'],
  notes: ['notes', 'note', 'description'],
  created_at: ['created_at', 'createdat', 'created_on'],
  updated_at: ['updated_at', 'updatedat', 'updated_on'],
  first_name: ['first_name', 'firstname', 'first'],
  last_name: ['last_name', 'lastname', 'last'],
};
const aliasFieldSet = new Set(Object.values(fieldAliases).flat());

const normalizeHeader = (value) => {
  if (!value) {
    return '';
  }
  return String(value).trim().toLowerCase().replace(/\s+/g, '_');
};

const normalizeValue = (value) => {
  if (value == null) {
    return undefined;
  }
  const stringValue = String(value).trim();
  return stringValue.length > 0 ? stringValue : undefined;
};

const getFieldValue = (record, aliases = []) => {
  for (const alias of aliases) {
    const value = normalizeValue(record[alias]);
    if (value) {
      return value;
    }
  }
  return undefined;
};

const mapRecordToContact = (record) => {
  const nameFromField = getFieldValue(record, fieldAliases.name);
  const firstName = getFieldValue(record, fieldAliases.first_name);
  const lastName = getFieldValue(record, fieldAliases.last_name);
  const fullNameFromParts = [firstName, lastName].filter(Boolean).join(' ').trim();
  const name = nameFromField || (fullNameFromParts.length > 0 ? fullNameFromParts : undefined);
  if (!name) {
    return null;
  }

  const attributes = Object.entries(record).reduce((acc, [key, value]) => {
    if (aliasFieldSet.has(key)) {
      return acc;
    }

    const normalized = normalizeValue(value);
    if (normalized == null) {
      return acc;
    }

    acc[key] = normalized;
    return acc;
  }, {});

  return {
    name,
    company: getFieldValue(record, fieldAliases.company),
    role: getFieldValue(record, fieldAliases.role),
    email: getFieldValue(record, fieldAliases.email),
    notes: getFieldValue(record, fieldAliases.notes),
    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
  };
};

const csvUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(importTempRoot)) {
        fs.mkdirSync(importTempRoot, { recursive: true });
      }
      cb(null, importTempRoot);
    },
    filename: (_req, file, cb) => {
      const extension = path.extname(file.originalname ?? '').toLowerCase() || '.csv';
      cb(null, `${crypto.randomUUID()}${extension}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const fileExt = path.extname(file.originalname ?? '').toLowerCase();
    const isCsvMime = file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel';
    if (isCsvMime || fileExt === '.csv') {
      cb(null, true);
      return;
    }
    cb(new Error('Only CSV files are allowed'));
  },
});

router.use(requireJwtAuth);

router.get('/', async (req, res) => {
  const page = Number.parseInt(String(req.query.page ?? '1'), 10);
  const limit = Number.parseInt(String(req.query.limit ?? '50'), 10);
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const company = typeof req.query.company === 'string' ? req.query.company : undefined;
  const role = typeof req.query.role === 'string' ? req.query.role : undefined;

  try {
    const result = await listContacts({
      userId: req.user.id,
      page,
      limit,
      search,
      company,
      role,
    });

    res.status(200).json(result);
  } catch (error) {
    logger.error('[GET /api/contacts] Error listing contacts', error);
    res.status(500).json({ error: 'Failed to list contacts' });
  }
});

router.get('/:contactId', async (req, res) => {
  const { contactId } = req.params;
  if (!isValidObjectIdString(contactId)) {
    return res.status(400).json({ error: 'Invalid contactId' });
  }

  try {
    const contact = await getContactById(req.user.id, contactId);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.status(200).json(contact);
  } catch (error) {
    logger.error('[GET /api/contacts/:contactId] Error getting contact', error);
    res.status(500).json({ error: 'Failed to get contact' });
  }
});

router.post('/', payloadLimit, async (req, res) => {
  const { name, company, role, email, notes, attributes } = req.body ?? {};

  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name is required and must be a non-empty string' });
  }

  if (attributes != null && (typeof attributes !== 'object' || Array.isArray(attributes))) {
    return res.status(400).json({ error: 'attributes must be an object when provided' });
  }

  try {
    const contact = await createContact({
      userId: req.user.id,
      name,
      company: typeof company === 'string' ? company : undefined,
      role: typeof role === 'string' ? role : undefined,
      email: typeof email === 'string' ? email : undefined,
      notes: typeof notes === 'string' ? notes : undefined,
      attributes,
    });

    res.status(201).json(contact);
  } catch (error) {
    logger.error('[POST /api/contacts] Error creating contact', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

router.patch('/:contactId', payloadLimit, async (req, res) => {
  const { contactId } = req.params;
  if (!isValidObjectIdString(contactId)) {
    return res.status(400).json({ error: 'Invalid contactId' });
  }

  const { name, company, role, email, notes, attributes } = req.body ?? {};
  if (attributes != null && (typeof attributes !== 'object' || Array.isArray(attributes))) {
    return res.status(400).json({ error: 'attributes must be an object when provided' });
  }

  try {
    const contact = await updateContact({
      userId: req.user.id,
      contactId,
      name: typeof name === 'string' ? name : undefined,
      company: typeof company === 'string' ? company : undefined,
      role: typeof role === 'string' ? role : undefined,
      email: typeof email === 'string' ? email : undefined,
      notes: typeof notes === 'string' ? notes : undefined,
      attributes,
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.status(200).json(contact);
  } catch (error) {
    if (error?.message === 'Contact name cannot be empty') {
      return res.status(400).json({ error: error.message });
    }
    logger.error('[PATCH /api/contacts/:contactId] Error updating contact', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

router.delete('/:contactId', async (req, res) => {
  const { contactId } = req.params;
  if (!isValidObjectIdString(contactId)) {
    return res.status(400).json({ error: 'Invalid contactId' });
  }

  try {
    const deleted = await deleteContact({ userId: req.user.id, contactId });
    if (!deleted) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.status(200).json({ deleted: true });
  } catch (error) {
    logger.error('[DELETE /api/contacts/:contactId] Error deleting contact', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

router.post('/import', csvUpload.single('file'), async (req, res) => {
  if (!req.file || !req.file.path) {
    return res.status(400).json({ error: 'CSV file is required' });
  }
  const parser = parse({
    columns: (header) => header.map(normalizeHeader),
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  const contactsBatch = [];
  let processedRows = 0;
  let importedRows = 0;
  let skippedRows = 0;
  let upsertedCount = 0;
  let matchedCount = 0;

  const flushBatch = async () => {
    if (contactsBatch.length === 0) {
      return;
    }

    const result = await bulkUpsertContacts({
      userId: req.user.id,
      contacts: contactsBatch.splice(0, contactsBatch.length),
    });
    upsertedCount += result.upsertedCount;
    matchedCount += result.matchedCount;
  };

  try {
    fs.createReadStream(req.file.path).pipe(parser);

    for await (const record of parser) {
      processedRows += 1;
      const contact = mapRecordToContact(record);
      if (!contact) {
        skippedRows += 1;
        continue;
      }

      contactsBatch.push(contact);
      importedRows += 1;

      if (contactsBatch.length >= importChunkSize) {
        await flushBatch();
      }
    }

    await flushBatch();

    res.status(201).json({
      message: 'Contacts imported successfully',
      stats: {
        processedRows,
        importedRows,
        skippedRows,
        upsertedCount,
        matchedCount,
      },
    });
  } catch (error) {
    logger.error('[POST /api/contacts/import] CSV import failed', error);
    res.status(500).json({ error: 'Failed to import contacts CSV' });
  } finally {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlink(req.file.path, (unlinkError) => {
        if (unlinkError) {
          logger.warn('[POST /api/contacts/import] Failed to remove temp file', unlinkError);
        }
      });
    }
  }
});

module.exports = router;
