import { useState, useRef, type ChangeEvent, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, X, ImageIcon, Info, AlertCircle, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Donation, FoodCategory, FoodUnit, StorageType } from '../../types';

const CATEGORIES: FoodCategory[] = ['Vegetarian', 'Non-Vegetarian', 'Bakery', 'Fruits & Vegetables', 'Packaged Food', 'Other'];
const UNITS: FoodUnit[] = ['Meals', 'Kg', 'Boxes', 'Pieces'];
const STORAGE_TYPES: StorageType[] = ['Room Temperature', 'Refrigerated', 'Frozen', 'Other'];

function FormField({ label, required, children, hint }: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string;
}) {
  return (
    <div>
      <label className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export default function CreateDonation() {
  const { addDonation, showToast } = useApp();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    foodName: '',
    category: 'Vegetarian' as FoodCategory,
    quantity: '',
    unit: 'Meals' as FoodUnit,
    preparedAt: '',
    pickupDeadline: '',
    location: '',
    description: '',
    storageType: 'Room Temperature' as StorageType,
  });
  const [imagePreview, setImagePreview] = useState<string | undefined>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
  };

  const handleQuickFillDemo = () => {
    setForm({
      foodName: '50 Vegetarian Meals',
      category: 'Vegetarian',
      quantity: '50',
      unit: 'Meals',
      preparedAt: '12:30',
      pickupDeadline: '20:00',
      location: 'College Central Mess, Thapar University',
      description: 'Freshly prepared wholesome vegetarian meals with dal makhani, paneer bhurji, 4 rotis, and jeera rice. Packed in insulated food-grade trays.',
      storageType: 'Room Temperature',
    });
    setErrors({});
    showToast('info', 'Demo Preset Loaded', '50 Vegetarian Meals (Pickup before 8 PM) populated.');
  };

  const handleImage = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!form.foodName.trim()) newErrors.foodName = 'Food name is required';
    if (!form.quantity || Number(form.quantity) <= 0) newErrors.quantity = 'Enter a valid quantity';
    if (!form.pickupDeadline) newErrors.pickupDeadline = 'Pickup deadline is required';
    if (!form.location.trim()) newErrors.location = 'Location is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);

    const newDonation: Donation = {
      id: `don-${Date.now()}`,
      donorId: 'u-donor-1',
      donorName: 'Aayushi Sharma',
      donorOrganization: 'College Central Mess',
      foodName: form.foodName.trim(),
      category: form.category,
      quantity: Number(form.quantity),
      unit: form.unit,
      preparedAt: form.preparedAt || '12:30 PM',
      pickupDeadline: form.pickupDeadline.includes(':') && !form.pickupDeadline.includes('M')
        ? `${form.pickupDeadline}`
        : form.pickupDeadline,
      location: form.location.trim(),
      description: form.description.trim(),
      storageType: form.storageType,
      imagePreview,
      status: 'AVAILABLE',
      createdAt: new Date().toISOString(),
      recipientId: 'r-1',
      recipientName: 'Helping Hands Community Kitchen',
      matchScore: 94,
      distanceKm: 1.8,
    };

    // Simulate short network latency for realism
    setTimeout(() => {
      addDonation(newDonation);
      showToast(
        'success',
        'Donation Listed Successfully!',
        `${newDonation.quantity} ${newDonation.unit} of ${newDonation.foodName} is now matched with Helping Hands NGO.`
      );
      navigate('/donor');
    }, 500);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create Food Donation</h1>
          <p className="text-gray-500 mt-1">
            List surplus food to immediately trigger intelligent AI matching with community kitchens.
          </p>
        </div>
        <button
          type="button"
          onClick={handleQuickFillDemo}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-xs font-semibold transition-colors"
        >
          <Sparkles size={14} className="text-purple-600" />
          Quick Demo Preset (50 Meals)
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card p-6 space-y-4">
          <h2 className="section-title border-b border-gray-100 pb-3">Food Details</h2>

          <FormField label="Food Name" required>
            <input
              id="food-name"
              type="text"
              value={form.foodName}
              onChange={e => handleChange('foodName', e.target.value)}
              className={`input-field ${errors.foodName ? 'border-red-300 ring-1 ring-red-200' : ''}`}
              placeholder="e.g. 50 Vegetarian Meals"
            />
            {errors.foodName && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.foodName}
              </p>
            )}
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Category" required>
              <select
                id="category"
                value={form.category}
                onChange={e => handleChange('category', e.target.value as FoodCategory)}
                className="input-field"
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </FormField>

            <FormField label="Storage">
              <select
                id="storage-type"
                value={form.storageType}
                onChange={e => handleChange('storageType', e.target.value as StorageType)}
                className="input-field"
              >
                {STORAGE_TYPES.map(s => <option key={s}>{s}</option>)}
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Quantity" required>
              <div className="flex gap-2">
                <input
                  id="quantity"
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={e => handleChange('quantity', e.target.value)}
                  className={`input-field flex-1 ${errors.quantity ? 'border-red-300 ring-1 ring-red-200' : ''}`}
                  placeholder="50"
                />
                <select
                  id="unit"
                  value={form.unit}
                  onChange={e => handleChange('unit', e.target.value as FoodUnit)}
                  className="input-field w-28"
                >
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              {errors.quantity && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.quantity}
                </p>
              )}
            </FormField>

            <FormField label="Preparation Time">
              <input
                id="prepared-at"
                type="time"
                value={form.preparedAt}
                onChange={e => handleChange('preparedAt', e.target.value)}
                className="input-field"
              />
            </FormField>
          </div>

          <FormField label="Pickup Deadline" required hint="Must be collected before this time to guarantee freshness">
            <input
              id="pickup-deadline"
              type="time"
              value={form.pickupDeadline}
              onChange={e => handleChange('pickupDeadline', e.target.value)}
              className={`input-field ${errors.pickupDeadline ? 'border-red-300 ring-1 ring-red-200' : ''}`}
            />
            {errors.pickupDeadline && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.pickupDeadline}
              </p>
            )}
          </FormField>
        </div>

        {/* Location & Description */}
        <div className="card p-6 space-y-4">
          <h2 className="section-title border-b border-gray-100 pb-3">Location & Handling Instructions</h2>

          <FormField label="Pickup Location" required>
            <input
              id="location"
              type="text"
              value={form.location}
              onChange={e => handleChange('location', e.target.value)}
              className={`input-field ${errors.location ? 'border-red-300 ring-1 ring-red-200' : ''}`}
              placeholder="College Central Mess, Thapar University"
            />
            {errors.location && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.location}
              </p>
            )}
          </FormField>

          <FormField label="Description">
            <textarea
              id="description"
              value={form.description}
              onChange={e => handleChange('description', e.target.value)}
              rows={3}
              className="input-field resize-none"
              placeholder="Specific dish items, allergen warnings, or gate entry instructions for couriers."
            />
          </FormField>
        </div>

        {/* Image Upload */}
        <div className="card p-6 space-y-4">
          <h2 className="section-title border-b border-gray-100 pb-3">Food Photo (Optional)</h2>

          {imagePreview ? (
            <div className="relative">
              <img
                src={imagePreview}
                alt="Food preview"
                className="w-full h-48 object-cover rounded-xl border border-gray-200"
              />
              <button
                type="button"
                onClick={() => { setImagePreview(undefined); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full shadow-md flex items-center justify-center hover:bg-red-50"
              >
                <X size={14} className="text-gray-600" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center gap-3 hover:border-emerald-400 hover:bg-emerald-50 transition-colors group"
            >
              <div className="w-12 h-12 bg-gray-100 group-hover:bg-emerald-100 rounded-xl flex items-center justify-center transition-colors">
                <Upload size={22} className="text-gray-400 group-hover:text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">Upload food photo</p>
                <p className="text-xs text-gray-400 mt-0.5">PNG, JPG up to 10 MB</p>
              </div>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImage}
            className="hidden"
            id="food-image"
          />

          {/* AI Feature Callout */}
          <div className="flex items-start gap-2.5 p-3 bg-purple-50 border border-purple-100 rounded-lg">
            <ImageIcon size={16} className="text-purple-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-purple-700">Future Intelligence Feature</p>
              <p className="text-xs text-purple-600 mt-0.5">
                AI computer vision will automatically recognize dish categories, estimate portion volumes, and score freshness from images.
              </p>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            id="btn-submit-donation"
            type="submit"
            disabled={isSubmitting}
            className="btn-primary px-8 py-3 text-sm font-semibold"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Matching with NGO…
              </span>
            ) : (
              'Create Donation'
            )}
          </button>
          <button
            type="button"
            onClick={() => navigate('/donor')}
            className="btn-secondary"
          >
            Cancel
          </button>
        </div>

        <div className="flex items-start gap-2 text-xs text-gray-400 pb-4">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>
            Upon listing, FoodLink AI will instantly calculate distance and capacity utility scores to notify the best recipient organization.
          </span>
        </div>
      </form>
    </div>
  );
}
