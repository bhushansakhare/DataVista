import mongoose from 'mongoose';

const planSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, unique: true, trim: true },
    slug:        { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    price:       { type: Number, default: 0 },        // in the smallest currency unit (cents / paise)
    currency:    { type: String, default: 'USD' },
    period:      { type: String, enum: ['month', 'year', 'one_time'], default: 'month' },
    description: { type: String, default: '' },
    features:    { type: [String], default: [] },
    credits:     { type: Number, default: 0 },        // monthly credit allotment
    dashboardLimit: { type: Number, default: 0 },     // 0 = unlimited
    isPublic:    { type: Boolean, default: true },    // shown on /pricing
    isDefault:   { type: Boolean, default: false },   // assigned to new signups when no plan picked
    sortOrder:   { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('Plan', planSchema);
