import { Schema } from 'mongoose';
import type { IContact } from '~/types';

const contactSchema = new Schema<IContact>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    company: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    role: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    email: {
      type: String,
      trim: true,
      maxlength: 500,
      lowercase: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 20000,
    },
    attributes: {
      type: Map,
      of: String,
      default: {},
    },
    attributes_search: {
      type: String,
      default: '',
    },
    tenantId: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  },
);

contactSchema.index({ userId: 1, name: 1 });
contactSchema.index({ userId: 1, company: 1 });
contactSchema.index({ userId: 1, role: 1 });
contactSchema.index({ userId: 1, email: 1 });
contactSchema.index({ userId: 1, attributes_search: 1 });

export default contactSchema;

