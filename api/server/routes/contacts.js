const path = require('path');
const fs = require('fs');
const multer = require('multer');
const express = require('express');
const { logger, isValidObjectIdString } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');
const {
  createContact,
  getContactById,
  listContacts,
  updateContact,
  deleteContact,
} = require('~/models');

const router = express.Router();
const payloadLimit = express.json({ limit: '1mb' });

const csvUpload = multer({
  storage: multer.memoryStorage(),
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
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ error: 'CSV file is required' });
  }

  const userTempDir = path.join(process.cwd(), 'api', 'data', 'contacts-import', req.user.id);
  try {
    if (!fs.existsSync(userTempDir)) {
      fs.mkdirSync(userTempDir, { recursive: true });
    }
  } catch (error) {
    logger.warn('[POST /api/contacts/import] Could not prepare temp directory', error);
  }

  return res.status(501).json({
    error: 'CSV import pipeline is not implemented yet',
    message: 'Phase 4 will implement streaming CSV ingestion and bulk writes',
  });
});

module.exports = router;
